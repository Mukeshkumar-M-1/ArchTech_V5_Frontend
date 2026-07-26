import { useState, useCallback, useRef, useEffect } from "react";
import TiptapEditor from "../../components/TiptapEditor";
import {
  Zap,
  FileText,
  Loader2,
  X,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Terminal,
  GripVertical,
  Eye,
  Download,
  Play,
  List,
  FoldVertical,
  Pause,
  Sidebar,
  SidebarClose,
  SidebarOpen,
} from "lucide-react";
import { getApiUrl } from "../../utils/apiConfig";
import {
  fetchDocumentVersions,
  fetchVersionSections,
  fetchVersionContent,
} from "../../api/templateApi";
import PreviewModal from "./PreviewModal";
import ExportModal from "./ExportModal";
import useGenerationStore from "../../store/generationStore";

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
    const sec = entry.section || "Processing";
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
  onGenerationComplete,
  selectedChatBlocks,
  setSelectedChatBlocks,
  focusedChatBlock,
  setFocusedChatBlock,
}) {
  // Local state for streaming generation
  const [headings, setHeadings] = useState([]);
  const [expandedSections, setExpandedSections] = useState(new Set([]));

  // Latest version document content (fetched when idle)
  const [latestVersionDoc, setLatestVersionDoc] = useState("");
  const [latestVersionSections, setLatestVersionSections] = useState([]);
  const [selectedSectionFile, setSelectedSectionFile] = useState(null);
  const [selectedSectionContent, setSelectedSectionContent] = useState("");

  // Switch section when a chat block is focused
  useEffect(() => {
    if (focusedChatBlock?.section && focusedChatBlock.section !== selectedSectionFile) {
      setSelectedSectionFile(focusedChatBlock.section);
    }
  }, [focusedChatBlock, selectedSectionFile]);
  const [viewingVersion, setViewingVersion] = useState(null);
  const [totalVersions, setTotalVersions] = useState(0);

  // Modals state
  const [showPreview, setShowPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const [sidebarTab, setSidebarTab] = useState("outline");
  const currentSectionRef = useRef("");

  // Persisted generation state via Zustand store
  const generation = useGenerationStore();
  const docContent = generation.docContent;
  const setDocContentStore = generation.setDocContent;
  const executionLog = generation.executionLog;
  const currentTurn = generation.currentTurn;
  const error = generation.error;
  const status = generation.status;
  const progressValue = generation.progress;
  const phase = generation.phase;
  const sectionCurrent = generation.sectionCurrent;
  const sectionTotal = generation.sectionTotal;
  const abortRef = useRef(null);
  const containerRef = useRef(null);
  const docContentRef = useRef("");
  const isResizingRef = useRef(false);
  const currentTurnRef = useRef(0);

  // Sidebar width — default 384px (w-64), range 256-500px
  const [sidebarWidth, setSidebarWidth] = useState(384);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
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

  const isGenerating = isGenActive || status === "generating";
  const isPaused = status === "paused";

  /**
   * Start document generation via SSE.
   */
  const handleGenerate = useCallback(async () => {
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;
    generation.setError(null);
    setDocContentStore("");
    setHeadings([]);
    setExpandedSections(new Set());
    generation.setExecutionLog([]);
    setSidebarTab("execution");
    generation.setProgress({
      progress: 0,
      phase: "Initializing...",
      sectionCurrent: 0,
      sectionTotal: 0,
      status: "generating",
    });
    setLatestVersionDoc("");
    setLatestVersionSections([]);
    setSelectedSectionFile(null);
    setSelectedSectionContent("");
    setViewingVersion(null);
    setTotalVersions(0);
    const projectId = project?.id || project?._id;
    const type = activeMainTab === "srs" ? "srs" : "sdd";

    // Clear any stale pause signal from a previous session
    if (projectId) {
      fetch(getApiUrl(`/document-generation-resume/${projectId}`), {
        method: "POST",
      }).catch(() => {});
    }

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
              generation.setProgress({
                progress: 5,
                phase: `Starting document generation — ${data.section_count} sections`,
                sectionCurrent: 0,
                sectionTotal: data.section_count,
                status: "generating",
              });
            } else if (eventType === "section_start") {
              currentSectionRef.current = data.heading || "";
              generation.setPhase(`Generating: ${data.heading}`);
              generation.setProgress({ sectionCurrent: data.section_current });
              // Auto-expand the current section
              setExpandedSections((prev) => {
                const next = new Set(prev);
                if (data.heading) next.add(data.heading);
                return next;
              });
            } else if (eventType === "section_chunk") {
              docContentAccum += data.content || "";
              docContentRef.current = docContentAccum;
              generation.setDocContent(docContentAccum);
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
              generation.setProgress({
                progress: data.progress,
                phase: data.phase,
                sectionCurrent: data.section_current,
                sectionTotal: data.section_total,
              });
            } else if (eventType === "tool_started") {
              const turnForTool = currentTurnRef.current;
              const section =
                data.section ||
                currentSectionRef.current ||
                generation.phase.replace("Generating: ", "") ||
                "Untitled";
              generation.setExecutionLog((prev) => [
                ...prev,
                {
                  id: data.tool_call_id,
                  toolName: data.tool_name,
                  status: "running",
                  toolInput: data.input || {},
                  startTime: Date.now(),
                  turn: turnForTool,
                  section,
                },
              ]);
            } else if (eventType === "tool_finished") {
              const toolCallId = data.tool_call_id;
              const isToolError = data.is_error;
              generation.setExecutionLog((prev) =>
                prev.map((entry) => {
                  if (entry.id === toolCallId) {
                    const completedAt = Date.now();
                    return {
                      ...entry,
                      status: isToolError ? "error" : "success",
                      section: data.section || entry.section,
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
              generation.setCurrentTurn(newTurn);
            } else if (eventType === "turn_complete") {
              // Turn completed, stays at current for next tools
            } else if (eventType === "gen_complete") {
              generation.setProgress({
                progress: 100,
                phase: `Complete — ${data.total_sections} sections generated`,
                status: "complete",
              });
              // Sync with parent
              if (setSrsDoc) setSrsDoc(docContentAccum);
              if (onGenerationComplete) onGenerationComplete(activeMainTab);
            } else if (eventType === "gen_error") {
              generation.setError(data.error);
              generation.setProgressStatus("error");
            } else if (eventType === "paused") {
              generation.setProgressStatus("paused");
            } else if (eventType === "cancel") {
              generation.setProgressStatus("cancelled");
            }
          } catch {
            // Skip malformed SSE events
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      generation.setError(err.message);
      generation.setProgressStatus("error");
    } finally {
      abortRef.current = null;
    }
  }, [project, activeMainTab, setSrsDoc, generation]);

  const handleCancel = useCallback(async () => {
    const projectId = project?.id || project?._id;
    if (projectId) {
      fetch(getApiUrl(`/document-generation-cancel/${projectId}`), {
        method: "POST",
      }).catch(() => {});
    }
    if (abortRef.current) {
      abortRef.current.abort("user cancelled");
    }
    if (onCancel) onCancel();
    generation.setProgressStatus("cancelled");
  }, [project, onCancel]);

  const handlePause = useCallback(async () => {
    const projectId = project?.id || project?._id;
    if (projectId) {
      fetch(getApiUrl(`/document-generation-pause/${projectId}`), {
        method: "POST",
      }).catch(() => {});
    }
    // Don't abort — let the SSE connection receive the "paused" event from the backend
    // The orchestrator checks is_paused(), yields {"type": "paused"}, then returns,
    // which closes the stream cleanly and lets us handle the event in the reader loop.
    generation.setProgressStatus("paused");
  }, [project]);

  const handleResume = useCallback(() => {
    const projectId = project?.id || project?._id;
    if (projectId) {
      fetch(getApiUrl(`/document-generation-resume/${projectId}`), {
        method: "POST",
      }).catch(() => {});
    }
    handleGenerate();
  }, [handleGenerate]);

  const toggleSection = useCallback((path) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Fetch latest version document when idle (not generating)
  useEffect(() => {
    if (isGenerating || !project) return;
    const projectId = project.id || project._id;
    let cancelled = false;
    const loadLatest = async () => {
      try {
        const versions = await fetchDocumentVersions(projectId);
        if (cancelled || !versions.length) return;
        const latest = versions[0]; // newest first
        const data = await fetchVersionSections(projectId, latest.version);
        if (cancelled) return;
        const secs = data.sections || [];
        setLatestVersionSections(secs);
        let md = "";
        for (const sec of secs) {
          if (!sec.has_content) continue;
          const content = await fetchVersionContent(
            projectId,
            sec.section_filename,
            latest.version,
          );
          md += content.content + "\n\n";
        }
        if (!cancelled) {
          setLatestVersionDoc(md.trim());
          setSelectedSectionFile(null);
          setSelectedSectionContent("");
          setViewingVersion(latest.version);
          setTotalVersions(versions.length);
        }
      } catch {
        // ignore - stale fetch
      }
    };
    loadLatest();
    return () => {
      cancelled = true;
    };
  }, [project, isGenerating]);

  // Fetch selected section content
  useEffect(() => {
    if (isGenerating || !selectedSectionFile || !viewingVersion) return;
    let cancelled = false;
    const projectId = project?.id || project?._id;
    const load = async () => {
      setSelectedSectionContent("");
      try {
        const sec = latestVersionSections.find(
          (s) => s.section_filename === selectedSectionFile,
        );
        if (!sec?.has_content) return;
        const content = await fetchVersionContent(
          projectId,
          selectedSectionFile,
          viewingVersion,
        );
        if (!cancelled) setSelectedSectionContent(content.content || "");
      } catch {
        // ignore - stale fetch
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedSectionFile, project, isGenerating, viewingVersion]);

  // Switch to a specific version
  const loadVersion = useCallback(
    async (version) => {
      if (isGenerating || !project) return;
      const projectId = project.id || project._id;
      let cancelled = false;
      try {
        const data = await fetchVersionSections(projectId, version);
        if (cancelled) return;
        const secs = data.sections || [];
        setLatestVersionSections(secs);
        setSelectedSectionFile(null);
        setSelectedSectionContent("");
        let md = "";
        for (const sec of secs) {
          if (!sec.has_content) continue;
          const content = await fetchVersionContent(
            projectId,
            sec.section_filename,
            version,
          );
          md += content.content + "\n\n";
        }
        if (!cancelled) {
          setLatestVersionDoc(md.trim());
          setViewingVersion(version);
        }
      } catch {
        // ignore - stale fetch
      }
    },
    [project, isGenerating],
  );

  const goPreviousVersion = useCallback(() => {
    if (!viewingVersion || viewingVersion <= 1) return;
    loadVersion(viewingVersion - 1);
  }, [viewingVersion, loadVersion]);

  const goNextVersion = useCallback(() => {
    if (!viewingVersion || viewingVersion >= totalVersions) return;
    loadVersion(viewingVersion + 1);
  }, [viewingVersion, totalVersions, loadVersion]);

  // Full document for preview/export (always the complete document, never section-specific)
  const fullDoc = isGenerating
    ? docContent
    : latestVersionDoc || docContent || parentSrsDoc;

  // Display doc for the main editor view (allows section-level editing)
  const displayDoc = isGenerating
    ? docContent
    : selectedSectionContent || fullDoc;

  return (
    <div ref={containerRef} className="flex flex-1 overflow-hidden select-none">
      {/* ── Left: Sections List ── */}
      <div className="w-56 flex-shrink-0 bg-[#fafbfc] border-r border-[#e5e7eb] flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-[#e5e7eb] flex items-center gap-2">
          <FileText size={13} className="text-[#64748b]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
            Sections
          </span>
          <span className="flex-1" />
          <button
            onClick={() => setShowRightSidebar(!showRightSidebar)}
            className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
            title={showRightSidebar ? "Hide sidebar" : "Show sidebar"}
          >
            {showRightSidebar ? (
              <SidebarOpen size={14} />
            ) : (
              <SidebarClose size={14} />
            )}
          </button>
        </div>

        {latestVersionSections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
            <FileText size={20} className="opacity-30 mb-2" />
            <span className="text-[10px] text-center px-4">
              No sections yet.
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {latestVersionSections.map((sec) => {
              const isActive = sec.section_filename === selectedSectionFile;
              return (
                <button
                  key={sec.section_filename}
                  onClick={() =>
                    setSelectedSectionFile(
                      isActive ? null : sec.section_filename,
                    )
                  }
                  className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all mb-0.5 ${
                    isActive
                      ? "bg-white shadow-sm border border-[#e5e7eb]"
                      : "hover:bg-[#f1f5f9] border border-transparent"
                  }`}
                >
                  <ChevronRight
                    size={12}
                    className={`flex-shrink-0 mt-0.5 ${
                      isActive ? "text-[#2563eb]" : "text-[#94a3b8]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`text-[11px] font-semibold truncate ${
                        isActive ? "text-[#2563eb]" : "text-[#334155]"
                      }`}
                    >
                      {sec.section_filename.replace(/\.md$/, "")}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <div className="text-[9px] text-[#94a3b8]">
                        {sec.has_content ? "Generated" : "Empty"}
                      </div>
                      {(() => {
                        const secBlocks = selectedChatBlocks?.filter(b => b.section === sec.section_filename) || [];
                        if (secBlocks.length === 0) return null;
                        
                        const nums = secBlocks.map(b => b.blockNumber).sort((a,b) => a - b);
                        const limit = 3;
                        const displayNums = nums.slice(0, limit);
                        const extraCount = nums.length > limit ? nums.length - limit : 0;

                        return (
                          <div 
                            className="flex flex-wrap items-center gap-1 justify-end max-w-[130px]"
                            title={`Blocks: ${nums.join(', ')}`}
                          >
                            {displayNums.map(num => (
                              <div key={num} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-none flex items-center justify-center min-w-[16px] ${
                                isActive ? 'text-blue-700 bg-blue-100' : 'text-gray-600 bg-gray-200'
                              }`}>
                                {num}
                              </div>
                            ))}
                            {extraCount > 0 && (
                              <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded-sm leading-none flex items-center justify-center min-w-[16px] ${
                                isActive ? 'text-blue-700 bg-blue-100' : 'text-gray-600 bg-gray-200'
                              }`}>
                                +{extraCount}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

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
                {phase}
              </span>
              <span className="text-[10px] font-mono text-gray-400 shrink-0">
                {sectionCurrent}/{sectionTotal}
              </span>
              {/* <button
                onClick={handlePause}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-amber-600 border border-amber-200 hover:bg-amber-50 cursor-pointer shrink-0"
              >
                <Pause size={9} /> Pause
              </button> */}
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
                style={{ width: `${progressValue}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Banner */}
        {status === "error" && error && (
          <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-red-700">Error:</span>
              <span className="text-xs text-red-600 truncate flex-1">
                {error}
              </span>
              {sectionCurrent > 0 && (
                <span className="text-[10px] text-red-500 shrink-0">
                  {sectionCurrent} of {sectionTotal} sections
                </span>
              )}
            </div>
          </div>
        )}

        {/* Cancel Status */}
        {status === "cancelled" && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
            <span className="text-xs text-amber-700">
              Generation cancelled. {sectionCurrent} of {sectionTotal} sections
              generated.
            </span>
          </div>
        )}

        {/* Pause Status */}
        {status === "paused" && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-amber-700">
                Generation paused. {sectionCurrent} of {sectionTotal} sections
                completed.
              </span>
              <button
                onClick={handleResume}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 cursor-pointer shrink-0 ml-auto"
              >
                <Play size={9} /> Resume
              </button>
            </div>
          </div>
        )}

        {/* Document View */}
        <div className="flex-1 overflow-hidden bg-[#fafafa] relative flex flex-col">
          {/* Selected Blocks Indicator */}
          {selectedChatBlocks && selectedChatBlocks.length > 0 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 bg-blue-600/95 backdrop-blur-sm text-white px-3 py-2 rounded-xl shadow-lg shadow-blue-900/20 flex items-center gap-3 text-xs font-medium border border-blue-500/50">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center bg-white text-blue-600 w-5 h-5 rounded-full text-[10px] font-bold">
                  {selectedChatBlocks.length}
                </div>
                <span>
                  Blocks Selected
                  <span className="opacity-80 font-normal ml-1.5">
                    ({selectedChatBlocks.map(b => b.blockNumber).join(', ')})
                  </span>
                </span>
              </div>
              <div className="w-px h-4 bg-blue-400/50" />
              <button 
                onClick={() => setSelectedChatBlocks([])}
                className="text-white hover:bg-blue-500/50 p-1 rounded-lg transition-colors"
                title="Clear selection"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {displayDoc ? (
            <TiptapEditor
              content={displayDoc}
              onChange={() => {}}
              project={project}
              requirementId="SRS_DOC"
              className="h-full border-none shadow-none rounded-none"
              selectedChatBlocks={selectedChatBlocks}
              setSelectedChatBlocks={setSelectedChatBlocks}
              activeSection={selectedSectionFile}
              focusedChatBlock={focusedChatBlock}
              setFocusedChatBlock={setFocusedChatBlock}
              enableChatContext={true}
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
      {showRightSidebar && (
        <div
          className="flex-shrink-0 w-1.5 cursor-col-resize hover:bg-blue-500/20 active:bg-blue-500/30 transition-colors border-l border-r border-gray-200 flex items-center justify-center"
          onMouseDown={handleMouseDown}
          onDoubleClick={resetSidebarWidth}
          title="Drag to resize • Double-click to reset"
        >
          <GripVertical
            size={8}
            className="text-gray-300 pointer-events-none"
          />
        </div>
      )}

      {/* ── TOC Sidebar ── */}
      {showRightSidebar && (
        <div
          className="bg-white flex-shrink-0 overflow-hidden flex flex-col"
          style={{ width: `${sidebarWidth}px` }}
        >
          {/* Action Buttons */}
          <div className="flex flex-col gap-2 px-3 py-3">
            {isPaused ? (
              <button
                onClick={handleResume}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-blue-600 text-white text-xs font-semibold rounded-xl shadow-sm hover:bg-blue-700 hover:shadow transition-all duration-200 cursor-pointer"
              >
                <Play size={14} /> Resume Generation
              </button>
            ) : (
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
            )}

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
              viewingVersion && totalVersions > 0 ? (
                <>
                  <div className="px-3 py-2.5 rounded-xl bg-gray-50/80 border border-gray-100 mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-white rounded-md shadow-sm border border-gray-100">
                        <ChevronRight size={12} className="text-gray-600" />
                      </div>
                      <span className="font-bold tracking-wide uppercase text-[10px] text-gray-600">
                        Versions
                      </span>
                    </div>
                    <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[9px] text-blue-600 font-bold">
                      v{viewingVersion} / {totalVersions}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-700">
                      Version {viewingVersion}
                    </span>
                    <span className="text-[9px] text-gray-400 ml-1">
                      of {totalVersions}
                    </span>
                    <span className="flex-1" />
                    <button
                      onClick={goPreviousVersion}
                      disabled={viewingVersion <= 1}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Previous version"
                    >
                      <ChevronLeft size={14} className="text-gray-600" />
                    </button>
                    <button
                      onClick={goNextVersion}
                      disabled={viewingVersion >= totalVersions}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Next version"
                    >
                      <ChevronRight size={14} className="text-gray-600" />
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-5 text-center text-xs text-gray-400">
                  No versions available
                </div>
              )
            ) : (
              <ExecutionTimeline
                entries={executionLog}
                currentTurn={currentTurn}
                currentSection={phase
                  .replace("Generating: ", "")
                  .replace("Completed: ", "")}
                isGenerating={isGenerating}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showPreview && (
        <PreviewModal
          displayDoc={fullDoc}
          onClose={() => setShowPreview(false)}
        />
      )}

      {showExport && (
        <ExportModal
          displayDoc={fullDoc}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
