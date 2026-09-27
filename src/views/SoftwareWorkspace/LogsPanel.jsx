import { useState, useEffect, useRef, useCallback } from "react";
import {
  Zap,
  MessageSquare,
  Terminal,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  AlertTriangle,
  ArrowDownToLine,
  Eraser,
  Expand,
  Shrink,
} from "lucide-react";
import { getApiUrl } from "../../utils/apiConfig";
import { motion } from "framer-motion";

/**
 * LogsPanel - Inline log viewer rendered as a sub-tab body (like the
 * template/generation/version panels — no overlay). Three sources:
 *  - generation: transcript events of a generation session, collapsible parent→child tree
 *  - chat:       transcript events of a chat session, same tree
 *  - server:     backend Python log records, cursor-polled every 2s
 * Trees are built from the uuid/parentUuid chain served by /logs/events.
 * @param {Object} props
 * @param {Object} props.project - Active project (provides project_id for the endpoints).
 */
export function LogsScrollStyle() {
  return (
    <style>{`
      /* Always-visible scrollbar inside the logs panel: the default 5px
         transparent-track thumb is invisible against the white log area. */
      .logs-scroll::-webkit-scrollbar { width: 9px; height: 9px; }
      .logs-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 99px; }
      .logs-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 99px; border: 2px solid #f1f5f9; }
      .logs-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
    `}</style>
  );
}

