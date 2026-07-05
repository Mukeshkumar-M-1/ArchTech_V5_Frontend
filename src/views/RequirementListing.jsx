import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import debounce from "lodash.debounce";
import ReactMarkdown from "react-markdown";
import { useNavigate } from "react-router-dom";
import {
  ClipboardList,
  ArrowRight,
  ShieldCheck,
  Tag,
  FileUp,
  FileText,
  Sparkles,
  Send,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Maximize2,
  X,
  LayoutList,
  Columns,
  MessageSquare,
  Plus,
  LayoutList as LayoutListIcon,
  Monitor as MonitorIcon,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from "lucide-react";
import remarkGfm from "remark-gfm";
import CustomSelect from "../components/ui/CustomSelect";
import PdfViewer from "../components/PdfViewer";
import { 
  fetchRequirements,
  fetchSelectedIds,
  fetchExtractionProgress,
  uploadRequirements,
  updateRequirement,
  requestAiInsight,
  submitSelectedRequirementsIds,
  getPdfViewerUrl,
} from "../api/requirementApi";
import TiptapEditor from "../components/TiptapEditor";


import useToastStore from "../store/toastStore";

// --- Sub-components for performance isolation ---

const AIInsightPanel = ({
  reqId,
  reqText,
  summarizingId,
  handleAIInsight,
  onCancel,
}) => {
  const [insightAction, setInsightAction] = useState("summarize");
  const [localQuery, setLocalQuery] = useState("");

  return (
    <div className=" w-[600px] bg-primary-50/50 border border-primary-100 rounded-2xl p-5 mb-6 animate-in slide-in-from-top-2 duration-300">
      <div className="flex items-center justify-between mb-4">
        <span className="text-[10px] font-black text-primary-600 uppercase tracking-widest">
          AI Command Center
        </span>
        <button
          onClick={onCancel}
          className="text-slate-400 hover:text-slate-600 transition-colors"
        >
          <ArrowRight size={14} className="rotate-180" />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {["summarize", "rephrase", "custom"].map((action) => (
          <button
            key={action}
            onClick={() => setInsightAction(action)}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-tight transition-all ${
              insightAction === action
                ? "bg-primary-600 text-white shadow-sm"
                : "bg-white text-slate-500 hover:bg-slate-100 border border-slate-200"
            }`}
          >
            {action}
          </button>
        ))}
      </div>

      {insightAction === "custom" && (
        <div className="mb-4">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-2 ml-1">
            Custom Instruction
          </label>
          <div className="bg-white border border-primary-100 rounded-2xl overflow-hidden focus-within:border-primary-400 transition-colors shadow-sm">
            <TiptapEditor
              content={localQuery}
              onChange={setLocalQuery}
              className="p-4 min-h-[100px]"
            />
          </div>
        </div>
      )}

      <button
        onClick={() =>
          handleAIInsight(reqId, reqText, insightAction, localQuery)
        }
        disabled={summarizingId === reqId}
        className="w-full py-2.5 bg-primary-600 hover:bg-primary-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary-200 disabled:opacity-50"
      >
        {summarizingId === reqId ? (
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : (
          <Send size={14} />
        )}
        Generate AI Insight
      </button>
    </div>
  );
};

export default function RequirementListing({ project }) {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);
  const [targetDoc, setTargetDoc] = useState("SyRS");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [summaries, setSummaries] = useState({}); // { reqId: [{ action, content, timestamp }] }
  const [activeInsightIndex, setActiveInsightIndex] = useState({}); // { reqId: index }
  const [showInsightId, setShowInsightId] = useState(null);
  const [summarizingId, setSummarizingId] = useState(null);
  const [newReq, setNewReq] = useState({
    id: "",
    text: "",
    type: "Functional",
    source: "Manual",
  });
  const [docType, setDocType] = useState("TechSpec");
  const navigate = useNavigate();
  const [isUploading, setIsUploading] = useState(false);
  const [filterCategory, setFilterCategory] = useState("All");
  const [progressData, setProgressData] = useState(null);
  const [aiPanelId, setAiPanelId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [fullViewId, setFullViewId] = useState(null);
  const [viewMode, setViewMode] = useState("list"); // 'list' | 'page'
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pageViewIndex, setPageViewIndex] = useState(0);
  const [pdfTotalPages, setPdfTotalPages] = useState(1);
  const [pdfSrc, setPdfSrc] = useState(null);
  const [pdfLayoutMode, setPdfLayoutMode] = useState("scroll");
  const [pdfZoom, setPdfZoom] = useState(100);
  const itemsPerPage = 8;
  const pdfSyncRef = useRef("init");
  const prevPageViewIndexRef = useRef(0);

  // ===================================================================
  // UI State — Chat, PDF Selection, Add Requirement Modal, Highlight
  // ===================================================================
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [selectedReqIds, setSelectedReqIds] = useState([]);
  const [chatQuery, setChatQuery] = useState("");
  const [pdfSelection, setPdfSelection] = useState(null);
  const [highlightedReqId, setHighlightedReqId] = useState(null);
  const [showAddReqModal, setShowAddReqModal] = useState(false);
  const [submittingSelected, setSubmittingSelected] = useState(false);

  // ===================================================================
  // Toast
  // ===================================================================
  const addToast = useToastStore((s) => s.addToast);

  // ===================================================================
  // Local states for metadata to avoid full re-renders on typing
  // ===================================================================
  const [localNewReq, setLocalNewReq] = useState(newReq);

  // ===================================================================
  // Computed — Filtered & Paginated Requirements
  // ===================================================================
  const filteredRequirements = useMemo(() => {
    if (filterCategory === "All") return requirements;
    return requirements.filter(
      (r) => (r.category || r.type) === filterCategory,
    );
  }, [requirements, filterCategory]);

  const totalPages = Math.ceil(filteredRequirements.length / itemsPerPage);
  const paginatedRequirements = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRequirements.slice(start, start + itemsPerPage);
  }, [filteredRequirements, currentPage]);

  //-------------------------------------------------------
  // Handle filter category change — reset to first page
  //-------------------------------------------------------
  useEffect(() => {
    setCurrentPage(1);
  }, [filterCategory]);
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Debounced sync for AI Query
  //-------------------------------------------------------
  const debouncedSetCustomQuery = useMemo(
    () => debounce((val) => setCustomQuery(val), 300),
    [],
  );
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Debounced sync for New Requirement
  //-------------------------------------------------------
  const debouncedSetNewReq = useMemo(
    () => debounce((val) => setNewReq(val), 300),
    [],
  );
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Handle page requirement list page changes
  //-------------------------------------------------------
  const listTopRef = useRef(null);
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
    listTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Loading requirement extraction
  //-------------------------------------------------------
  const loadReqs = async () => {
    setLoading(true);
    try {
      const data = await fetchRequirements(project.id);
      const sorted = [...(data || [])].sort(
        (a, b) => (a.page || 0) - (b.page || 0),
      );
      setRequirements(sorted);

      // Auto-select from previously saved selected_requirement.json
      if (project?.id) {
        try {
          const selData = await fetchSelectedIds(project.id);
          setSelectedIds(selData.selected_ids || []);
        } catch (err) {
          console.error("Failed to fetch selected ids", err);
        }
      }
    } catch (err) {
      console.error("Extraction mapping failure:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReqs();
  }, [project.id]);
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Upload file to Requirement extraction endpoint
  //-------------------------------------------------------
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];

    if (!file) return;

    setIsUploading(true);
    setProgressData({ status: "starting", message: "Initializing upload..." });

    // Extraction Message polling setup
    const pollInterval = setInterval(async () => {
      try {
        const data = await fetchExtractionProgress(project.id);
        setProgressData(data);
      } catch (err) {
        console.log(err);
      }
    }, 500);

    try {
      await uploadRequirements(project.id, file);

      // Reload requirements after successful extraction
      await loadReqs();
    } catch (err) {
      console.error("Upload error:", err);
      alert("Failed to upload document.");
    } finally {
      clearInterval(pollInterval);
      setProgressData(null);
      setIsUploading(false);
    }
  };

  //-------------------------------------------------------
  // Toggle single requirement selection
  //-------------------------------------------------------
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Toggle select all visible requirements
  //-------------------------------------------------------
  const toggleSelectAll = () => {
    const visibleIds = filteredRequirements.map((r) => r.id);
    const isAllVisibleSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedIds.includes(id));

    if (isAllVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Save edited requirement text to backend
  //-------------------------------------------------------
  const handleSaveEdit = async (id) => {
    try {
      await updateRequirement(project.id, id, editText);
      setRequirements(
        requirements.map((r) => (r.id === id ? { ...r, text: editText } : r)),
      );
      setEditingId(null);
    } catch (err) {
      console.error("Save error:", err);
      alert("Failed to save changes to backend.");
    }
  };
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Handle AI insights request to backend
  //-------------------------------------------------------
  const handleAIInsight = async (
    reqId,
    text,
    action = "summarize",
    query = "",
  ) => {
    setSummarizingId(reqId);
    try {
      const data = await requestAiInsight(project.id, text, action, action === "custom" ? query : null);
      console.log("Response : ", data);

      const newInsight = {
        action: action === "custom" ? `Custom: ${query}` : action,
        content: data.insight || "Failed to parse AI insight.",
        timestamp: new Date().toLocaleTimeString(),
      };

      setSummaries((prev) => {
        const currentList = prev[reqId] || [];
        const updatedList = [...currentList, newInsight];

        setActiveInsightIndex((idxPrev) => ({
          ...idxPrev,
          [reqId]: updatedList.length - 1,
        }));

        return { ...prev, [reqId]: updatedList };
      });
      setShowInsightId(reqId);
    } catch (e) {
      const errorInsight = {
        action: "Error",
        content: "Error: Could not connect to AI engine.",
        timestamp: new Date().toLocaleTimeString(),
      };
      setSummaries((prev) => ({
        ...prev,
        [reqId]: [...(prev[reqId] || []), errorInsight],
      }));
    } finally {
      setSummarizingId(null);
      setAiPanelId(null);
    }
  };
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Toggle AI insight panel visibility
  //-------------------------------------------------------
  const toggleInsightPanel = (reqId) => {
    if (aiPanelId === reqId) {
      setAiPanelId(null);
    } else {
      setAiPanelId(reqId);
    }
  };
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Handle copy requirement text to clipboard
  //-------------------------------------------------------
  const handleCopy = (text, id) => {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 2000);
        })
        .catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      console.log("Clipboard copy failed");
    }
    document.body.removeChild(textarea);
  };
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Toggle AI insight result visibility
  //-------------------------------------------------------
  const toggleInsightResult = (reqId) => {
    if (showInsightId === reqId) {
      setShowInsightId(null);
    } else if (summaries[reqId]?.length > 0) {
      setShowInsightId(reqId);
    } else {
      toggleInsightPanel(reqId);
    }
  };
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Handle requirement changes — update PDF source and reset page view
  //-------------------------------------------------------
  useEffect(() => {
    const req = requirements[0];
    if (req && req.source) {
      setPdfSrc(getPdfViewerUrl(project.id, req.source));
      setPdfCurrentPage(pageViewIndex || 1);
    }
  }, [pageViewIndex, requirements]);
  //-------------------------------------------------------

  //-------------------------------------------------------
  // Sync requirement display based on PDF page
  //-------------------------------------------------------
  useEffect(() => {
    if (requirements.length > 0 && pdfCurrentPage > 0) {
      setPageViewIndex(pdfCurrentPage);
    }
  }, [pdfCurrentPage, requirements]);
  //-------------------------------------------------------

  const pageViewReq =
    filteredRequirements.length > 0
      ? filteredRequirements[pageViewIndex]
      : null;

  //-------------------------------------------------------
  // Requirements matching the current PDF page (computed)
  //-------------------------------------------------------
  const pageRequirements = useMemo(() => {
    if (!pdfCurrentPage || requirements.length === 0) return [];
    return requirements.filter((r) => r.page === pdfCurrentPage);
  }, [pdfCurrentPage, requirements]);
  //-------------------------------------------------------

  const canNavigatePage = filteredRequirements.length > 0;

  // Add a new message to the chat history array
  const addChatMessage = (msg) => {
    setChatMessages((prev) => [...prev, msg]);
  };

  // Handle text selected on the PDF viewer — match to requirements and send to chat
  const handlePdfTextSelection = useCallback(
    (sel) => {
      setPdfSelection(sel);
      // Find matching requirement
      const matchedReq = pageRequirements.find(
        (r) =>
          r.text.toLowerCase().includes(sel.text.toLowerCase()) ||
          (r.explanation &&
            r.explanation.toLowerCase().includes(sel.text.toLowerCase())),
      );
      if (matchedReq) {
        setHighlightedReqId(matchedReq.id);
        // Add to chat if open
        if (chatOpen && !selectedReqIds.includes(matchedReq.id)) {
          setSelectedReqIds((prev) => [...prev, matchedReq.id]);
          addChatMessage({
            id: Date.now(),
            type: "system",
            content: `Requirement ${matchedReq.id} selected`,
          });
        }
        // Add selection to chat
        if (chatOpen) {
          addChatMessage({
            id: Date.now() + 1,
            type: "selection",
            content: sel.text,
            pageIndex: sel.pageIndex,
            reqId: matchedReq.id,
            reqIds: [matchedReq.id],
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      } else {
        setHighlightedReqId(null);
        // Still add selection to chat even without match
        if (chatOpen) {
          addChatMessage({
            id: Date.now() + 1,
            type: "selection",
            content: sel.text,
            pageIndex: sel.pageIndex,
            timestamp: new Date().toLocaleTimeString(),
          });
        }
      }
    },
    [pageRequirements, chatOpen, selectedReqIds],
  );

  // Plugin ref for programmatic page navigation
  const pluginRef = useRef(null);

  // Called when PdfViewer plugin instance is ready
  const handlePluginReady = useCallback((p) => {
    pluginRef.current = p;
  }, []);

  // Handle PDF document loaded — capture total pages once
  const handleDocumentLoad = useCallback(({ numPages }) => {
    setPdfTotalPages(numPages);
  }, []);

  // Submit selected requirement IDs from page view to backend
  const submitSelectedRequirements = useCallback(async () => {
    if (selectedIds.length === 0 || !project?.id) return;
    setSubmittingSelected(true);
    try {
      await submitSelectedRequirementsIds(project.id, selectedIds);
      addToast(
        `${selectedIds.length} requirement(s) saved to selected_requirement.json`,
        "success",
      );
    } catch (err) {
      addToast(
        err.message || "Failed to submit selected requirements",
        "error",
      );
    } finally {
      setSubmittingSelected(false);
    }
  }, [selectedIds, project, addToast]);

  //-------------------------------------------------------
  // Navigate PDF to a specific page (1-indexed)
  //-------------------------------------------------------
  const goToPage = useCallback(
    (pageIndex) => {
      const clampedPage = Math.max(1, Math.min(pdfTotalPages, pageIndex));
      if (pluginRef.current?.jumpToPage) {
        pluginRef.current.jumpToPage(clampedPage - 1);
      }
      setPdfCurrentPage(clampedPage);
    },
    [pdfTotalPages, pdfCurrentPage],
  );
  //-------------------------------------------------------

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 font-bold">
        <ClipboardList
          className="animate-bounce text-primary-500 mb-4"
          size={36}
        />
        Extracting Document Schema...
      </div>
    );
  }

  return (
    <div className="">
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .scrollbar-pro::-webkit-scrollbar { width: 6px; }
        .scrollbar-pro::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-pro::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
        .scrollbar-pro::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `,
        }}
      />
      {/* Section 1 - File Upload */}
      {/* Sections 1 & 2 - Unified Header */}
      <div className="relative overflow-hidden rounded-[32px] bg-white border border-slate-200/50 shadow-[0_20px_20px_-12px_rgba(0,0,0,0.15)] z-50 group/header transition-all duration-500 hover:shadow-[0_30px_60px_-15px_rgba(59,130,246,0.25)] hover:border-primary-200/50 flex flex-col">
        {/* Animated Background Mesh */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-primary-400/20 to-purple-400/20 rounded-full blur-3xl -mr-64 -mt-64 transition-transform group-hover/header:scale-110 duration-1000 ease-in-out pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-blue-400/10 to-transparent rounded-full blur-2xl -ml-32 -mb-32 pointer-events-none" />

        {/* Top Row - File Upload */}
        <div className="relative z-10 p-8 flex items-center justify-between border-b border-slate-100/60 bg-white/40 backdrop-blur-md">
          <div className="flex items-center gap-4" ref={listTopRef}>
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center shadow-[0_10px_20px_-5px_rgba(99,102,241,0.5)] transform group-hover/header:rotate-3 transition-transform duration-300">
              <FileUp
                size={24}
                className="text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
              />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600 drop-shadow-sm">
                Source Specifications
              </h3>
              <p className="text-[12px] font-bold text-slate-400 uppercase tracking-widest mt-1 drop-shadow-sm">
                Ingest technical documents for AI extraction
              </p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {isUploading && (
              <div className="flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-primary-600 bg-white/60 backdrop-blur-xl border border-primary-100 px-5 py-3 rounded-2xl shadow-[0_8px_16px_-4px_rgba(59,130,246,0.15)] animate-pulse ring-1 ring-primary-50">
                <div className="w-4 h-4 border-2 border-primary-600 border-t-transparent rounded-full animate-spin drop-shadow-sm"></div>
                {progressData ? progressData.message : "Extracting Context..."}
              </div>
            )}
            <div className="w-72 relative group/select">
              <CustomSelect
                value={docType}
                onChange={setDocType}
                options={[
                  {
                    label: "Technical Specification (Full Chain)",
                    value: "TechSpec",
                  },
                  { label: "System Requirements (SyRS)", value: "SyRS" },
                  { label: "Hardware Requirements (HRS)", value: "HRS" },
                ]}
                className="z-20 transition-all duration-300 shadow-[0_8px_16px_-4px_rgba(0,0,0,0.1)] group-hover/select:shadow-[0_12px_24px_-6px_rgba(0,0,0,0.15)]"
              />
            </div>
            <label className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-slate-800 to-slate-900 hover:from-primary-600 hover:to-indigo-600 text-white font-black uppercase tracking-widest rounded-2xl text-[12px] transition-all duration-300 cursor-pointer shadow-[0_12px_24px_-8px_rgba(15,23,42,0.6)] hover:shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)] hover:-translate-y-1 active:scale-[0.98] group/btn overflow-hidden relative">
              <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300 ease-out" />
              <FileUp
                size={18}
                className="relative z-10 group-hover/btn:-translate-y-0.5 transition-transform duration-300 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]"
              />
              <span className="relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]">
                Upload Document
              </span>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.docx,.odt,.txt,.md"
                onChange={handleFileUpload}
                disabled={isUploading}
              />
            </label>
          </div>
        </div>

        {/* Bottom Row - Data Extraction & View Selection */}
        <div className="relative z-10 p-8 flex justify-between items-center bg-white/20 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-black text-slate-800 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-slate-900 to-slate-600 ml-2">
              Data Extraction
            </h2>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center bg-white/60 p-1.5 rounded-[20px] border border-slate-200/60 shadow-inner">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                  viewMode === "list"
                    ? "bg-white text-primary-600 shadow-md shadow-primary-500/10 border-transparent scale-105"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              >
                <LayoutList
                  size={16}
                  className={viewMode === "list" ? "text-primary-500" : ""}
                />
                List
              </button>
              <button
                onClick={() => setViewMode("page")}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all duration-300 ${
                  viewMode === "page"
                    ? "bg-white text-primary-600 shadow-md shadow-primary-500/10 border-transparent scale-105"
                    : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                }`}
              >
                <Columns
                  size={16}
                  className={viewMode === "page" ? "text-primary-500" : ""}
                />
                Page
              </button>
            </div>

            <div className="flex items-center">
              <div className="text-[11px] font-black text-slate-500 uppercase tracking-widest bg-white/60 px-5 py-3 rounded-2xl border border-slate-200/60 shadow-sm flex items-center gap-4 hover:shadow-md transition-shadow">
                <span className="opacity-80">Visible Selection</span>
                <div className="flex items-center gap-2 bg-primary-50 text-primary-600 px-3 py-1 rounded-xl border border-primary-100/50">
                  <span className="text-sm font-black">
                    {selectedIds.length}
                  </span>
                </div>
                <div className="w-px h-4 bg-slate-200" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-slate-800">
                    {requirements.length}
                  </span>
                  <span className="opacity-80">Total</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3 - Category Filter Navigation Bar */}
      <div
        className={
          viewMode === "list"
            ? "flex items-center gap-4 mt-6 relative z-20 transition-all duration-500"
            : "hidden"
        }
      >
        <div className="bg-white/60 backdrop-blur-xl p-2 rounded-[24px] flex flex-wrap gap-2 border border-slate-200/60 shadow-lg shadow-slate-200/20">
          {/* Filter Heading Tag */}
          <div className="px-5 py-2.5 flex items-center gap-2 text-slate-500 bg-white/50 rounded-[18px] border border-slate-100 shadow-sm">
            <Tag size={14} className="text-primary-500" />
            <span className="text-[11px] font-black uppercase tracking-[0.2em]">
              Filter
            </span>
          </div>
          {/* Filter Heading List view */}
          {[
            "All",
            ...new Set(
              requirements.map((r) => r.category || r.type).filter(Boolean),
            ),
          ].map((cat) => {
            const isActive = filterCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className={`px-6 py-2.5 rounded-[18px] text-[11px] font-black uppercase tracking-widest transition-all duration-300 border ${
                  isActive
                    ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/25 border-transparent scale-105 z-10 -translate-y-0.5"
                    : "bg-white text-slate-500 hover:text-slate-800 hover:bg-slate-50 border-slate-200/60 hover:border-slate-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 4 - Requirement Page View */}
      {/* ─── List View ─── */}
      <div className={viewMode === "list" ? "block mt-6" : "hidden"}>
        <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
          {/* List  View - Header Section */}
          <div className="px-8 py-5 bg-gradient-to-r from-primary-50/40 via-white to-indigo-50/40 border-b border-primary-100/50 flex items-center justify-between relative overflow-hidden group/bar">
            {/* Left Side - Header Section */}
            <div className="flex items-center gap-4 relative z-10">
              {/* Icon */}
              <div className="w-10 h-10 rounded-2xl bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-200">
                <ShieldCheck size={20} className="text-white" />
              </div>

              <div className="flex flex-col">
                <span className="text-[12px] font-black text-primary-500 uppercase tracking-[0.3em] leading-none mb-2 ">
                  System Intelligence
                </span>
                <div className="flex items-center gap-4">
                  <div className="bg-slate-100/80 border border-slate-200/60 rounded-full px-6 py-2.5 flex items-center gap-4 shadow-inner group/capsule hover:bg-slate-100 transition-colors">
                    <span className="text-[12px] font-black uppercase tracking-[0.2em] text-slate-400">
                      Total Extracted:
                    </span>
                    <span className="text-2xl font-black text-slate-900 leading-none">
                      {requirements.length}
                    </span>
                  </div>
                  {filterCategory !== "All" && (
                    <span className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-full text-[14px] font-black uppercase tracking-wider shadow-lg shadow-primary-100 animate-in slide-in-from-left-2 duration-300">
                      <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                      {filterCategory}: {filteredRequirements.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Right Side - Header Section */}
            <div className="flex items-center gap-4 relative z-10">
              {/* Select all checkbox */}
              <label className="flex items-center gap-3 cursor-pointer px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:border-primary-200 transition-all select-none active:scale-95 group/select">
                <input
                  type="checkbox"
                  checked={
                    filteredRequirements.length > 0 &&
                    filteredRequirements.every((r) =>
                      selectedIds.includes(r.id),
                    )
                  }
                  onChange={toggleSelectAll}
                  className="rounded-lg border-slate-300 text-primary-600 focus:ring-primary-200 cursor-pointer w-4 h-4 transition-transform group-hover/select:scale-110"
                />
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest group-hover/select:text-primary-600 transition-colors">
                  Select All
                </span>
              </label>

              {/* Pagination View */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button
                    disabled={currentPage === 1}
                    onClick={() =>
                      handlePageChange(Math.max(1, currentPage - 1))
                    }
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {[...Array(totalPages)].map((_, i) => {
                    const p = i + 1;
                    // Only show current, first, last, and neighbors
                    if (
                      p === 1 ||
                      p === totalPages ||
                      (p >= currentPage - 1 && p <= currentPage + 1)
                    ) {
                      return (
                        <button
                          key={p}
                          onClick={() => handlePageChange(p)}
                          className={`w-9 h-9 rounded-xl text-[11px] font-black transition-all ${
                            currentPage === p
                              ? "bg-primary-600 text-white shadow-lg shadow-primary-200"
                              : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
                          }`}
                        >
                          {p}
                        </button>
                      );
                    }
                    if (p === currentPage - 2 || p === currentPage + 2)
                      return (
                        <span key={p} className="px-1 text-slate-300">
                          ...
                        </span>
                      );
                    return null;
                  })}

                  <button
                    disabled={currentPage === totalPages}
                    onClick={() =>
                      handlePageChange(Math.min(totalPages, currentPage + 1))
                    }
                    className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* List View - Requirement Listing Section */}
          {requirements.length === 0 ? (
            //-------------------------------------------------------
            // Show only if no Requirements are found
            //-------------------------------------------------------
            <div className="flex flex-col items-center justify-center py-32 px-6 text-center animate-in fade-in zoom-in-95 duration-500">
              <div className="relative mb-8 group">
                <div className="absolute inset-0 bg-slate-200/50 rounded-full blur-2xl group-hover:bg-slate-300/50 transition-colors duration-500" />
                <div className="relative w-24 h-24 bg-white border border-slate-100 rounded-[28px] flex items-center justify-center shadow-xl shadow-slate-200/50 transform group-hover:-translate-y-1 transition-transform duration-500">
                  <ClipboardList size={40} className="text-slate-300" />
                </div>
              </div>
              <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-3">No Requirements Detected</h3>
              <p className="text-[11px] font-bold text-slate-500 max-w-md mx-auto uppercase tracking-widest leading-relaxed">
                We couldn't extract any structured requirements. Verify your document formatting or try another file.
              </p>
            </div>
          ) : (
            //-------------------------------------------------------
            // Show the list of Requirements are found
            //-------------------------------------------------------
            <>
              <div className="divide-y divide-slate-100">
                {paginatedRequirements.map((req, idx) => (
                  <div
                    key={req.id || idx}
                    className="p-8 hover:bg-slate-50/80 transition-all flex items-start gap-8 group"
                  >
                    <div className="flex items-center mt-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(req.id)}
                        onChange={() => toggleSelect(req.id)}
                        className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-200 cursor-pointer"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* 1. Meta Header: ID, Category, Priority, Confidence */}
                      <div className="flex flex-wrap items-center gap-3 mb-5">
                        {/* Requirement ID */}
                        <div className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm select-none flex items-center gap-2">
                          {req.id}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setFullViewId(req.id);
                            }}
                            className="ml-1 text-slate-400 hover:text-primary-600 transition-colors"
                            title="Full Reading View"
                          >
                            <Maximize2 size={12} />
                          </button>
                        </div>

                        {/* Requirement Category */}
                        {req.category && (
                          <span className="text-[11px] font-black uppercase tracking-widest text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg border border-primary-200">
                            {req.category} / {req.sub_category || "General"}
                          </span>
                        )}

                        {/* Requirement Priority */}
                        {req.priority && (
                          <span
                            className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${
                              req.priority === "High"
                                ? "bg-rose-50 text-rose-700 border-rose-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {req.priority} Priority
                          </span>
                        )}

                        {/* Requirement Confidence */}
                        {/* {req.confidence && (
                      <div className="ml-auto flex items-center gap-3">
                        <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                          <div
                            className="h-full bg-emerald-500 transition-all duration-1000"
                            style={{ width: `${Math.round(req.confidence * 100)}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-extrabold text-slate-500">
                          {Math.round(req.confidence * 100)}% Match
                        </span>
                      </div>
                    )} */}
                      </div>

                      {/* 2. Requirement Text - TipTap Notion-like Editor */}
                      <div className="relative group">
                        {editingId === req.id ? (
                          <div className="grid grid-cols-2 gap-6 mb-6">
                            {/* Requirement Editing Window */}
                            <div className="relative bg-primary-50/30 h-full border-l-4 border-primary-500 px-4 py-4 rounded-r-2xl ring-1 ring-primary-100 shadow-xl shadow-primary-50/50 transition-all duration-500 animate-in fade-in zoom-in-95">
                              <TiptapEditor
                                content={editText}
                                onChange={setEditText}
                                className="w-full"
                                project={project}
                                requirementId={req.id}
                              />
                              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-primary-600 to-indigo-600 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-full shadow-lg shadow-primary-200 flex items-center gap-2">
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                Active Drafting
                              </div>
                            </div>
                            {/* Requirement Previewing Window */}
                            <div className="bg-white  h-full p-8 rounded-[32px] border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-500">
                              <div className="flex items-center gap-3 mb-6">
                                {/* Left Line */}
                                <div className="flex-1 h-px bg-slate-200" />
                                {/* Production View Title */}
                                <div className="flex items-center gap-2 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full">
                                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full" />
                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                    Production Preview
                                  </span>
                                </div>
                                {/* Right Line */}
                                <div className="flex-1 h-px bg-slate-200" />
                              </div>
                              <div className="prose prose-slate max-w-none prose-p:text-slate-700 prose-p:text-[15px] prose-p:font-medium prose-table:border prose-table:border-slate-200 prose-th:bg-slate-100 prose-th:p-2 prose-td:p-2 overflow-y-auto scrollbar-pro pr-2">
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {editText}
                                </ReactMarkdown>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div
                            className="prose prose-slate max-w-none prose-p:text-slate-900 prose-p:text-[15px] prose-p:font-medium prose-p:leading-relaxed mb-6 bg-white border border-slate-200/60 shadow-sm rounded-[12px] p-8 hover:border-primary-200 hover:bg-primary-50/5 hover:shadow-xl hover:shadow-primary-50/50 transition-all duration-300 cursor-text border-l-[3px] border-l-slate-100 hover:border-l-blue-500 max-h-[450px] overflow-y-auto scrollbar-pro group/block"
                            onClick={() => {
                              setEditingId(req.id);
                              setEditText(req.explanation);
                            }}
                          >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {req.explanation}
                            </ReactMarkdown>
                          </div>
                        )}
                      </div>

                      {/* 3. AI Insight Panel - Optimized via Component Isolation */}
                      {aiPanelId === req.id && (
                        <AIInsightPanel
                          reqId={req.id}
                          reqText={req.explanation}
                          summarizingId={summarizingId}
                          handleAIInsight={handleAIInsight}
                          onCancel={() => setAiPanelId(null)}
                        />
                      )}

                      {/* 4. Keywords Tags */}
                      {req.keywords && req.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-6">
                          {req.keywords.slice(0, 8).map((kw) => (
                            <span
                              key={kw}
                              className="text-[10px] font-extrabold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm hover:border-slate-300 hover:text-slate-900 transition-colors cursor-default"
                            >
                              #{kw.toUpperCase()}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* 5. Footer: Actions & Traceability */}
                      <div className="flex items-center justify-between pt-5 border-t border-slate-100">
                        <div className="flex items-center gap-5 text-slate-500">
                          <div className="flex items-center gap-2">
                            <FileText size={16} className="text-primary-600" />
                            <span className="text-[11px] font-bold uppercase tracking-tight truncate max-w-fit bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600 text-transparent">
                              {req.source || "Manual Entry"}
                            </span>
                          </div>
                          {req.page && (
                            <div className="flex items-center gap-2 bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600 text-transparent">
                              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full" />
                              <span className="text-[11px] font-bold uppercase tracking-tight">
                                Page - {req.page}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-4">
                          {editingId === req.id ? (
                            <button
                              onClick={() => handleSaveEdit(req.id)}
                              className="text-[12px] font-black text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition-colors shadow-md shadow-primary-200"
                            >
                              Save Changes
                            </button>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(req.id);
                                setEditText(req.text);
                              }}
                              className="text-[12px] font-black text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-100 px-4 py-2 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => toggleInsightResult(req.id)}
                            className={`text-[12px] font-black transition-all flex items-center gap-2 px-4 py-2 rounded-lg ${
                              summaries[req.id]?.length > 0 ||
                              aiPanelId === req.id
                                ? "bg-primary-600 text-white shadow-md shadow-primary-200"
                                : "text-primary-600 bg-primary-50 hover:bg-primary-100 hover:text-primary-700 border border-primary-100"
                            }`}
                          >
                            {summarizingId === req.id ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                            {summaries[req.id]?.length > 0
                              ? `Insights (${summaries[req.id].length})`
                              : aiPanelId === req.id
                                ? "Cancel AI"
                                : "AI Insight"}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* AI Summary Sidebar - Enhanced with versioning (Light Theme) */}
                    {showInsightId === req.id &&
                      summaries[req.id]?.length > 0 && (
                        <div className="w-1/3 bg-indigo-50/50 border border-indigo-100 text-slate-800 p-6 rounded-[24px] text-xs font-medium leading-relaxed shadow-2xl animate-in fade-in slide-in-from-right-4 duration-300 relative overflow-hidden flex flex-col">
                          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <ShieldCheck
                              size={80}
                              className="text-indigo-600"
                            />
                          </div>

                          {/* Version Navigation */}
                          <div className="flex items-center justify-between mb-4 border-b border-indigo-100 pb-3">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2">
                                <button
                                  disabled={
                                    (activeInsightIndex[req.id] || 0) === 0
                                  }
                                  onClick={() =>
                                    setActiveInsightIndex((prev) => ({
                                      ...prev,
                                      [req.id]: (prev[req.id] || 0) - 1,
                                    }))
                                  }
                                  className="p-1 hover:bg-indigo-100 rounded-md disabled:opacity-20 transition-all text-indigo-600"
                                >
                                  <ChevronLeft size={14} />
                                </button>
                                <span className="font-black text-[11px] text-indigo-700 bg-indigo-100/50 px-2 py-0.5 rounded-full tabular-nums">
                                  {(activeInsightIndex[req.id] || 0) + 1} /{" "}
                                  {summaries[req.id].length}
                                </span>
                                <button
                                  disabled={
                                    (activeInsightIndex[req.id] || 0) ===
                                    summaries[req.id].length - 1
                                  }
                                  onClick={() =>
                                    setActiveInsightIndex((prev) => ({
                                      ...prev,
                                      [req.id]: (prev[req.id] || 0) + 1,
                                    }))
                                  }
                                  className="p-1 hover:bg-indigo-100 rounded-md disabled:opacity-20 transition-all text-indigo-600"
                                >
                                  <ChevronRight size={14} />
                                </button>
                              </div>
                              <span className="text-[9px] text-slate-400 font-bold uppercase mt-1.5 ml-1">
                                {
                                  summaries[req.id][
                                    activeInsightIndex[req.id] || 0
                                  ]?.action
                                }{" "}
                                •{" "}
                                {
                                  summaries[req.id][
                                    activeInsightIndex[req.id] || 0
                                  ]?.timestamp
                                }
                              </span>
                            </div>

                            <div className="flex items-center z-10">
                              <button
                                onClick={() =>
                                  handleCopy(
                                    summaries[req.id][
                                      activeInsightIndex[req.id] || 0
                                    ]?.content,
                                    req.id,
                                  )
                                }
                                className="p-2 hover:bg-indigo-100 rounded-xl transition-all text-indigo-600"
                                title="Copy to clipboard"
                              >
                                {copiedId === req.id ? (
                                  <Check
                                    size={16}
                                    className="text-emerald-600"
                                  />
                                ) : (
                                  <Copy size={16} />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="relative z-10 text-slate-700 flex-1 overflow-y-auto max-h-[600px] scrollbar-hide prose prose-indigo max-w-none prose-table:text-[10px] prose-table:leading-tight prose-th:p-1 prose-td:p-1 prose-table:border prose-table:border-indigo-100 prose-th:bg-indigo-100/30">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {
                                summaries[req.id][
                                  activeInsightIndex[req.id] || 0
                                ]?.content
                              }
                            </ReactMarkdown>
                          </div>

                          <div className="mt-6 flex items-center justify-between border-t border-indigo-100 pt-5">
                            <button
                              onClick={() => toggleInsightPanel(req.id)}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-indigo-100 group"
                            >
                              <Sparkles
                                size={12}
                                className="group-hover:rotate-12 transition-transform"
                              />
                              New Command
                            </button>
                            <button
                              onClick={() => toggleInsightResult(req.id)}
                              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-md shadow-rose-100"
                            >
                              Dismiss
                            </button>
                          </div>
                        </div>
                      )}
                  </div>
                ))}
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Page {currentPage} of {totalPages}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() =>
                        handlePageChange(Math.max(1, currentPage - 1))
                      }
                      className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft size={16} />
                    </button>

                    {[...Array(totalPages)].map((_, i) => {
                      const p = i + 1;
                      // Only show current, first, last, and neighbors
                      if (
                        p === 1 ||
                        p === totalPages ||
                        (p >= currentPage - 1 && p <= currentPage + 1)
                      ) {
                        return (
                          <button
                            key={p}
                            onClick={() => handlePageChange(p)}
                            className={`w-9 h-9 rounded-xl text-[11px] font-black transition-all ${
                              currentPage === p
                                ? "bg-primary-600 text-white shadow-lg shadow-primary-200"
                                : "bg-white text-slate-500 hover:bg-slate-50 border border-slate-200"
                            }`}
                          >
                            {p}
                          </button>
                        );
                      }
                      if (p === currentPage - 2 || p === currentPage + 2)
                        return (
                          <span key={p} className="px-1 text-slate-300">
                            ...
                          </span>
                        );
                      return null;
                    })}

                    <button
                      disabled={currentPage === totalPages}
                      onClick={() =>
                        handlePageChange(Math.min(totalPages, currentPage + 1))
                      }
                      className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight size={16} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ─── Page View ─── */}
      <div className={viewMode === "page" ? "block mt-6" : "hidden"}>
        <div className="bg-white border border-slate-200 rounded-[32px] overflow-hidden shadow-sm">
          {/* Page View Header */}
          <div className="px-8 py-5 bg-gradient-to-r from-primary-50/40 via-white to-indigo-50/40 border-b border-primary-100/50 flex items-center justify-between relative overflow-hidden">
            {/* Icon and Title */}
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-primary-600 flex items-center justify-center shadow-lg shadow-primary-200">
                <ShieldCheck size={20} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-[12px] font-black text-primary-500 uppercase tracking-[0.3em] leading-none mb-2">
                  Page View
                </span>
                <span className="flex flex-row text-[11px] font-bold text-slate-600 gap-3">
                  <FileText size={14} className="text-primary-600" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest truncate">
                    {pageViewReq ? pageViewReq.source : "—"}
                  </span>
                </span>
              </div>
            </div>

            {/* Page Navigation Header */}
            <div className="flex items-center gap-4 relative z-10">
              {/* Page Switching */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => goToPage(pdfCurrentPage - 1)}
                  disabled={pdfCurrentPage <= 1}
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft size={18} />
                </button>
                <span className="text-[11px] font-black text-slate-500 bg-slate-100 px-4 py-2 rounded-xl border border-slate-200">
                  {pdfCurrentPage} / {pdfTotalPages}
                </span>
                <button
                  onClick={() => goToPage(pdfCurrentPage + 1)}
                  disabled={pdfCurrentPage >= pdfTotalPages}
                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-primary-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Clear Selection & Submit Selected Requirements */}
              <div className="flex items-center gap-2">
                {selectedIds.length > 0 && (
                  <button
                    onClick={() => setSelectedIds([])}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-[10px] font-black uppercase tracking-widest transition-all shadow-sm"
                  >
                    <X size={14} />
                    Clear
                  </button>
                )}
                <button
                  onClick={submitSelectedRequirements}
                  disabled={submittingSelected || selectedIds.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-100"
                >
                  {submittingSelected ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Submit {selectedIds.length > 0 ? selectedIds.length : ''}
                </button>
              </div>
            </div>
          </div>

          {/* Page View Split Pane */}
          <div className="flex h-[calc(100vh-160px)] min-h-[800px]">
            {/* Left: PDF Viewer */}
            <div className="relative flex-1 border-r border-slate-200 bg-slate-50 flex flex-col h-full overflow-hidden">
              {/* PDF File Showing */}
              <div className="flex-1 overflow-hidden p-6 flex flex-col">
                {pageViewReq && pdfSrc ? (
                  <div
                    className={`bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col ${
                      pdfLayoutMode === "page"
                        ? "max-h-[1400px] h-full w-full mx-auto overflow-auto"
                        : "flex-1 overflow-hidden"
                    }`}
                  >
                    <PdfViewer
                      src={pdfSrc}
                      page={pdfCurrentPage}
                      className="w-full h-full"
                      zoom={pdfZoom}
                      highlightTexts={pageRequirements}
                      onPdfPageChange={(p) => {
                        setPdfCurrentPage(p);
                      }}
                      onTextSelection={handlePdfTextSelection}
                      onDocumentLoad={handleDocumentLoad}
                      onPluginReady={handlePluginReady}
                      layoutMode={pdfLayoutMode}
                    />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 font-medium">
                    {pdfSrc ? "Loading PDF..." : "No requirements to display"}
                  </div>
                )}
              </div>

              {/* Layout Mode Toggle — floating on top of the PDF area */}
              <div className="absolute bottom-6 right-6 z-20">
                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-1.5 shadow-lg">
                  <button
                    onClick={() => setPdfLayoutMode("scroll")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      pdfLayoutMode === "scroll"
                        ? "bg-primary-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <LayoutListIcon size={14} />
                    Scroll
                  </button>
                  <button
                    onClick={() => setPdfLayoutMode("page")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                      pdfLayoutMode === "page"
                        ? "bg-primary-600 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <MonitorIcon size={14} />
                    Page
                  </button>
                </div>
              </div>

              {/* Zoom Controls — floating on top of the PDF area (left side) */}
              <div className="absolute bottom-20 right-6 z-20">
                <div className="flex items-center gap-2 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl p-1.5 shadow-lg">
                  <button
                    onClick={() =>
                      setPdfZoom((prev) => Math.max(50, prev - 25))
                    }
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-primary-600 transition-all"
                    title="Zoom Out"
                  >
                    <ZoomOut size={14} />
                  </button>
                  <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 min-w-[56px] text-center tabular-nums">
                    {pdfZoom}%
                  </span>
                  <button
                    onClick={() =>
                      setPdfZoom((prev) => Math.min(200, prev + 25))
                    }
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-primary-600 transition-all"
                    title="Zoom In"
                  >
                    <ZoomIn size={14} />
                  </button>
                  <div className="w-px h-6 bg-slate-200" />
                  <button
                    onClick={() => setPdfZoom(100)}
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-primary-600 transition-all"
                    title="Reset Zoom"
                  >
                    <RotateCcw size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Requirement Detail */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-8 scrollbar-pro">
                {pageRequirements.length > 0 ? (
                  <div className="space-y-8">
                    {/* Select All for Current Page */}
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={
                          pageRequirements.length > 0 &&
                          pageRequirements.every((r) =>
                            selectedIds.includes(r.id),
                          )
                        }
                        onChange={() => {
                          const allOnPage = pageRequirements.every((r) =>
                            selectedIds.includes(r.id),
                          );
                          if (allOnPage) {
                            setSelectedIds((prev) =>
                              prev.filter(
                                (id) =>
                                  !pageRequirements.some((r) => r.id === id),
                              ),
                            );
                          } else {
                            const newIds = new Set([...selectedIds]);
                            pageRequirements.forEach((r) => newIds.add(r.id));
                            setSelectedIds(Array.from(newIds));
                          }
                        }}
                        className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-200 cursor-pointer"
                      />
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Select All ({pageRequirements.length})
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {pageRequirements.length} requirement
                        {pageRequirements.length > 1 ? "s" : ""} on Page{" "}
                        {pdfCurrentPage}
                      </span>
                    </div>
                    {pageRequirements.map((req) => (
                      <div
                        key={req.id}
                        className={`flex flex-col gap-6 transition-all duration-300 ${
                          req.id === highlightedReqId
                            ? "bg-primary-100 border-primary-300 ring-2 ring-primary-200 rounded-2xl p-8 -m-2 border"
                            : ""
                        }`}
                        onMouseEnter={() => {
                          if (req.id === highlightedReqId) {
                            setSelectedReqIds((prev) =>
                              prev.includes(req.id) ? prev : [...prev, req.id],
                            );
                          }
                        }}
                      >
                        {/* Meta Header */}
                        <div className="flex flex-wrap items-center gap-3">
                          {/* Checkbox on right side */}
                          <div className="flex-shrink-0 flex items-start pt-1">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(req.id)}
                              onChange={() => toggleSelect(req.id)}
                              className="w-5 h-5 rounded border-slate-300 text-primary-600 focus:ring-primary-200 cursor-pointer"
                            />
                          </div>

                          <div className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm select-none">
                            {req.id}
                          </div>
                          {req.category && (
                            <span className="text-[11px] font-black uppercase tracking-widest text-primary-700 bg-primary-50 px-3 py-1.5 rounded-lg border border-primary-200">
                              {req.category} / {req.sub_category || "General"}
                            </span>
                          )}
                          {req.priority && (
                            <span
                              className={`text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border ${
                                req.priority === "High"
                                  ? "bg-rose-50 text-rose-700 border-rose-200"
                                  : "bg-slate-100 text-slate-600 border-slate-200"
                              }`}
                            >
                              {req.priority} Priority
                            </span>
                          )}
                          {/* {req.confidence && (
                            <div className="flex items-center gap-3 ml-auto">
                              <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden hidden sm:block">
                                <div
                                  className="h-full bg-emerald-500 transition-all duration-1000"
                                  style={{ width: `${Math.round(req.confidence * 100)}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-extrabold text-slate-500">
                                {Math.round(req.confidence * 100)}% Match
                              </span>
                            </div>
                          )} */}
                        </div>

                        {/* Requirement Explanation */}
                        <div className="prose prose-slate max-w-none prose-p:text-slate-900 prose-p:text-[15px] prose-p:font-medium prose-p:leading-relaxed bg-white border border-slate-200/60 shadow-sm rounded-[12px] p-8 border-l-[3px] border-l-slate-100 max-h-[600px] overflow-y-auto scrollbar-pro">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {req.explanation}
                          </ReactMarkdown>
                        </div>

                        {/* Keywords */}
                        {req.keywords && req.keywords.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {req.keywords.slice(0, 8).map((kw) => (
                              <span
                                key={kw}
                                className="text-[10px] font-extrabold text-slate-600 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm"
                              >
                                #{kw.toUpperCase()}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Actions */}
                        {/* <div className="flex items-center justify-between pt-2">
                          <div className="flex items-center gap-4">
                            <button
                              onClick={() => { setEditingId(req.id); setEditText(req.text); }}
                              className="text-[12px] font-black text-primary-600 bg-primary-50 hover:bg-primary-100 border border-primary-100 px-4 py-2 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => toggleInsightResult(req.id)}
                              className={`text-[12px] font-black transition-all flex items-center gap-2 px-4 py-2 rounded-lg ${
                                summaries[req.id]?.length > 0 || aiPanelId === req.id
                                  ? 'bg-primary-600 text-white shadow-md shadow-primary-200'
                                  : 'text-primary-600 bg-primary-50 hover:bg-primary-100 hover:text-primary-700 border border-primary-100'
                              }`}
                            >
                              {summarizingId === req.id ? (
                                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <Sparkles size={14} />
                              )}
                              {summaries[req.id]?.length > 0 ? `Insights (${summaries[req.id].length})` : (aiPanelId === req.id ? 'Cancel AI' : 'AI Insight')}
                            </button>
                          </div>

                          
                          {req.id === highlightedReqId && (
                            <span className="text-[9px] font-black text-primary-700 bg-primary-600 px-3 py-1 rounded-full shadow-sm shadow-primary-100 flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                              REQ: {req.id}
                            </span>
                          )}
                        </div> */}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 font-medium">
                    No requirements on this page
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full Reading View Modal */}
      {fullViewId &&
        (() => {
          const req = requirements.find((r) => r.id === fullViewId);
          if (!req) return null;
          return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 md:p-20 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
              <div className="relative w-full max-w-5xl h-full max-h-[90vh] bg-white rounded-[40px] shadow-2xl flex flex-col overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-4">
                    <div className="font-mono text-sm font-black text-primary-600 bg-primary-50 px-4 py-2 rounded-xl border border-primary-100 shadow-sm">
                      {req.id}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">
                        Requirement Source
                      </span>
                      <span className="text-xs font-bold text-slate-600">
                        {req.category || req.type} Specification
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setFullViewId(null)}
                    className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 text-slate-400 hover:text-rose-500 hover:border-rose-100 rounded-2xl transition-all shadow-sm hover:shadow-md active:scale-95"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-12 scrollbar-pro">
                  <div className="prose prose-slate max-w-none prose-p:text-slate-800 prose-p:text-[18px] prose-p:leading-relaxed prose-headings:text-slate-900 prose-headings:font-black prose-table:border prose-table:border-slate-200 prose-th:bg-slate-50 prose-th:p-4 prose-td:p-4 prose-blockquote:border-l-blue-500 prose-blockquote:bg-primary-50/50 prose-blockquote:p-6 prose-blockquote:rounded-r-2xl">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {req.explanation}
                    </ReactMarkdown>
                  </div>
                </div>

                {/* Footer Meta */}
                <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-6">
                    {/* <div className="flex flex-col">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Confidence Score</span>
                    <span className="text-xs font-bold text-emerald-600">{Math.round(req.confidence * 100)}% Extraction Match</span>
                  </div> */}
                    {/* <div className="w-px h-8 bg-slate-200" /> */}
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Last Updated
                      </span>
                      <span className="text-xs font-bold text-slate-600">
                        {new Date().toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(req.explanation);
                      setCopiedId(req.id);
                      setTimeout(() => setCopiedId(null), 2000);
                    }}
                    className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${
                      copiedId === req.id
                        ? "bg-emerald-600 text-white shadow-emerald-100"
                        : "bg-slate-900 text-white shadow-slate-200 hover:bg-slate-800"
                    }`}
                  >
                    {copiedId === req.id ? (
                      <>
                        <Check size={14} /> Copied to Clipboard
                      </>
                    ) : (
                      <>
                        <Copy size={14} /> Copy Source Text
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
    </div>
  );
}
