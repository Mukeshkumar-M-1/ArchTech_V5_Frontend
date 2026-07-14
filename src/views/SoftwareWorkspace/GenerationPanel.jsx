import { useState, useCallback, useRef, useEffect } from "react";
import TiptapEditor from "../../components/TiptapEditor";
import {
  Zap,
  FileText,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  Terminal,
  GripVertical,
  Eye,
  Download,
  Play,
  List,
  FoldVertical,
} from "lucide-react";
import { getApiUrl } from "../../utils/apiConfig";
import PreviewModal from "./PreviewModal";
import ExportModal from "./ExportModal";

/**
 * Recursive heading tree component.
 */
function HeadingTree({
  nodes,
  depth,
  currentSection,
  expandedSections,
  toggleSection,
}) {
  if (!nodes || nodes.length === 0) return null;

  const levelColors = {
    1: "bg-blue-50 text-blue-600",
    2: "bg-purple-50 text-purple-600",
    3: "bg-amber-50 text-amber-600",
    4: "bg-green-50 text-green-600",
    5: "bg-rose-50 text-rose-600",
  };
  const levelLabels = { 1: "1", 2: "2", 3: "3", 4: "4", 5: "5" };

  return (
    <div className="flex flex-col">
      {nodes.map((node, i) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedSections.has(node.text);

        return (
          <div key={i}>
            <div
              className={`flex items-center gap-1 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                currentSection === node.text
                  ? "bg-blue-100 text-blue-700"
                  : "hover:bg-gray-50 text-gray-700"
              }`}
              style={{ paddingLeft: `${depth * 14 + 12}px` }}
              onClick={() => {
                if (hasChildren) toggleSection(node.text);
              }}
            >
              {hasChildren ? (
                <span className="text-gray-400 shrink-0">
                  {isExpanded ? (
                    <ChevronDown size={10} />
                  ) : (
                    <ChevronRight size={10} />
                  )}
                </span>
              ) : (
                <span className="w-2.5 shrink-0" />
              )}
              <span
                className={`text-[9px] px-1 py-0.5 rounded font-bold shrink-0 ${
                  levelColors[node.level] || "bg-gray-100 text-gray-500"
                }`}
              >
                {levelLabels[node.level] || node.level}
              </span>
              <span className="truncate">{node.text}</span>
            </div>
            {hasChildren && isExpanded && (
              <div className="flex flex-col">
                <HeadingTree
                  nodes={node.children}
                  depth={depth + 1}
                  currentSection={currentSection}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * ExecutionTimeline — Section/turn/tool hierarchical view with left timeline line.
 * Each section has its own turn groups, and tools display status dots.
 */
function ExecutionTimeline({
  entries,
  currentTurn: activeTurn,
  currentSection: sectionName,
  isGenerating,
}) {
  const getToolPreview = (toolName, input) => {
    if (!input) return null;
    switch (toolName) {
      case "FileRead":
      case "FileWrite":
      case "FileEdit": {
        const path = input.file_path || input.target_file || "";
        return path.split(/[/\\]/).pop();
      }
      case "Grep":
      case "Glob":
        return input.pattern || input.glob;
      case "Agent":
        return input.agent_type;
      case "Bash":
        return input.command;
      default:
        return null;
    }
  };

  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [expandedTurns, setExpandedTurns] = useState(new Set());
  const [expandedSections, setExpandedSections] = useState(new Set());

  const toggleEntry = useCallback((entryId) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);

  const toggleTurn = useCallback((turnNum) => {
    setExpandedTurns((prev) => {
      const next = new Set(prev);
      if (next.has(turnNum)) next.delete(turnNum);
      else next.add(turnNum);
      return next;
    });
  }, []);

  const toggleSection = useCallback((section) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  }, []);

  // Group entries by section first, then by turn within each section
  const sectionGroups = entries.reduce((acc, entry) => {
    const sec = entry.section || "Untitled";
    if (!acc[sec]) acc[sec] = {};
    const turnNum = entry.turn || 1;
    if (!acc[sec][turnNum]) acc[sec][turnNum] = [];
    acc[sec][turnNum].push(entry);
    return acc;
  }, {});

  const sectionNames = Object.keys(sectionGroups).sort();

  // Auto-expand sections that have running tools or are currently active
  useEffect(() => {
    const toExpand = new Set(expandedSections);
    for (const secName of sectionNames) {
      const turns = sectionGroups[secName];
      const hasRunning = Object.values(turns).some((tools) =>
        tools.some((t) => t.status === "running"),
      );
      if (hasRunning || (isGenerating && secName === sectionName)) {
        toExpand.add(secName);
      }
    }
    if (toExpand.size !== expandedSections.size) {
      setExpandedSections(toExpand);
    }
  }, [entries, isGenerating]);

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-400">
        <Terminal size={20} className="opacity-30 mb-2" />
        <div className="text-xs text-center">No tool activity yet</div>
      </div>
    );
  }

  const statusConfig = {
    running: { color: "bg-blue-500 animate-pulse" },
    success: { color: "bg-green-500" },
    error: { color: "bg-red-500" },
  };

  return (
    <div className="flex flex-col gap-4">
      {sectionNames.map((secName) => {
        const turnGroups = sectionGroups[secName];
        const turnNumbers = Object.keys(turnGroups)
          .map(Number)
          .sort((a, b) => a - b);
        const isSectionActive = isGenerating && secName === sectionName;
        const isSectionExpanded = expandedSections.has(secName);
        const sectionHasRunning = turnNumbers.some((tn) =>
          turnGroups[tn].some((e) => e.status === "running"),
        );

        return (
          <div
            key={secName}
            className={`rounded-lg border transition-all ${
              isSectionActive
                ? "border-blue-400 bg-blue-50/30 shadow-sm"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {/* Section Header */}
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              onClick={() => toggleSection(secName)}
            >
              <ChevronRight
                size={10}
                className={`text-gray-400 shrink-0 transition-transform ${isSectionExpanded ? "rotate-90" : ""}`}
              />
              <span
                className={`text-[11px] font-bold ${isSectionActive ? "text-blue-600" : "text-gray-700"}`}
              >
                {secName}
              </span>
              {isSectionActive && (
                <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">
                  active
                </span>
              )}
              <span className="text-[10px] text-gray-500 ml-auto mr-1">
                {turnNumbers.length} turn{turnNumbers.length !== 1 ? "s" : ""}
              </span>

              <button
                className="p-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition-colors mr-1"
                title="Toggle all turns"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedTurns((prev) => {
                    const next = new Set(prev);
                    const turnIds = turnNumbers.map((t) => `${secName}-${t}`);
                    const anyExpanded = turnIds.some((id) => next.has(id));
                    if (anyExpanded) {
                      turnIds.forEach((id) => next.delete(id));
                    } else {
                      turnIds.forEach((id) => next.add(id));
                    }
                    return next;
                  });
                }}
              >
                <FoldVertical
                  size={11}
                  className={
                    turnNumbers.some((t) =>
                      expandedTurns.has(`${secName}-${t}`),
                    )
                      ? "rotate-180 transition-transform"
                      : "transition-transform"
                  }
                />
              </button>

              {sectionHasRunning && !isSectionActive && (
                <Loader2
                  size={10}
                  className="animate-spin text-blue-500 shrink-0"
                />
              )}
            </div>

            {/* Section Body */}
            {isSectionExpanded && (
              <div className="px-3 pb-3 flex flex-col gap-2">
                {turnNumbers.map((turnNum) => {
                  const turnTools = turnGroups[turnNum];
                  const turnId = `${secName}-${turnNum}`;
                  const isTurnExpanded = expandedTurns.has(turnId);
                  const hasRunning = turnTools.some(
                    (t) => t.status === "running",
                  );
                  const isActive = isGenerating && activeTurn === turnNum;

                  return (
                    <div
                      key={turnNum}
                      className={`rounded-md border transition-all ${
                        isActive
                          ? "border-blue-200 bg-blue-50/20"
                          : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      {/* Turn Header */}
                      <div
                        className="flex items-center gap-2 px-2.5 py-1.5 cursor-pointer"
                        onClick={() => toggleTurn(turnId)}
                      >
                        <ChevronRight
                          size={9}
                          className={`text-gray-400 shrink-0 transition-transform ${isTurnExpanded ? "rotate-90" : ""}`}
                        />
                        <span
                          className={`text-[10px] font-bold ${isActive ? "text-blue-600" : "text-gray-600"}`}
                        >
                          Turn {turnNum}
                        </span>
                        {hasRunning && !isActive && (
                          <Loader2
                            size={9}
                            className="animate-spin text-blue-500 shrink-0"
                          />
                        )}
                      </div>

                      {/* Tool list */}
                      {isTurnExpanded && (
                        <div className="px-2 pb-2 relative flex flex-col pt-1">
                          {turnTools.map((entry, idx) => {
                            const isEntryExpanded = expandedEntries.has(
                              entry.id,
                            );
                            const statusInfo =
                              statusConfig[entry.status] ||
                              statusConfig.running;
                            const isLast = idx === turnTools.length - 1;

                            return (
                              <div
                                key={entry.id}
                                className="relative pl-6 pb-2 mt-1"
                              >
                                {/* Timeline line */}
                                {!isLast && (
                                  <div className="absolute left-[11px] top-4 bottom-[-16px] w-[1px] bg-gray-200" />
                                )}
                                {/* Timeline Dot */}
                                <div
                                  className={`absolute left-[8px] top-[6px] w-[7px] h-[7px] rounded-full ring-2 ring-white ${statusInfo.color}`}
                                />

                                {/* Tool Header */}
                                <div
                                  className="flex items-center gap-1.5 cursor-pointer group hover:bg-gray-50 rounded px-1.5 py-0.5 -ml-1.5"
                                  onClick={() => toggleEntry(entry.id)}
                                >
                                  <span className="text-[11px] font-bold text-gray-800">
                                    {entry.toolName}
                                  </span>
                                  {getToolPreview(
                                    entry.toolName,
                                    entry.toolInput,
                                  ) && (
                                    <span className="text-[10px] text-gray-500 font-mono truncate">
                                      {getToolPreview(
                                        entry.toolName,
                                        entry.toolInput,
                                      )}
                                    </span>
                                  )}
                                  <div className="flex-1" />
                                  {entry.status === "success" &&
                                    entry.durationMs != null && (
                                      <span className="text-[9px] font-mono text-gray-400">
                                        {entry.durationMs < 1000
                                          ? `${Math.round(entry.durationMs)}ms`
                                          : `${(entry.durationMs / 1000).toFixed(1)}s`}
                                      </span>
                                    )}
                                </div>

                                {/* Expanded Box */}
                                {isEntryExpanded && (
                                  <div className="mt-2 mr-2 rounded bg-[#1e1e1e] border border-gray-700 shadow-sm overflow-hidden text-left flex flex-col">
                                    {entry.toolInput &&
                                      Object.keys(entry.toolInput).length >
                                        0 && (
                                        <div className="flex px-3 py-2">
                                          <div className="w-8 shrink-0 text-[10px] font-mono font-bold text-gray-500 mt-0.5">
                                            IN
                                          </div>
                                          <div className="flex-1 text-[10px] font-mono text-gray-300 whitespace-pre-wrap break-all">
                                            {JSON.stringify(
                                              entry.toolInput,
                                              null,
                                              2,
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    {entry.toolOutput && (
                                      <div
                                        className={`flex px-3 py-2 border-t border-gray-700/50 ${entry.status === "error" ? "bg-red-950/30" : ""}`}
                                      >
                                        <div className="w-8 shrink-0 text-[10px] font-mono font-bold text-gray-500 mt-0.5">
                                          OUT
                                        </div>
                                        <div
                                          className={`flex-1 text-[10px] font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto ${entry.status === "error" ? "text-red-400" : "text-gray-300"}`}
                                        >
                                          {entry.toolOutput}
                                        </div>
                                      </div>
                                    )}
                                    {entry.status === "running" && (
                                      <div className="flex px-3 py-2 border-t border-gray-700/50">
                                        <div className="w-8 shrink-0 text-[10px] font-mono font-bold text-gray-500 mt-0.5">
                                          OUT
                                        </div>
                                        <div className="flex-1 text-[10px] font-mono text-blue-400 animate-pulse">
                                          Executing...
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * GenerationPanel — SRS/SDD document generation with streaming progress.
 *
 * Manages its own document state during generation. On completion,
 * passes the full document to the parent via setSrsDoc.
 */
export default function GenerationPanel({
  srsDoc: parentSrsDoc,
  isGenActive,
  activeMainTab,
  project,
  onCancel,
  setSrsDoc,
}) {
  const mockHeadings = [
    {
      level: 1,
      text: "1. Introduction",
      children: [
        { level: 2, text: "1.1 Purpose", children: [] },
        { level: 2, text: "1.2 Scope", children: [] },
      ],
    },
    {
      level: 1,
      text: "2. Overall Description",
      children: [
        { level: 2, text: "2.1 Product Perspective", children: [] },
        {
          level: 2,
          text: "2.2 Product Functions",
          children: [
            { level: 3, text: "2.2.1 User Management", children: [] },
            { level: 3, text: "2.2.2 Document Generation", children: [] },
          ],
        },
      ],
    },
    {
      level: 1,
      text: "3. System Features",
      children: [{ level: 2, text: "3.1 AI Generation Engine", children: [] }],
    },
  ];

  // Local state for streaming generation
  const [docContent, setDocContent] = useState("");
  const [headings, setHeadings] = useState(mockHeadings);
  const [expandedSections, setExpandedSections] = useState(
    new Set([
      "1. Introduction",
      "2. Overall Description",
      "2.2 Product Functions",
    ]),
  );

  // Modals state
  const [showPreview, setShowPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const mockExecutionLog = [
    {
      id: "tool_1",
      toolName: "FileRead",
      status: "success",
      toolInput: { file_path: "backend/AgentCore/shared/types.py" },
      startTime: Date.now() - 15000,
      turn: 1,
      section: "1. Introduction",
      durationMs: 450,
      toolOutput:
        "class FileReadInput(BaseModel):\n    file_path: str = Field(...)",
    },
    {
      id: "tool_2",
      toolName: "Grep",
      status: "success",
      toolInput: {
        pattern: "BaseModel",
        path: "backend/AgentCore",
        glob: "*.py",
      },
      startTime: Date.now() - 12000,
      turn: 2,
      section: "1. Introduction",
      durationMs: 1200,
      toolOutput:
        "backend/AgentCore/shared/types.py:8:from pydantic import BaseModel, Field\nbackend/AgentCore/shared/types.py:11:class FileReadInput(BaseModel):",
    },
    {
      id: "tool_3",
      toolName: "Glob",
      status: "success",
      toolInput: { pattern: "**/*.py", path: "backend/AgentCore/execution" },
      startTime: Date.now() - 11000,
      turn: 3,
      section: "1. Introduction",
      durationMs: 150,
      toolOutput:
        "backend/AgentCore/execution/__init__.py\nbackend/AgentCore/execution/builtins.py",
    },
    {
      id: "tool_4",
      toolName: "Agent",
      status: "success",
      toolInput: {
        agent_type: "explore",
        prompt: "Analyze the types.py structure and return a summary.",
        run_in_background: false,
      },
      startTime: Date.now() - 9000,
      turn: 1,
      section: "2. Overall Description",
      durationMs: 8500,
      toolOutput:
        "The file defines Pydantic input models for various built-in tools such as FileRead, FileWrite, Bash, and Grep.",
    },
    {
      id: "tool_5",
      toolName: "Bash",
      status: "error",
      toolInput: { command: "pytest backend/tests/test_types.py", timeout: 30 },
      startTime: Date.now() - 4000,
      turn: 2,
      section: "2. Overall Description",
      durationMs: 1500,
      toolOutput:
        "ERROR: file or directory not found: backend/tests/test_types.py",
    },
    {
      id: "tool_6",
      toolName: "TaskCreate",
      status: "success",
      toolInput: {
        subject: "Write tests for types.py",
        description: "Create tests to cover the models defined in types.py",
        activeForm: "Writing tests",
      },
      startTime: Date.now() - 3500,
      turn: 3,
      section: "2.2 Product Functions",
      durationMs: 250,
      toolOutput: "Task created with ID: task_789xyz",
    },
    {
      id: "tool_7",
      toolName: "TodoWrite",
      status: "success",
      toolInput: {
        todos: [
          { content: "Test BaseModel fields", status: "pending" },
          { content: "Test validation", status: "pending" },
        ],
      },
      startTime: Date.now() - 3000,
      turn: 4,
      section: "2.2 Product Functions",
      durationMs: 120,
      toolOutput: "Successfully wrote 2 todos.",
    },
    {
      id: "tool_8",
      toolName: "SendMessage",
      status: "success",
      toolInput: {
        to: "planning-agent",
        message: "I have added the tests to the todo list.",
        message_type: "text",
      },
      startTime: Date.now() - 2800,
      turn: 1,
      section: "3. System Features",
      durationMs: 90,
      toolOutput: "Message delivered to planning-agent.",
    },
    {
      id: "tool_9",
      toolName: "FileEdit",
      status: "running",
      toolInput: {
        file_path: "backend/AgentCore/shared/types.py",
        target_file: "backend/AgentCore/shared/types.py",
        range: { start_line: 11, end_line: 12 },
        insert_content:
          'class FileReadInput(BaseModel):\n    file_path: str = Field(..., description="Absolute path")',
      },
      startTime: Date.now() - 1000,
      turn: 2,
      section: "3. System Features",
    },
  ];

  const [executionLog, setExecutionLog] = useState(mockExecutionLog);
  const [currentTurn, setCurrentTurn] = useState(0);
  const [sidebarTab, setSidebarTab] = useState("outline");
  const currentSectionRef = useRef("");
  const [progress, setProgress] = useState({
    progress: 0,
    phase: "",
    section_current: 0,
    section_total: 0,
    status: "idle",
  });
  const [error, setError] = useState(null);
  const abortRef = useRef(null);
  const containerRef = useRef(null);
  const isResizingRef = useRef(false);
  const currentTurnRef = useRef(0);

  // Sidebar width — default 384px (w-64), range 256-500px
  const [sidebarWidth, setSidebarWidth] = useState(384);
  const SIDEBAR_MIN = 256;
  const SIDEBAR_MAX = 500;
  const SIDEBAR_DEFAULT = 384;

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    isResizingRef.current = true;
  }, []);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newWidth = rect.width - (e.clientX - rect.left);
      setSidebarWidth(Math.max(SIDEBAR_MIN, Math.min(SIDEBAR_MAX, newWidth)));
    };
    const handleMouseUp = () => {
      isResizingRef.current = false;
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  const resetSidebarWidth = useCallback(() => {
    setSidebarWidth(SIDEBAR_DEFAULT);
  }, []);

  const isGenerating = progress.status === "generating";

  /**
   * Start document generation via SSE.
   */
  const handleGenerate = useCallback(async () => {
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;
    setError(null);
    setDocContent("");
    setHeadings([]);
    setExpandedSections(new Set());
    setExecutionLog([]);
    setSidebarTab("execution");
    setProgress({
      progress: 0,
      phase: "Initializing...",
      section_current: 0,
      section_total: 0,
      status: "generating",
    });

    const projectId = project?.id || project?._id;
    const type = activeMainTab === "srs" ? "srs" : "sdd";

    try {
      const res = await fetch(getApiUrl("/generate-document-stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement_ids: [],
          template_type: type,
          project_id: projectId,
        }),
        signal: abortCtrl.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let docContentAccum = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            const { type: eventType } = data;

            if (eventType === "gen_start") {
              setProgress((p) => ({
                ...p,
                section_total: data.section_count,
                section_current: 0,
                progress: 5,
                phase: `Starting document generation — ${data.section_count} sections`,
              }));
            } else if (eventType === "section_start") {
              currentSectionRef.current = data.heading || "";
              setProgress((p) => ({
                ...p,
                phase: `Generating: ${data.heading}`,
                section_current: data.section_current,
              }));
              // Auto-expand the current section
              setExpandedSections((prev) => {
                const next = new Set(prev);
                if (data.heading) next.add(data.heading);
                return next;
              });
            } else if (eventType === "section_chunk") {
              docContentAccum += data.content || "";
              setDocContent(docContentAccum);
            } else if (eventType === "section_complete") {
              const parsed = data.headings_parsed || [];
              setHeadings((prev) => {
                const next = [...prev];
                for (const h of parsed) next.push(h);
                return next;
              });
              setExpandedSections((prev) => {
                const next = new Set(prev);
                if (data.heading) next.add(data.heading);
                return next;
              });
            } else if (eventType === "progress") {
              setProgress((p) => ({
                ...p,
                progress: data.progress,
                phase: data.phase,
                section_current: data.section_current,
                section_total: data.section_total,
              }));
            } else if (eventType === "tool_started") {
              const turnForTool = currentTurnRef.current;
              const section =
                currentSectionRef.current ||
                progress.phase.replace("Generating: ", "");
              setExecutionLog((prev) => [
                ...prev,
                {
                  id: data.tool_call_id,
                  toolName: data.tool_name,
                  status: "running",
                  toolInput: data.input || {},
                  startTime: Date.now(),
                  turn: turnForTool,
                  section: section,
                },
              ]);
            } else if (eventType === "tool_finished") {
              const toolCallId = data.tool_call_id;
              const isToolError = data.is_error;
              setExecutionLog((prev) =>
                prev.map((entry) => {
                  if (entry.id === toolCallId) {
                    const completedAt = Date.now();
                    return {
                      ...entry,
                      status: isToolError ? "error" : "success",
                      durationMs:
                        data.duration_ms || completedAt - entry.startTime,
                      toolOutput: data.output || "",
                    };
                  }
                  return entry;
                }),
              );
            } else if (eventType === "turn_start") {
              const newTurn = data.turn || currentTurnRef.current + 1;
              currentTurnRef.current = newTurn;
              setCurrentTurn(newTurn);
            } else if (eventType === "turn_complete") {
              // Turn completed, stays at current for next tools
            } else if (eventType === "gen_complete") {
              setProgress((p) => ({
                ...p,
                progress: 100,
                phase: `Complete — ${data.total_sections} sections generated`,
                status: "complete",
              }));
              // Sync with parent
              if (setSrsDoc) setSrsDoc(docContentAccum);
            } else if (eventType === "gen_error") {
              setError(data.error);
              setProgress((p) => ({ ...p, status: "error" }));
            } else if (eventType === "cancel") {
              setProgress((p) => ({ ...p, status: "cancelled" }));
            }
          } catch {
            // Skip malformed SSE events
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message);
      setProgress((p) => ({ ...p, status: "error" }));
    } finally {
      abortRef.current = null;
    }
  }, [project, activeMainTab, setSrsDoc]);

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort("user cancelled");
    }
    if (onCancel) onCancel();
    setProgress((p) => ({ ...p, status: "cancelled" }));
  }, [onCancel]);

  const toggleSection = useCallback((path) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Use local doc during generation, fall back to parent doc when idle
  const displayDoc = `| Document Information | Details |
|---------------------|---------|
| Document Title | Software Requirements Specification (SRS) |
| Document Reference | DP-OBC-8184-603-SRS |
| Version Number | 0V01 |
| Version Date | 2026-04-30 |
| Prepared By | Data Patterns (India) Limited |
| Document Review By | [REVIEWER] |
| Technical Review By | [TECHNICAL_REVIEWER] |
| Process Review By | [PROCESS_REVIEWER] |
| Approved By | [APPROVER] |

---

**REVISION HISTORY**

| Version | Date | Author | Description of Changes |
|---------|------|--------|----------------------|
| 0V01 | 2026-04-30 | Data Patterns | Initial Version |
| | | | |
| | | | |

---

# 1. INTRODUCTION

## 1.1 Purpose

This Software Requirements Specification (SRS) document describes the requirements involved in the design and development of the test application software for DP-OBC-8184 processor board, that will be used to test and qualify the hardware available on this board. The software shall enable comprehensive validation of all hardware modules including the Processor Module (SBC), Optical Interface Module, Video Processing Module, SATA Storage Module, Power Supply Module, and communication interfaces.

**Table 1.1: Entities Involved in DP-OBC-8184**

| Topics | Details |
|--------------|------------|
| Identification Number | DP-OBC-8184 |
| Title | Rugged Controller for ADFCR/ DP-OBC-8184 |
| Version Number | 0V01 |
| Abbrevation | SRS (Software Requirement Specification) |

---

## 1.2 Scope

Scope of this document is to capture the functional, operation, interface, performance, safety, and qualification related requirement for the software. The software shall be developed for system-specific requirements and for testing the functionality of DP-OBC-8184 Rugged Controller. The test application shall validate all hardware components including the 9th Generation Intel Xeon Processor, 32GB DDR4 memory, 512GB SATA SSD storage, multiple communication interfaces (RS422, RS485, RS232, USB, CAN, Ethernet), optical interfaces, and the NVIDIA Quadro GPU module. The software shall operate on Ubuntu Linux 22.04 and shall support both manual and automated testing modes for hardware qualification and production testing.

---

## 1.3 Definitions, Acronyms, and Abbreviations

**Table 1.2: List of Definitions, Acronyms, and Abbreviations**

| Term/Acronym | Definition |
|--------------|------------|
| SRS | Software Requirements Specification |
| SDD | Software Design Document |
| HRS | Hardware Requirements Specification |
| SyRS | System Requirements Specification |
| ADFCR | Air Defence Fire Control Radar |
| OBC | On Board Computer |
| VPX | Virtual Path Cross-Connect |
| SBC | Single Board Computer |
| DDR4 | Double Data Rate 4 SDRAM |
| SSD | Solid State Drive |
| SATA | Serial Advanced Technology Attachment |
| USB | Universal Serial Bus |
| CAN | Controller Area Network |
| UART | Universal Asynchronous Receiver Transmitter |
| GPIO | General Purpose Input/Output |
| FPGA | Field Programmable Gate Array |
| XMC | Express Mezzanine Card |
| GPU | Graphics Processing Unit |
| UHD | Ultra High Definition |
| DVI | Digital Visual Interface |
| RS232 | Recommended Standard 232 |
| RS422 | Recommended Standard 422 |
| RS485 | Recommended Standard 485 |
| MODBUS | Industrial communication protocol |
| IP | Ingress Protection |
| EMI | Electro Magnetic Interference |
| EMC | Electro Magnetic Compatibility |
| MIL STD | Military Standard |
| JSS | Japanese Industrial Standard |
| BSP | Board Support Package |
| RTOS | Real Time Operating System |
| KC | Key Characteristics |
| IV&V | Independent Verification and Validation |
| MGT | Multi-Gigabit Transceiver |
| PCIe | Peripheral Component Interconnect Express |
| FPDP | Front Panel Data Port |
| FIFO | First In First Out |
| GPIO | General Purpose Input/Output |
| JTAG | Joint Test Action Group |
| MD5 | Message Digest Algorithm 5 |
| ECC | Error Correction Code |
| NAND | Not AND (Flash memory type) |
| SPI | Serial Peripheral Interface |
| QSPI | Quad Serial Peripheral Interface |
| NOR | Not OR (Flash memory type) |

---

## 1.4 References

**Table 1.3: Reference Documents**

| S.NO | Document | Reference | Date |
|------|----------|-----------|------|
| 1 | Hardware Requirements Specification | DP-OBC-8184-600-HRS-0V01 | 2024-03-30 |
| 2 | System Requirements Specification | DP-OBC-8184-603-SyRS-0V01 | 2024-03-30 |
| 3 | System Requirements Specification for Air Defence Fire Control Radar | DP-RDR-8227-600-SYRS-xVyz | - |
| 4 | System Requirements Specification for X Band Search RADAR for ADFCR | DP-RDR-8230-600-SYRS-xVyz | - |
| 5 | System Requirements Specification for Ka Band Track RADAR for ADFCR | DP-RDR-8239-600-SYRS-xVyz | - |

---

## 1.5 Document Overview

**Document Organization:**

This Software Requirements Specification (SRS) document is organized as follows:

- **Section 1 (Introduction):** Provides an overview of the document, including its purpose, scope, definitions, and references.

- **Section 2 (Overall Description):** Describes the product perspective, functions, user classes, operating environment, design constraints, and assumptions.

- **Section 3 (External Interface Requirements):** Details the user, hardware, software, and communications interfaces.

- **Section 4 (Functional Requirements):** Specifies the functional requirements organized by application/module type.

- **Section 5 (Software System Attributes):** Covers performance, safety, security requirements, and software quality attributes.

- **Section 6 (Other Requirements):** Addresses any additional requirements not covered elsewhere.

- **Section 7 (Requirements Traceability):** Maps requirements from customer documents to this SRS.

- **Appendices:** Contains KC mapping and supporting information.

---

# 2. OVERALL DESCRIPTION

## 2.1 Product Perspective

The Rugged Controller for ADFCR (DP-OBC-8184) is a mission-critical subsystem designed for the Air Defence Fire Control Radar system. This controller serves as the central processing and communication hub for both X-band search radar and Ka-band track radar vehicles. The software application developed for this controller shall provide comprehensive hardware validation and testing capabilities for all integrated modules.

The system architecture comprises multiple interconnected modules including the Processor Module (DP-VPX-0750), Optical Interface Module (DP-XMC-5010), Video Processing Module (DP-VPX-5797), SATA Storage Module (DP-VPX-4001), Power Supply Module (DP-PSU-8218), and various interface modules. Each module plays a critical role in the overall system functionality, and the test application shall validate the proper operation of each component.

The Processor Module serves as the main computing engine, featuring a 9th Generation Intel Xeon Processor-E with 6 cores operating at 2.0GHz. It provides 32GB of ECC DDR4 SDRAM for reliable data processing and includes extensive I/O capabilities. The test software shall validate processor functionality, memory integrity, and all peripheral interfaces including USB, Ethernet, and serial ports.

The Optical Interface Module (DP-XMC-5010) handles high-speed data acquisition through Front Panel Data Port (FPDP) interfaces. It supports both optical and copper connections with data rates up to 3.6 Gbps. The module includes 256MB DDR2 SDRAM with FIFO buffering for smooth data flow. Testing shall verify optical communication integrity, data throughput, and protocol compliance.

The Video Processing Module (DP-VPX-5797) provides advanced video processing capabilities through a Kintex-7 FPGA and NVIDIA Quadro GPU with 768 CUDA cores. It supports multiple DVI input channels and provides hardware-accelerated video processing. The test application shall validate video input processing, GPU functionality, and frame buffer operations.

The SATA Storage Module (DP-VPX-4001) provides reliable data storage with a 512GB SATA SSD and includes dual CAN channels for additional I/O expansion. The module features advanced data security measures including end-to-end data path protection. Testing shall verify storage read/write operations, data integrity, and CAN communication functionality.

The Power Supply Module (DP-PSU-8218) converts input voltage (18-32V DC) to multiple regulated outputs (+12V, +5V, +3.3V) required by all system modules. It includes comprehensive protection features and health monitoring. The test software shall validate voltage regulation, protection mechanisms, and power good signaling.

The system operates within a ruggedized enclosure meeting JSS 55555 military standards with IP65 ingress protection and MIL-STD-461F EMI/EMC compliance. The conduction-cooled design ensures reliable operation in harsh environmental conditions ranging from -20°C to +60°C.

**Figure 2.1: DP-OBC-8184 Block Diagram**

![Kitty.jpg](data:image/jpeg;base64,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)

---

## 2.2 Product Functions

The Rugged Controller test application provides comprehensive hardware validation and testing capabilities for the DP-OBC-8184 system. The primary functions include system initialization, hardware module discovery, interface testing, functional validation, and comprehensive reporting.

**System Initialization and Configuration:** The application shall perform complete system initialization including hardware detection, resource allocation, and interface configuration. During initialization, the software shall enumerate all connected modules, verify their presence through dedicated identification registers, and configure communication interfaces according to system requirements. The initialization process shall establish communication channels with each hardware module and verify basic functionality before proceeding with detailed testing.

**Hardware Module Testing:** The test application shall validate each hardware module independently and as part of the integrated system. Processor module testing includes CPU functionality verification, memory integrity testing (DDR4 ECC validation), and peripheral interface validation. Storage module testing encompasses SSD read/write operations, data integrity verification, and endurance testing. Power supply validation includes output voltage measurement, current consumption monitoring, and protection circuit verification.

**Interface Communication Testing:** All communication interfaces shall be tested for proper functionality including RS232, RS422, RS485, USB, Ethernet, CAN, and optical interfaces. The testing shall verify data transmission integrity, protocol compliance, and performance characteristics. Loopback tests shall be performed where applicable to validate both transmit and receive functionality.

**Video Processing Validation:** The video processing module testing shall validate DVI input channel functionality, GPU processing capabilities, and frame buffer operations. Tests shall verify proper video signal acquisition, processing pipeline functionality, and output rendering. CUDA core functionality shall be validated through computational tests.

**Environmental and Stress Testing:** The application shall support extended operation testing under various conditions to validate system reliability. This includes long-duration operation tests, thermal cycling validation, and stress testing under maximum load conditions.

**Data Logging and Reporting:** All test operations shall be logged with timestamps and detailed results. The application shall generate comprehensive reports including test coverage, pass/fail status, and detailed measurement data. Action logs shall maintain a complete record of all user operations and system events.

**Figure 2.2: DP-OBC-8184 Functionality Diagram**

---

## 2.3 User Classes and Characteristics

The different users of the DP-OBC-8184 test application are:

- **Design Engineers:** Require comprehensive testing capabilities for design validation and verification. They possess in-depth knowledge of the system architecture and require detailed diagnostic information.

- **Production Test Operators:** Need straightforward test execution capabilities for production line testing. They require basic product knowledge and clear pass/fail indicators with minimal technical detail.

- **Quality Assurance Personnel:** Require detailed test reports and compliance verification. They need access to historical data, trend analysis, and certification documentation.

- **Maintenance Technicians:** Need diagnostic capabilities for field troubleshooting. They require moderate system knowledge and access to module-level testing functions.

All users shall have access to role-specific functionality with appropriate security controls. The application shall support user authentication and authorization to ensure proper access control.

---

## 2.4 Operating Environment

The operating environment details of the software are given in the below table.

**Table 2.1: Operating Environment Specifications**

| Environment Category | Specification |
|---------------------|---------------|
| **Hardware Platform** | Intel Xeon Processor-E 2276ML 2.0GHz (6 Cores), 32GB DDR4 ECC RAM, 512GB SATA SSD, NVIDIA Quadro GPU (768 CUDA cores), VPX backplane with 3U form factor |
| **Operating System** | Ubuntu Linux 22.04 LTS (64-bit) |
| **Software Environment** | Board Support Package (BSP) for Ubuntu 22.04, Linux kernel drivers for all interfaces, CUDA toolkit for GPU processing, Qt framework for GUI |
| **Network Environment** | 2x 10/100/1000 Base-T Ethernet ports, RS422/RS485/RS232 serial interfaces, CAN bus (up to 1 Mbit/s), Optical FPDP interfaces (2.5-3.6 Gbps) |

---

## 2.5 Design and Implementation Constraints

- The application shall run exclusively on Ubuntu Linux 22.04 LTS operating system.
- All hardware interface drivers shall be provided through the Board Support Package (BSP).
- The application shall utilize CUDA-supported GPU for video processing tasks.
- Real-time performance requirements shall be met through Linux kernel optimizations.
- All communication protocols shall comply with military standards (MIL-STD-461F).
- The application shall support both manual and automated test execution modes.
- GUI shall be developed using Qt framework for cross-platform compatibility.
- All test results shall be stored in structured format with timestamp and metadata.
- The application shall support remote operation capabilities through network interfaces.
- Security requirements include user authentication and role-based access control.

---

## 2.6 User Documentation

The product shall include the following documents:

- User Manual - Comprehensive guide for test application operation
- Quick Start Guide - Basic operation instructions for production testing
- API Reference - Technical documentation for integration and customization
- Troubleshooting Guide - Diagnostic procedures and error resolution
- Release Notes - Version-specific information and known issues

---

## 2.7 Assumptions and Dependencies

**Assumptions:**
- Assumption 1: All hardware modules are properly installed and powered - if incorrect, test execution will fail with hardware detection errors.
- Assumption 2: Ubuntu Linux 22.04 BSP is correctly installed with all drivers - if incorrect, hardware interfaces may not function properly.
- Assumption 3: Test equipment (power supply, measurement instruments) is available and calibrated - if incorrect, qualification testing cannot be performed.

**Dependencies:**
- Dependency 1: Board Support Package (BSP) for hardware abstraction - changes may require application recompilation.
- Dependency 2: Linux kernel version compatibility - major version changes may affect driver functionality.
- Dependency 3: CUDA toolkit version for GPU operations - updates may require application modifications.

---

# 3. EXTERNAL INTERFACE REQUIREMENTS

External interface requirements define the connections between the software product and its external environment, including users, hardware, software, and communications interfaces.

## 3.1 User Interfaces

The application software shall interface with the user through Graphical User Interface (GUI). The user shall communicate with the system using mouse and keyboard.

- Application shall consist of standard GUI layouts such as menu bar, action log, standard buttons and other user-friendly controls.
- All controls shall be available with keyboard shortcuts and shall be tab ordered.
- Pop-up message boxes shall be used to provide warning and error messages to intimate the user about failures or serious events.
- Every user action shall be listed in the action log to monitor previous activities.
- Navigation panel shall be used to assist the user for easy transition in accessing each functionality.
- Test results shall be displayed in tabular format with color-coded pass/fail indicators.
- Real-time status indicators shall show system health and test progress.

---

## 3.2 Hardware Interfaces

**Table 3.1: Hardware Interfaces**

| Sl.No. | Device | Interface | Description |
|--------|--------|-----------|-------------|
| 1 | Processor Module (SBC) | PCIe Gen2, VPX Backplane | Main processing unit with Intel Xeon processor, memory, and I/O interfaces |
| 2 | Optical Interface Module | FPDP/Aurora Protocol (Optical/Copper) | High-speed data acquisition with 256MB DDR2 SDRAM FIFO buffer |
| 3 | Video Processing Module | PCIe, DVI, GPU (MXM) | Video signal processing with Kintex-7 FPGA and NVIDIA Quadro GPU |
| 4 | SATA Storage Module | SATA III, PCIe (CAN) | 512GB SSD storage with dual CAN channel interface |
| 5 | Power Supply Module | VPX Power Backplane | DC-DC conversion (18-32V input to +12V/+5V/+3.3V outputs) |
| 6 | EMI Filter Module | VPX Power Input | EMI filtering and input protection |
| 7 | Backplane Module | VPX P1/P2/P3 Connectors | 3U VPX 4-slot backplane with PCIe Gen2 routing |
| 8 | Circular Connector Module | MIL STD 38999 Series III | External field interface connectors |
| 9 | RS422/RS485 Ports | Serial Interface | Communication with IFF, Gimbal controllers, VFD |
| 10 | Ethernet Ports | 10/100/1000 Base-T | Network communication with other subsystems |
| 11 | USB Ports | USB 2.0 | Peripheral connectivity and data transfer |
| 12 | CAN Ports | CAN 2.0 A/B | Controller area network communication |

---

## 3.3 Software Interfaces

The application shall interface with the following software components:

- **Board Support Package (BSP):** Provides hardware abstraction layer for all device drivers.
- **Linux Kernel:** Version 5.15 or later for Ubuntu 22.04 compatibility.
- **CUDA Runtime:** For GPU-accelerated video processing operations.
- **Qt Framework:** Version 5.15 or later for GUI development.
- **Database System:** SQLite for test result storage and retrieval.
- **Communication Libraries:** libserial for serial ports, libusb for USB, socket libraries for Ethernet.

---

## 3.4 Communications Interfaces

**Table 3.2: Communications Interfaces**

| Sl.No. | Interface | Protocol | Description |
|--------|-----------|----------|-------------|
| 1 | RS422 | Differential Serial | Communication with IFF Module, Radar Gimbal Controller |
| 2 | RS485 | MODBUS | Variable frequency driver module communication |
| 3 | RS232 | Serial | Debug and configuration interfaces |
| 4 | Ethernet | TCP/IP | Network communication with other subsystems |
| 5 | FPDP | Aurora Protocol | High-speed optical data transfer (2.5-3.6 Gbps) |
| 6 | CAN | CAN 2.0 A/B | Controller area network (up to 1 Mbit/s) |
| 7 | USB | USB 2.0 | Peripheral connectivity |

---

# 4. FUNCTIONAL REQUIREMENTS

**Table 4.1: DP-OBC-8184 Board Validation Test Requirement IDs**

| Sl.No. | Requirement ID | Requirement Name | Reference Requirement ID |
|--------|----------------|------------------|-------------------------|
| 1 | DP_OBC_8184_HOST_01 | Host Application | DP-OBC-8184-600-SyRS-SDG-002 |
| 2 | DP_OBC_8184_TARGET_02 | Target Application | DP-OBC-8184-600-SyRS-SDG-002 |
| 3 | DP_OBC_8184_SBC_03 | SBC Processor Module Test | Derived |
| 4 | DP_OBC_8184_STOR_04 | Storage Module Test | Derived |
| 5 | DP_OBC_8184_VIDEO_05 | Video Processing Test | Derived |
| 6 | DP_OBC_8184_PWR_06 | Power Supply Test | Derived |
| 7 | DP_OBC_8184_INT_07 | Interface Test | DP-OBC-8184-600-SyRS-EXT-001 |
| 8 | DP_OBC_8184_OPT_08 | Optical Interface Test | DP-OBC-8184-600-SyRS-EXT-002 |

---

## 4.1 Host Application

**Description:**
The host application is a GUI application that runs on the test PC/server for controlling hardware validation, receiving test data, and managing test operations.

**Table 4.1: Host Application Test Requirement**

| Sl.No | Requirement ID | Requirement Name |
|-------|----------------|------------------|
| 1 | DP_OBC_8184_HOST_01 | Host Application |

**Table 4.2: Host Application Test Sub Requirements**

| Sl.No | Sub Requirement ID | Requirement Name |
|-------|-------------------|------------------|
| 1 | DP_OBC_8184_HOST_USR_AUTH_01_01 | User Authentication |
| 2 | DP_OBC_8184_HOST_INIT_01_02 | Initialization |
| 3 | DP_OBC_8184_HOST_USR_MGMT_01_03 | User Management |
| 4 | DP_OBC_8184_HOST_TEST_EXEC_01_04 | Test Execution |
| 5 | DP_OBC_8184_HOST_REPORT_01_05 | Report Generation |
| 6 | DP_OBC_8184_HOST_LOG_01_06 | Action Logging |

---

### 4.1.1 User Authentication

**Description:**
The user authentication module shall ensure that only authorized users are allowed to access the software. The module shall collect the user name and password from the user. Then it shall evaluate the user name and password entered by the user and allows the user to proceed if both are valid. Any invalid input shall lead to the display of an error message and prompt for the user to re-enter the details.

**Table 4.3: User Authentication**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| DP_OBC_8184_HOST_USR_AUTH_01_01 | **Description:** The system shall authenticate users before granting access to test functions. Invalid login attempts shall be logged and limited to prevent unauthorized access. |

---

### 4.1.2 Initialization

**Description:**
This module shall ensure that the initialization of communication interfaces between host and target components is established successfully. This module shall enable or disable the connection between host application and target hardware through device drivers based on software control.

**Table 4.4: Initialization**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| DP_OBC_8184_HOST_INIT_01_02 | **Description:** The initialization module shall detect all hardware modules, configure communication interfaces, and verify system readiness before test execution. |

---

### 4.1.3 User Management

**Description:**
This module shall provide an option to change the password for the user name and manage user access levels. Different user classes shall have appropriate access to test functions based on their role.

**Table 4.5: User Management**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| DP_OBC_8184_HOST_USR_MGMT_01_03 | **Description:** User management shall support multiple access levels including Administrator, Engineer, Operator, and Viewer with appropriate permissions. |

---

### 4.1.4 Test Execution

**Description:**
The test execution module shall control the running of all hardware validation tests. Users shall be able to select individual tests or run complete test suites in manual or automatic mode.

**Table 4.6: Test Execution**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| DP_OBC_8184_HOST_TEST_EXEC_01_04 | **Description:** Test execution shall support manual selection, sequential execution, and automated test sequences with configurable parameters. |

---

### 4.1.5 Report Generation

**Description:**
The report generation module shall create comprehensive test reports including test coverage, results, and measurement data. Reports shall be exportable in multiple formats.

**Table 4.7: Report Generation**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| DP_OBC_8184_HOST_REPORT_01_05 | **Description:** Reports shall include test summary, detailed results, timestamps, operator information, and be exportable as PDF, CSV, and XML formats. |

---

### 4.1.6 Action Logging

**Description:**
The action logging module shall record all user operations and system events for audit and troubleshooting purposes.

**Table 4.8: Action Logging**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| DP_OBC_8184_HOST_LOG_01_06 | **Description:** All user actions, test events, errors, and system status changes shall be logged with timestamps and stored for historical analysis. |

---

## 4.2 Target Application

**Description:**
The target application runs in the SBC/Processing Unit which accesses and controls FPGA/Processor devices in the DP-OBC-8184 module as master/controller.

**Table 4.9: Target Application Test Requirement**

| Sl.No | Requirement ID | Requirement Description |
|-------|----------------|------------------------|
| 1 | DP_OBC_8184_TARGET_02 | Target Application |

**Table 4.10: Target Application Test Sub Requirements**

| Sl.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | DP_OBC_8184_TARGET_BRD_DETAILS_02_01 | Get Board Details |
| 2 | DP_OBC_8184_TARGET_SBC_TEST_02_02 | SBC Processor Test |
| 3 | DP_OBC_8184_TARGET_DDR_02_03 | DDR Memory Test |
| 4 | DP_OBC_8184_TARGET_STORAGE_02_04 | Storage Test |
| 5 | DP_OBC_8184_TARGET_TEMP_02_05 | Temperature Test |
| 6 | DP_OBC_8184_TARGET_INT_02_06 | Interface Test |
| 7 | DP_OBC_8184_TARGET_VIDEO_02_07 | Video Processing Test |
| 8 | DP_OBC_8184_TARGET_OPT_02_08 | Optical Interface Test |

---

### 4.2.1 Get Board Details

**Description:**
The DP-OBC-8184 has read-only registers for reading board details such as board ID, board version, and type ID. On selecting this test, interface read operations shall be performed on these registers and displayed in the console.

**Table 4.11: Get Board Details**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| DP_OBC_8184_TARGET_BRD_DETAILS_02_01 | **Description:** The system shall read and display board identification information including board ID, version number, manufacturer, and hardware revision. |

---

### 4.2.2 SBC Processor Test

**Description:**
This test shall validate the Intel Xeon Processor functionality including CPU operation, instruction execution, and performance characteristics.

**Table 4.12: SBC Processor Test**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| DP_OBC_8184_TARGET_SBC_TEST_02_02 | **Description:** Processor testing shall verify core functionality, cache operation, and instruction set compliance through computational tests. |

---

### 4.2.3 DDR Memory Test

**Description:**
The DDR4 memory test shall validate the 32GB ECC SDRAM for data integrity and reliability.

**Table 4.13: DDR Memory Test**

| Sl.No | Requirement ID | Requirement Description |
|-------|----------------|------------------------|
| 1 | DP_OBC_8184_TARGET_DDR_02_03 | DDR Memory Test |

**Table 4.14: DDR Memory Test Sub Requirements**

| Sl.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | DP_OBC_8184_TARGET_DDR_FULL_02_03_01 | DDR Full Memory Test |
| 2 | DP_OBC_8184_TARGET_DDR_DATA_02_03_02 | DDR Data Bus Test |
| 3 | DP_OBC_8184_TARGET_DDR_ADDR_02_03_03 | DDR Address Bus Test |
| 4 | DP_OBC_8184_TARGET_DDR_ECC_02_03_04 | DDR ECC Validation |

---

#### 4.2.3.1 DDR Full Memory Test

**Description:**
The DP-OBC-8184 DDR full memory test shall be performed by writing and reading predefined pattern data and anti-pattern data in each location of all memory banks.

**Table 4.15: DDR Full Memory Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| DP_OBC_8184_TARGET_DDR_FULL_02_03_01 | **Description:** Full memory test shall write and verify multiple patterns (0x00, 0xFF, 0xAA, 0x55, walking 1/0) across all 32GB of DDR4 memory. |

---

#### 4.2.3.2 DDR Data Bus Test

**Description:**
This test shall validate the 64-bit data lines in the DDR memory by performing walking 1's and walking 0's tests.

**Table 4.16: DDR Data Bus Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| DP_OBC_8184_TARGET_DDR_DATA_02_03_02 | **Description:** Data bus testing shall verify each data bit line through walking pattern tests to detect stuck-at or shorted lines. |

---

#### 4.2.3.3 DDR Address Bus Test

**Description:**
This test shall validate the address lines in the DDR memory by writing known pattern and anti-pattern data to verify address decoding.

**Table 4.17: DDR Address Bus Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| DP_OBC_8184_TARGET_DDR_ADDR_02_03_03 | **Description:** Address bus testing shall verify each address line through pattern tests to ensure proper memory location addressing. |

---

#### 4.2.3.4 DDR ECC Validation

**Description:**
This test shall validate the Error Correction Code functionality of the DDR4 memory system.

**Table 4.18: DDR ECC Validation**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| DP_OBC_8184_TARGET_DDR_ECC_02_03_04 | **Description:** ECC validation shall verify single-bit error correction and multi-bit error detection capabilities of the memory system. |

---

### 4.2.4 Storage Test

**Description:**
The SATA SSD storage module test shall validate read/write operations, data integrity, and storage functionality.

**Table 4.19: Storage Test Requirement**

| Sl.No | Requirement ID | Requirement Description |
|-------|----------------|------------------------|
| 1 | DP_OBC_8184_TARGET_STORAGE_02_04 | Storage Test |

**Table 4.20: Storage Test Sub Requirements**

| Sl.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | DP_OBC_8184_TARGET_STOR_READ_02_04_01 | SSD Read Test |
| 2 | DP_OBC_8184_TARGET_STOR_WRITE_02_04_02 | SSD Write Test |
| 3 | DP_OBC_8184_TARGET_STOR_INTEG_02_04_03 | Data Integrity Test |
| 4 | DP_OBC_8184_TARGET_STOR_PERF_02_04_04 | Performance Test |

---

### 4.2.5 Temperature Test

**Description:**
The temperature monitoring test shall validate thermal sensors and health monitoring functionality.

**Table 4.21: Temperature Test Requirement**

| Sl.No | Requirement ID | Requirement Description |
|-------|----------------|------------------------|
| 1 | DP_OBC_8184_TARGET_TEMP_02_05 | Temperature Test |

**Table 4.22: Temperature Test Sub Requirements**

| Sl.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | DP_OBC_8184_TARGET_TEMP_LOCAL_02_05_01 | Read Local Temperature |
| 2 | DP_OBC_8184_TARGET_TEMP_REMOTE_02_05_02 | Read Remote Temperature |

---

#### 4.2.5.1 Local Temperature Read

**Description:**
This test case shall be selected for reading local temperature value from the dedicated register through the system management interface.

**Table 4.23: Local Temperature Read Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| DP_OBC_8184_TARGET_TEMP_LOCAL_02_05_01 | **Description:** Local temperature reading shall monitor the SBC processor and power supply thermal sensors. |

---

#### 4.2.5.2 Remote Temperature Read

**Description:**
This test case shall be selected for reading remote temperature values from distributed thermal sensors across the system.

**Table 4.24: Remote Temperature Read Test**

| Sub Requirement ID | Requirement Description |
|-------------------|------------------------|
| DP_OBC_8184_TARGET_TEMP_REMOTE_02_05_02 | **Description:** Remote temperature reading shall monitor thermal sensors on video processing module, storage module, and other components. |

---

### 4.2.6 Interface Test

**Description:**
The interface test shall validate all communication ports including RS232, RS422, RS485, USB, Ethernet, and CAN interfaces.

**Table 4.25: Interface Test Requirement**

| Sl.No | Requirement ID | Requirement Description |
|-------|----------------|------------------------|
| 1 | DP_OBC_8184_TARGET_INT_02_06 | Interface Test |

**Table 4.26: Interface Test Sub Requirements**

| Sl.No | Sub Requirement ID | Requirement Description |
|-------|-------------------|------------------------|
| 1 | DP_OBC_8184_TARGET_INT_RS232_02_06_01 | RS232 Test |
| 2 | DP_OBC_8184_TARGET_INT_RS422_02_06_02 | RS422 Test |
| 3 | DP_OBC_8184_TARGET_INT_RS485_02_06_03 | RS485 Test |
| 4 | DP_OBC_8184_TARGET_INT_USB_02_06_04 | USB Test |
| 5 | DP_OBC_8184_TARGET_INT_ETH_02_06_05 | Ethernet Test |
| 6 | DP_OBC_8184_TARGET_INT_CAN_02_06_06 | CAN Test |

---

### 4.2.7 Video Processing Test

**Description:**
The video processing module test shall validate DVI inputs, GPU functionality, and video processing capabilities.

**Table 4.27: Video Processing Test**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| DP_OBC_8184_TARGET_VIDEO_02_07 | **Description:** Video testing shall validate all 4 DVI input channels, GPU CUDA cores, frame buffer operations, and video processing pipeline functionality. |

---

### 4.2.8 Optical Interface Test

**Description:**
The optical interface test shall validate the FPDP module functionality including optical transceivers and high-speed data transfer.

**Table 4.28: Optical Interface Test**

| Requirement ID | Requirement Description |
|----------------|------------------------|
| DP_OBC_8184_TARGET_OPT_02_08 | **Description:** Optical interface testing shall verify FPDP protocol operation, data throughput, and optical link integrity for both transmit and receive paths. |

---

# 5. SOFTWARE SYSTEM ATTRIBUTES

Software system attributes define the quality characteristics and non-functional requirements for the software product.

## 5.1 Performance Requirements

- Both the host and target application shall run simultaneously. After sending the command to the target hardware, the host shall wait for the response from the target and then display the test status in GUI.
- All test plans shall be carried out only if all hardware modules are present in the system.
- Auto Mode test report and action logging shall be done up to the last executed point if the system hangs/closes abnormally.
- Memory test shall complete within specified time limits based on memory size.
- Interface throughput shall meet minimum data rate requirements (Ethernet ≥ 100 Mbps, FPDP ≥ 2.5 Gbps).
- Test execution shall provide real-time status updates with latency less than 1 second.
- Report generation shall complete within 30 seconds for full test suite results.

---

## 5.2 Safety Requirements

**Safety Requirements Implementation:**

- **System integrity protection:** The application shall prevent unauthorized modifications to test configurations and results.
- **Data loss prevention:** All test results shall be automatically saved at regular intervals and upon test completion.
- **Recovery procedures:** The application shall support resume-from-checkpoint for interrupted test sequences.
- **Fail-safe operations:** Hardware interfaces shall be safely disabled on application crash or system error.
- **Emergency shutdown procedures:** The application shall provide controlled shutdown capability to prevent hardware damage.

---

## 5.3 Security Requirements

**Security Requirements:**

- **Authentication mechanisms:** User login with username/password authentication shall be required for application access.
- **Authorization controls:** Role-based access control shall limit functionality based on user class.
- **Data encryption standards:** Sensitive data shall be encrypted at rest and in transit.
- **Audit logging requirements:** All user actions and system events shall be logged for audit purposes.
- **Network security measures:** Network communications shall use secure protocols where applicable.
- **Data privacy protections:** Test results shall be protected from unauthorized access or modification.

---

## 5.4 Software Quality Attributes

The application software quality attributes, including maintainability and reusability details, are dealt in this section.

### 5.4.1 Maintainability

The software shall be maintained with version details and program checksum. The modular architecture shall enable easy updates to individual test modules without affecting overall system functionality. Code shall follow DP coding guidelines with comprehensive Doxygen documentation.

### 5.4.2 Reusability

Files generated by the test application software shall be timestamped with date for future references. Test modules shall be designed for reuse across different hardware configurations. Common functionality shall be implemented as reusable libraries.

---

## 5.5 Business Rules

- Test results shall be immutable once finalized and signed off.
- Production testing shall require operator authentication and test session logging.
- Quality assurance personnel shall have authority to approve/reject test results.
- Design engineers shall have access to diagnostic and debug functionality.
- Test configurations shall be version-controlled and traceable.

---

# 6. OTHER REQUIREMENTS

The test application shall support future expansion for additional hardware modules and test capabilities. The architecture shall accommodate new interface types and testing protocols without major redesign.

---

# 7. REQUIREMENTS TRACEABILITY

Requirements traceability provides a systematic method for tracing requirements through all stages of the development lifecycle, ensuring that all requirements are implemented and verified.

**Table 7.1: Requirements Traceability Matrix**

| Requirement ID in SRS | Section / Section ID in SyRS |
|----------------------|------------------------------|
| DP_OBC_8184_HOST_01 | 3.2 Software Requirements Specification |
| DP_OBC_8184_TARGET_02 | 3.2 Software Requirements Specification |
| DP_OBC_8184_SBC_03 | 4.2 Processor Module (SBC) Specifications |
| DP_OBC_8184_STOR_04 | 4.5 Storage and CAN IO Module Specifications |
| DP_OBC_8184_VIDEO_05 | 4.3 Video Processing Module Specifications |
| DP_OBC_8184_PWR_06 | 4.1 DC-DC Converter Specifications |
| DP_OBC_8184_INT_07 | 3.3 External Interface Requirements Specification |
| DP_OBC_8184_OPT_08 | 3.3 External Interface Requirements Specification |
| DP_OBC_8184_HOST_INIT_01_02 | 3.2 Software Requirements Specification |
| DP_OBC_8184_TARGET_DDR_02_03 | 4.2 Processor Module (SBC) Specifications |
| DP_OBC_8184_TARGET_STORAGE_02_04 | 4.5 Storage and CAN IO Module Specifications |

---

# APPENDIX A: MAPPING KC

Not Applicable (NA)

---

# APPENDIX B: SUPPORTING INFORMATION

**Test Setup Requirements:**

- 18-32V DC Power Supply
- Test PC with Ubuntu Linux 22.04
- USB to RS232/RS422 isolated interface board (DP-SPL-4258-300)
- Test JIG for hardware connectivity
- Measurement instruments for validation testing

---

*Document End*
`; //isGenerating ? docContent : (parentSrsDoc || '<h1>Mock SRS Document</h1><p>This is a mock document for testing the UI.</p>');

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden select-none">
      {/* ── Main Content Area ── */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Progress Bar */}
        {isGenerating && (
          <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <Loader2
                size={13}
                className="animate-spin text-blue-500 shrink-0"
              />
              <span className="text-[11px] text-gray-600 truncate flex-1">
                {progress.phase}
              </span>
              <span className="text-[10px] font-mono text-gray-400 shrink-0">
                {progress.section_current}/{progress.section_total}
              </span>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-red-600 border border-red-200 hover:bg-red-50 cursor-pointer shrink-0"
              >
                <X size={9} /> Cancel
              </button>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Banner */}
        {progress.status === "error" && error && (
          <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-red-700">Error:</span>
              <span className="text-xs text-red-600 truncate flex-1">
                {error}
              </span>
              {progress.section_current > 0 && (
                <span className="text-[10px] text-red-500 shrink-0">
                  {progress.section_current} of {progress.section_total}{" "}
                  sections
                </span>
              )}
            </div>
          </div>
        )}

        {/* Cancel Status */}
        {progress.status === "cancelled" && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
            <span className="text-xs text-amber-700">
              Generation cancelled. {progress.section_current} of{" "}
              {progress.section_total} sections generated.
            </span>
          </div>
        )}

        {/* Document View */}
        <div className="flex-1 overflow-hidden bg-[#fafafa]">
          {displayDoc ? (
            <TiptapEditor
              content={displayDoc}
              onChange={() => {}}
              project={project}
              requirementId="SRS_DOC"
              className="h-full border-none shadow-none rounded-none"
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-gray-400 p-10">
              <Zap size={32} className="opacity-30 mb-4" />
              <div className="text-sm font-semibold text-gray-500 mb-2">
                No document generated yet
              </div>
              <div className="text-xs text-center max-w-[280px] mb-4">
                Click <strong>Generate {activeMainTab?.toUpperCase()}</strong>{" "}
                to create a document.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Resize Handle ── */}
      <div
        className="flex-shrink-0 w-1.5 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors border-l border-r border-gray-200 flex items-center justify-center"
        onMouseDown={handleMouseDown}
        onDoubleClick={resetSidebarWidth}
        title="Drag to resize • Double-click to reset"
      >
        <GripVertical size={8} className="text-gray-300 pointer-events-none" />
      </div>

      {/* ── TOC Sidebar ── */}
      <div
        className="bg-white flex-shrink-0 overflow-hidden flex flex-col"
        style={{ width: `${sidebarWidth}px` }}
      >
        {/* Action Buttons */}
        <div className="flex flex-col gap-2 px-3 py-3">
          <button
            onClick={handleGenerate}
            disabled={isGenActive || isGenerating}
            className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 cursor-pointer"
          >
            <Play
              size={14}
              className={isGenActive || isGenerating ? "animate-pulse" : ""}
            />
            {isGenActive || isGenerating
              ? "Generating..."
              : "Generate Document"}
          </button>

          <div className="flex gap-2">
            <button
              onClick={() => setShowPreview(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-[11px] font-semibold rounded-lg shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 cursor-pointer"
            >
              <Eye size={13} />
              Preview
            </button>
            <button
              onClick={() => setShowExport(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-[11px] font-semibold rounded-lg shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 cursor-pointer"
            >
              <Download size={13} />
              Export
            </button>
          </div>
        </div>

        {/* Modern Tab Selector */}
        <div className="px-3 pb-3 border-b border-gray-100">
          <div className="flex p-1 bg-gray-100/80 rounded-lg">
            <button
              onClick={() => setSidebarTab("outline")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                sidebarTab === "outline"
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
              }`}
            >
              <List size={13} />
              Outline
            </button>
            <button
              onClick={() => setSidebarTab("execution")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-semibold rounded-md transition-all duration-200 cursor-pointer ${
                sidebarTab === "execution"
                  ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-200/50"
              }`}
            >
              <Terminal size={13} />
              Execution
              {executionLog.length > 0 && (
                <span
                  className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full transition-colors ${
                    sidebarTab === "execution"
                      ? "bg-gray-100 text-gray-700"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  {executionLog.filter((e) => e.status !== "running").length}/
                  {executionLog.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {sidebarTab === "outline" ? (
            displayDoc ? (
              <>
                <div className="px-3 py-2.5 rounded-xl bg-gray-50/80 border border-gray-100 mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-white rounded-md shadow-sm border border-gray-100">
                      <List size={12} className="text-gray-600" />
                    </div>
                    <span className="font-bold tracking-wide uppercase text-[10px] text-gray-600">
                      Table of Contents
                    </span>
                  </div>
                  {progress.status === "complete" && (
                    <span className="px-1.5 py-0.5 rounded-md bg-green-50 border border-green-100 text-[9px] text-green-600 font-bold uppercase tracking-wider">
                      Ready
                    </span>
                  )}
                </div>

                {headings.length > 0 ? (
                  <HeadingTree
                    nodes={headings}
                    depth={0}
                    currentSection={progress.phase
                      .replace("Generating: ", "")
                      .replace("Completed: ", "")}
                    expandedSections={expandedSections}
                    toggleSection={toggleSection}
                  />
                ) : (
                  <div className="px-3 py-4 text-center text-xs text-gray-400 flex items-center justify-center gap-1.5">
                    {isGenerating && (
                      <Loader2
                        size={10}
                        className="animate-spin text-blue-500"
                      />
                    )}
                    Building document outline...
                  </div>
                )}
              </>
            ) : (
              <div className="py-5 text-center text-xs text-gray-400">
                No document generated yet
              </div>
            )
          ) : (
            <ExecutionTimeline
              entries={executionLog}
              currentTurn={currentTurn}
              currentSection={progress.phase
                .replace("Generating: ", "")
                .replace("Completed: ", "")}
              isGenerating={isGenerating}
            />
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      {showPreview && (
        <PreviewModal
          displayDoc={displayDoc}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showExport && (
        <ExportModal
          displayDoc={displayDoc}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