export default function LogsPanel({ project }) {
  const [source, setSource] = useState("generation");
  const projectId = project?.id || project?._id;

  return (
    <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-white">
      <LogsScrollStyle />
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/60 bg-slate-50/80">
          <div className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Terminal size={14} className="text-slate-400" />
            Logs
            {projectId && (
              <span className="text-[10px] font-mono text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                {projectId}
              </span>
            )}
          </div>
        </div>

        {/* Source segmented control — same active style as the sub-tab buttons */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-slate-200/60 bg-white">
          {[
            { id: "generation", label: "Generation", icon: <Zap size={13} /> },
            { id: "chat", label: "Chat", icon: <MessageSquare size={13} /> },
            { id: "server", label: "Server", icon: <Terminal size={13} /> },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSource(tab.id)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-[10px] cursor-pointer text-[10px] font-black uppercase tracking-widest transition-all duration-200 border ${
                source === tab.id
                  ? "bg-white text-primary-600 shadow-md shadow-slate-200/50 border-slate-200"
                  : "bg-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-transparent"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden min-h-0">
          {source === "server" ? (
            <ServerLogView />
          ) : (
            <TranscriptTreeView projectId={projectId} kind={source} />
          )}
        </div>

      </div>
    </div>
  );
}

// ── Transcript tree (generation + chat) ─────────────────────────────────────

/**
 * Build parent→child nodes from the flat uuid/parentUuid event list.
 * Events whose parent is missing or dangling are promoted to roots so no
 * event is silently dropped from the view.
 */
function buildTree(events) {
  const nodesByUuid = new Map(events.map((e) => [e.uuid, { event: e, children: [] }]));
  const roots = [];
  for (const node of nodesByUuid.values()) {
    const parent = node.event.parentUuid ? nodesByUuid.get(node.event.parentUuid) : null;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Events arrive in append (chronological) order, so children lists are ordered too.
  return roots;
}

/** Expand the path from the last root down its last-child chain — shows the latest activity. */
function latestBranchUuids(roots) {
  const uuids = [];
  let node = roots[roots.length - 1];
  while (node) {
    uuids.push(node.event.uuid);
    node = node.children[node.children.length - 1];
  }
  return uuids;
}

const TYPE_STYLES = {
  user: "bg-blue-100 text-blue-700",
  assistant: "bg-violet-100 text-violet-700",
  tool_result: "bg-emerald-100 text-emerald-700",
  compact_summary: "bg-amber-100 text-amber-700",
};
const typeBadgeClass = (type) => TYPE_STYLES[type] || "bg-slate-100 text-slate-500";

function extractText(content) {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((block) => (typeof block === "string" ? block : block?.text || block?.content || JSON.stringify(block)))
      .join(" ");
  }
  return JSON.stringify(content);
}

export function TranscriptTreeView({ projectId, kind }) {
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingClear, setPendingClear] = useState(false);
  const treeScrollRef = useRef(null);

  // Manual jump: scrolls the tree to its newest events (bottom). Explicitly
  // user-triggered — no automatic scrolling, per the server-log precedent.
  const jumpToLatest = () => {
    const container = treeScrollRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
    }
  };

  const fetchSessions = useCallback(async () => {
    if (!projectId) return;
    try {
      const res = await fetch(getApiUrl(`/logs/sessions/${projectId}`));
      if (!res.ok) throw new Error(`sessions fetch failed: ${res.status}`);
      const data = await res.json();
      const kindSessions = data[kind] || [];
      console.debug("[Logs] sessions loaded:", kind, kindSessions.length);
      setSessions(kindSessions);
      // Default to most recent only when nothing (valid) is selected yet.
      setSelectedSession(
        kindSessions.some((s) => s.session_id === selectedSession)
          ? selectedSession
          : kindSessions[0]?.session_id || null,
      );
    } catch (err) {
      console.error("[Logs] Failed to load sessions:", err);
      setError(String(err));
    }
  }, [projectId, kind, selectedSession]);

  const fetchEvents = useCallback(async () => {
    if (!projectId || !selectedSession) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        getApiUrl(`/logs/events/${projectId}/${selectedSession}?kind=${kind}`),
      );
      if (!res.ok) throw new Error(`events fetch failed: ${res.status}`);
      const data = await res.json();
      const tree = buildTree(data.events || []);
      setEvents(tree);
      // Reveal the latest branch whenever new data lands, unless the user has
      // expanded something manually (non-empty set = user intent, keep it).
      setExpanded((prev) => (prev.size ? prev : new Set(latestBranchUuids(tree))));
    } catch (err) {
      console.error("[Logs] Failed to load events:", err);
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedSession, kind]);

  // Initial data fetch on mount / selection change: fetching from the backend on
  // mount is a legitimate external-system sync; the set-state-in-effect rule is
  // disabled because setLoading(true) at the top of the fetchers is intentional
  // (loading indicator must appear before the first await resolves).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchSessions();
  }, [projectId, kind]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchEvents();
  }, [selectedSession]); // eslint-disable-line react-hooks/exhaustive-deps
  /* eslint-enable react-hooks/set-state-in-effect */

  const parentUuids = collectExpandableUuids(events);
  const allExpanded = parentUuids.length > 0 && parentUuids.every((uuid) => expanded.has(uuid));
  const toggleExpandAll = () => {
    setExpanded(allExpanded ? new Set() : new Set(parentUuids));
  };

  const toggle = (uuid) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  // Deletes the selected session's transcript file on disk (irreversible),
  // then clears the view and refreshes the session list. Reached only via the
  // confirmation dialog — a misclick must not silently destroy a transcript.
  const clearLogs = async () => {
    if (!selectedSession) return;
    try {
      const res = await fetch(
        getApiUrl(`/logs/events/${projectId}/${selectedSession}?kind=${kind}`),
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`clear failed: ${res.status}`);
      console.debug("[Logs] Deleted transcript:", kind, selectedSession);
      setEvents([]);
      setExpanded(new Set());
      setSelectedSession(null);
      fetchSessions();
    } catch (err) {
      console.error("[Logs] Failed to delete transcript:", err);
      setError(String(err));
    }
  };

  if (!projectId) {
    return <EmptyState text="No project selected" />;
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Session selector + refresh */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200/60 bg-slate-50/50">
        <select
          value={selectedSession || ""}
          onChange={(e) => setSelectedSession(e.target.value || null)}
          className="text-[11px] font-mono text-slate-600 bg-white border border-slate-200 rounded-lg px-2 py-1.5 outline-none max-w-[420px] cursor-pointer"
        >
          {sessions.length === 0 && <option value="">No {kind} sessions</option>}
          {sessions.map((s) => (
            <option key={s.session_id} value={s.session_id}>
              {s.session_id} · {new Date(s.mtime * 1000).toLocaleString()} · {(s.size / 1024).toFixed(1)} KB
            </option>
          ))}
        </select>
        <button
          onClick={() => {
            fetchSessions();
            fetchEvents();
          }}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold text-slate-500 hover:bg-slate-50 cursor-pointer transition-colors"
        >
          <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
        <button
          onClick={jumpToLatest}
          disabled={events.length === 0}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold transition-colors ${
            events.length === 0
              ? "text-slate-300 cursor-default"
              : "text-slate-500 hover:bg-slate-50 cursor-pointer"
          }`}
          title="Scroll to the newest events"
        >
          <ArrowDownToLine size={11} />
          Latest
        </button>
        <button
          onClick={toggleExpandAll}
          disabled={parentUuids.length === 0}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold transition-colors ${
            parentUuids.length === 0
              ? "text-slate-300 cursor-default"
              : "text-slate-500 hover:bg-slate-50 cursor-pointer"
          }`}
          title={allExpanded ? "Collapse all events" : "Expand all events"}
        >
          {allExpanded ? <Shrink size={11} /> : <Expand size={11} />}
          {allExpanded ? "Collapse" : "Expand"}
        </button>
        <button
          onClick={() => setPendingClear(true)}
          disabled={!selectedSession}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[10px] font-semibold transition-colors ${
            selectedSession
              ? "text-slate-500 hover:bg-slate-50 cursor-pointer"
              : "text-slate-300 cursor-default"
          }`}
          title="Permanently delete this session's transcript file"
        >
          <Eraser size={11} />
          Clear
        </button>
        <span className="text-[10px] text-slate-400 ml-auto font-mono">
          {countNodes(events)} events
        </span>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 text-[11px]">
          <AlertTriangle size={12} /> {error}
        </div>
      )}

      {/* overflow-x-hidden is deliberate: long unbreakable strings (file paths,
          JSON) must wrap inside their rows, never widen this scroll area — with
          plain overflow-y-auto the x-axis computes to auto and one long token
          turns the whole tree into a horizontally scrolling sliver. */}
      <div ref={treeScrollRef} className="logs-scroll flex-1 overflow-y-auto overflow-x-hidden min-h-0 min-w-0 p-3 font-mono text-[11px]">
        {events.length === 0 && !loading && (
          <EmptyState text={selectedSession ? "No transcript events in this session" : "No sessions yet — run a generation or start a chat"} />
        )}
        {events.map((node) => (
          <EventNode
            key={node.event.uuid}
            node={node}
            depth={0}
            expanded={expanded}
            onToggle={toggle}
          />
        ))}
      </div>

      {/* Clear Transcript Confirmation Dialog */}
      {pendingClear && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/60 w-full max-w-md overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-200/50">
                <Eraser size={28} className="text-white" />
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2">Clear Transcript?</h3>
              <p className="text-sm text-slate-500 mb-1">
                The transcript "{selectedSession}" will be permanently deleted from disk.
              </p>
              <p className="text-[11px] text-slate-400">
                This action cannot be undone.
              </p>
            </div>

            <div className="px-8 pb-8 flex items-center gap-3">
              <button
                onClick={() => setPendingClear(false)}
                className="flex-1 px-5 py-3 bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setPendingClear(false);
                  clearLogs();
                }}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-red-200/50 hover:shadow-red-300/50 active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

function countNodes(nodes) {
  return nodes.reduce((sum, n) => sum + 1 + countNodes(n.children), 0);
}

function eventHasDetails(event) {
  if (event.type === "tool_result") return true;
  if (event.type === "compact_summary") return !!extractText(event.summary);
  return !!extractText(event.message?.content ?? event.content) || !!event.message?.tool_calls?.length;
}

const isExpandable = (node) => node.children.length > 0 || eventHasDetails(node.event);

function collectExpandableUuids(nodes) {
  return nodes.reduce((acc, n) => {
    const childUuids = collectExpandableUuids(n.children);
    return isExpandable(n) ? [...acc, n.event.uuid, ...childUuids] : [...acc, ...childUuids];
  }, []);
}

// Visual indent cap, in tree levels (16px each). See EventNode for why.
const MAX_INDENT_DEPTH = 8;

function EventNode({ node, depth, expanded, onToggle }) {
  const { event, children } = node;
  const isOpen = expanded.has(event.uuid);
  const expandable = isExpandable(node);
  const isError = event.is_error === true;
  const timestamp = event.timestamp
    ? new Date(event.timestamp * 1000).toLocaleTimeString()
    : "";

  const preview =
    event.type === "tool_result"
      ? `${event.tool_name || "tool"}${isError ? " · error" : ""} — ${extractText(event.content).slice(0, 90)}`
      : event.type === "compact_summary"
        ? extractText(event.summary).slice(0, 90)
        : event.type === "assistant"
          ? extractText(event.message?.content || event.content).slice(0, 90)
          : extractText(event.content).slice(0, 90);

  // Transcript chains are linear (each tool result chains onto the previous
  // event), so real depth grows with chain length — a 100+ event chain would
  // indent rows ~1600px right and clip them invisible. Cap the visual indent:
  // deeper nodes all align at the cap, keeping every row on-screen at any
  // panel width.
  const indentDepth = Math.min(depth, MAX_INDENT_DEPTH);

  return (
    <div className="min-w-0">
      <div
        className={`flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50 min-w-0 ${
          expandable ? "cursor-pointer" : "cursor-default"
        } ${isError ? "bg-rose-50/60" : ""}`}
        style={{ paddingLeft: `${indentDepth * 16 + 8}px` }}
        onClick={() => expandable && onToggle(event.uuid)}
      >
        {expandable ? (
          isOpen ? (
            <ChevronDown size={12} className="mt-0.5 text-slate-400 shrink-0" />
          ) : (
            <ChevronRight size={12} className="mt-0.5 text-slate-400 shrink-0" />
          )
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${typeBadgeClass(event.type)}`}>
          {event.type}
        </span>
        {event.turn != null && (
          <span className="shrink-0 text-[9px] text-slate-400 mt-0.5">T{event.turn}</span>
        )}
        {timestamp && <span className="shrink-0 text-[9px] text-slate-300 mt-0.5">{timestamp}</span>}
        <span className={`truncate min-w-0 ${isError ? "text-rose-600" : "text-slate-600"}`}>{preview}</span>
      </div>

      {isOpen && (
        <div style={{ paddingLeft: `${indentDepth * 16 + 24}px` }} className="pb-1 min-w-0">
          <EventDetails event={event} />
        </div>
      )}

      {isOpen &&
        children.map((child) => (
          <EventNode
            key={child.event.uuid}
            node={child}
            depth={depth + 1}
            expanded={expanded}
            onToggle={onToggle}
          />
        ))}
    </div>
  );
}

