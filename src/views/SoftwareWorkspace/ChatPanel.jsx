import {
  Bot,
  X,
  Paperclip,
  Send,
  Terminal,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronDown,
  ChevronRight,
  MousePointerClick,
  Copy,
  Check,
} from "lucide-react";
import React, { useState } from "react";
import { C } from "./types";

function CopyButton({ text, isUser }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const baseClasses = isUser
    ? "p-1 rounded bg-white/10 hover:bg-white/20 text-primary-100 hover:text-white transition-colors shadow-sm cursor-pointer border border-white/10 backdrop-blur-sm"
    : "p-1 rounded bg-slate-50/80 hover:bg-slate-200 text-slate-400 hover:text-slate-700 transition-colors border border-slate-200/50 shadow-sm cursor-pointer";

  return (
    <button onClick={handleCopy} className={baseClasses} title="Copy message">
      {copied ? (
        <Check
          size={12}
          className={isUser ? "text-emerald-300" : "text-emerald-500"}
        />
      ) : (
        <Copy size={12} />
      )}
    </button>
  );
}

function ToolMessageCard({ msg }) {
  const [expanded, setExpanded] = useState(false);
  const [interactionValue, setInteractionValue] = useState("");

  const isExecuting = msg.status === "executing";
  const isError = msg.status === "error";
  const isCompleted = msg.status === "completed";
  const isAwaitingInput = msg.status === "awaiting_input";

  const isExpanded = expanded || isAwaitingInput;

  const handleInteractionSubmit = () => {
    console.log(
      `Submitting tool interaction for ${msg.tool_call_id}:`,
      interactionValue,
    );
    // Future backend endpoint integration here
  };

  const renderToolInput = () => {
    if (!msg.input) return null;

    // Command tools get a terminal-like block
    if (
      msg.name === "run_command" ||
      msg.name === "bash" ||
      msg.name === "execute"
    ) {
      const cmd =
        msg.input.command ||
        msg.input.script ||
        msg.input.CommandLine ||
        JSON.stringify(msg.input);
      return (
        <div className="bg-[#1e1e1e] rounded-md p-3 my-2 font-mono text-[12px] text-slate-200 overflow-x-auto shadow-sm border border-[#333]">
          <div className="text-slate-500 text-[10px] mb-1.5 select-none font-sans font-semibold tracking-wider uppercase">
            Terminal
          </div>
          <code className="whitespace-pre-wrap">{cmd}</code>
        </div>
      );
    }

    // File tools get a clean path block
    if (
      msg.name.includes("file") ||
      msg.name.includes("read") ||
      msg.name.includes("write")
    ) {
      const target =
        msg.input.TargetFile ||
        msg.input.AbsolutePath ||
        msg.input.path ||
        msg.input.SearchPath;
      if (target) {
        return (
          <div className="bg-white border border-slate-200 rounded-md p-2.5 my-2 font-mono text-[12px] text-slate-700 shadow-sm flex flex-col gap-1.5">
            <div className="text-slate-400 text-[10px] uppercase tracking-wider font-sans font-bold select-none">
              Target
            </div>
            <div className="break-all">{target}</div>
            {msg.input.CodeContent && (
              <div className="mt-2 pt-2 border-t border-slate-100">
                <div className="text-slate-400 text-[10px] uppercase tracking-wider font-sans font-bold select-none mb-1">
                  Content
                </div>
                <pre className="text-[11px] max-h-32 overflow-y-auto whitespace-pre-wrap text-slate-600">
                  {msg.input.CodeContent}
                </pre>
              </div>
            )}
          </div>
        );
      }
    }

    // Default JSON fallback
    return (
      <div className="mb-2.5 mt-2">
        <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider font-sans">
          Parameters
        </div>
        <pre className="bg-white p-2.5 rounded-lg border border-slate-200/60 whitespace-pre-wrap shadow-sm text-slate-700 text-[11px]">
          {JSON.stringify(msg.input, null, 2)}
        </pre>
      </div>
    );
  };

  return (
    <div className="w-full my-1 border border-slate-200/70 rounded-xl overflow-hidden bg-white shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] font-sans text-left transition-all hover:shadow-[0_4px_12px_-4px_rgba(0,0,0,0.08)]">
      <div
        className="px-3 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2.5">
          {isExecuting && (
            <Loader2 size={14} className="text-primary-500 animate-spin" />
          )}
          {isCompleted && (
            <CheckCircle2 size={14} className="text-emerald-500" />
          )}
          {isError && <XCircle size={14} className="text-rose-500" />}
          {isAwaitingInput && (
            <MousePointerClick
              size={14}
              className="text-amber-500 animate-pulse"
            />
          )}

          <span className="text-[13px] font-semibold text-slate-700 flex items-center gap-2">
            {isExecuting
              ? "Running"
              : isError
                ? "Failed"
                : isAwaitingInput
                  ? "Needs Input"
                  : "Run"}
            <span className="font-mono text-[11px] text-primary-700 bg-primary-50/80 px-2 py-0.5 rounded border border-primary-100/50 shadow-sm">
              {msg.name}
            </span>
          </span>
        </div>
        <div className="text-slate-400 flex items-center gap-2">
          {isExecuting && (
            <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider">
              Working...
            </span>
          )}
          {isAwaitingInput && (
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">
              Action Required
            </span>
          )}
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pt-2 border-t border-slate-100 bg-slate-50/50 text-[12px] text-slate-600 font-mono overflow-x-auto">
          {renderToolInput()}
          {isCompleted && msg.output && (
            <div className="mt-2.5">
              {msg.name === "run_command" ||
              msg.name === "bash" ||
              msg.name === "execute" ? (
                <>
                  <div className="text-slate-500 text-[10px] mb-1.5 select-none font-sans font-semibold tracking-wider uppercase">
                    Output
                  </div>
                  <div className="bg-[#1e1e1e] rounded-md p-3 font-mono text-[11px] text-slate-300 max-h-60 overflow-y-auto shadow-sm border border-[#333]">
                    <code className="whitespace-pre-wrap">{msg.output}</code>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[10px] uppercase font-bold text-slate-400 mb-1.5 tracking-wider font-sans">
                    Output
                  </div>
                  <pre className="bg-white p-2.5 rounded-lg border border-slate-200/60 whitespace-pre-wrap max-h-48 overflow-y-auto shadow-sm text-slate-700 text-[11px]">
                    {msg.output}
                  </pre>
                </>
              )}
            </div>
          )}
          {isAwaitingInput && (
            <div className="mt-2.5 mb-1 bg-amber-50/50 border border-amber-200/50 rounded-lg p-3">
              <div className="text-[12px] font-semibold text-slate-800 mb-2.5 font-sans">
                {msg.prompt || "Please select an option:"}
              </div>

              {msg.ui_type === "select" && (
                <div className="flex flex-col gap-2 font-sans">
                  <select
                    className="w-full bg-white border border-slate-300 text-slate-700 text-[12px] rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500/50 cursor-pointer shadow-sm"
                    value={interactionValue}
                    onChange={(e) => setInteractionValue(e.target.value)}
                  >
                    <option value="" disabled>
                      Select an option...
                    </option>
                    {(msg.options || []).map((opt, idx) => (
                      <option key={idx} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleInteractionSubmit}
                    disabled={!interactionValue}
                    className="self-end mt-1.5 px-4 py-1.5 bg-primary-600 text-white text-[12px] font-semibold rounded-md shadow-sm shadow-primary-600/20 hover:bg-primary-700 hover:shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Submit Choice
                  </button>
                </div>
              )}

              {msg.ui_type === "radio" && (
                <div className="flex flex-col gap-2.5 font-sans">
                  {(msg.options || []).map((opt, idx) => (
                    <label
                      key={idx}
                      className="flex items-center gap-2.5 cursor-pointer group px-1"
                    >
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
                    className="self-end mt-1.5 px-4 py-1.5 bg-primary-600 text-white text-[12px] font-semibold rounded-md shadow-sm shadow-primary-600/20 hover:bg-primary-700 hover:shadow-primary-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Submit Choice
                  </button>
                </div>
              )}
            </div>
          )}
          {isError && msg.error && (
            <div className="mt-2.5">
              <div className="text-[10px] uppercase font-bold text-rose-400 mb-1.5 tracking-wider">
                Error
              </div>
              <pre className="bg-rose-50/50 p-2.5 rounded-lg border border-rose-200/60 text-rose-700 whitespace-pre-wrap shadow-sm">
                {msg.error}
              </pre>
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
  // Regex to match the entire antArtifact block (non-greedy)
  const artifactRegex =
    /<antArtifact\s+identifier="([^"]+)"\s+type="([^"]+)"\s+title="([^"]+)">([\s\S]*?)<\/antArtifact>/g;

  let lastIndex = 0;
  const parts = [];
  let match;

  while ((match = artifactRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: content.slice(lastIndex, match.index),
      });
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

function renderMessageContent(content, showCursor = false) {
  const parts = parseMessageParts(content);

  if (
    showCursor &&
    (parts.length === 0 || parts[parts.length - 1].type !== "text")
  ) {
    parts.push({ type: "text", content: "" });
  }

  return (
    <>
      {parts.map((part, idx) => {
        const isLast = idx === parts.length - 1;
        if (part.type === "text") {
          let html = formatText(part.content);
          if (showCursor && isLast) {
            html +=
              '<span class="inline-block w-2.5 h-[14px] ml-1 bg-slate-800 align-baseline animate-grok-blink"></span>';
          }
          return (
            <div
              key={idx}
              dangerouslySetInnerHTML={{ __html: html }}
              className={isLast && showCursor ? "inline" : ""}
            />
          );
        } else {
          // Artifact Rendering
          return (
            <div
              key={idx}
              className="my-2 border border-primary-100/60 rounded-xl overflow-hidden bg-white shadow-[0_2px_12px_-4px_rgba(6,81,237,0.08)] flex flex-col font-sans text-left transition-all hover:shadow-[0_4px_16px_-4px_rgba(6,81,237,0.12)]"
            >
              <div className="bg-gradient-to-r from-primary-50/50 to-primary-50/50 border-b border-primary-100/60 px-3 py-2 flex items-center justify-between">
                <span className="text-[13px] font-semibold text-slate-800 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(59, 130, 246,0.6)]"></div>
                  {part.title}
                </span>
                <span className="text-[10px] text-primary-600/80 font-semibold bg-primary-100/50 px-2 py-0.5 rounded-full border border-primary-200/40 tracking-wide uppercase">
                  Artifact
                </span>
              </div>
              <div className="p-3.5 text-[13px] text-slate-700 leading-relaxed max-h-[300px] overflow-y-auto">
                {part.content.split("\n").map((line, lIdx) => {
                  if (!line.trim()) return null;

                  // Checkbox rendering logic
                  if (line.includes("- [ ]")) {
                    return (
                      <div key={lIdx} className="flex gap-2.5 items-start py-1">
                        <div className="w-4 h-4 border-2 border-slate-300 rounded-[4px] mt-[3px] flex-shrink-0 transition-colors"></div>
                        <span
                          className="text-slate-600"
                          dangerouslySetInnerHTML={{
                            __html: formatText(line.replace("- [ ]", "")),
                          }}
                        ></span>
                      </div>
                    );
                  }
                  if (line.includes("- [/]")) {
                    return (
                      <div key={lIdx} className="flex gap-2.5 items-start py-1">
                        <div className="w-4 h-4 bg-primary-500 rounded-[4px] mt-[3px] flex-shrink-0 flex items-center justify-center shadow-sm shadow-primary-500/30">
                          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                        </div>
                        <span
                          className="text-primary-700 font-medium"
                          dangerouslySetInnerHTML={{
                            __html: formatText(line.replace("- [/]", "")),
                          }}
                        ></span>
                      </div>
                    );
                  }
                  if (line.includes("- [x]")) {
                    return (
                      <div key={lIdx} className="flex gap-2.5 items-start py-1">
                        <div className="w-4 h-4 bg-emerald-500 rounded-[4px] mt-[3px] flex-shrink-0 flex items-center justify-center shadow-sm shadow-emerald-500/20">
                          <svg
                            width="10"
                            height="10"
                            viewBox="0 0 12 12"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M10 3L4.5 8.5L2 6"
                              stroke="white"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <span
                          className="text-slate-400 line-through"
                          dangerouslySetInnerHTML={{
                            __html: formatText(line.replace("- [x]", "")),
                          }}
                        ></span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={lIdx}
                      className="py-0.5"
                      dangerouslySetInnerHTML={{ __html: formatText(line) }}
                    />
                  );
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
  selectedChatBlocks,
  setSelectedChatBlocks,
}) {
  return (
    <div
      className="border-l border-slate-100 bg-white flex-shrink-0 flex flex-col animate-[fadeIn_0.2s_ease] shadow-[-4px_0_24px_rgba(0,0,0,0.02)] relative z-20"
      style={{ width: `${width}px` }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-shrink-0 bg-white/80 backdrop-blur-xl z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-xl flex items-center justify-center shadow-sm transition-all duration-300"
            style={{
              background: isStreaming
                ? "linear-gradient(135deg, #eff6ff 0%, #eff6ff 100%)"
                : "#f8fafc",
              color: isStreaming ? "#2563eb" : "#64748b",
              border: "1px solid",
              borderColor: isStreaming ? "#dbeafe" : "#f1f5f9",
            }}
          >
            <Bot
              size={16}
              style={isStreaming ? { animation: "pulse 1.5s infinite" } : {}}
            />
          </div>
          <div>
            <div className="text-sm font-bold bg-gradient-to-r from-primary-600 to-primary-600 bg-clip-text text-transparent">
              AI Assistant
            </div>
            <div className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase mt-0.5">
              {messages.length} messages
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="border-none bg-slate-50/50 cursor-pointer p-2 rounded-full text-slate-400 flex items-center hover:text-slate-700 hover:bg-slate-100 transition-all duration-200"
        >
          <X size={14} />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={(el) => {
          if (el) el.scrollTop = el.scrollHeight;
        }}
        className="flex-1 overflow-y-auto p-4 bg-[#f8fafc] scroll-smooth"
      >
        {messages.map((msg, i) => {
          if (msg.role === "tool") {
            return (
              <div
                key={i}
                className="flex mb-4 group"
                style={{ justifyContent: "flex-start" }}
              >
                <div className="w-7 h-7 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center mr-3 flex-shrink-0 mt-1 shadow-sm">
                  <Terminal size={13} className="text-slate-500" />
                </div>
                <div className="flex-1 max-w-[85%] relative">
                  <ToolMessageCard msg={msg} />
                </div>
              </div>
            );
          }

          if (!msg._streaming) {
            return (
              <div
                key={i}
                className="flex mb-4 group"
                style={{
                  justifyContent:
                    msg.role === "user" ? "flex-end" : "flex-start",
                }}
              >
                {msg.role === "bot" && (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-500 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5 shadow-md shadow-primary-500/20">
                    <Bot size={14} className="text-white" />
                  </div>
                )}
                <div
                  className="max-w-[78%] px-4 py-2.5 text-[13px] leading-relaxed break-words relative transition-all"
                  style={{
                    borderRadius:
                      msg.role === "user"
                        ? "18px 18px 4px 18px"
                        : "18px 18px 18px 4px",
                    background:
                      msg.role === "user"
                        ? "linear-gradient(135deg, #2563eb 0%, #2563eb 100%)"
                        : "#ffffff",
                    color: msg.role === "user" ? "#ffffff" : "#334155",
                    boxShadow:
                      msg.role === "user"
                        ? "0 4px 12px rgba(37, 99, 235, 0.2)"
                        : "0 2px 10px -3px rgba(6, 81, 237, 0.05)",
                    border:
                      msg.role === "bot"
                        ? "1px solid rgba(226, 232, 240, 0.6)"
                        : "none",
                  }}
                >
                  <div className="flex flex-col relative">
                    <div>{renderMessageContent(msg.content)}</div>
                    <div className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <CopyButton
                        text={msg.content}
                        isUser={msg.role === "user"}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })}

        {/* Streaming bot response (live-updating) */}
        {messages.some((m) => m._streaming) && (
          <div
            className="flex mb-4 group"
            style={{ justifyContent: "flex-start" }}
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-500 flex items-center justify-center mr-3 flex-shrink-0 mt-0.5 shadow-md shadow-primary-500/20">
              <Bot size={14} className="text-white" />
            </div>
            <div
              className="max-w-[78%] px-4 py-2.5 text-[13px] leading-relaxed break-words relative"
              style={{
                borderRadius: "18px 18px 18px 4px",
                background: "#ffffff",
                color: "#334155",
                boxShadow: "0 2px 10px -3px rgba(6, 81, 237, 0.05)",
                border: "1px solid rgba(226, 232, 240, 0.6)",
              }}
            >
              <div>
                {renderMessageContent(
                  messages.find((m) => m._streaming)?.content,
                  true,
                )}
              </div>
            </div>
          </div>
        )}

        {/* Streaming Typing Indicator */}
        {isStreaming && !messages.some((m) => m._streaming) && (
          <div className="flex items-center mb-4">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary-500 to-primary-500 flex items-center justify-center mr-3 flex-shrink-0 shadow-md shadow-primary-500/20">
              <Bot size={14} className="text-white" />
            </div>
            <div className="px-4 py-3 rounded-[18px_18px_18px_4px] bg-white shadow-[0_2px_10px_-3px_rgba(6,81,237,0.05)] border border-slate-200/60 flex items-center h-[38px]">
              <div className="grid grid-cols-2 gap-[2px] w-fit">
                <div
                  className="w-1.5 h-1.5 bg-slate-800 rounded-[1px] animate-grok-spiral"
                  style={{ animationDelay: "0ms" }}
                ></div>
                <div
                  className="w-1.5 h-1.5 bg-slate-800 rounded-[1px] animate-grok-spiral"
                  style={{ animationDelay: "200ms" }}
                ></div>
                <div
                  className="w-1.5 h-1.5 bg-slate-800 rounded-[1px] animate-grok-spiral"
                  style={{ animationDelay: "600ms" }}
                ></div>
                <div
                  className="w-1.5 h-1.5 bg-slate-800 rounded-[1px] animate-grok-spiral"
                  style={{ animationDelay: "400ms" }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3.5 border-t border-slate-100 bg-white/80 backdrop-blur-xl z-10 sticky bottom-0">
        {/* Selected Blocks Context Pill */}
        {selectedChatBlocks && selectedChatBlocks.length > 0 && (
          <div className="flex items-center justify-between bg-primary-50 border border-primary-100 rounded-lg px-3 py-2 mb-2">
            <div className="flex items-center gap-2 text-primary-700 text-[12px] font-medium">
              <Paperclip size={14} />
              <span>
                {selectedChatBlocks.length} block
                {selectedChatBlocks.length > 1 ? "s" : ""} attached from Editor
              </span>
            </div>
            <button
              onClick={() => setSelectedChatBlocks([])}
              className="text-primary-400 hover:text-primary-600 rounded-full hover:bg-primary-100 p-0.5 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 bg-[#f8fafc] hover:bg-slate-50 focus-within:bg-white focus-within:ring-4 focus-within:ring-primary-500/10 focus-within:border-primary-300 transition-all duration-300 rounded-[20px] border border-slate-200 p-2 relative shadow-sm">
          <button className="border-none bg-transparent cursor-pointer p-2 text-slate-400 flex items-center hover:text-primary-600 transition-all duration-200 mb-0.5 rounded-full hover:bg-primary-50">
            <Paperclip size={16} />
          </button>
          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim()) onSend();
              }
            }}
            placeholder="Message AI Assistant..."
            rows={1}
            className="flex-1 border-none outline-none resize-none bg-transparent text-[13px] text-slate-700 placeholder-slate-400 font-sans leading-relaxed max-h-28 py-2.5"
          />
          {isStreaming ? (
            <button
              onClick={onStop}
              className="p-2 rounded-2xl flex items-center justify-center transition-all duration-200 mb-0.5 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 hover:shadow-sm"
              style={{ border: "none", transform: "scale(1)" }}
              title="Stop generating"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="currentColor"
                stroke="none"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
              </svg>
            </button>
          ) : (
            <button
              onClick={onSend}
              disabled={!input.trim()}
              className="p-2 rounded-2xl flex items-center justify-center transition-all duration-200 mb-0.5"
              style={{
                border: "none",
                background: input.trim()
                  ? "linear-gradient(135deg, #2563eb 0%, #2563eb 100%)"
                  : "#f1f5f9",
                color: input.trim() ? "#fff" : "#cbd5e1",
                cursor: input.trim() ? "pointer" : "default",
                boxShadow: input.trim()
                  ? "0 4px 12px rgba(37, 99, 235, 0.25)"
                  : "none",
                transform: input.trim() ? "scale(1)" : "scale(0.95)",
              }}
            >
              <Send size={15} style={{ marginLeft: "1px" }} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
