import { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getApiUrl } from '../utils/apiConfig';
import { TABS } from './SoftwareWorkspace/types';
import WorkspaceTopbar from './SoftwareWorkspace/WorkspaceTopbar';
import EditorPanel from './SoftwareWorkspace/EditorPanel';
import ChatPanel from './SoftwareWorkspace/ChatPanel';

const CHAT_API = getApiUrl('/chat');

/**
 * SoftwareWorkspace - Main workspace component for managing SRS/SDD documents.
 * Orchestrates the chat, document generation, and editor panels.
 * Template section management is delegated to TemplatePanel via EditorPanel.
 * @param {Object} props
 * @param {Object} props.project - The active project object.
 */
export default function SoftwareWorkspace({ project: activeProject }) {
  const { srsDoc, setSrsDoc, isGenerating, setIsGenerating } = useOutletContext();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    { role: 'bot', content: 'Hi! I\'m your AI assistant. Ask me anything about your project, requirements, or SRS document.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [selectedChatBlocks, setSelectedChatBlocks] = useState([]); // State for Tiptap context sharing
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const chatRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [activeMainTab, setActiveMainTab] = useState('srs');
  const [subTab, setSubTab] = useState('document-template');
  const [chatWidth, setChatWidth] = useState(360);

  useEffect(() => {
    if (!document.getElementById('mermaid-cdn')) {
      const script = document.createElement('script');
      script.id = 'mermaid-cdn';
      script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
      script.async = true;
      script.onload = () => {
        if (window.mermaid) {
          window.mermaid.initialize({ startOnLoad: false, theme: 'default' });
        }
      };
      document.body.appendChild(script);
    }
  }, []);

  // Defensive: ensure project directories exist on the backend
  useEffect(() => {
    const projectId = activeProject?.id || activeProject?._id;
    if (projectId) {
      fetch(`${getApiUrl('/init-project')}?project_id=${projectId}`)
        .catch(() => {}); // best-effort, don't block
    }
  }, [activeProject]);

  // Auto-scroll chat messages
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages, isStreaming]);

  /**
   * Generate the SRS/SDD document via SSE stream.
   * @param {'srs' | 'sdd'} type - Document type to generate.
   */
  const handleGenerateDoc = async (type) => {
    setIsGenerating(prev => ({ ...prev, srs: true }));
    setSrsDoc('');
    try {
      const res = await fetch(getApiUrl('/generate-document-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirement_ids: [], template_type: type, project_id: activeProject?.id }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.heading) setChatMessages(prev => [...prev, { role: 'bot', content: `Building: ${data.heading}` }]);
              if (data.content) {
                setSrsDoc(prev => prev ? prev + '\n\n' + data.content : data.content);
              }
              if (data.message) setChatMessages(prev => [...prev, { role: 'bot', content: data.message }]);
            } catch (_) {}
          }
        }
      }
      setChatMessages(prev => [...prev, { role: 'bot', content: 'SRS generated successfully.' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'bot', content: 'Failed to generate SRS. Please try again.' }]);
    } finally {
      setIsGenerating(prev => ({ ...prev, srs: false }));
    }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim() || isStreaming) return;
    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsStreaming(true);

    let finalPayloadMsg = userMsg;
    if (selectedChatBlocks.length > 0) {
      const contextStr = selectedChatBlocks.join('\\n\\n');
      finalPayloadMsg = `[Context from Editor:\\n${contextStr}\\n]\\n\\n${userMsg}`;
      setSelectedChatBlocks([]);
    }

    // Create session if needed
    if (!currentSessionId) {
      setCurrentSessionId('new');
    }

    const projectId = activeProject?.id || activeProject?._id || 'default';
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch(`${CHAT_API}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: currentSessionId === 'new' ? undefined : currentSessionId,
          message: finalPayloadMsg,
          project_id: projectId,
        }),
        signal: abortController.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let linesBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        linesBuffer += decoder.decode(value, { stream: true });
        const lines = linesBuffer.split('\n');
        linesBuffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              const { type, content } = event;

              if (type === 'session_created') {
                setCurrentSessionId(event.session_id);
              } else if (type === 'text_delta') {
                setChatMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'bot' && last._streaming) {
                    return [...prev.slice(0, -1), { ...last, content: last.content + (content || '') }];
                  }
                  return [...prev, { role: 'bot', content: (content || ''), _streaming: true }];
                });
              } else if (type === 'tool_use_start') {
                setChatMessages(prev => {
                  const newPrev = [...prev];
                  const last = newPrev[newPrev.length - 1];
                  if (last?.role === 'bot' && last._streaming) {
                    // Close the streaming bot text before starting a tool execution
                    newPrev[newPrev.length - 1] = { ...last, _streaming: false };
                  }
                  return [
                    ...newPrev,
                    { role: 'tool', tool_call_id: event.tool_call_id, name: event.name, input: event.input, status: 'executing' }
                  ];
                });
              } else if (type === 'tool_use_complete') {
                setChatMessages(prev => prev.map(m => 
                  m.role === 'tool' && m.tool_call_id === event.tool_call_id 
                    ? { ...m, status: 'completed', output: event.output } 
                    : m
                ));
              } else if (type === 'tool_error') {
                setChatMessages(prev => prev.map(m => 
                  m.role === 'tool' && m.tool_call_id === event.tool_call_id 
                    ? { ...m, status: 'error', error: event.error } 
                    : m
                ));
              } else if (type === 'tool_interaction_request') {
                setChatMessages(prev => prev.map(m => 
                  m.role === 'tool' && m.tool_call_id === event.tool_call_id 
                    ? { ...m, status: 'awaiting_input', ui_type: event.ui_type, options: event.options, prompt: event.prompt } 
                    : m
                ));
              } else if (type === 'done') {
                // Finalize streaming message
                setChatMessages(prev => {
                  const last = prev[prev.length - 1];
                  if (last?.role === 'bot' && last._streaming) {
                    return [...prev.slice(0, -1), { ...last, _streaming: false }];
                  }
                  return prev;
                });
              } else if (type === 'error') {
                setChatMessages(prev => [
                  ...prev,
                  { role: 'bot', content: `Error: ${event.message}` },
                ]);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setChatMessages(prev => [
          ...prev,
          { role: 'bot', content: `Error: ${err.message}` },
        ]);
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  const handleStopChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const isGenActive = isGenerating.srs && activeMainTab === 'srs';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Geist:wght@400;500;600;700&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 99px; }
        ::-webkit-scrollbar-thumb:hover { background: #9ca3af; }
      `}</style>

      <div className="flex h-[860px] gap-0 bg-gray-50 font-sans overflow-hidden rounded-2xl border border-gray-200 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
        {/* ── Main Content ── */}
        <div className="flex flex-1 flex-col overflow-hidden min-w-0">
          {/* Topbar */}
          <WorkspaceTopbar
            TABS={TABS}
            activeMainTab={activeMainTab}
            isGenerating={isGenActive}
            onTabChange={(tab) => {
              setActiveMainTab(tab);
              if (tab !== 'srs') setSubTab('document-template');
            }}
            chatOpen={chatOpen}
            onChatToggle={() => setChatOpen(o => !o)}
          />

          {/* Workspace Row */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            <EditorPanel
              activeMainTab={activeMainTab}
              subTab={subTab}
              onSubTabChange={setSubTab}
              isFullscreen={false}
              onFullscreenToggle={() => {}}
              onGenerate={handleGenerateDoc}
              isGenActive={isGenActive}
              srsDoc={srsDoc}
              project={activeProject}
              selectedChatBlocks={selectedChatBlocks}
              setSelectedChatBlocks={setSelectedChatBlocks}
            />

            {/* Chat Panel Resizer */}
            {chatOpen && (
              <div
                className="w-1 cursor-col-resize hover:bg-primary-500/50 transition-colors bg-transparent relative z-30 group shrink-0"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = chatWidth;
                  
                  const onMouseMove = (eMove) => {
                    // Reverse the delta since the panel is on the right
                    const newWidth = Math.max(300, Math.min(800, startWidth - (eMove.clientX - startX)));
                    setChatWidth(newWidth);
                  };
                  
                  const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = 'default';
                  };
                  
                  document.addEventListener('mousemove', onMouseMove);
                  document.addEventListener('mouseup', onMouseUp);
                  document.body.style.cursor = 'col-resize';
                }}
              >
                <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary-500/10 transition-colors" />
              </div>
            )}

            {/* Chat Panel */}
            {chatOpen && (
              <ChatPanel
                width={chatWidth}
                messages={chatMessages}
                input={chatInput}
                onInputChange={setChatInput}
                onSend={handleChatSend}
                isStreaming={isStreaming}
                onStop={handleStopChat}
                selectedChatBlocks={selectedChatBlocks}
                setSelectedChatBlocks={setSelectedChatBlocks}
                onClose={() => setChatOpen(false)}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