function EventDetails({ event }) {
  if (event.type === "tool_result") {
    return (
      <div className="ml-5 border-l-2 border-slate-100 pl-3 py-1 space-y-1 min-w-0">
        <Detail label="tool_call_id" value={event.tool_call_id} mono />
        {event.tool_input != null && (
          <pre className="bg-slate-50 border border-slate-100 rounded-md p-2 text-[10px] leading-relaxed whitespace-pre-wrap break-all min-w-0 text-slate-600">
            {JSON.stringify(event.tool_input, null, 2)}
          </pre>
        )}
        <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-all min-w-0 text-slate-500 max-h-48 overflow-y-auto">
          {extractText(event.content)}
        </pre>
      </div>
    );
  }
  if (event.type === "assistant" && event.message?.tool_calls?.length) {
    const textBody = extractText(event.message?.content || event.content);
    return (
      <div className="ml-5 border-l-2 border-slate-100 pl-3 py-1 space-y-1 min-w-0">
        {textBody && (
          <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-all min-w-0 text-slate-600 max-h-48 overflow-y-auto">
            {textBody}
          </pre>
        )}
        {event.message.tool_calls.map((toolCall) => (
          <pre key={toolCall.id || toolCall.tool_call_id} className="bg-slate-50 border border-slate-100 rounded-md p-2 text-[10px] leading-relaxed whitespace-pre-wrap break-all min-w-0 text-slate-600">
            {JSON.stringify({ tool: toolCall.function?.name || toolCall.name, arguments: toolCall.function?.arguments || toolCall.arguments }, null, 2)}
          </pre>
        ))}
      </div>
    );
  }
  const body = event.type === "compact_summary" ? event.summary : event.message?.content ?? event.content;
  if (!body) return null;
  return (
    <div className="ml-5 border-l-2 border-slate-100 pl-3 py-1 min-w-0">
      <pre className="text-[10px] leading-relaxed whitespace-pre-wrap break-all min-w-0 text-slate-500 max-h-48 overflow-y-auto">
        {extractText(body)}
      </pre>
    </div>
  );
}

