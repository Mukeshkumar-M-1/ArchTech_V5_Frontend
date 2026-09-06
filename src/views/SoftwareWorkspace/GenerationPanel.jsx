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
  Pause,
  Sidebar,
  SidebarClose,
  SidebarOpen,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Check,
} from "lucide-react";
import { getApiUrl } from "../../utils/apiConfig";
import {
  fetchDocumentVersions,
  fetchVersionSections,
  fetchVersionContent,
  updateVersionContent,
} from "../../api/templateApi";
import PreviewModal from "./PreviewModal";
import ExportModal from "./ExportModal";
import useGenerationStore from "../../store/generationStore";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * EditActionsBar — floating bar showing pending content_edit blocks
 * with Accept All and Reject All buttons, styled like the SelectedBlocksIndicator.
 */
function EditActionsBar({ chatMessages, onInteractionSubmit, currentSessionId }) {
  const pendingEdits = (chatMessages || [])
    .filter(
      (msg) =>
        msg.role === "tool" &&
        msg.ui_type === "content_edit" &&
        msg.status === "awaiting_input",
    );
  if (pendingEdits.length === 0) return null;

  const allPayloads = [];
  for (const msg of pendingEdits) {
    try {
      const opts = msg.input?.options || msg.options || [];
      if (opts.length > 0) {
        const payload = typeof opts[0] === "string" ? JSON.parse(opts[0]) : opts[0];
        allPayloads.push({ msg, payload });
      }
    } catch {
      // skip malformed payloads
    }
  }
  if (allPayloads.length === 0) return null;

  const handleRejectAll = () => {
    for (const { msg, payload } of allPayloads) {
      onInteractionSubmit(currentSessionId, msg.tool_call_id, {
        status: "rejected",
      });
      window.dispatchEvent(new CustomEvent("apply-content-edit-reject", {
        detail: {
          block_number: payload.block_number,
          original_text: payload.original_text,
          proposed_text: payload.proposed_text,
        },
      }));
    }
  };

  const handleAcceptAll = () => {
    for (const { msg, payload } of allPayloads) {
      onInteractionSubmit(currentSessionId, msg.tool_call_id, {
        status: "accepted",
        ui_type: "content_edit",
        section_filename: payload.section_filename,
        proposed_text: payload.proposed_text,
        block_number: payload.block_number,
      });
      window.dispatchEvent(new CustomEvent("apply-content-edit-accept", {
        detail: {
          block_number: payload.block_number,
          original_text: payload.original_text,
          proposed_text: payload.proposed_text,
        },
      }));
    }
  };

  return (
    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 bg-primary-600/95 backdrop-blur-sm text-white px-3 py-2 rounded-xl shadow-lg shadow-primary-900/20 flex items-center gap-3 text-xs font-medium border border-primary-500/50">
      <button
        onClick={handleAcceptAll}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer font-semibold"
        title="Accept all edits"
      >
        <Check size={14} />
        Accept
      </button>
      <button
        onClick={handleRejectAll}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer font-semibold"
        title="Reject all edits"
      >
        <X size={14} />
        Reject
      </button>
      <div className="w-px h-4 bg-primary-400/50" />
      <div className="flex items-center gap-2">
        <div className="flex items-center justify-center bg-white text-blue-500 w-5 h-5 rounded-full text-[10px] font-bold">
          {allPayloads.length}
        </div>
        <span>
          Edits Pending
        </span>
      </div>
      {/* <div className="flex items-center gap-1">
        <button
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer text-white/80 hover:text-white"
          title="Previous edited message"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 transition-colors cursor-pointer text-white/80 hover:text-white"
          title="Next edited message"
        >
          <ArrowRight size={14} />
        </button>
      </div> */}
    </div>
  );
}
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
  onSubmitInteraction,
  tabContentRef,
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
      case "RequestUserInput":
        return input?.title
      default:
        return null;
    }
  };

  const [expandedEntries, setExpandedEntries] = useState(new Set());
  const [expandedSections, setExpandedSections] = useState(new Set());

  const activeSectionBodyRef = useRef(null);
  useEffect(() => {
    if (tabContentRef.current) {
      tabContentRef.current.scrollTop = tabContentRef.current.scrollHeight;
    }
    if (activeSectionBodyRef.current) {
      activeSectionBodyRef.current.scrollTop = activeSectionBodyRef.current.scrollHeight;
    }
  }, [entries]);

  // Track which awaiting_input entries have been expanded so we only scroll once
  const expandedAwaitingIds = useRef(new Set());

  // Auto-expand entries waiting for user input, then scroll into view
  useEffect(() => {
    const awaitingEntries = entries.filter(e => e.status === "awaiting_input");
    if (awaitingEntries.length === 0) return;

    let isNew = false;
    setExpandedEntries(prev => {
      const next = new Set(prev);
      awaitingEntries.forEach(entry => {
        const isNewEntry = !expandedAwaitingIds.current.has(entry.id);
        if (isNewEntry) isNew = true;
        next.add(entry.id);
        expandedAwaitingIds.current.add(entry.id);
      });
      return next;
    });
    setExpandedSections(prev => {
      const next = new Set(prev);
      awaitingEntries.forEach(entry => next.add(entry.sectionCurrent));
      return next;
    });

    // Scroll after the expanded panel renders
    if (isNew) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (tabContentRef.current) {
            tabContentRef.current.scrollTop = tabContentRef.current.scrollHeight;
          }
          if (activeSectionBodyRef.current) {
            activeSectionBodyRef.current.scrollTop = activeSectionBodyRef.current.scrollHeight;
          }
        });
      });
    }
  }, [entries]);

  const toggleEntry = useCallback((entryId) => {
    setExpandedEntries((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
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
    const sectionDisplayName = entry.sectionCurrent;
    
    if (!acc[sectionDisplayName]) acc[sectionDisplayName] = {};
    const turnNum = entry.turn || 1;
    if (!acc[sectionDisplayName][turnNum]) acc[sectionDisplayName][turnNum] = [];
    acc[sectionDisplayName][turnNum].push(entry);
    return acc;
  }, {});

  const sectionNames = Object.keys(sectionGroups).sort();

  // Auto-expand sections that have running tools or are currently active
  useEffect(() => {
    const sectionsToExpand = new Set(expandedSections);
    for (const sectionDisplayName of sectionNames) {
      const turnGroups = sectionGroups[sectionDisplayName];
      const hasRunningTurns = Object.values(turnGroups).some((toolEntries) =>
        toolEntries.some((toolEntry) => toolEntry.status === "running"),
      );
      if (hasRunningTurns || (isGenerating && sectionDisplayName === sectionName)) {
        sectionsToExpand.add(sectionDisplayName);
      }
    }
    if (sectionsToExpand.size !== expandedSections.size) {
      setExpandedSections(sectionsToExpand);
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
      {sectionNames.map((sectionDisplayName) => {
        const turnGroups = sectionGroups[sectionDisplayName];
        const turnNumbers = Object.keys(turnGroups)
          .map(Number)
          .sort((a, b) => a - b);
        const isSectionActive = isGenerating && sectionDisplayName === sectionName;
        const isSectionExpanded = expandedSections.has(sectionDisplayName);
        const sectionHasRunningTurns = turnNumbers.some((turnNumber) =>
          turnGroups[turnNumber].some((toolEntry) => toolEntry.status === "running"),
        );

        return (
          <div
            key={sectionDisplayName}
            className={`rounded-lg border transition-all ${
              isSectionActive
                ? "border-blue-400 bg-blue-50/30 shadow-sm"
                : "border-gray-200 hover:border-gray-300"
            }`}
          >
            {/* Section Header */}
            <div
              className="flex items-center gap-2 px-3 py-2 cursor-pointer"
              onClick={() => toggleSection(sectionDisplayName)}
            >
              <ChevronRight
                size={10}
                className={`text-gray-400 shrink-0 transition-transform ${isSectionExpanded ? "rotate-90" : ""}`}
              />
              <span
                className={`text-[11px] font-bold ${isSectionActive ? "text-blue-600" : "text-gray-700"}`}
              >
                {sectionDisplayName}
              </span>
              {isSectionActive && (
                <span className="text-[9px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-md uppercase">
                  active
                </span>
              )}
              <span className="text-[10px] text-gray-500 ml-auto">
                {Object.values(turnGroups).flat().length} tool{Object.values(turnGroups).flat().length !== 1 ? "s" : ""}
              </span>

              {sectionHasRunningTurns && !isSectionActive && (
                <Loader2
                  size={10}
                  className="animate-spin text-blue-500 shrink-0"
                />
              )}
            </div>

            {/* Section Body */}
            {isSectionExpanded && (
              <div ref={isSectionActive ? activeSectionBodyRef : null} className="px-3 pb-3 relative flex flex-col pt-1">
                {turnNumbers.flatMap((turnNum) => turnGroups[turnNum]).map((toolEntry, toolIndex, allToolEntries) => {
                  const isEntryExpanded = expandedEntries.has(toolEntry.id);
                  const toolStatusInfo =
                    statusConfig[toolEntry.status] ||
                    statusConfig.running;
                  const isLastEntry = toolIndex === allToolEntries.length - 1;

                  return (
                    <div
                      key={toolEntry.id}
                      className="relative pl-6 pb-2 mt-1"
                    >
                      {/* Timeline line */}
                      {(isSectionActive || !isLastEntry) && (
                        <div className={`absolute left-[11px] top-4 ${isLastEntry && isSectionActive ? 'bottom-[-24px]' : 'bottom-[-16px]'} w-[1px] bg-gray-200`} />
                      )}
                      {/* Timeline Dot */}
                      <div
                        className={`absolute left-[8px] top-[6px] w-[7px] h-[7px] rounded-full ring-2 ring-white ${toolStatusInfo.color}`}
                      />

                      {/* Tool Header */}
                      <div
                        className="flex items-center gap-1.5 cursor-pointer group hover:bg-gray-50 rounded px-1.5 py-0.5 -ml-1.5"
                        onClick={() => toggleEntry(toolEntry.id)}
                      >
                        {/* Tool Name */}
                        <span className="text-[11px] font-bold text-gray-800">
                          {toolEntry.toolName}
                        </span>

                        {/* Tool Preview */}
                        {getToolPreview(
                          toolEntry.toolName,
                          toolEntry.toolInput,
                        ) && (
                          <span className="text-[10px] text-gray-500 font-mono truncate">
                            {getToolPreview(
                              toolEntry.toolName,
                              toolEntry.toolInput,
                            )}
                          </span>
                        )}

                        {/* Tool turn count */}
                        <div className="flex-1" />
                        {toolEntry.turn != null && (
                          <span className="text-[9px] font-mono text-gray-400">
                            T{toolEntry.turn}
                          </span>
                        )}

                        {/* Tool execution time */}
                        {toolEntry.status === "success" &&
                          toolEntry.durationMs != null && (
                            <span className="text-[9px] font-mono text-gray-400">
                              {toolEntry.durationMs < 1000
                                ? `${Math.round(toolEntry.durationMs)}ms`
                                : `${(toolEntry.durationMs / 1000).toFixed(1)}s`}
                            </span>
                          )}
                      </div>

                      {/* Interactive UI Panel */}
                      {isEntryExpanded && toolEntry.status === "awaiting_input" && onSubmitInteraction && (
                        <InteractiveToolItem entry={toolEntry} onSubmit={onSubmitInteraction} />
                      )}

                      {/* Message showing after completed */}
                      {isEntryExpanded && toolEntry.status !== "awaiting_input" && (
                        <div className="mt-2 mr-2 rounded bg-[#1e1e1e] border border-gray-700 shadow-sm overflow-hidden text-left flex flex-col">
                          {toolEntry.toolInput &&
                            Object.keys(toolEntry.toolInput).length >
                              0 && (
                              <div className="flex px-3 py-2">
                                <div className="w-8 shrink-0 text-[10px] font-mono font-bold text-gray-500 mt-0.5">
                                  IN
                                </div>
                                <div className="flex-1 text-[10px] font-mono text-gray-300 whitespace-pre-wrap break-all">
                                  {JSON.stringify(
                                    toolEntry.toolInput,
                                    null,
                                    2,
                                  )}
                                </div>
                              </div>
                            )}
                          {toolEntry.toolOutput && (
                            <div
                              className={`flex px-3 py-2 border-t border-gray-700/50 ${toolEntry.status === "error" ? "bg-red-950/30" : ""}`}
                            >
                              <div className="w-8 shrink-0 text-[10px] font-mono font-bold text-gray-500 mt-0.5">
                                OUT
                              </div>
                              <div
                                className={`flex-1 text-[10px] font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto ${toolEntry.status === "error" ? "text-red-400" : "text-gray-300"}`}
                              >
                                {toolEntry.toolOutput}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Active indicator */}
                {isSectionActive && (
                  <div className="relative pl-7 pb-6">
                    <div className="absolute left-[8px] top-1.5 w-2 h-2 rounded-full bg-slate-300 z-10 ring-4 ring-white" />
                    <div className="grid grid-cols-3 gap-[1px] w-fit mt-0.5">
                      <div className="w-1 h-1 bg-blue-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "0ms" }} />
                      <div className="w-1 h-1 bg-blue-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "100ms" }} />
                      <div className="w-1 h-1 bg-blue-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "200ms" }} />
                      <div className="w-1 h-1 bg-blue-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "700ms" }} />
                      <div className="w-1 h-1 bg-blue-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "800ms" }} />
                      <div className="w-1 h-1 bg-blue-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "300ms" }} />
                      <div className="w-1 h-1 bg-blue-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "600ms" }} />
                      <div className="w-1 h-1 bg-blue-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "500ms" }} />
                      <div className="w-1 h-1 bg-blue-500 rounded-[0.5px] animate-grok-spiral" style={{ animationDelay: "400ms" }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * InteractiveToolItem — Renders an interactive form for pending tool input.
 * Supports radio, checkbox, select, and text UI types.
 */
function InteractiveToolItem({ entry, onSubmit }) {
  const [expanded, setExpanded] = useState(true);
  const [interactionValue, setInteractionValue] = useState(
    entry.interactionData?.ui_type === "checkbox" ? [] : ""
  );
  const [interactionText, setInteractionText] = useState("");

  const handleInteractionSubmit = async () => {
    const payload = interactionText.trim()
      ? interactionText.trim()
      : entry.interactionData?.ui_type === "checkbox"
        ? interactionValue.join(", ")
        : interactionValue;
    try {
      await onSubmit(entry.id, payload);
      setInteractionValue(entry.interactionData?.ui_type === "checkbox" ? [] : "");
      setInteractionText("");
    } catch (err) {
      console.error("Interaction submit failed:", err);
    }
  };

  const selectedCount =
    entry.interactionData?.ui_type === "checkbox"
      ? interactionValue.length + (interactionText.trim() ? 1 : 0)
      : (interactionValue ? 1 : 0) + (interactionText.trim() ? 1 : 0);

  const isAwaitingInput = entry.status === "awaiting_input";

  return (
    <div className="flex flex-col gap-1 w-full max-w-full">
      <div className="mt-1 bg-white border border-primary-200 rounded-lg overflow-hidden shadow-sm">
        {/* Header */}
        {entry.interactionData?.title && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100">
            <span className="text-[11px] font-semibold text-primary-600 tracking-wide border-b border-primary-500">
              {entry.interactionData.title}
            </span>
          </div>
        )}
        {/* Prompt */}
        {entry.interactionData?.prompt && (
          <div className="px-3 py-2 border-b border-primary-100 bg-primary-50/50 select-text">
            <div className="text-[12px] font-medium text-primary-800">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {entry.interactionData.prompt}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Options / Form */}
        <div className="px-3 py-2.5">
          {/* Radio Button option */}
          {entry.interactionData?.ui_type === "radio" && (
            <div className="flex flex-col gap-1">
              {(entry.interactionData.options || []).map((optionValue, optionIndex) => {
                const optionLines = Array.isArray(optionValue) ? optionValue : (typeof optionValue === "string" ? optionValue.split("\n") : [optionValue]);
                const optionLabel = optionLines[0] || "";
                const optionDescription = optionLines.slice(1).join("\n") || "";
                return (
                  <label
                    key={optionIndex}
                    className={`flex items-start gap-2.5 cursor-pointer py-1.5 px-2 rounded transition-colors ${
                      interactionValue === optionValue ? "bg-primary-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="radio"
                      name={`gen-radio-${entry.id}`}
                      value={optionValue}
                      checked={interactionValue === optionValue}
                      onChange={() => setInteractionValue(optionValue)}
                      className="sr-only peer"
                    />
                    <div className={`w-3.5 h-3.5 rounded-full border transition-colors flex items-center justify-center mt-0.5 flex-shrink-0 ${
                      interactionValue === optionValue ? "border-primary-500" : "border-slate-300"
                    }`}>
                      {interactionValue === optionValue && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[12px] font-medium leading-tight ${
                        interactionValue === optionValue ? "text-primary-700" : "text-slate-700"
                      }`}>
                        {optionLabel}
                      </span>
                      {optionDescription && (
                        <span className="text-[11px] text-slate-500 leading-snug">{optionDescription}</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Checkbox option */}
          {entry.interactionData?.ui_type === "checkbox" && (
            <div className="flex flex-col gap-1">
              {(entry.interactionData.options || []).map((optionValue, optionIndex) => {
                const optionLines = Array.isArray(optionValue) ? optionValue : (typeof optionValue === "string" ? optionValue.split("\n") : [optionValue]);
                const optionLabel = optionLines[0] || "";
                const optionDescription = optionLines.slice(1).join("\n") || "";
                return (
                  <label
                    key={optionIndex}
                    className={`flex items-start gap-2.5 cursor-pointer py-1.5 px-2 rounded transition-colors ${
                      interactionValue.includes(optionValue) ? "bg-primary-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      value={optionValue}
                      checked={interactionValue.includes(optionValue)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setInteractionValue((prev) => [...prev, optionValue]);
                        } else {
                          setInteractionValue((prev) => prev.filter((v) => v !== optionValue));
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className={`w-3.5 h-3.5 rounded border transition-colors flex items-center justify-center mt-0.5 flex-shrink-0 ${
                      interactionValue.includes(optionValue) ? "border-primary-500 bg-primary-500" : "border-slate-300"
                    }`}>
                      {interactionValue.includes(optionValue) && (
                        <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                          <path d="M10 3L4.5 8.5L2 6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className={`text-[12px] font-medium leading-tight ${
                        interactionValue.includes(optionValue) ? "text-primary-700" : "text-slate-700"
                      }`}>
                        {optionLabel}
                      </span>
                      {optionDescription && (
                        <span className="text-[11px] text-slate-500 leading-snug">{optionDescription}</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          )}

          {/* Select Box option */}
          {entry.interactionData?.ui_type === "select" && (
            <select
              className="w-full rounded-md px-2.5 py-1.5 text-[12px] cursor-pointer outline-none border bg-slate-50 text-slate-800 border-slate-200 focus:border-primary-500 transition-colors"
              value={interactionValue}
              onChange={(e) => setInteractionValue(e.target.value)}
            >
              <option value="" disabled>Select an option...</option>
              {(entry.interactionData.options || []).map((optionValue, optionIndex) => (
                <option key={optionIndex} value={optionValue}>{optionValue}</option>
              ))}
            </select>
          )}

          {/* Common chat input - radio, checkbox, select */}
          {(entry.interactionData?.ui_type === "radio" || entry.interactionData?.ui_type === "checkbox" || entry.interactionData?.ui_type === "select") && (
            <div className="flex flex-col gap-1.5 py-1.5 border-t border-slate-100 mt-1.5 pt-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-slate-600">
                  Other
                </span>
              </div>
              <input
                type="text"
                placeholder="Type your answer..."
                className="w-full rounded-md px-2.5 py-1 text-[11px] outline-none border transition-colors bg-slate-50 text-slate-800 border-slate-200 focus:border-primary-500 placeholder-slate-400"
                value={interactionText}
                onChange={(e) => setInteractionText(e.target.value)}
              />
            </div>
          )}

          {/* Text Based input */}
          {entry.interactionData?.ui_type === "text" && (
            <textarea
              placeholder="Type your response..."
              className="w-full rounded-md px-2.5 py-2 text-[12px] outline-none border resize-none transition-colors bg-slate-50 text-slate-800 border-slate-200 focus:border-primary-500 placeholder-slate-400 leading-relaxed"
              rows={3}
              value={interactionText}
              onChange={(e) => setInteractionText(e.target.value)}
            />
          )}
        </div>

        {/* Submit Button */}
        <div className="px-3 pb-2.5 pt-1">
          <button
            onClick={handleInteractionSubmit}
            disabled={
              entry.interactionData?.ui_type === "text"
                ? !interactionText.trim()
                : !interactionValue && !interactionText.trim()
            }
            className={`w-full flex items-center justify-center gap-2 px-4 py-1.5 rounded-md text-[12px] font-semibold transition-all ${
              selectedCount > 0
                ? "bg-primary-600 text-white hover:bg-primary-700 shadow-sm cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            {selectedCount > 0 && (
              <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded bg-white/20 text-[10px] font-bold">
                {selectedCount}
              </span>
            )}
            Submit answer
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * GenerationPanel — SRS/SDD document generation with streaming progress.
 *
 * Manages its own document state during generationStore. On completion,
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
  chatMessages,
  onInteractionSubmit,
  currentSessionId,
  isAwaitingUserInput,
  onAwaitingUserInputChange,
  pendingToolCallId,
  setPendingToolCallId,
}) {
  // Local state for streaming generation
  const [generationHeadings, setGenerationHeadings] = useState([]);
  const [headingExpandedSections, setHeadingExpandedSections] = useState(new Set([]));

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
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [tocCollapsed, setTocCollapsed] = useState(new Set());

  // Modals state
  const [showPreview, setShowPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);

  const [sidebarTab, setSidebarTab] = useState("outline");
  const currentSectionRef = useRef("");

  // Persisted generation state via Zustand store
  const generationStore = useGenerationStore();
  const generatedDocContent = generationStore.docContent;
  const setDocContentStore = generationStore.setDocContent;
  const executionLog = generationStore.executionLog;
  const currentTurn = generationStore.currentTurn;
  const error = generationStore.error;
  const status = generationStore.status;
  const progressValue = generationStore.progress;
  const phase = generationStore.phase;
  const sectionCurrent = generationStore.sectionCurrent;
  const sectionTotal = generationStore.sectionTotal;
  const abortRef = useRef(null);
  const regenerateAbortRef = useRef(null);
  const containerRef = useRef(null);
  const tabContentRef = useRef(null);
  const docContentRef = useRef("");
  const isResizingRef = useRef(false);
  const currentTurnRef = useRef(0);
  const currentTaskIdRef = useRef("");
  const saveVersionRef = useRef(null);

  // Auto-save generated version edits with 1000ms debounce
  useEffect(() => {
    if (saveVersionRef.current) saveVersionRef.current.cancel();
    
    saveVersionRef.current = {
      timeout: null,
      save: (projectId, sectionFilename, version, content) => {
        if (!projectId || !sectionFilename || !version) return;
        if (saveVersionRef.current.timeout) clearTimeout(saveVersionRef.current.timeout);
        saveVersionRef.current.timeout = setTimeout(async () => {
          try {
            await updateVersionContent(projectId, sectionFilename, version, content);
          } catch (err) {
            console.error('Failed to save version content:', err);
          }
        }, 1000);
      },
      cancel: () => {
        if (saveVersionRef.current?.timeout) clearTimeout(saveVersionRef.current.timeout);
      }
    };

    return () => saveVersionRef.current?.cancel();
  }, []);

  const handleVersionContentChange = useCallback((newContent) => {
    setSelectedSectionContent(newContent);
    const projectId = project?.id || project?._id;
    if (projectId && selectedSectionFile && viewingVersion) {
      saveVersionRef.current?.save(projectId, selectedSectionFile, viewingVersion, newContent);
    }
  }, [project, selectedSectionFile, viewingVersion]);

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

  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regeneratingSectionProgress, setRegeneratingSectionProgress] = useState(0);
  const isGenerating = isGenActive || status === "generating" || isRegenerating;
  const isPaused = status === "paused";
  console.log("[Generating] : ", isGenerating)

  /**
   * Start document generation via SSE.
   */
  const handleGenerate = useCallback(async () => {
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;
    generationStore.setError(null);
    setDocContentStore("");
    setGenerationHeadings([]);
    setHeadingExpandedSections(new Set());
    generationStore.setExecutionLog([]);
    setSidebarTab("execution");
    generationStore.setProgress({
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
    const projectId = project?.id;
    const documentType = activeMainTab === "srs" ? "srs" : "sdd";

    // Clear any stale pause signal from a previous session
    if (projectId) {
      fetch(getApiUrl(`/document-generation-resume/${projectId}`), {
        method: "POST",
      }).catch(() => {});
    }

    try {
      const response = await fetch(getApiUrl("/generate-document-stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement_ids: [],
          template_type: documentType,
          project_id: projectId,
        }),
        signal: abortCtrl.signal,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let generatedContentAccum = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const streamEvent = JSON.parse(line.slice(6));
            const { type: eventType } = streamEvent;

            if (eventType === "gen_start") {
              generationStore.setProgress({
                progress: 5,
                phase: `Starting document generation — ${streamEvent.section_count} sections`,
                sectionCurrent: 0,
                sectionTotal: streamEvent.section_count,
                status: "generating",
              });
            } else if (eventType === "section_start") {
              currentSectionRef.current = streamEvent.section_heading || "";
              generationStore.setPhase(`Generating: ${streamEvent.section_heading}`);
              generationStore.setProgress({ sectionCurrent: streamEvent.section_current });
              generationStore.setSectionProgress({sectionCurrent: streamEvent.section_current, sectionTotal: streamEvent.section_total })
              // Auto-expand the current section
              setHeadingExpandedSections((prev) => {
                const next = new Set(prev);
                if (streamEvent.section_heading) next.add(streamEvent.section_heading);
                return next;
              });
            } else if (eventType === "section_chunk") {
              generatedContentAccum += streamEvent.content || "";
              docContentRef.current = generatedContentAccum;
              generationStore.setDocContent(generatedContentAccum);
            } else if (eventType === "section_complete") {
              const parsedHeadings = streamEvent.headings_parsed || [];
              setGenerationHeadings((prev) => {
                const next = [...prev];
                for (const heading of parsedHeadings) next.push(heading);
                return next;
              });
              setHeadingExpandedSections((prev) => {
                const next = new Set(prev);
                if (streamEvent.heading) next.add(streamEvent.heading);
                return next;
              });
            } else if (eventType === "progress") {
              generationStore.setProgress({
                progress: streamEvent.progress,
                sectionCurrent: streamEvent.section_current,
                sectionTotal: streamEvent.section_total,
              });
            } else if (eventType === "section_phase"){
              currentSectionRef.current = streamEvent.section_heading || "";
              generationStore.setPhase(`Generating: ${streamEvent.section_heading}`);
            } else if (eventType === "tool_started") {
              const currentTurnNumber = currentTurnRef.current;
              const sectionHeading = streamEvent.section_heading || currentSectionRef.current;
              generationStore.setExecutionLog((prev) => {
                // Deduplicate — skip if entry with this tool_call_id already exists
                if (prev.some((e) => e.id === streamEvent.tool_call_id)) {
                  return prev;
                }
                return [
                  ...prev,
                  {
                    id: streamEvent.tool_call_id,
                    toolName: streamEvent.tool_name,
                    status: "running",
                    toolInput: streamEvent.input || {},
                    startTime: Date.now(),
                    turn: currentTurnNumber,
                    sectionCurrent: sectionHeading,
                    taskId: streamEvent.task_id || currentTaskIdRef.current,
                  },
                ];
              });
            } else if (eventType === "tool_finished") {
              const toolCallId = streamEvent.tool_call_id;
              const toolFailed = streamEvent.is_error;
              generationStore.setExecutionLog((prev) => {
                // Only update if there's an entry in awaiting_input or running state
                // — skip entries already in terminal state (success/error) to avoid
                // double-resolving when handleSubmitInteraction already set success.
                const target = prev.find((e) => e.id === toolCallId && (e.status === "awaiting_input" || e.status === "running"));
                if (!target) return prev;
                return prev.map((toolLogEntry) => {
                  if (toolLogEntry.id === toolCallId) {
                    return {
                      ...toolLogEntry,
                      status: toolFailed ? "error" : "success",
                      sectionCurrent: streamEvent.section_heading,
                      durationMs: streamEvent.duration_ms,
                      toolOutput: streamEvent.output || "",
                    };
                  }
                  return toolLogEntry;
                });
              });
            } else if (eventType === "turn_start") {
              const newTurnNumber = streamEvent.turn || currentTurnRef.current + 1;
              currentTurnRef.current = newTurnNumber;
              currentTaskIdRef.current = streamEvent.task_id || "";
              generationStore.setCurrentTurn(newTurnNumber);
            } else if (eventType === "turn_complete") {
              // Turn completed, stays at current for next tools
            } else if (eventType === "tool_interaction_request") {
              // Update the entry for this tool_call_id to "awaiting_input".
              // Skip entries already in a terminal state (success/error).
              // If no existing entry is found, create one (defensive fallback).
              generationStore.setExecutionLog((prev) => {
                const matchingIdx = prev.findIndex(
                  (e) => e.id === streamEvent.tool_call_id
                    && e.status !== "success"
                    && e.status !== "error",
                );
                if (matchingIdx !== -1) {
                  // Update existing entry
                  const updated = [...prev];
                  updated[matchingIdx] = {
                    ...prev[matchingIdx],
                    status: "awaiting_input",
                    toolName: streamEvent.tool_name,
                    toolInput: streamEvent.input || {},
                    interactionData: {
                      prompt: streamEvent.input?.prompt,
                      ui_type: streamEvent.input?.ui_type,
                      options: streamEvent.input?.options,
                      title: streamEvent.input?.title,
                      ...(streamEvent.input || {}),
                    },
                    sectionCurrent: streamEvent.section_heading,
                    taskId: streamEvent.task_id || currentTaskIdRef.current,
                  };
                  return updated;
                }
                // Fallback: no matching entry found — create a new one
                return [
                  ...prev,
                  {
                    id: streamEvent.tool_call_id,
                    toolName: streamEvent.tool_name,
                    status: "awaiting_input",
                    toolInput: streamEvent.input || {},
                    interactionData: {
                      prompt: streamEvent.input?.prompt,
                      ui_type: streamEvent.input?.ui_type,
                      options: streamEvent.input?.options,
                      title: streamEvent.input?.title,
                      ...(streamEvent.input || {}),
                    },
                    sectionCurrent: streamEvent.section_heading,
                    taskId: streamEvent.task_id || currentTaskIdRef.current,
                  },
                ];
              });
              setSidebarTab("execution");
            } else if (eventType === "gen_complete") {
              generationStore.setProgress({
                progress: 100,
                phase: `Complete — ${streamEvent.total_sections} sections generated`,
                status: "complete",
              });
              // Sync with parent
              if (setSrsDoc) setSrsDoc(generatedContentAccum);
              if (onGenerationComplete) onGenerationComplete(activeMainTab);
            
            } else if (eventType === "gen_error") {
              generationStore.setError(streamEvent.error);
              generationStore.setProgressStatus("error");
            } else if (eventType === "paused") {
              generationStore.setProgressStatus("paused");
            } else if (eventType === "cancel") {
              generationStore.setProgressStatus("cancelled");
            }
          } catch (error) {
            console.error(`Document generating error occured : ${error}`)
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      generationStore.setError(err.message);
      generationStore.setProgressStatus("error");
    } finally {
      abortRef.current = null;
    }
  }, [project, activeMainTab, setSrsDoc, generationStore]);

  /**
   * Regenerate a single section via SSE.
   */
  const handleRegenerateSection = useCallback(async (sectionFilename) => {
    const abortCtrl = new AbortController();
    regenerateAbortRef.current = abortCtrl;
    setIsRegenerating(true);
    setRegeneratingSectionProgress(0);
    generationStore.setExecutionLog([]);
    setSidebarTab("execution");
    generationStore.setDocContent("");
    generationStore.setGenerating(true);
    generationStore.setProgressStatus("generating");

    const projectId = project?.id || project?._id;
    const documentType = activeMainTab === "srs" ? "srs" : "sdd";

    try {
      const response = await fetch(getApiUrl("/regenerate-section-stream"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, template_type: documentType, section_filename: sectionFilename, document_version: viewingVersion }),
        signal: abortCtrl.signal,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const streamEvent = JSON.parse(line.slice(6));
            const { type: eventType } = streamEvent;

            if (eventType === "gen_start") {
              setRegeneratingSectionProgress(5);
              generationStore.setPhase(`Regenerating: ${sectionFilename.replace(".md", "")}`);
            } else if (eventType === "section_chunk") {
              generationStore.setDocContent(streamEvent.content || "");
            } else if (eventType === "progress") {
              setRegeneratingSectionProgress(streamEvent.progress);
            } else if (eventType === "section_phase") {
              generationStore.setPhase(`Regenerating: ${streamEvent.section_heading}`);
            } else if (eventType === "tool_started") {
              generationStore.setExecutionLog((prev) => {
                // Deduplicate — skip if entry with this tool_call_id already exists
                if (prev.some((e) => e.id === streamEvent.tool_call_id)) {
                  return prev;
                }
                return [
                  ...prev,
                  {
                    id: streamEvent.tool_call_id,
                    toolName: streamEvent.tool_name,
                    status: "running",
                    toolInput: streamEvent.input || {},
                    startTime: Date.now(),
                    turn: currentTurnRef.current,
                    sectionCurrent: streamEvent.section_heading,
                  },
                ];
              });
            } else if (eventType === "tool_finished") {
              const toolCallId = streamEvent.tool_call_id;
              const toolFailed = streamEvent.is_error;
              generationStore.setExecutionLog((prev) => {
                // Only update if there's an entry in awaiting_input or running state
                // — skip entries already in terminal state (success/error) to avoid
                // double-resolving when handleSubmitInteraction already set success.
                const target = prev.find((e) => e.id === toolCallId && (e.status === "awaiting_input" || e.status === "running"));
                if (!target) return prev;
                return prev.map((toolLogEntry) => {
                  if (toolLogEntry.id === toolCallId) {
                    return {
                      ...toolLogEntry,
                      status: toolFailed ? "error" : "success",
                      sectionCurrent: streamEvent.section_heading,
                      durationMs: streamEvent.duration_ms,
                      toolOutput: streamEvent.output || "",
                    };
                  }
                  return toolLogEntry;
                });
              });
            } else if (eventType === "turn_start") {
              const newTurnNumber = streamEvent.turn || currentTurnRef.current + 1;
              currentTurnRef.current = newTurnNumber;
              currentTaskIdRef.current = streamEvent.task_id || "";
              generationStore.setCurrentTurn(newTurnNumber);
            } else if (eventType === "tool_interaction_request") {
              // Update the entry for this tool_call_id to "awaiting_input".
              // Skip entries already in a terminal state (success/error).
              // If no existing entry is found, create one (defensive fallback).
              generationStore.setExecutionLog((prev) => {
                const toolName = streamEvent.tool_name || "RequestUserInput";
                const matchingIdx = prev.findIndex(
                  (e) => e.id === streamEvent.tool_call_id
                    && e.status !== "success"
                    && e.status !== "error",
                );
                if (matchingIdx !== -1) {
                  const updated = [...prev];
                  updated[matchingIdx] = {
                    ...prev[matchingIdx],
                    status: "awaiting_input",
                    toolName,
                    toolInput: streamEvent.input || {},
                    interactionData: {
                      prompt: streamEvent.input?.prompt,
                      ui_type: streamEvent.input?.ui_type,
                      options: streamEvent.input?.options,
                      title: streamEvent.input?.title,
                      ...(streamEvent.input || {}),
                    },
                    sectionCurrent: streamEvent.section_heading,
                    taskId: streamEvent.task_id || currentTaskIdRef.current,
                  };
                  return updated;
                }
                return [
                  ...prev,
                  {
                    id: streamEvent.tool_call_id,
                    toolName,
                    status: "awaiting_input",
                    toolInput: streamEvent.input || {},
                    interactionData: {
                      prompt: streamEvent.input?.prompt,
                      ui_type: streamEvent.input?.ui_type,
                      options: streamEvent.input?.options,
                      title: streamEvent.input?.title,
                      ...(streamEvent.input || {}),
                    },
                    sectionCurrent: streamEvent.section_heading,
                    taskId: streamEvent.task_id || currentTaskIdRef.current,
                  },
                ];
              });
              setSidebarTab("execution");
            } else if (eventType === "gen_complete") {
              generationStore.setError(streamEvent.error);
              generationStore.setProgressStatus("error");
            } else if (eventType === "paused") {
              generationStore.setProgressStatus("paused");
            }
            
          } catch (error) {
            console.error(`Section regeneration error: ${error}`);
          }
        }
      }
    } catch (err) {
      if (err.name === "AbortError") return;
      generationStore.setError(err.message);
      generationStore.setProgressStatus("error");
    } finally {
      regenerateAbortRef.current = null;
      setIsRegenerating(false);
      generationStore.setGenerating(false);
    }
  }, [project, activeMainTab, generationStore, viewingVersion, sidebarTab, setSidebarTab]);

  /**
   * Submit an interactive tool response back to the backend.
   * Updates the execution log entry status and calls the interaction API.
   */
  const handleSubmitInteraction = useCallback(async (toolCallId, userResponse) => {
    const projectId = project?.id || project?._id;
    const existingEntry = generationStore.executionLog.find(e => e.id === toolCallId);
    const taskId = existingEntry?.taskId || currentTaskIdRef.current || "";

    try {
      await fetch(getApiUrl("/generation-interact"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          task_id: taskId,
          tool_call_id: toolCallId,
          response: userResponse,
        }),
      });
      generationStore.setExecutionLog((prevEntries) => {
        const matchingEntry = prevEntries.find((prevEntry_item) => prevEntry_item.id === toolCallId);
        if (!matchingEntry || matchingEntry.status === "success" || matchingEntry.status === "error") return prevEntries;
        return prevEntries.map((entry) =>
          entry.id === toolCallId
            ? { ...entry, status: "success", toolOutput: userResponse }
            : entry
        );
      });
    } catch (submitErr) {
      console.error("Interaction submit failed:", submitErr);
      generationStore.setExecutionLog((prevEntries) =>
        prevEntries.map((entry) =>
          entry.id === toolCallId
            ? { ...entry, status: "error", toolOutput: submitErr.message }
            : entry
        )
      );
    }
  }, [project, generationStore]);

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
    if (regenerateAbortRef.current) {
      regenerateAbortRef.current.abort("user cancelled");
    }
    if (onCancel) onCancel();
    generationStore.setProgressStatus("cancelled");
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
    generationStore.setProgressStatus("paused");
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
    setHeadingExpandedSections((prev) => {
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
        const versionData = await fetchVersionSections(projectId, latest.version);
        if (cancelled) return;
        const documentSections = versionData.sections || [];
        setLatestVersionSections(documentSections);
        let fullDocumentMarkdown = "";
        for (const section of documentSections) {
          if (!section.has_content) continue;
          const content = await fetchVersionContent(
            projectId,
            section.section_filename,
            latest.version,
          );
          fullDocumentMarkdown += content.content + "\n\n";
        }
        if (!cancelled) {
          setLatestVersionDoc(fullDocumentMarkdown.trim());
          setSelectedSectionFile(documentSections[0]?.section_filename || null);
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
        const versionData = await fetchVersionSections(projectId, version);
        if (cancelled) return;
        const documentSections = versionData.sections || [];
        console.log("Document sections: ", documentSections);
        setLatestVersionSections(documentSections);
        setSelectedSectionFile(documentSections[0]?.section_filename || null);
        setSelectedSectionContent("");
        let fullDocumentMarkdown = "";
        for (const section of documentSections) {
          if (!section.has_content) continue;
          const content = await fetchVersionContent(
            projectId,
            section.section_filename,
            version,
          );
          fullDocumentMarkdown += content.content + "\n\n";
        }
        if (!cancelled) {
          setLatestVersionDoc(fullDocumentMarkdown.trim());
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
    ? generatedDocContent
    : latestVersionDoc || generatedDocContent || parentSrsDoc;

  // Display doc for the main editor view (allows section-level editing)
  const displayDoc = isGenerating
    ? generatedDocContent
    : selectedSectionContent;

  // TOC heading extraction from the latest version document
  const tocHeadings = latestVersionDoc
    ? latestVersionDoc
        .split('\n')
        .filter(line => /^#{1,6}\s+/.test(line))
        .map((line, index) => {
          const match = line.match(/^(#{1,6})\s+(.*)/);
          const text = match[2].trim();
          return {
            level: match[1].length,
            text,
            slug: text.toLowerCase().replace(/[^\w]+/g, '-'),
            originalIndex: index,
          };
        })
    : [];

  // Compute visible headings with collapse state
  const tocVisibleHeadings = [];
  let tocHideThreshold = null;
  for (let i = 0; i < tocHeadings.length; i++) {
    const tocHeading = tocHeadings[i];
    if (tocHideThreshold !== null && tocHeading.level <= tocHideThreshold) {
      tocHideThreshold = null;
    }
    if (tocHideThreshold === null) {
      const hasChildren = i + 1 < tocHeadings.length && tocHeadings[i + 1].level > tocHeading.level;
      const isCollapsed = tocCollapsed.has(i);
      tocVisibleHeadings.push({ ...tocHeading, hasChildren, isCollapsed });
      if (isCollapsed) tocHideThreshold = tocHeading.level;
    }
  }

  const toggleTocHeading = useCallback((index) => {
    setTocCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const scrollToTocHeading = useCallback((slug) => {
    const editor = containerRef.current?.querySelector('.prose');
    if (editor) {
      const id = slug.toLowerCase().replace(/[^\w]+/g, '-');
      const el = editor.querySelector(`[id="${id}"]`) || editor.querySelector(`[id="${slug}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

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
                  onClick={() => {
                    if (!isActive) setSelectedSectionFile(sec.section_filename);
                  }}
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
                    <div className="flex items-center justify-between">
                      <div
                        className={`text-[11px] font-semibold truncate ${
                          isActive ? "text-[#2563eb]" : "text-[#334155]"
                        }`}
                      >
                        {sec.section_filename.replace(/\.md$/, "")}
                      </div>
                      {/* REFRESH / REGENERATE BUTTON */}
                      { isActive &&
                        <span
                          onClick={(e) => { e.stopPropagation(); handleRegenerateSection(sec.section_filename); }}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); handleRegenerateSection(sec.section_filename); } }}
                          title={`Regenerate: ${sec.section_filename.replace(".md", "")}`}
                          className={`inline-flex items-center justify-center rounded-md p-1 transition-colors ${
                            isRegenerating ? "cursor-wait opacity-70" : "cursor-pointer"
                          } bg-primary-100 hover:bg-primary-200`}
                        >
                          <RefreshCw size={12} className={`flex-shrink-0 ${isRegenerating ? "animate-spin" : ""}`}/>
                        </span>
                      }
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
              <button
                onClick={handlePause}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer shrink-0 text-blue-600 border border-primary-200 bg-primary-50 hover:bg-primary-100"
              >
                <Pause size={9} className="text-blue-400" /> Pause
              </button>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer shrink-0 text-red-600 border border-red-200 bg-red-50 hover:bg-red-100"
              >
                <X size={9} className="text-red-600" /> Cancel
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
                  {/* <span className="opacity-80 font-normal ml-1.5">
                    ({selectedChatBlocks.map(b => b.blockNumber).join(', ')})
                  </span> */}
                </span>
              </div>
              {/* <div className="w-px h-4 bg-blue-400/50" /> */}
              <button
                onClick={() => setSelectedChatBlocks([])}
                className="text-white hover:bg-blue-500/50 p-1 rounded-lg transition-colors"
                title="Clear selection"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Edit Actions Indicator */}
          <EditActionsBar
            chatMessages={chatMessages}
            onInteractionSubmit={onInteractionSubmit}
            currentSessionId={currentSessionId}
          />

          {displayDoc ? (
            <TiptapEditor
              content={displayDoc}
              onChange={handleVersionContentChange}
              project={project}
              requirementId="SRS_DOC"
              className="h-full border-none shadow-none rounded-none"
              versionNumber={viewingVersion}
              selectedChatBlocks={selectedChatBlocks}
              setSelectedChatBlocks={setSelectedChatBlocks}
              activeSection={selectedSectionFile}
              focusedChatBlock={focusedChatBlock}
              setFocusedChatBlock={setFocusedChatBlock}
              enableChatContext={true}
              useDocumentSync={false}
              documentId={selectedSectionFile}
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
          <div className="flex-1 overflow-y-auto p-3" ref={tabContentRef}>
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

                  {/* TOC Toggle */}
                  <button
                    onClick={() => setIsTocOpen(!isTocOpen)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-gray-50/80 border border-gray-100 mt-4 mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1 bg-white rounded-md shadow-sm border border-gray-100">
                        <List size={12} className="text-gray-600" />
                      </div>
                      <span className="font-bold tracking-wide uppercase text-[10px] text-gray-600">
                        Table of Contents
                      </span>
                    </div>
                    {isTocOpen ? (
                      <ChevronDown size={12} className="text-gray-400" />
                    ) : (
                      <ChevronRight size={12} className="text-gray-400" />
                    )}
                  </button>

                  {/* TOC List */}
                  {isTocOpen && (
                    <div className="overflow-hidden">
                      {tocVisibleHeadings.length > 0 ? (
                        <ul className="space-y-0.5">
                          {tocVisibleHeadings.map((tocHeadingItem) => (
                            <li
                              key={tocHeadingItem.originalIndex}
                              className="flex items-start gap-1"
                              style={{ paddingLeft: `${(tocHeadingItem.level - 1) * 12}px` }}
                            >
                              {tocHeadingItem.hasChildren ? (
                                <button
                                  onClick={() => toggleTocHeading(tocHeadingItem.originalIndex)}
                                  className="p-0.5 hover:bg-gray-100 rounded mt-0.5 text-gray-400 flex-shrink-0"
                                >
                                  {tocHeadingItem.isCollapsed ? (
                                    <ChevronRight size={12} />
                                  ) : (
                                    <ChevronDown size={12} />
                                  )}
                                </button>
                              ) : (
                                <div className="w-[18px] flex-shrink-0" />
                              )}
                              <span
                                onClick={() => scrollToTocHeading(tocHeadingItem.slug)}
                                className={`text-xs ${tocHeadingItem.level === 1 ? 'font-bold text-gray-700' : 'text-gray-500'} hover:text-blue-600 cursor-pointer transition-colors leading-tight py-1`}
                                title={tocHeadingItem.text}
                              >
                                {tocHeadingItem.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-gray-400 text-center py-4">
                          No headings found
                        </div>
                      )}
                    </div>
                  )}
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
                onSubmitInteraction={handleSubmitInteraction}
                tabContentRef={tabContentRef}
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
          project={project}
          viewingVersion={viewingVersion}
          templateType={activeMainTab}
          isGenerating={isGenerating}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}