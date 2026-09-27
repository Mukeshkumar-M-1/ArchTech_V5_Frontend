import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import TiptapEditor from "../../components/TiptapEditor";
import {
  Zap,
  FileText,
  AlertTriangle,
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
  Layers,
  AtSign,
} from "lucide-react";
import { getApiUrl } from "../../utils/apiConfig";
import { fetchProjectSettings } from "../../api/settingsApi";
import useToastStore from "../../store/toastStore";
import {
  fetchDocumentVersions,
  fetchVersionSections,
  fetchVersionContent,
  updateVersionContent,
  fetchPhase3Analysis,
} from "../../api/templateApi";
import PreviewModal from "./PreviewModal";
import ExportModal from "./ExportModal";
import ContentEditPreviewPanel from "./ContentEditPreviewPanel";
import { findBestMatchInMarkdown } from "../../utils/markdownMatch";
import useGenerationStore from "../../store/generationStore";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

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
      case "Search":
      case "Glob":
        return input.pattern || input.glob;
      case "Agent":
        return input.agent_type;
      case "Bash":
        return input.description;
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
                {Object.values(turnGroups).flat().filter((e) => e.kind !== "assistant_message" && e.kind !== "llm_retry").length} tool{Object.values(turnGroups).flat().filter((e) => e.kind !== "assistant_message" && e.kind !== "llm_retry").length !== 1 ? "s" : ""}
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

                  // LLM retry/backoff events render as an amber warning row —
                  // they are not tools, so they bypass the collapsible IN/OUT row.
                  if (toolEntry.kind === "llm_retry") {
                    return (
                      <div key={toolEntry.id} className="relative pl-6 pb-2 mt-1">
                        {(isSectionActive || !isLastEntry) && (
                          <div className={`absolute left-[11px] top-4 ${isLastEntry && isSectionActive ? "bottom-[-24px]" : "bottom-[-16px]"} w-[1px] bg-gray-200`} />
                        )}
                        <div className="absolute left-[8px] top-[6px] w-[7px] h-[7px] rounded-full ring-2 ring-white bg-amber-500" />
                        <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-left">
                          <AlertTriangle size={11} className="text-amber-600 shrink-0" />
                          <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">
                            LLM retry
                          </span>
                          <span className="text-[10px] font-mono text-amber-700">
                            {toolEntry.model} · {toolEntry.reason} · attempt {toolEntry.attempt}/{toolEntry.maxAttempts} · waiting {toolEntry.waitSeconds}s
                          </span>
                        </div>
                      </div>
                    );
                  }

                  // Assistant narration that accompanied a tool call renders as a
                  // Markdown message bubble, not a collapsible tool row.
                  if (toolEntry.kind === "assistant_message") {
                    return (
                      <div key={toolEntry.id} className="relative pl-6 pb-2 mt-1">
                        {(isSectionActive || !isLastEntry) && (
                          <div className={`absolute left-[11px] top-4 ${isLastEntry && isSectionActive ? "bottom-[-24px]" : "bottom-[-16px]"} w-[1px] bg-gray-200`} />
                        )}
                        <div className="absolute left-[8px] top-[6px] w-[7px] h-[7px] rounded-full ring-2 ring-white bg-primary-500" />
                        <div className="rounded-lg border border-primary-100 bg-primary-50/40 px-3 py-2 text-left">
                          <div className="text-[10px] font-bold uppercase tracking-wide text-accent mb-1">
                            Assistant
                          </div>
                          <div className="prose max-w-none text-[12px] text-slate-700 break-words [&_table]:w-full [&_th]:text-left [&_th]:text-[11px] [&_td]:text-[11px] [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {toolEntry.content}
                            </ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    );
                  }

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
  onInteractionSubmit,
  currentSessionId,
  isAwaitingUserInput,
  onAwaitingUserInputChange,
  pendingToolCallId,
  setPendingToolCallId,
  onActiveSectionContextChange,
  mentionedFiles = [],
  setMentionedFiles,
}) {
  const addToast = useToastStore((s) => s.addToast);
  // Local state for streaming generation
  const [generationHeadings, setGenerationHeadings] = useState([]);
  const [headingExpandedSections, setHeadingExpandedSections] = useState(new Set([]));

  // Latest version document content (fetched when idle)
  const [latestVersionDoc, setLatestVersionDoc] = useState("");
  const [latestVersionSections, setLatestVersionSections] = useState([]);
  const [selectedSectionFile, setSelectedSectionFile] = useState(null);
  const [selectedSectionContent, setSelectedSectionContent] = useState("");
  // Per-section markdown cached while concatenating the full doc — TOC clicks use it to
  // find which section owns a heading without refetching every section.
  const latestVersionSectionContentsRef = useRef({});
  const pendingTocHeadingRef = useRef(null);

  // Switch section when a chat block is focused
  useEffect(() => {
    if (focusedChatBlock?.section && focusedChatBlock.section !== selectedSectionFile) {
      setSelectedSectionFile(focusedChatBlock.section);
    }
  }, [focusedChatBlock, selectedSectionFile]);
  const [viewingVersion, setViewingVersion] = useState(null);
  const [totalVersions, setTotalVersions] = useState(0);
  /* Active (non-deleted) version numbers, ascending. Prev/next navigation and
     the draggable version bar step through THIS list by position, not by raw
     version number, so soft-deleted versions (number gaps) are never shown. */
  const [navigableVersionNumbers, setNavigableVersionNumbers] = useState([]);
  const [scrubVersion, setScrubVersion] = useState(null);
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [tocCollapsed, setTocCollapsed] = useState(new Set());

  // Report the currently-viewed section + version up to the shared workspace so the chat
  // panel can capture a "mention file" of whatever the user is looking at.
  useEffect(() => {
    onActiveSectionContextChange?.(
      selectedSectionFile && viewingVersion
        ? { filename: selectedSectionFile, version: viewingVersion }
        : null,
    );
  }, [selectedSectionFile, viewingVersion, onActiveSectionContextChange]);

  // Modals state
  const [showPreview, setShowPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);

  // Tabbed content-edit preview (Current/Proposed). The router resolves the proposal to the
  // backend-stored markdown and opens the modal instead of splicing a diff into the live
  // editor — queued so multiple pending edits drain one at a time.
  const [activeEditPreview, setActiveEditPreview] = useState(null); // { edit, sourceMarkdown }
  const editPreviewQueueRef = useRef([]); // [{ edit, sourceMarkdown }]
  const [editPreviewSaving, setEditPreviewSaving] = useState(false);
  const [editPreviewError, setEditPreviewError] = useState(null);
  // Tab strip in the document pane: the live editor and the edit preview are sibling
  // tabs while a proposal is open.
  const [editorPaneTab, setEditorPaneTab] = useState("editor");

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
  // WHY: cancel stops the run via the backend pause flag, which emits a "paused" SSE event that
  // races in after the user already cancelled — without this guard the banner flips to "Resume".
  const cancelledRef = useRef(false);
  // Counts sections the backend reported as failed; a run with failures is NOT a success, so the
  // Build Complete panel must stay hidden (orchestrator counts failed tasks as completed).
  const failedSectionsRef = useRef(0);

  // Auto-save generated version edits with a 1000ms debounce, one independent timer per section.
  // WHY per-section timers: a single shared timer means editing section B within 1 second of
  // section A cancels A's still-pending save and silently loses A's edit.
  // WHY the post-save cache sync: `latestVersionSections` and `latestVersionSectionContentsRef`
  // are snapshots from the initial load — without this, an "empty" section the user just filled
  // keeps has_content=false and the section list label + TOC cache go stale.
  useEffect(() => {
    const SAVE_DEBOUNCE_MS = 1000;
    const pendingSaveTimersBySection = {};

    const saveEditedSectionContent = (projectId, sectionFilename, documentVersion, editedContent) => {
      if (!projectId || !sectionFilename || !documentVersion) return;

      if (pendingSaveTimersBySection[sectionFilename]) {
        clearTimeout(pendingSaveTimersBySection[sectionFilename]);
      }
      pendingSaveTimersBySection[sectionFilename] = setTimeout(async () => {
        delete pendingSaveTimersBySection[sectionFilename];
        try {
          await updateVersionContent(projectId, sectionFilename, documentVersion, editedContent);

          latestVersionSectionContentsRef.current[sectionFilename] = editedContent;
          setLatestVersionSections((previousSections) =>
            previousSections.map((section) =>
              section.section_filename === sectionFilename
                ? { ...section, has_content: editedContent.trim().length > 0 }
                : section,
            ),
          );
        } catch (saveError) {
          console.error('Failed to save version content:', saveError);
        }
      }, SAVE_DEBOUNCE_MS);
    };

    saveVersionRef.current = {
      save: saveEditedSectionContent,
      cancel: () => {
        Object.values(pendingSaveTimersBySection).forEach(clearTimeout);
      },
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

  /**
   * Start document generation via SSE.
   */
  const handleGenerate = useCallback(async (mode = "fresh") => {
    const projectId = project?.id || project?._id;

    // LLM settings must be configured before generation can run
    if (projectId) {
      try {
        const settings = await fetchProjectSettings(projectId);
        if (!settings?.api_url || !settings?.api_key || !settings?.default_model) {
          addToast(
            "LLM is not configured. Open Settings and set API URL, API Key and Model before generating.",
            "error",
          );
          return;
        }
      } catch (err) {
        console.error("Failed to load LLM settings:", err);
        addToast("Could not verify LLM settings. Configure them in Settings before generating.", "error");
        return;
      }

      // The template analysis report ({project_id}_template_report.json) must exist
      // before generation — the backend 404s if it's missing.
      try {
        await fetchPhase3Analysis(projectId);
      } catch {
        addToast(
          "Template analysis report not found. Run template analysis in the Document Template panel before generating.",
          "error",
        );
        return;
      }
    }

    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;
    // Fresh run: no longer cancelled, and no failures counted yet.
    cancelledRef.current = false;
    failedSectionsRef.current = 0;
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
    setNavigableVersionNumbers([]);
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
          mode,
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
            } else if (eventType === "llm_retry") {
              const retryEntryId = `llm-retry-${streamEvent.task_id}-${streamEvent.attempt}-${streamEvent.reason}`;
              generationStore.setExecutionLog((prev) =>
                prev.some((e) => e.id === retryEntryId)
                  ? prev
                  : [
                      ...prev,
                      {
                        id: retryEntryId,
                        kind: "llm_retry",
                        status: "success",
                        model: streamEvent.model,
                        reason: streamEvent.reason,
                        attempt: streamEvent.attempt,
                        maxAttempts: streamEvent.max_attempts,
                        waitSeconds: streamEvent.wait_seconds,
                        turn: currentTurnRef.current,
                        sectionCurrent: streamEvent.section_heading || currentSectionRef.current,
                        taskId: streamEvent.task_id || currentTaskIdRef.current,
                      },
                    ],
              );
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
            } else if (eventType === "assistant_message") {
              const assistantEntryId = `assistant-${streamEvent.task_id}-${streamEvent.turn}`;
              const sectionHeading = streamEvent.section_heading || currentSectionRef.current;
              generationStore.setExecutionLog((prev) => {
                if (prev.some((e) => e.id === assistantEntryId)) return prev;
                return [
                  ...prev,
                  {
                    id: assistantEntryId,
                    kind: "assistant_message",
                    content: streamEvent.content || "",
                    turn: streamEvent.turn,
                    sectionCurrent: sectionHeading,
                    taskId: streamEvent.task_id || currentTaskIdRef.current,
                  },
                ];
              });
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
              const hadFailures = failedSectionsRef.current > 0;
              generationStore.setProgress({
                progress: 100,
                phase: hadFailures
                  ? `Finished — ${failedSectionsRef.current} section(s) failed`
                  : `Complete — ${streamEvent.total_sections} sections generated`,
                status: hadFailures ? "error" : "complete",
              });
              // Sync with parent
              if (setSrsDoc) setSrsDoc(generatedContentAccum);
              // WHY the guard: the orchestrator counts failed tasks as completed and still emits
              // gen_complete, so showing "Build Complete / all sections successfully generated"
              // after failures would be a lie. Surface the error banner instead.
              if (!hadFailures && onGenerationComplete) onGenerationComplete(activeMainTab);

            } else if (eventType === "gen_error") {
              generationStore.setError(streamEvent.error);
              generationStore.setProgressStatus("error");
            } else if (eventType === "task_failed") {
              // Per-section failure — count it and surface the message instead of dropping it.
              failedSectionsRef.current += 1;
              generationStore.setError(streamEvent.error);
            } else if (eventType === "paused") {
              // A "paused" event arriving after the user hit Cancel is the backend's stop
              // mechanism, not a user pause — keep the honest "cancelled" banner, not "Resume".
              generationStore.setProgressStatus(cancelledRef.current ? "cancelled" : "paused");
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
    const projectId = project?.id || project?._id;

    // LLM settings must be configured before regeneration can run
    if (projectId) {
      try {
        const settings = await fetchProjectSettings(projectId);
        if (!settings?.api_url || !settings?.api_key || !settings?.default_model) {
          addToast(
            "LLM is not configured. Open Settings and set API URL, API Key and Model before generating.",
            "error",
          );
          return;
        }
      } catch (err) {
        console.error("Failed to load LLM settings:", err);
        addToast("Could not verify LLM settings. Configure them in Settings before generating.", "error");
        return;
      }
    }

    const abortCtrl = new AbortController();
    regenerateAbortRef.current = abortCtrl;
    setIsRegenerating(true);
    setRegeneratingSectionProgress(0);
    generationStore.setExecutionLog([]);
    setSidebarTab("execution");
    generationStore.setDocContent("");
    generationStore.setGenerating(true);
    generationStore.setProgressStatus("generating");

    const documentType = activeMainTab === "srs" ? "srs" : "sdd";
    let regeneratedContentAccum = "";

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
              regeneratedContentAccum = streamEvent.content || "";
              generationStore.setDocContent(regeneratedContentAccum);
            } else if (eventType === "progress") {
              setRegeneratingSectionProgress(streamEvent.progress);
            } else if (eventType === "section_phase") {
              generationStore.setPhase(`Regenerating: ${streamEvent.section_heading}`);
            } else if (eventType === "llm_retry") {
              const retryEntryId = `llm-retry-${streamEvent.task_id}-${streamEvent.attempt}-${streamEvent.reason}`;
              generationStore.setExecutionLog((prev) =>
                prev.some((e) => e.id === retryEntryId)
                  ? prev
                  : [
                      ...prev,
                      {
                        id: retryEntryId,
                        kind: "llm_retry",
                        status: "success",
                        model: streamEvent.model,
                        reason: streamEvent.reason,
                        attempt: streamEvent.attempt,
                        maxAttempts: streamEvent.max_attempts,
                        waitSeconds: streamEvent.wait_seconds,
                        turn: currentTurnRef.current,
                        sectionCurrent: streamEvent.section_heading || currentSectionRef.current,
                        taskId: streamEvent.task_id || currentTaskIdRef.current,
                      },
                    ],
              );
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
            } else if (eventType === "assistant_message") {
              const assistantEntryId = `assistant-${streamEvent.task_id}-${streamEvent.turn}`;
              generationStore.setExecutionLog((prev) => {
                if (prev.some((e) => e.id === assistantEntryId)) return prev;
                return [
                  ...prev,
                  {
                    id: assistantEntryId,
                    kind: "assistant_message",
                    content: streamEvent.content || "",
                    turn: streamEvent.turn,
                    sectionCurrent: streamEvent.section_heading || currentSectionRef.current,
                    taskId: streamEvent.task_id || currentTaskIdRef.current,
                  },
                ];
              });
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
              generationStore.setProgressStatus("complete");
              generationStore.setPhase("Regeneration complete");
              // Sync the caches the section list / TOC read, and refresh the open
              // editor if the regenerated section is the one on screen.
              latestVersionSectionContentsRef.current[sectionFilename] = regeneratedContentAccum;
              setLatestVersionSections((prev) =>
                prev.map((section) =>
                  section.section_filename === sectionFilename
                    ? { ...section, has_content: regeneratedContentAccum.trim().length > 0 }
                    : section,
                ),
              );
              if (selectedSectionFile === sectionFilename) {
                setSelectedSectionContent(regeneratedContentAccum);
              }
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
  }, [project, activeMainTab, generationStore, viewingVersion, sidebarTab, setSidebarTab, selectedSectionFile]);

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
    // Set before aborting so a "paused" event already in the read buffer is attributed to the
    // cancel rather than flipping the banner to "Resume".
    cancelledRef.current = true;
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
    // Continue-after-pause: keep transcripts so completed sections replay and only the
    // remaining ones generate. "resume" skips the backend's transcript invalidation.
    handleGenerate("resume");
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
        const versionPayload = await fetchDocumentVersions(projectId);
        // New response shape: { versions, deleted_versions, templates } —
        // the generation panel only works with active (non-deleted) versions.
        const activeVersions = versionPayload.versions || [];
        if (cancelled || !activeVersions.length) return;
        const latest = activeVersions[0]; // newest first
        const versionData = await fetchVersionSections(projectId, latest.version);
        if (cancelled) return;
        const documentSections = versionData.sections || [];
        setLatestVersionSections(documentSections);
        let fullDocumentMarkdown = "";
        const sectionContents = {};
        for (const section of documentSections) {
          if (!section.has_content) continue;
          const content = await fetchVersionContent(
            projectId,
            section.section_filename,
            latest.version,
          );
          sectionContents[section.section_filename] = content.content;
          fullDocumentMarkdown += content.content + "\n\n";
        }
        if (!cancelled) {
          latestVersionSectionContentsRef.current = sectionContents;
          setLatestVersionDoc(fullDocumentMarkdown.trim());
          // Keep the section the user is viewing (e.g. the one just regenerated);
          // only default to the first section when nothing is selected yet.
          setSelectedSectionFile((prev) => prev || documentSections[0]?.section_filename || null);
          setSelectedSectionContent("");
          setViewingVersion(latest.version);
          setTotalVersions(activeVersions.length);
          setNavigableVersionNumbers(
            activeVersions.map((v) => v.version).sort((a, b) => a - b),
          );
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

  // Content-edit preview routed to a section that isn't loaded yet: the request is
  // parked here while the section-switch fetch below runs, then dispatched to the
  // TiptapEditor once its content prop has synced (child effects flush first).
  const pendingPreviewRef = useRef(null);

  const failPendingPreview = (sectionFilename, reason) => {
    const pending = pendingPreviewRef.current;
    if (!pending || pending.section_filename !== sectionFilename) return;
    pendingPreviewRef.current = null;
    window.dispatchEvent(
      new CustomEvent("content-edit-preview-result", {
        detail: { tool_call_id: pending.tool_call_id, success: false, reason },
      }),
    );
  };

  // Fetch selected section content
  useEffect(() => {
    if (isGenerating || !selectedSectionFile || !viewingVersion) return;
    let cancelled = false;
    const projectId = project?.id || project?._id;
    const load = async () => {
      setSelectedSectionContent("");
      try {
        // WHY no has_content guard: the local sections list is cached from before the user may
        // have edited an "empty" section (auto-save only touches the backend), so has_content
        // can be stale false. Always fetch — the backend returns saved edits or "".
        const content = await fetchVersionContent(
          projectId,
          selectedSectionFile,
          viewingVersion,
        );
        if (!cancelled) {
          setSelectedSectionContent(content.content || "");
          latestVersionSectionContentsRef.current[selectedSectionFile] =
            content.content || "";
          // An empty section can never match the proposal's original_text — report the
          // failure now instead of letting the pending preview hang silently.
          if (!content.content)
            failPendingPreview(selectedSectionFile, `Section '${selectedSectionFile}' is empty`);
        }
      } catch {
        if (!cancelled)
          failPendingPreview(selectedSectionFile, `Could not load section '${selectedSectionFile}'`);
        // ignore - stale fetch
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [selectedSectionFile, project, isGenerating, viewingVersion]);

  const dispatchEditorPreview = (detail, sourceMarkdown) => {
    window.dispatchEvent(
      new CustomEvent("preview-content-edit", {
        detail: { ...detail, source_markdown: sourceMarkdown ?? null },
      }),
    );
  };

  // Open (or queue) the tabbed preview modal for a resolved proposal. The live editor is
  // never spliced for this path — the modal renders Current/Proposed from sourceMarkdown.
  const openEditPreview = (detail, sourceMarkdown) => {
    setEditPreviewError(null);
    setActiveEditPreview((current) => {
      if (current && current.edit.tool_call_id !== detail.tool_call_id) {
        editPreviewQueueRef.current = [
          ...editPreviewQueueRef.current.filter(
            (q) => q.edit.tool_call_id !== detail.tool_call_id,
          ),
          { edit: detail, sourceMarkdown },
        ];
        return current;
      }
      return { edit: detail, sourceMarkdown };
    });
  };

  // Router for content-edit preview requests from ChatPanel. The proposal carries
  // section_filename + version, so the preview can be resolved against the
  // backend-stored section markdown (source of truth) instead of fuzzy-matching
  // whatever section happens to be open — and the right section is auto-loaded.
  useEffect(() => {
    const handlePreviewRequest = (e) => {
      const detail = e.detail || {};
      const target = detail.section_filename;
      if (!target) {
        // Legacy payload without a section — let the editor match what's open.
        dispatchEditorPreview(detail, null);
        return;
      }

      const parsedVersion = Number(detail.version);
      const hasVersion = Number.isInteger(parsedVersion) && parsedVersion > 0;
      const matchesViewingVersion = hasVersion && parsedVersion === Number(viewingVersion);

      if (target === selectedSectionFile && !hasVersion) {
        // Right section open, no version pin — use the cached stored markdown.
        openEditPreview(detail, latestVersionSectionContentsRef.current[target] ?? selectedSectionContent ?? null);
        return;
      }
      if (target === selectedSectionFile && matchesViewingVersion) {
        // Read from the cache ref, not selectedSectionContent: the listener closure can
        // hold a stale copy between content refreshes, while the ref is always current.
        openEditPreview(detail, latestVersionSectionContentsRef.current[target] || selectedSectionContent || null);
        return;
      }

      if (target !== selectedSectionFile) {
        // Park the request and switch sections; the pending-dispatch effect below is the
        // single dispatcher for this path — dispatching here would race the section-load
        // content-prop sync, which would clobber the overlay.
        pendingPreviewRef.current = detail;
        setSelectedSectionFile(target);
        return;
      }

      // Same section, but proposal pinned to a different version — fetch that exact
      // version's markdown as the match source. No section switch, so the content prop
      // stays put and the overlay can't be clobbered.
      const projectId = project?.id || project?._id;
      fetchVersionContent(projectId, target, parsedVersion)
        .then((content) => {
          const markdown = content.content || "";
          latestVersionSectionContentsRef.current[target] = markdown;
          if (markdown) {
            openEditPreview(detail, markdown);
          } else {
            window.dispatchEvent(
              new CustomEvent("content-edit-preview-result", {
                detail: {
                  tool_call_id: detail.tool_call_id,
                  success: false,
                  reason: `Section '${target}' v${parsedVersion} is empty`,
                },
              }),
            );
          }
        })
        .catch(() => {
          window.dispatchEvent(
            new CustomEvent("content-edit-preview-result", {
              detail: {
                tool_call_id: detail.tool_call_id,
                success: false,
                reason: `Could not load section '${target}' v${parsedVersion}`,
              },
            }),
          );
        });
    };
    window.addEventListener("content-edit-preview-request", handlePreviewRequest);
    return () =>
      window.removeEventListener("content-edit-preview-request", handlePreviewRequest);
    // selectedSectionContent intentionally read without being a dep: the router acts on
    // events, and re-registering on every keystroke-refresh would churn listeners.
  }, [selectedSectionFile, viewingVersion, project]);

  // Fire a parked preview once its section content has loaded AND the editor's content
  // prop has synced (child effects flush before parent effects in the same commit).
  useEffect(() => {
    const pending = pendingPreviewRef.current;
    if (!pending || !selectedSectionContent) return;
    if (pending.section_filename !== selectedSectionFile) return;
    pendingPreviewRef.current = null;
    let cancelled = false;
    const parsedVersion = Number(pending.version);
    const hasVersion = Number.isInteger(parsedVersion) && parsedVersion > 0;
    if (hasVersion && parsedVersion !== Number(viewingVersion)) {
      // Proposal pinned to a section version other than the one on screen — fetch that
      // exact version's markdown so the diff matches what the model proposed against.
      const projectId = project?.id || project?._id;
      fetchVersionContent(projectId, pending.section_filename, parsedVersion)
        .then((content) => {
          if (cancelled) return;
          const markdown = content.content || "";
          latestVersionSectionContentsRef.current[pending.section_filename] = markdown;
          if (markdown) {
            openEditPreview(pending, markdown);
          } else {
            window.dispatchEvent(
              new CustomEvent("content-edit-preview-result", {
                detail: {
                  tool_call_id: pending.tool_call_id,
                  success: false,
                  reason: `Section '${pending.section_filename}' v${parsedVersion} is empty`,
                },
              }),
            );
          }
        })
        .catch(() => {
          if (!cancelled)
            window.dispatchEvent(
              new CustomEvent("content-edit-preview-result", {
                detail: {
                  tool_call_id: pending.tool_call_id,
                  success: false,
                  reason: `Could not load section '${pending.section_filename}' v${parsedVersion}`,
                },
              }),
            );
        });
      return () => {
        cancelled = true;
      };
    }
    openEditPreview(pending, selectedSectionContent);
  }, [selectedSectionContent, selectedSectionFile, viewingVersion, project]);

  const closeEditPreview = useCallback(() => {
    const next = editPreviewQueueRef.current.shift() || null;
    setActiveEditPreview(next);
    setEditPreviewError(null);
    setEditPreviewSaving(false);
  }, []);

  // Auto-switch: opening a preview lands on the Edit Preview tab; closing returns
  // to the editor tab.
  useEffect(() => {
    setEditorPaneTab(activeEditPreview ? "preview" : "editor");
  }, [activeEditPreview]);

  // If the modal's proposal can't be matched against its source markdown, report the
  // failure to the chat card (it resets its Preview toggle) and dismiss the modal.
  useEffect(() => {
    if (!activeEditPreview) return;
    const { edit, sourceMarkdown } = activeEditPreview;
    if (edit?.original_text && findBestMatchInMarkdown(edit.original_text, sourceMarkdown)) {
      return;
    }
    window.dispatchEvent(
      new CustomEvent("content-edit-preview-result", {
        detail: {
          tool_call_id: edit?.tool_call_id,
          success: false,
          reason: edit?.original_text
            ? "Original text not found in the stored section"
            : "Proposal is missing original/proposed text",
        },
      }),
    );
    closeEditPreview();
  }, [activeEditPreview, closeEditPreview]);

  const handleEditPreviewReject = useCallback(() => {
    const { edit } = activeEditPreview || {};
    if (edit && onInteractionSubmit && currentSessionId) {
      onInteractionSubmit(currentSessionId, edit.tool_call_id, { status: "rejected" });
    }
    closeEditPreview();
  }, [activeEditPreview, onInteractionSubmit, currentSessionId, closeEditPreview]);

  // Shared persist sequence for an accepted content_edit proposal: locate the
  // original_text in the STORED section markdown (never the live editor — it may
  // not even be showing the proposal's section), replace it, and write through
  // updateVersionContent. Used by both the preview modal Accept and the chat card
  // Accept so "accepted" always means the file was actually written.
  const persistAcceptedContentEdit = useCallback(async (acceptedEdit) => {
    const projectId = project?.id || project?._id;
    const parsedVersion = Number(acceptedEdit?.version);
    const effectiveVersion =
      Number.isInteger(parsedVersion) && parsedVersion > 0
        ? parsedVersion
        : Number(viewingVersion);
    if (!acceptedEdit || !projectId || !acceptedEdit.section_filename || !effectiveVersion) {
      return null;
    }

    let storedSectionMarkdown = acceptedEdit.sourceMarkdown ?? null;
    if (!storedSectionMarkdown) {
      const storedVersionContent = await fetchVersionContent(
        projectId,
        acceptedEdit.section_filename,
        effectiveVersion,
      );
      storedSectionMarkdown = storedVersionContent?.content || "";
    }
    const matchedSegment = findBestMatchInMarkdown(acceptedEdit.original_text, storedSectionMarkdown);
    if (!matchedSegment) return null;

    const updatedSectionMarkdown = storedSectionMarkdown.replace(matchedSegment, acceptedEdit.proposed_text);
    await updateVersionContent(projectId, acceptedEdit.section_filename, effectiveVersion, updatedSectionMarkdown);

    // Sync the same caches the auto-save path maintains, so the section list label,
    // TOC cache, and any open editor view reflect the persisted edit.
    latestVersionSectionContentsRef.current[acceptedEdit.section_filename] = updatedSectionMarkdown;
    setLatestVersionSections((prev) =>
      prev.map((section) =>
        section.section_filename === acceptedEdit.section_filename
          ? { ...section, has_content: updatedSectionMarkdown.trim().length > 0 }
          : section,
      ),
    );
    // TiptapEditor syncs its content prop with emitUpdate:false when not focused.
    if (acceptedEdit.section_filename === selectedSectionFile) {
      setSelectedSectionContent(updatedSectionMarkdown);
    }
    return updatedSectionMarkdown;
  }, [project, viewingVersion, selectedSectionFile]);

  const handleEditPreviewAccept = useCallback(async () => {
    const { edit, sourceMarkdown } = activeEditPreview || {};
    setEditPreviewSaving(true);
    setEditPreviewError(null);
    try {
      const updatedMarkdown = await persistAcceptedContentEdit(
        edit ? { ...edit, sourceMarkdown } : null,
      );
      if (!updatedMarkdown) {
        setEditPreviewError("Could not locate the original text in the stored section");
        return;
      }

      if (onInteractionSubmit && currentSessionId) {
        onInteractionSubmit(currentSessionId, edit.tool_call_id, {
          status: "accepted",
          ui_type: "content_edit",
          section_filename: edit.section_filename,
          proposed_text: edit.proposed_text,
          block_number: edit.block_number,
        });
      }
      closeEditPreview();
    } catch (acceptError) {
      setEditPreviewError(
        `Failed to save: ${acceptError?.message || "unknown error"}`,
      );
    } finally {
      setEditPreviewSaving(false);
    }
  }, [activeEditPreview, persistAcceptedContentEdit, onInteractionSubmit, currentSessionId, closeEditPreview]);

  // Chat card Accept: persist through the same sequence as the modal Accept, then
  // resolve the interaction. The old card path relied on TiptapEditor being open on
  // the proposal's section, so accepting with a different section on screen
  // silently dropped the edit while still reporting accepted.
  useEffect(() => {
    const handleCardContentEditAccept = async (e) => {
      const acceptedEdit = e.detail || {};
      try {
        const updatedMarkdown = await persistAcceptedContentEdit(acceptedEdit);
        if (!updatedMarkdown) {
          window.dispatchEvent(
            new CustomEvent("content-edit-preview-result", {
              detail: {
                tool_call_id: acceptedEdit.tool_call_id,
                success: false,
                reason: "Original text not found in the stored section",
              },
            }),
          );
          return;
        }
        if (onInteractionSubmit && currentSessionId) {
          onInteractionSubmit(currentSessionId, acceptedEdit.tool_call_id, {
            status: "accepted",
            ui_type: "content_edit",
            section_filename: acceptedEdit.section_filename,
            proposed_text: acceptedEdit.proposed_text,
            block_number: acceptedEdit.block_number,
          });
        }
        // If the preview modal is showing this same proposal, close it now that
        // the edit is persisted.
        if (activeEditPreview?.edit?.tool_call_id === acceptedEdit.tool_call_id) {
          closeEditPreview();
        }
      } catch (cardAcceptError) {
        console.error("Card content edit accept failed:", cardAcceptError);
        window.dispatchEvent(
          new CustomEvent("content-edit-preview-result", {
            detail: {
              tool_call_id: acceptedEdit.tool_call_id,
              success: false,
              reason: `Failed to save: ${cardAcceptError?.message || "unknown error"}`,
            },
          }),
        );
      }
    };
    window.addEventListener("card-content-edit-accept", handleCardContentEditAccept);
    return () =>
      window.removeEventListener("card-content-edit-accept", handleCardContentEditAccept);
  }, [persistAcceptedContentEdit, onInteractionSubmit, currentSessionId, closeEditPreview, activeEditPreview]);

  // Card Hide/Reject dispatch apply-content-edit-reject and card Accept dispatches
  // apply-content-edit-accept; if the event targets the open preview, close it (and
  // drain the queue). Hide must not resolve the interaction — the card's
  // Accept/Reject paths already call onInteractionSubmit themselves, so this listener
  // only closes. The card dispatches lack tool_call_id, hence the
  // block_number/original_text fallback.
  useEffect(() => {
    const handleClose = (e) => {
      const d = e.detail || {};
      setActiveEditPreview((current) => {
        if (!current) return current;
        const matches = d.tool_call_id
          ? d.tool_call_id === current.edit.tool_call_id
          : d.block_number === current.edit.block_number &&
            d.original_text === current.edit.original_text;
        if (!matches) return current;
        editPreviewQueueRef.current = editPreviewQueueRef.current.filter(
          (q) => q.edit.tool_call_id !== current.edit.tool_call_id,
        );
        return editPreviewQueueRef.current.shift() || null;
      });
      setEditPreviewError(null);
    };
    window.addEventListener("apply-content-edit-reject", handleClose);
    window.addEventListener("apply-content-edit-accept", handleClose);
    return () => {
      window.removeEventListener("apply-content-edit-reject", handleClose);
      window.removeEventListener("apply-content-edit-accept", handleClose);
    };
  }, []);

  // Switch to a specific version
  const loadVersion = useCallback(
    async (version) => {
      if (isGenerating || !project) return;
      const projectId = project.id || project._id;
      latestLoadVersionRef.current = version;
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
        const sectionContents = {};
        for (const section of documentSections) {
          if (!section.has_content) continue;
          const content = await fetchVersionContent(
            projectId,
            section.section_filename,
            version,
          );
          sectionContents[section.section_filename] = content.content;
          fullDocumentMarkdown += content.content + "\n\n";
        }
        if (!cancelled && latestLoadVersionRef.current === version) {
          latestVersionSectionContentsRef.current = sectionContents;
          setLatestVersionDoc(fullDocumentMarkdown.trim());
          setViewingVersion(version);
        }
      } catch {
        // ignore - stale fetch
      }
    },
    [project, isGenerating],
  );

  // Return the neighbouring active version in the given direction (-1 = previous,
  // +1 = next), skipping soft-deleted versions. If the version currently being
  // viewed was itself deleted after it was loaded, jump to the nearest active
  // version in the requested direction instead of getting stuck.
  const getAdjacentNavigableVersion = useCallback(
    (direction) => {
      if (!navigableVersionNumbers.length || !viewingVersion) return null;
      const currentIndex = navigableVersionNumbers.indexOf(viewingVersion);
      if (currentIndex !== -1) {
        return navigableVersionNumbers[currentIndex + direction] ?? null;
      }
      if (direction > 0) {
        return navigableVersionNumbers.find((v) => v > viewingVersion) ?? null;
      }
      const activeVersionsBelow = navigableVersionNumbers.filter(
        (v) => v < viewingVersion,
      );
      return activeVersionsBelow.length
        ? activeVersionsBelow[activeVersionsBelow.length - 1]
        : null;
    },
    [navigableVersionNumbers, viewingVersion],
  );

  const goPreviousVersion = useCallback(() => {
    const previousVersion = getAdjacentNavigableVersion(-1);
    if (previousVersion !== null) loadVersion(previousVersion);
  }, [getAdjacentNavigableVersion, loadVersion]);

  const goNextVersion = useCallback(() => {
    const nextVersion = getAdjacentNavigableVersion(1);
    if (nextVersion !== null) loadVersion(nextVersion);
  }, [getAdjacentNavigableVersion, loadVersion]);

  const versionBarRef = useRef(null);
  const latestLoadVersionRef = useRef(null);

  // Map a pointer x-position to the version at that slot of the ACTIVE version
  // list (index-based, so soft-deleted versions are never scrubbed onto).
  const versionFromPointer = useCallback(
    (clientX) => {
      const el = versionBarRef.current;
      if (!el || !navigableVersionNumbers.length) return null;
      const rect = el.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      const positionIndex = Math.round(ratio * (navigableVersionNumbers.length - 1));
      return navigableVersionNumbers[positionIndex] ?? null;
    },
    [navigableVersionNumbers],
  );

  const handleVersionBarPointerDown = (e) => {
    if (isGenerating || !viewingVersion) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setScrubVersion(versionFromPointer(e.clientX));
  };

  const handleVersionBarPointerMove = (e) => {
    if (scrubVersion === null) return;
    const v = versionFromPointer(e.clientX);
    if (v !== null && v !== scrubVersion) setScrubVersion(v);
  };

  const handleVersionBarPointerEnd = () => {
    if (scrubVersion === null) return;
    if (scrubVersion !== viewingVersion) loadVersion(scrubVersion);
    setScrubVersion(null);
  };

  // While dragging the version bar, preview the scrub target; otherwise the loaded version.
  const displayedVersion = scrubVersion ?? viewingVersion ?? 0;

  /* 1-based position of the displayed version within the active list. Used for
     the slider fill/thumb so gaps from soft-deleted versions don't distort the
     bar (raw version numbers are no longer contiguous 1..totalVersions). If the
     displayed version isn't in the list (deleted while viewing), interpolate by
     counting how many active versions sit below it. */
  const displayedVersionPosition = useMemo(() => {
    const positionIndex = navigableVersionNumbers.indexOf(displayedVersion);
    if (positionIndex !== -1) return positionIndex + 1;
    return navigableVersionNumbers.filter((v) => v < displayedVersion).length;
  }, [navigableVersionNumbers, displayedVersion]);

  // Full document for preview/export (always the complete document, never section-specific)
  const fullDoc = isGenerating
    ? generatedDocContent
    : latestVersionDoc || generatedDocContent || parentSrsDoc;

  // Display doc for the main editor view (allows section-level editing)
  const displayDoc = isGenerating
    ? generatedDocContent
    : selectedSectionContent;

  // Whether the editor pane should render: an empty section (not yet generated) still gets an
  // editable editor — only the no-section-selected state shows the placeholder.
  const hasDocumentView = isGenerating
    ? Boolean(generatedDocContent)
    : Boolean(selectedSectionFile);

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

  // The document renders in TiptapEditor (.ProseMirror) whose headings carry no ids, so
  // match by exact text instead of the slug/`[id=...]` lookup that could never hit.
  const scrollEditorToHeading = useCallback((headingText) => {
    const editorRoot = containerRef.current?.querySelector('.ProseMirror');
    if (!editorRoot) return false;
    const headingElements = editorRoot.querySelectorAll('h1, h2, h3, h4, h5, h6');
    for (const headingElement of headingElements) {
      if (headingElement.textContent?.trim() === headingText) {
        headingElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return true;
      }
    }
    return false;
  }, []);

  const scrollToTocHeading = useCallback((headingText) => {
    if (scrollEditorToHeading(headingText)) return;
    // Heading lives in a section that isn't loaded in the editor yet — find its owner
    // in the cached markdown, switch sections, and let the pending effect scroll.
    const owner = latestVersionSections.find((sec) => {
      const markdown = latestVersionSectionContentsRef.current[sec.section_filename];
      return (
        markdown &&
        markdown.split('\n').some((line) => {
          const match = line.match(/^#{1,6}\s+(.*)/);
          return match && match[1].trim() === headingText;
        })
      );
    });
    if (!owner || owner.section_filename === selectedSectionFile) return;
    pendingTocHeadingRef.current = headingText;
    setSelectedSectionFile(owner.section_filename);
  }, [scrollEditorToHeading, latestVersionSections, selectedSectionFile]);

  // After a TOC-triggered section switch loads its content, scroll to the target heading.
  useEffect(() => {
    if (!pendingTocHeadingRef.current || isGenerating || !selectedSectionContent) return;
    const headingText = pendingTocHeadingRef.current;
    const timer = setTimeout(() => {
      pendingTocHeadingRef.current = null;
      scrollEditorToHeading(headingText);
    }, 150);
    return () => clearTimeout(timer);
  }, [selectedSectionContent, isGenerating, scrollEditorToHeading]);

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
                      <div className="flex items-center gap-1 justify-end min-w-0">
                      {mentionedFiles?.some((m) => m.sectionFilename === sec.section_filename) && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); setMentionedFiles?.((prev) => prev.filter((m) => m.sectionFilename !== sec.section_filename)); }}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.stopPropagation(); setMentionedFiles?.((prev) => prev.filter((m) => m.sectionFilename !== sec.section_filename)); } }}
                          title="Mentioned in chat — click to remove"
                          className="inline-flex items-center justify-center rounded-sm p-0.5 bg-violet-100 text-violet-600 border border-violet-200 cursor-pointer shrink-0"
                        >
                          <AtSign size={11} />
                        </span>
                      )}
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
              {/*<button
                onClick={handlePause}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold cursor-pointer shrink-0 text-blue-600 border border-primary-200 bg-primary-50 hover:bg-primary-100"
              >
                <Pause size={9} className="text-blue-400" /> Pause
              </button> */}
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
        {/* {status === "paused" && (
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
        )} */}

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

          {hasDocumentView ? (
            <>
              {/* While an edit preview is open, the pane becomes a two-tab strip:
                  the section's live editor and the Current/Proposed preview. The
                  editor stays mounted (hidden) so unsaved state survives switching. */}
              {activeEditPreview && (
                <div className="flex items-end gap-1 px-3 pt-1.5 bg-[#fafbfc] border-b border-gray-200 shrink-0">
                  <button
                    onClick={() => setEditorPaneTab("editor")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-t-md border border-b-0 transition-colors cursor-pointer ${
                      editorPaneTab === "editor"
                        ? "bg-white border-gray-200 text-blue-600"
                        : "bg-transparent border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <FileText size={11} />
                    <span className="truncate max-w-[180px]">
                      {selectedSectionFile?.replace(/\.md$/, "") || "Editor"}
                    </span>
                  </button>
                  <button
                    onClick={() => setEditorPaneTab("preview")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-t-md border border-b-0 transition-colors cursor-pointer ${
                      editorPaneTab === "preview"
                        ? "bg-white border-gray-200 text-emerald-600"
                        : "bg-transparent border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <Eye size={11} />
                    Edit Preview
                    {activeEditPreview.edit?.block_number != null && (
                      <span className="px-1 py-0.5 rounded-sm bg-gray-100 border border-gray-200 text-[9px] text-gray-500 font-bold">
                        B{activeEditPreview.edit.block_number}
                      </span>
                    )}
                    {editPreviewSaving && (
                      <Loader2 size={10} className="animate-spin text-emerald-500" />
                    )}
                  </button>
                  <div className="flex-1" />
                  <button
                    onClick={closeEditPreview}
                    disabled={editPreviewSaving}
                    className="p-1 mb-1 hover:bg-gray-200 rounded text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40 shrink-0"
                    title="Dismiss preview"
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
              <div
                className={`flex-1 flex min-h-0 overflow-hidden ${
                  editorPaneTab === "preview" ? "hidden" : ""
                }`}
              >
                <TiptapEditor
                  content={displayDoc}
                  onChange={handleVersionContentChange}
                  project={project}
                  requirementId="SRS_DOC"
                  className="h-full w-full border-none shadow-none rounded-none"
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
              </div>
              {activeEditPreview && editorPaneTab === "preview" && (
                <ContentEditPreviewPanel
                  key={activeEditPreview.edit?.tool_call_id ?? activeEditPreview.edit?.block_number ?? "edit"}
                  edit={activeEditPreview.edit}
                  sourceMarkdown={activeEditPreview.sourceMarkdown}
                  saving={editPreviewSaving}
                  error={editPreviewError}
                  onAccept={handleEditPreviewAccept}
                  onReject={handleEditPreviewReject}
                />
              )}
            </>
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
                onClick={() => handleGenerate("fresh")}
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
                disabled={isGenerating}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-[11px] font-semibold rounded-lg shadow-sm transition-all duration-200 ${
                  isGenerating
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:bg-gray-50 hover:border-gray-300 cursor-pointer"
                }`}
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
                  <div className="rounded-xl bg-gray-50/80 border border-gray-100 mb-4 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 py-2.5">
                      <div className="p-1 bg-white rounded-md shadow-sm border border-gray-100">
                        <Layers size={12} className="text-gray-600" />
                      </div>
                      <span className="font-bold tracking-wide uppercase text-[10px] text-gray-600">
                        Versions
                      </span>
                      <span className="flex-1" />
                      <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-100 text-[9px] text-blue-600 font-bold">
                        v{viewingVersion} / {totalVersions}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 pb-3">
                      <button
                        onClick={goPreviousVersion}
                        disabled={getAdjacentNavigableVersion(-1) === null}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 shadow-sm hover:border-blue-200 hover:bg-blue-50/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 transition-all"
                        title="Previous version"
                      >
                        <ChevronLeft size={14} className="text-gray-600" />
                      </button>
                      <div className="flex-1 flex flex-col items-center gap-1.5">
                        <div className="text-[13px] font-bold text-gray-800 leading-none">
                          Version {displayedVersion}
                          <span className="text-[10px] font-semibold text-gray-400 ml-1">
                            / {totalVersions}
                          </span>
                        </div>
                        <div
                          ref={versionBarRef}
                          onPointerDown={handleVersionBarPointerDown}
                          onPointerMove={handleVersionBarPointerMove}
                          onPointerUp={handleVersionBarPointerEnd}
                          onPointerCancel={handleVersionBarPointerEnd}
                          className="relative w-full py-2 -my-2 cursor-pointer touch-none select-none"
                          title="Drag to change version"
                        >
                          <div className="w-full h-1 rounded-full bg-gray-200/80 overflow-hidden">
                            <div
                              className={`h-full rounded-full bg-blue-500 ${scrubVersion === null ? "transition-all duration-300" : ""}`}
                              style={{ width: `${totalVersions ? Math.round((displayedVersionPosition / totalVersions) * 100) : 0}%` }}
                            />
                          </div>
                          <div
                            className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-blue-500 shadow-md ${scrubVersion === null ? "transition-all duration-300" : "scale-110"} pointer-events-none`}
                            style={{ left: `${totalVersions ? Math.round((displayedVersionPosition / totalVersions) * 100) : 0}%` }}
                          />
                        </div>
                      </div>
                      <button
                        onClick={goNextVersion}
                        disabled={getAdjacentNavigableVersion(1) === null}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white border border-gray-200 shadow-sm hover:border-blue-200 hover:bg-blue-50/60 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:border-gray-200 transition-all"
                        title="Next version"
                      >
                        <ChevronRight size={14} className="text-gray-600" />
                      </button>
                    </div>
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
                                onClick={() => scrollToTocHeading(tocHeadingItem.text)}
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
                  .replace("Regenerating: ", "")
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