function Detail({ label, value, mono }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 items-baseline min-w-0">
      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 shrink-0">{label}</span>
      <span className={`text-[10px] text-slate-500 break-all min-w-0 ${mono ? "font-mono" : ""}`}>{String(value)}</span>
    </div>
  );
}

// ── Server logs (ring buffer polling) ───────────────────────────────────────

const LEVEL_STYLES = {
  INFO: "bg-slate-100 text-slate-500",
  DEBUG: "bg-slate-50 text-slate-400",
  WARNING: "bg-amber-50 text-amber-600",
  ERROR: "bg-rose-50 text-rose-600",
  CRITICAL: "bg-rose-100 text-rose-700",
};

export function ServerLogView() {
  const [entries, setEntries] = useState([]);
  const [error, setError] = useState(null);
  const scrollRef = useRef(null);
  // Ref over state: the poll interval callback reads the cursor every 2s and
  // re-creating the interval on each cursor change would reset the poll cadence.
  const cursorRef = useRef(0);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(getApiUrl(`/logs?since=${cursorRef.current}&limit=500`));
      if (!res.ok) throw new Error(`/logs fetch failed: ${res.status}`);
      const data = await res.json();
      if (data.entries?.length) {
        setEntries((prev) => [...prev, ...data.entries].slice(-2000));
        cursorRef.current = data.cursor;
      }
      setError(null);
    } catch (err) {
      console.error("[Logs] Server log poll failed:", err);
      setError(String(err));
    }
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [poll]);

  // Follow new entries ONLY while the user is already at the bottom — if they
  // scrolled up to read history, forcing scrollTop down would yank them away
  // on every 2s poll. A 40px tolerance covers sub-pixel scroll positions.
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 40;
    if (isNearBottom) {
      container.scrollTop = container.scrollHeight;
    }
  }, [entries]);

  return (
    <div ref={scrollRef} className="logs-scroll h-full overflow-y-auto overflow-x-hidden p-3 font-mono text-[11px] space-y-0.5">
      {error && (
        <div className="flex items-center gap-2 px-2 py-1 bg-rose-50 text-rose-600 text-[10px]">
          <AlertTriangle size={12} /> {error}
        </div>
      )}
      {entries.length === 0 && !error && <EmptyState text="Waiting for server log records..." />}
      {entries.map((entry) => (
        <div key={entry.seq} className="flex items-start gap-2 py-0.5 px-1 rounded hover:bg-slate-50 min-w-0">
          <span className="shrink-0 text-[9px] text-slate-300 mt-0.5">
            {new Date(entry.ts * 1000).toLocaleTimeString()}
          </span>
          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${LEVEL_STYLES[entry.level] || "bg-slate-100 text-slate-500"}`}>
            {entry.level}
          </span>
          <span className="shrink-0 text-[9px] text-slate-400 mt-0.5 max-w-[220px] truncate">{entry.logger}</span>
          <span className="text-slate-600 whitespace-pre-wrap break-all min-w-0">{entry.message}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-400">
      <Terminal size={20} className="opacity-30 mb-2" />
      <span className="text-[11px]">{text}</span>
    </div>
  );
}
