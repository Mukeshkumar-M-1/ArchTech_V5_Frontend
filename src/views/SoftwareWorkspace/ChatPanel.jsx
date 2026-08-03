import {
  Bot,
  X,
  Paperclip,
  ArrowUp,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  MousePointerClick,
  Copy,
  Check,
  Plus,
  RefreshCw,
  Square,
  Code,
  MessageSquare
} from "lucide-react";
import React, { useState, useRef, useEffect } from "react";
import { C } from "./types";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function CopyButton({ text, isUser }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    const doCopy = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 500);
    };
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(doCopy).catch(doCopy);
    } else {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      doCopy();
    }
  };

  return (
    <button onClick={handleCopy} className="p-1 rounded bg-white hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors border border-slate-200 shadow-sm cursor-pointer" title="Copy message">
      {copied ? (
        <Check size={12} className="text-emerald-500" />
      ) : (
        <Copy size={12} />
      )}
    </button>
  );
}

function ToolTimelineItem({ msg, onInteractionSubmit, currentSessionId }) {
  const [expanded, setExpanded] = useState(false);
  const [interactionValue, setInteractionValue] = useState(
    msg.ui_type === "checkbox" ? [] : ""
  );

  const isExecuting = msg.status === "executing";
  const isError = msg.status === "error";
  const isCompleted = msg.status === "completed";
  const isAwaitingInput = msg.status === "awaiting_input";

  const isExpanded = expanded || isAwaitingInput || isError;

  const handleInteractionSubmit = async () => {
    if (!currentSessionId || !onInteractionSubmit) return;
    try {
      await onInteractionSubmit(currentSessionId, msg.tool_call_id, interactionValue);
      setInteractionValue(msg.ui_type === "checkbox" ? [] : "");
    } catch (err) {
      console.error('Interaction submit failed:', err);
    }
  };

  let summary = "";
  if (msg.name.includes("read") || msg.name.includes("file") || msg.name.includes("view")) {
    const target = msg.input?.TargetFile || msg.input?.AbsolutePath || msg.input?.path || msg.input?.SearchPath || "";
    summary = `Read ${target}`;
  } else if (msg.name.includes("grep") || msg.name.includes("search")) {
    summary = `Grep "${msg.input?.Query || msg.input?.query || ''}"`;
  } else if (msg.name.includes("run_command") || msg.name.includes("bash")) {
    summary = `Execute "${msg.input?.command || msg.input?.CommandLine || ''}"`;
  } else {
    summary = `${msg.name}`;
  }

  let outputSummary = "";
  if (isCompleted && msg.output) {
      const lines = msg.output.split('\n').length;
      outputSummary = `L ${lines} lines of output`;
  }

  return (
    <div className="flex flex-col gap-1 w-full max-w-full">
      <div 
        className="flex items-center gap-2 cursor-pointer select-none group"
        onClick={() => setExpanded(!expanded)}
      >
        <span className="font-semibold text-slate-700 text-[13px] group-hover:text-slate-900 transition-colors break-all">
          {summary}
        </span>
        {isCompleted && !expanded && outputSummary && (
          <span className="text-[11px] text-slate-400 group-hover:text-slate-500">{outputSummary}</span>
        )}
        {isExecuting && (
          <span className="text-[11px] text-primary-500 font-medium">Running...</span>
        )}
        <div className="text-slate-300 group-hover:text-slate-400">
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-1 bg-white border border-slate-200 rounded-lg p-2.5 shadow-sm overflow-x-auto text-[11px] font-mono text-slate-600">
           <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1 font-sans font-bold">Parameters</div>
           <pre className="whitespace-pre-wrap mb-2 text-[10px] bg-slate-50 p-2 rounded border border-slate-100">{JSON.stringify(msg.input, null, 2)}</pre>
           
           {isCompleted && msg.output && (
             <>
               <div className="text-[9px] uppercase tracking-wider text-slate-400 mb-1 font-sans font-bold mt-2 pt-2 border-t border-slate-100">Output</div>
               <pre className="whitespace-pre-wrap max-h-48 overflow-y-auto text-[10px] bg-slate-900 text-slate-200 p-2 rounded">{msg.output}</pre>
             </>
           )}

           {isAwaitingInput && (
            <div className="mt-2.5 mb-1 bg-amber-50 border border-amber-200/50 rounded-lg p-3 font-sans">
              <div className="text-[12px] font-semibold text-slate-800 mb-2.5">
                {msg.prompt || "Please select an option:"}
              </div>

              {msg.ui_type === "select" && (
                <div className="flex flex-col gap-2">
                  <select
                    className="w-full bg-white border border-slate-300 text-slate-700 text-[12px] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer shadow-sm"
                    value={interactionValue}
                    onChange={(e) => setInteractionValue(e.target.value)}
                  >
                    <option value="" disabled>Select an option...</option>
                    {(msg.input?.options || msg.options || []).map((opt, idx) => (
                      <option key={idx} value={opt}>{opt}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleInteractionSubmit}
                    disabled={!interactionValue}
                    className="self-end mt-1.5 px-4 py-1.5 bg-primary-600 text-white text-[12px] font-semibold rounded-md shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Submit Choice
                  </button>
                </div>
              )}

              {msg.ui_type === "radio" && (
                <div className="flex flex-col gap-2.5">
                  {(msg.input?.options || msg.options || []).map((opt, idx) => (
                    <label key={idx} className="flex items-center gap-2.5 cursor-pointer group px-1">
                      <input
                        type="radio"
                        name={`tool-radio-${msg.tool_call_id}`}
                        value={opt}
                        checked={interactionValue === opt}
                        onChange={(e) => setInteractionValue(e.target.value)}
                        className="w-3.5 h-3.5 text-primary-600 border-slate-300 focus:ring-primary-500 cursor-pointer"
                      />
                      <span className="text-[12px] text-slate-700 group-hover:text-slate-900 transition-colors font-medium">
                        {opt}
                      </span>
                    </label>
                  ))}
                  <button
                    onClick={handleInteractionSubmit}
                    disabled={!interactionValue}
                    className="self-end mt-1.5 px-4 py-1.5 bg-primary-600 text-white text-[12px] font-semibold rounded-md shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Submit Choice
                  </button>
                </div>
              )}

              {msg.ui_type === "checkbox" && (
                <div className="flex flex-col gap-2.5">
                  {(msg.input?.options || msg.options || []).map((opt, idx) => (
                    <label key={idx} className="flex items-center gap-2.5 cursor-pointer group px-1">
                      <input
                        type="checkbox"
                        value={opt}
                        checked={interactionValue.includes(opt)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setInteractionValue((prev) => [...prev, opt]);
                          } else {
                            setInteractionValue((prev) => prev.filter((v) => v !== opt));
                          }
                        }}
                        className="w-3.5 h-3.5 text-primary-600 border-slate-300 focus:ring-primary-500 cursor-pointer rounded"
                      />
                      <span className="text-[12px] text-slate-700 group-hover:text-slate-900 transition-colors font-medium">
                        {opt}
                      </span>
                    </label>
                  ))}
                  <button
                    onClick={handleInteractionSubmit}
                    disabled={interactionValue.length === 0}
                    className="self-end mt-1.5 px-4 py-1.5 bg-primary-600 text-white text-[12px] font-semibold rounded-md shadow-sm hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Submit Selection
                  </button>
                </div>
              )}

              {msg.ui_type === "content_edit" && (
                <div className="flex flex-col gap-3">
                  {(() => {
                    let payload = null;
                    try {
                      const opts = msg.input?.options || msg.options || [];
                      if (opts.length > 0) payload = typeof opts[0] === 'string' ? JSON.parse(opts[0]) : opts[0];
                    } catch (e) {
                      console.error("Failed to parse content_edit options", e);
                    }

                    if (!payload) return <div className="text-xs text-red-500">Failed to load edit payload</div>;

                    return (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 text-xs font-semibold text-slate-700 flex justify-between items-center">
                           <span>📄 {payload.section_filename} <span className="font-normal text-slate-500">(v{payload.version})</span></span>
                           {payload.block_number && <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">Block {payload.block_number}</span>}
                        </div>
                        
                        {payload.rationale && (
                          <div className="px-3 py-2 bg-blue-50/50 text-blue-800 text-[11px] italic border-b border-blue-100">
                             {payload.rationale}
                          </div>
                        )}

                        <div className="flex flex-col text-[12px] font-mono leading-relaxed">
                           <div className="bg-rose-50/50 text-rose-800 p-3 whitespace-pre-wrap border-b border-rose-100 relative">
                             <div className="absolute top-1 left-2 select-none text-rose-300">-</div>
                             <div className="pl-4">{payload.original_text}</div>
                           </div>
                           <div className="bg-emerald-50/50 text-emerald-800 p-3 whitespace-pre-wrap relative">
                             <div className="absolute top-1 left-2 select-none text-emerald-300">+</div>
                             <div className="pl-4">{payload.proposed_text}</div>
                           </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 p-2 bg-slate-50 border-t border-slate-200">
                           <button
                             onClick={() => {
                               window.dispatchEvent(new CustomEvent('preview-content-edit', {
                                 detail: {
                                    block_number: payload.block_number,
                                    original_text: payload.original_text,
                                    proposed_text: payload.proposed_text
                                 }
                               }));
                             }}
                             className="px-3 py-1.5 text-[11px] font-semibold text-blue-600 bg-white border border-blue-300 rounded hover:bg-blue-50 transition-colors mr-auto"
                           >
                             Preview in Editor
                           </button>
                           <button
                             onClick={() => {
                               onInteractionSubmit(currentSessionId, msg.tool_call_id, { status: "rejected" });
                               window.dispatchEvent(new CustomEvent('apply-content-edit-reject', {
                                 detail: {
                                    block_number: payload.block_number,
                                    original_text: payload.original_text,
                                    proposed_text: payload.proposed_text
                                 }
                               }));
                             }}
                             className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-300 rounded hover:bg-slate-100 transition-colors"
                           >
                             Reject
                           </button>
                           <button
                             onClick={() => {
                               // Inform the backend
                               onInteractionSubmit(currentSessionId, msg.tool_call_id, { 
                                 status: "accepted", 
                                 ui_type: "content_edit",
                                 section_filename: payload.section_filename,
                                 proposed_text: payload.proposed_text,
                                 block_number: payload.block_number
                               });
                               
                               // Dispatch a custom event so TiptapEditor can listen and apply the edit locally
                               window.dispatchEvent(new CustomEvent('apply-content-edit-accept', {
                                 detail: {
                                    block_number: payload.block_number,
                                    original_text: payload.original_text,
                                    proposed_text: payload.proposed_text
                                 }
                               }));
                             }}
                             className="px-3 py-1.5 text-[11px] font-semibold text-white bg-emerald-600 border border-emerald-700 rounded hover:bg-emerald-700 shadow-sm transition-colors"
                           >
                             Accept Edit
                           </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

           {isError && msg.error && (
             <div className="mt-2 text-rose-500 text-[10px] whitespace-pre-wrap bg-rose-50 p-2 rounded border border-rose-100">
               <div className="font-bold mb-1 uppercase font-sans tracking-wider text-[9px]">Error</div>
               {msg.error}
             </div>
           )}
        </div>
      )}
    </div>
  );
}

function formatText(content) {
  if (!content) return "";
  return content
    .replace(/\n/g, "<br/>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(
      /`(.*?)`/g,
      '<code style="background:rgba(175,184,193,0.2);padding:2px 5px;border-radius:5px;font-size:12px;font-family:monospace;">$1</code>',
    );
}

function parseMessageParts(content) {
  if (!content) return [];
  const artifactRegex = /<antArtifact\s+identifier="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/antArtifact>/g;
  let lastIndex = 0;
  const parts = [];
  let match;
  while ((match = artifactRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", content: content.slice(lastIndex, match.index) });
    }
    parts.push({
      type: "artifact",
      identifier: match[1],
      artifactType: match[2],
      title: match[3],
      content: match[4],
    });
    lastIndex = artifactRegex.lastIndex;
  }
  if (lastIndex < content.length) {
    parts.push({ type: "text", content: content.slice(lastIndex) });
  }
  return parts.length > 0 ? parts : [{ type: "text", content }];
}

function renderMessageContent(content, showCursor = false, isUser = false) {
  const parts = parseMessageParts(content);

  if (showCursor && (parts.length === 0 || parts[parts.length - 1].type !== "text")) {
    parts.push({ type: "text", content: "" });
  }

  return (
    <>
      {parts.map((part, idx) => {
        const isLast = idx === parts.length - 1;
        if (part.type === "text") {
          return (
            <div key={idx} className={`${isLast && showCursor ? "inline" : ""} prose prose-sm max-w-none text-slate-700`}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {part.content}
              </ReactMarkdown>
              {showCursor && isLast && (
                <span className="inline-block w-2.5 h-[14px] ml-1 align-baseline animate-grok-blink bg-slate-800"></span>
              )}
            </div>
          );
        } else {
          return (
            <div key={idx} className="my-2 border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm flex flex-col font-sans text-left transition-all hover:shadow-md">
              <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-700 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]"></div>
                  {part.title}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold bg-white px-2 py-0.5 rounded-full border border-slate-200 tracking-wide uppercase">
                  Artifact
                </span>
              </div>
              <div className="p-3.5 text-[13px] text-slate-700 leading-relaxed max-h-[300px] overflow-y-auto">
                {part.content.split("\n").map((line, lIdx) => {
                  if (!line.trim()) return null;
                  if (line.includes("- [ ]")) {
                    return (
                      <div key={lIdx} className="flex gap-2.5 items-start py-1">
                        <div className="w-4 h-4 border-2 border-slate-300 rounded-[4px] mt-[3px] flex-shrink-0"></div>
                        <span className="text-slate-600" dangerouslySetInnerHTML={{ __html: formatText(line.replace("- [ ]", "")) }}></span>
                      </div>
                    );
                  }
                  if (line.includes("- [/]")) {
                    return (
                      <div key={lIdx} className="flex gap-2.5 items-start py-1">
                        <div className="w-4 h-4 bg-primary-500 rounded-[4px] mt-[3px] flex-shrink-0 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        </div>
                        <span className="text-primary-700 font-medium" dangerouslySetInnerHTML={{ __html: formatText(line.replace("- [/]", "")) }}></span>
                      </div>
                    );
                  }
                  if (line.includes("- [x]")) {
                    return (
                      <div key={lIdx} className="flex gap-2.5 items-start py-1">
                        <div className="w-4 h-4 bg-emerald-500 rounded-[4px] mt-[3px] flex-shrink-0 flex items-center justify-center">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </div>
                        <span className="text-slate-400 line-through" dangerouslySetInnerHTML={{ __html: formatText(line.replace("- [x]", "")) }}></span>
                      </div>
                    );
                  }
                  return <div key={lIdx} className="py-0.5" dangerouslySetInnerHTML={{ __html: formatText(line) }} />;
                })}
              </div>
            </div>
          );
        }
      })}
    </>
  );
}

export default function ChatPanel({
  width = 360,
  messages,
  input,
  onInputChange,
  onSend,
  onStop,
  isStreaming,
  onClose,
  selectedChatBlocks = [],
  setSelectedChatBlocks,
  setFocusedChatBlock,
  onInteractionSubmit,
  currentSessionId,
  isAwaitingUserInput,
}) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 192)}px`;
    if (el.scrollHeight > 192) {
      el.style.overflowY = "auto";
    } else {
      el.style.overflowY = "hidden";
    }
  }, [input]);

  useEffect(()=>{
    console.log("Selected blocks: ", selectedChatBlocks);
  }, [selectedChatBlocks])
  
 
  return (
    <div
      className="border-l border-slate-200 bg-[#f8fafc] flex-shrink-0 flex flex-col animate-[fadeIn_0.2s_ease] relative z-20 font-sans"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 flex-shrink-0 bg-[#f8fafc] z-10 sticky top-0 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-500 shadow-sm">
            <Bot size={16} />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-800">
              AI Assistant
            </div>
            <div className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
              {messages.length} messages
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="border-none bg-transparent cursor-pointer p-1.5 rounded-md text-slate-400 flex items-center hover:text-slate-700 hover:bg-slate-200 transition-all duration-200"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={(el) => {
          if (el) el.scrollTop = el.scrollHeight;
        }}
        className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth bg-[#f8fafc]"
      >
        {messages.map((msg, i) => {
          const isLast = i === messages.length - 1;
          const isNextMsgUser = i < messages.length - 1 && messages[i+1].role === "user";
          const showLine = !isLast && !isNextMsgUser;

          if (msg.role === "user") {
            return (
              <div key={i} className="mb-8 mt-2 w-full flex justify-start">
                <div className="bg-white rounded-xl px-4 py-3 text-slate-800 text-[13px] border border-slate-200 flex flex-col w-full shadow-sm text-left">
                   {msg.contextBlocks && msg.contextBlocks.length > 0 && (
                     <div className="mb-3 flex flex-wrap gap-1.5 pb-3 border-b border-slate-100">
                       {msg.contextBlocks.map((block, idx) => (
                         <div 
                           key={idx} 
                           onClick={() => setFocusedChatBlock && setFocusedChatBlock(block)}
                           className="flex items-center gap-1.5 bg-slate-100 text-slate-700 pl-1 pr-2 py-1 rounded-md text-[11px] font-medium border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-200/70 transition-colors"
                         >
                           <div className="shrink-0 w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm shadow-primary-500/20">
                             {block.blockNumber}
                           </div>
                           <span className="max-w-[150px] truncate">{block.preview}</span>
                         </div>
                       ))}
                     </div>
                   )}
                   <div className="max-h-72 overflow-y-auto scrollbar-thin [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-300 pr-2">
                     {renderMessageContent(msg.content, false, true)}
                   </div>
                   <div className="flex justify-end mt-2 pt-2 border-t border-slate-100">
                      <CopyButton text={msg.content} isUser={true} />
                   </div>
                </div>
              </div>
            );
          }

          if (msg.role === "bot" && !msg._streaming) {
            return (
              <div key={i} className="relative pl-7 pb-6">
                {showLine && <div className="absolute left-[11px] top-3 bottom-[-10px] w-[2px] bg-slate-200 rounded-full"></div>}
                
                <div className="absolute left-[8px] top-1.5 w-2 h-2 rounded-full bg-slate-300 z-10 ring-4 ring-[#f8fafc]"></div>
                
                <div className="text-[13px] text-slate-700 leading-relaxed">
                  {renderMessageContent(msg.content, false, false)}
                  <div className="flex justify-end mt-2">
                      <CopyButton text={msg.content} isUser={false} />
                  </div>
                </div>
              </div>
            );
          }

          if (msg.role === "tool") {
            const isCompleted = msg.status === "completed";
            const isError = msg.status === "error";
            const isAwaitingInput = msg.status === "awaiting_input";
            
            let dotClass = "bg-primary-400 animate-pulse ring-[#f8fafc]";
            if (isCompleted) dotClass = "bg-emerald-500 ring-[#f8fafc]";
            if (isError) dotClass = "bg-rose-500 ring-[#f8fafc]";
            if (isAwaitingInput) dotClass = "bg-amber-500 ring-[#f8fafc]";

            return (
              <div key={i} className="relative pl-7 pb-4">
                {showLine && <div className="absolute left-[11px] top-3 bottom-[-10px] w-[2px] bg-slate-200 rounded-full"></div>}
                
                <div className={`absolute left-[7.5px] top-1.5 w-2.5 h-2.5 rounded-full z-10 ring-4 ${dotClass}`}></div>

                <ToolTimelineItem msg={msg} onInteractionSubmit={onInteractionSubmit} currentSessionId={currentSessionId} />
              </div>
            );
          }

          return null;
        })}

        {/* Streaming bot response */}
        {messages.some((m) => m._streaming) && (
          <div className="relative pl-7 pb-6">
            <div className="absolute left-[8px] top-1.5 w-2 h-2 rounded-full bg-primary-500 animate-pulse z-10 ring-4 ring-[#f8fafc]"></div>
            <div className="text-[13px] text-slate-700 leading-relaxed">
              {renderMessageContent(messages.find((m) => m._streaming)?.content, true)}
            </div>
          </div>
        )}

        {/* Streaming Typing Indicator when no text yet */}
        {isStreaming && !messages.some((m) => m._streaming) && (
          <div className="relative pl-7 pb-6">
            <div className="absolute left-[8px] top-1.5 w-2 h-2 rounded-full bg-slate-300 z-10 ring-4 ring-[#f8fafc]"></div>
            <div className="grid grid-cols-3 gap-[1px] w-fit mt-0.5">
              <div className="w-1 h-1 bg-primary-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "0ms" }}></div>
              <div className="w-1 h-1 bg-primary-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "100ms" }}></div>
              <div className="w-1 h-1 bg-primary-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "200ms" }}></div>
              <div className="w-1 h-1 bg-primary-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "700ms" }}></div>
              <div className="w-1 h-1 bg-primary-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "800ms" }}></div>
              <div className="w-1 h-1 bg-primary-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "300ms" }}></div>
              <div className="w-1 h-1 bg-primary-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "600ms" }}></div>
              <div className="w-1 h-1 bg-primary-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "500ms" }}></div>
              <div className="w-1 h-1 bg-primary-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "400ms" }}></div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 bg-gradient-to-t from-[#f8fafc] via-[#f8fafc] to-transparent z-10 sticky bottom-0 pt-8">
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col transition-all focus-within:border-slate-300 focus-within:ring-4 focus-within:ring-slate-100">
          
          {selectedChatBlocks && selectedChatBlocks.length > 0 && (
            <div className="px-3 pt-2 pb-1 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto scrollbar-thin [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 [&::-webkit-scrollbar-thumb]:rounded-full">
              {selectedChatBlocks.map((block, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setFocusedChatBlock && setFocusedChatBlock(block)}
                  className="flex items-center gap-1.5 bg-slate-100 text-slate-700 pl-1 pr-2 py-1 rounded-md text-[11px] font-medium border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-200/70 transition-colors"
                >
                  {/* Block number badge */}
                  <div className="shrink-0 w-5 h-5 rounded-full bg-primary-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm shadow-primary-500/20">
                    {block.blockNumber}
                  </div>
                  <span className="max-w-[150px] truncate">{block.preview}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedChatBlocks(prev => prev.filter((_, i) => i !== idx));
                    }} 
                    className="text-slate-400 hover:text-rose-500 ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim()) onSend();
              }
            }}
            placeholder={isAwaitingUserInput ? "Awaiting your response..." : "Ask AI Assistant..."}
            disabled={isAwaitingUserInput}
            className={`w-full bg-transparent text-[13px] text-slate-800 placeholder-slate-400 py-3 px-3.5 outline-none resize-none max-h-48 leading-relaxed font-sans ${
              selectedChatBlocks && selectedChatBlocks.length > 0 ? "border-t border-slate-100" : ""
            }`}
          />

          <div className="flex items-center justify-between px-2 pb-2">
            <div className="flex items-center gap-1">
              <button className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded-md transition-colors cursor-pointer">
                <MessageSquare size={13} />
                Ask before edits
              </button>
              <button className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 px-2 py-1.5 rounded-md transition-colors cursor-pointer">
                <Code size={13} />
                Code
              </button>
            </div>

            <div className="flex items-center gap-1.5 pr-1">
              {isStreaming ? (
                <button
                  onClick={onStop}
                  className="p-1.5 bg-slate-800 text-white hover:bg-slate-700 rounded-lg shadow-sm transition-colors cursor-pointer"
                  title="Stop generating"
                >
                  <Square size={13} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={onSend}
                  disabled={!input.trim()}
                  className={`p-1.5 rounded-lg transition-colors shadow-sm flex items-center justify-center ${
                    input.trim()
                      ? "bg-slate-800 text-white hover:bg-slate-700 cursor-pointer"
                      : "bg-slate-100 text-slate-400 cursor-default"
                  }`}
                >
                  <ArrowUp size={15} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}