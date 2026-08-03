import { useState, useEffect, useRef } from "react";
import { useOutletContext } from "react-router-dom";
import { getApiUrl } from "../utils/apiConfig";
import {
  handleChatSend as utilsHandleChatSend,
  handleStopChat as utilsHandleStopChat,
  handleInteractionSubmit as utilsHandleInteractionSubmit,
} from "../utils/chatUtils";
import { TABS } from "./SoftwareWorkspace/types";
import WorkspaceTopbar from "./SoftwareWorkspace/WorkspaceTopbar";
import EditorPanel from "./SoftwareWorkspace/EditorPanel";
import ChatPanel from "./SoftwareWorkspace/ChatPanel";
import useBuildCompleteStore from "../store/buildCompleteStore";


/**
 * SoftwareWorkspace - Main workspace component for managing SRS/SDD documents.
 * Orchestrates the chat, document generation, and editor panels.
 * Template section management is delegated to TemplatePanel via EditorPanel.
 * @param {Object} props
 * @param {Object} props.project - The active project object.
 */
export default function SoftwareWorkspace({ project: activeProject }) {
  const {
    srsDoc,
    setSrsDoc,
    isGenerating,
    setIsGenerating,
    onGenerationComplete,
  } = useOutletContext();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([
    {
      role: "bot",
      content:
        "Hi! I'm your AI assistant. Ask me anything about your project, requirements, or SRS document.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [selectedChatBlocks, setSelectedChatBlocks] = useState([]); // State for Tiptap context sharing
  const [focusedChatBlock, setFocusedChatBlock] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isAwaitingUserInput, setIsAwaitingUserInput] = useState(false);
  const [pendingToolCallId, setPendingToolCallId] = useState(null);
  const chatRef = useRef(null);
  const abortControllerRef = useRef(null);

  const [activeMainTab, setActiveMainTab] = useState("srs");
  const [subTab, setSubTab] = useState("document-template");
  const [chatWidth, setChatWidth] = useState(360);

  // Auto-navigate to document generation tab when build completes
  const buildCompleteTab = useBuildCompleteStore((s) => s.activeTab);
  const [prevBuildCompleteTab, setPrevBuildCompleteTab] = useState(buildCompleteTab);

  if (buildCompleteTab !== prevBuildCompleteTab) {
    setPrevBuildCompleteTab(buildCompleteTab);
    if (buildCompleteTab) {
      setSubTab("document-generation");
    }
  }

  // Defensive: ensure project directories exist on the backend
  useEffect(() => {
    const projectId = activeProject?.id || activeProject?._id;
    if (projectId) {
      fetch(`${getApiUrl("/init-project")}?project_id=${projectId}`).catch(
        () => {},
      ); // best-effort, don't block
    }
  }, [activeProject]);

  // Auto-scroll chat messages
  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [chatMessages, isStreaming]);

  /**
   * Generate the SRS/SDD document via SSE stream.
   * @param {'srs' | 'sdd'} type - Document type to generate.
   */
  const handleGenerateDoc = async (type) => {
    setIsGenerating((prev) => ({ ...prev, srs: true }));
    setSrsDoc("");
    try {
      const res = await fetch(getApiUrl("/generate-document-stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement_ids: [],
          template_type: type,
          project_id: activeProject?.id,
        }),
      });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.heading)
                setChatMessages((prev) => [
                  ...prev,
                  { role: "bot", content: `Building: ${data.heading}` },
                ]);
              if (data.content) {
                setSrsDoc((prev) =>
                  prev ? prev + "\n\n" + data.content : data.content,
                );
              }
              if (data.message)
                setChatMessages((prev) => [
                  ...prev,
                  { role: "bot", content: data.message },
                ]);
            } catch (exception) {
              console.error(exception);
            }
          }
        }
      }
      setChatMessages((prev) => [
        ...prev,
        { role: "bot", content: "SRS generated successfully." },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "bot", content: "Failed to generate SRS. Please try again." },
      ]);
    } finally {
      setIsGenerating((prev) => ({ ...prev, srs: false }));
    }
  };

  const handleCancelGeneration = () => {
    setIsGenerating((prev) => ({ ...prev, srs: false }));
  };

  const handleChatSend = () => {
    utilsHandleChatSend({
      chatInput,
      isStreaming,
      isAwaitingUserInput,
      selectedChatBlocks,
      currentSessionId,
      activeProject,
      abortControllerRef,
      setChatInput,
      setChatMessages,
      setIsStreaming,
      setSelectedChatBlocks,
      setCurrentSessionId,
      setIsAwaitingUserInput,
      setPendingToolCallId,
    });
  };

  const handleStopChat = () => {
    utilsHandleStopChat(abortControllerRef);
  };

  const handleInteractionSubmit = (session_id, tool_call_id, response) => {
    utilsHandleInteractionSubmit({
      session_id,
      tool_call_id,
      response,
      setChatMessages,
    });
  };

  const isGenActive = isGenerating.srs && activeMainTab === "srs";

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
              if (tab !== "srs") setSubTab("document-template");
            }}
            chatOpen={chatOpen}
            onChatToggle={() => setChatOpen((o) => !o)}
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
              setSrsDoc={setSrsDoc}
              onCancel={handleCancelGeneration}
              onGenerationComplete={onGenerationComplete}
              project={activeProject}
              selectedChatBlocks={selectedChatBlocks}
              setSelectedChatBlocks={setSelectedChatBlocks}
              focusedChatBlock={focusedChatBlock}
              setFocusedChatBlock={setFocusedChatBlock}
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
                    const newWidth = Math.max(
                      300,
                      Math.min(800, startWidth - (eMove.clientX - startX)),
                    );
                    setChatWidth(newWidth);
                  };

                  const onMouseUp = () => {
                    document.removeEventListener("mousemove", onMouseMove);
                    document.removeEventListener("mouseup", onMouseUp);
                    document.body.style.cursor = "default";
                  };

                  document.addEventListener("mousemove", onMouseMove);
                  document.addEventListener("mouseup", onMouseUp);
                  document.body.style.cursor = "col-resize";
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
                setFocusedChatBlock={setFocusedChatBlock}
                onClose={() => setChatOpen(false)}
                onInteractionSubmit={handleInteractionSubmit}
                currentSessionId={currentSessionId}
                isAwaitingUserInput={isAwaitingUserInput}
                onAwaitingUserInputChange={setIsAwaitingUserInput}
                pendingToolCallId={pendingToolCallId}
                setPendingToolCallId={setPendingToolCallId}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
