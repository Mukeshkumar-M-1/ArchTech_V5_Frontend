import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";

const LOG_ROLE_BADGES = {
  user: "bg-sky-50 text-sky-600 border-sky-200",
  bot: "bg-primary-50 text-primary-600 border-primary-200",
  tool: "bg-amber-50 text-amber-600 border-amber-200",
};

function getLogContentPreview(message) {
  if (typeof message.content !== "string") return "";
  return message.content.replace(/\s+/g, " ").trim();
}

export default function ChatLogPanel({ messages, isStreaming }) {
  const logListRef = useRef(null);

  useEffect(() => {
    const el = logListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isStreaming]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#f8fafc]">
      <div className="px-4 py-2 border-b border-slate-200 flex items-center justify-between flex-shrink-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
          Session log
        </span>
        <span className="text-[9px] font-bold text-slate-400">
          {messages.length} entries
        </span>
      </div>

      <div ref={logListRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="px-2 py-6 text-center text-[12px] text-slate-400">
            No log entries yet
          </div>
        ) : (
          <ol className="space-y-1.5">
            {messages.map((message, index) => {
              const contentPreview = getLogContentPreview(message);
              return (
                <li
                  key={index}
                  className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-white border border-slate-200 shadow-sm"
                >
                  <span className="text-[10px] font-bold text-slate-400 tabular-nums w-6 shrink-0 pt-0.5">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={`shrink-0 text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                      LOG_ROLE_BADGES[message.role] ||
                      "bg-slate-50 text-slate-500 border-slate-200"
                    }`}
                  >
                    {message.role}
                  </span>
                  <span className="flex-1 min-w-0 text-[11px] text-slate-600 leading-snug truncate">
                    {contentPreview || (message.role === "tool" ? "Tool event" : "")}
                  </span>
                  {message.tool_call_id && (
                    <span className="shrink-0 text-[9px] font-mono text-slate-400 max-w-[90px] truncate">
                      {message.tool_call_id}
                    </span>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {isStreaming && (
          <div className="flex items-center gap-2 px-2 py-2 mt-1.5 text-[11px] text-slate-400">
            <Loader2 size={12} className="animate-spin" />
            Streaming response…
          </div>
        )}
      </div>
    </div>
  );
}
