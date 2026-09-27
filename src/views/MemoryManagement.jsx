import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  Folder,
  FolderOpen,
  FileText,
  Search,
  Play,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Maximize2,
  X,
  Eye,
  Edit3,
  Trash2,
  Hash,
  ChevronRight,
  Ban,
  Database,
} from 'lucide-react';
import {
  fetchKnowledgeFiles,
  fetchUploadedFiles,
  fetchKnowledgeFileContent,
  fetchMemoryProgress,
  checkRequirements,
  generateMemory,
  cancelMemory,
  clearMemory,
} from '../api/memoryApi';
import useKnowledgeStore from '../store/knowledgeStore';
import useToastStore from '../store/toastStore';
import { motion } from 'framer-motion';

export default function MemoryManagement({ project }) {
  const {
    memoryFiles,
    setMemoryFiles,
    selectedFilePath,
    setSelectedFilePath,
    fileContent,
    setFileContent,
    fileTreeLoading,
    setFileTreeLoading,
    memoryProgress,
    setMemoryProgress,
    detailMode,
    setDetailMode,
    fullScreen,
    setFullScreen,
    searchQuery,
    setSearchQuery,
  } = useKnowledgeStore();

  const [copied, setCopied] = useState(false);
  const [editingContent, setEditingContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [activeTab, setActiveTab] = useState('all');
  const [fetchError, setFetchError] = useState(null);
  const [builtUploadedFilesTree, setBuiltUploadedFilesTree] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [pendingCancel, setPendingCancel] = useState(false);
  const [pendingClear, setPendingClear] = useState(false);
  const [checkingRequirements, setCheckingRequirements] = useState(false);
  const { addToast } = useToastStore();

  // ─── Tree Builder ────────────────────────────────────────────────────────
  const treeStructure = useMemo(() => {
    if (!memoryFiles || memoryFiles.length === 0) return null;
    const rootItems = [];
    const knowledgeDir = [];
    const others = [];

    for (const file of memoryFiles) {
      const normalizedPath = file.path.replace(/\\/g, '/');
      const parts = normalizedPath.split('/');
      parts.length === 1 ? others.push({ ...file, path: normalizedPath }) : knowledgeDir.push({ ...file, path: normalizedPath });
    }

    const sortFn = (a, b) => a.name.localeCompare(b.name);
    others.sort(sortFn);
    knowledgeDir.sort(sortFn);

    if (knowledgeDir.length > 0) {
      const dirMap = {};
      for (const file of knowledgeDir) {
        const parts = file.path.split('/');
        let current = dirMap;
        for (let i = 0; i < parts.length - 1; i++) {
          if (!current[parts[i]]) {
            current[parts[i]] = { __isDir: true, children: {} };
          }
          current = current[parts[i]].children;
        }
        current[parts[parts.length - 1]] = {
          __isFile: true,
          path: file.path,
          name: file.name,
        };
      }

      const buildTree = (node, depth) => {
        const result = [];
        const sortedKeys = Object.keys(node).sort();
        for (const key of sortedKeys) {
          const item = node[key];
          if (item.__isDir) {
            const children = buildTree(item.children, depth + 1);
            result.push({ name: key, isDir: true, children, depth });
          } else {
            result.push({
              name: item.name,
              isFile: true,
              path: item.path,
              depth,
            });
          }
        }
        return result;
      };

      rootItems.push({ name: 'knowledge', isDir: true, children: buildTree(dirMap, 1) });
    }

    for (const file of others) {
      rootItems.push({ name: file.name, isFile: true, path: file.path, depth: 0 });
    }

    return rootItems;
  }, [memoryFiles]);

  // ─── File Fetching ───────────────────────────────────────────────────────
  const refreshFiles = useCallback(async () => {
    if (!project?.id) return;
    try {
      setFileTreeLoading(true);
      const files = await fetchKnowledgeFiles(project.id);
      setMemoryFiles(files);
    } catch (err) {
      setFetchError(err.message);
    } finally {
      setFileTreeLoading(false);
    }
  }, [project?.id, setMemoryFiles, setFileTreeLoading]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  useEffect(() => {
    if (!project?.id) return;
    async function fetchUploadedFilesWrapper() {
      try {
        const files = await fetchUploadedFiles(project.id);
        setBuiltUploadedFilesTree(
          files.map((file) => ({
            name: file.name,
            isFile: true,
            path: `uploaded/${file.name}`,
            depth: 0,
          }))
        );
      } catch {
        setBuiltUploadedFilesTree(null);
      }
    }
    fetchUploadedFilesWrapper();
  }, [project?.id]);

  const tabs = useMemo(() => {
    const tabList = [];
    if (builtUploadedFilesTree && builtUploadedFilesTree.length > 0) {
      for (const f of builtUploadedFilesTree) {
        tabList.push({ key: `uploaded-${f.path}`, label: f.name });
      }
    }
    if (tabList.length === 0) {
      tabList.push({ key: 'all', label: 'All Files' });
    }
    return tabList;
  }, [builtUploadedFilesTree]);

  const currentTree = useMemo(() => {
    if (activeTab.startsWith('uploaded-')) {
      return treeStructure;
    }
    return treeStructure;
  }, [activeTab, treeStructure]);

  // ─── Filtered Tree (Search via DFS) ──────────────────────────────────────
  const filteredTree = useMemo(() => {
    if (!currentTree) return null;
    if (!searchQuery.trim()) return currentTree;
    const q = searchQuery.toLowerCase();

    // DFS: bottom-up. Each node returns a copy with only matching descendants,
    // or null if nothing matched. Parent folders are kept as long as they are
    // on the path to a matching leaf (reconstructs the tree path).
    const filterNode = (node) => {
      if (node.isFile) {
        return (
          node.name.toLowerCase().startsWith(q) ||
          node.path.toLowerCase().startsWith(q)
        )
          ? node
          : null;
      }
      const filteredChildren = (node.children || [])
        .map(filterNode)
        .filter(Boolean);

      if (filteredChildren.length > 0) {
        return { ...node, children: filteredChildren };
      }

      if (node.name.toLowerCase().startsWith(q)) {
        return { ...node, children: filteredChildren };
      }

      return null;
    };

    return (currentTree || []).map(filterNode).filter(Boolean);
  }, [currentTree, searchQuery]);

  // ─── Auto-expand matching folders on search ──────────────────────────────
  useEffect(() => {
    if (!searchQuery.trim()) {
      setExpandedFolders(new Set());
      return;
    }
    if (!treeStructure) return;
    const q = searchQuery.toLowerCase();
    const toExpand = new Set();
    const findMatches = (node) => {
      if (node.isFile) {
        return node.name.toLowerCase().startsWith(q) || node.path.toLowerCase().startsWith(q);
      }
      const childMatches = (node.children || []).some(findMatches);
      if (childMatches || node.name.toLowerCase().startsWith(q)) {
        toExpand.add(node.name);
        return true;
      }
      return false;
    };
    treeStructure.forEach(findMatches);
    setExpandedFolders(toExpand);
  }, [searchQuery, treeStructure]);

  // ─── File Content Fetch ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedFilePath || !project?.id) return;
    async function fetchContent() {
      try {
        const data = await fetchKnowledgeFileContent(project.id, selectedFilePath);
        setFileContent(data.content);
        setEditingContent(data.content);
        setSaved(false);
        setCopied(false);
      } catch (err) {
        setFileContent('Failed to load content: ' + err.message);
      }
    }
    fetchContent();
  }, [selectedFilePath, project?.id]);

  // ─── Progress Polling ────────────────────────────────────────────────────
  useEffect(() => {
    if (!project?.id) return;
    if (memoryProgress?.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const progress = await fetchMemoryProgress(project.id);
        setMemoryProgress(progress);
        if (progress.status === 'complete') {
          clearInterval(interval);
          refreshFiles();
        }
        if (progress.status === 'error' || progress.status === 'cancelled') {
          clearInterval(interval);
        }
      } catch {
        clearInterval(interval);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [project?.id, memoryProgress?.status, refreshFiles]);

  // ─── Auto-dismiss "complete" badge ────────────────────────────────────────
  // memoryProgress lives in the shared store and is never reset by the
  // backend after completion, so clear it here or the success badge lingers.
  useEffect(() => {
    if (memoryProgress?.status !== 'complete') return;
    const dismissTimer = setTimeout(() => setMemoryProgress(null), 5000);
    return () => clearTimeout(dismissTimer);
  }, [memoryProgress?.status, setMemoryProgress]);

  // ─── Handlers ────────────────────────────────────────────────────────────
  const toggleFolder = useCallback((folderName) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      next.has(folderName) ? next.delete(folderName) : next.add(folderName);
      return next;
    });
  }, []);

  const selectFile = useCallback(
    (filePath) => {
      if (filePath.startsWith('uploaded/')) {
        setSelectedFilePath(filePath);
        setFileContent(`Source file: ${filePath.replace('uploaded/', '')}`);
        setEditingContent('');
        setSaved(false);
        setCopied(false);
      } else {
        setSelectedFilePath(filePath);
      }
    },
    [setSelectedFilePath]
  );

  const copyContent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fileContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [fileContent]);

  const saveContent = useCallback(async () => {
    if (!selectedFilePath || !project?.id) return;
    setSaving(true);
    try {
      localStorage.setItem(
        `memory_edit_${project.id}_${selectedFilePath}`,
        editingContent
      );
      setSaving(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setSaving(false);
    }
  }, [selectedFilePath, project?.id, editingContent]);

  // ─── Generate Memory (with requirements pre-check) ────────────────────────
  const handleGenerateMemory = useCallback(async () => {
    setCheckingRequirements(true);
    try {
      const requirementsCheckResult = await checkRequirements(project.id);
      if (!requirementsCheckResult.present) {
        addToast(
          'No requirements found. Please extract requirements before generating memory.',
          'error'
        );
        return;
      }
      addToast(
        `Found ${requirementsCheckResult.count} requirements — starting memory generation`,
        'success'
      );
      await generateMemory(project.id);
      setMemoryProgress({
        status: 'running',
        progress: 0,
        phase: 'Generating...',
      });
      setCancelling(false);
    } catch (err) {
      addToast(`Failed to start memory generation: ${err.message}`, 'error');
      setMemoryProgress({ status: 'error', error: err.message });
    } finally {
      setCheckingRequirements(false);
    }
  }, [project?.id, addToast, setMemoryProgress]);

  // ─── Cancel Memory Generation (with confirmation) ─────────────────────────
  const confirmCancel = useCallback(async () => {
    setPendingCancel(false);
    setCancelling(true);
    try {
      await cancelMemory(project.id);
      setMemoryProgress({
        status: 'cancelled',
        progress: memoryProgress?.progress,
        phase: 'Cancelled',
      });
    } catch {
      setMemoryProgress({
        status: 'error',
        error: 'Failed to cancel',
      });
    } finally {
      setCancelling(false);
    }
  }, [project?.id, memoryProgress?.progress, setMemoryProgress]);

  // ─── Strip YAML frontmatter only ─────────────────────────────────────────
  const stripFrontmatter = useCallback((content) => {
    if (!content) return content;
    // Remove YAML frontmatter block (--- ... ---)
    const trimmed = content.trimStart();
    if (trimmed.startsWith('---')) {
      const closeIdx = trimmed.indexOf('\n---', 3);
      if (closeIdx !== -1) {
        // Find the closing --- line — it must start after a newline
        const afterFront = trimmed.slice(closeIdx + 1); // starts after newline
        const nextLine = afterFront.indexOf('\n');
        const closingLine = afterFront.slice(0, nextLine !== -1 ? nextLine : undefined);
        if (closingLine.trim() === '---') {
          const closeLineStart = trimmed.indexOf('---', closeIdx + 1);
          const endIdx = closeLineStart + 3;
          return content.slice(endIdx).trimStart();
        }
      }
    }
    return content;
  }, []);

  // ─── TOC from markdown ───────────────────────────────────────────────────
  const headings = useMemo(() => {
    if (!fileContent) return [];
    const body = stripFrontmatter(fileContent);
    return body
      .split('\n')
      .filter((l) => l.startsWith('#'))
      .map((line, idx) => {
        const level = line.match(/^#+/)[0].length;
        const title = line.replace(/^#+\s*/, '').trim();
        const id = title
          .toLowerCase()
          .replace(/[\s_]+/g, '-')
          .replace(/[^\w-]/g, '');
        return { level, title, id, idx };
      });
  }, [fileContent]);

  // ─── Heading IDs ref for smooth scroll ────────────────────────────────────
  const headingRefs = useRef({});
  const previewContainerRef = useRef(null);

  useEffect(() => {
    // Re-build heading refs on content change
    if (!previewContainerRef.current) return;
    const headingElements = previewContainerRef.current.querySelectorAll('h1, h2, h3');
    headingElements.forEach((el) => {
      headingRefs.current[el.id] = el;
    });
  }, [fileContent, detailMode]);

  const renderTreeNode = useCallback(
    (node, depth) => {
      // Base padding + depth indentation
      const basePadding = 12;
      const indent = depth * 16;
      
      if (node.isFile) {
        const isSelected = selectedFilePath === node.path;
        return (
          <div
            key={node.path}
            onClick={() => selectFile(node.path)}
            className={`flex items-center gap-2 cursor-pointer transition-colors text-[12px] py-1.5 pr-2 ${
              isSelected
                ? 'bg-primary-50/80 text-primary-700 font-semibold'
                : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
            }`}
            style={{ paddingLeft: `${basePadding + indent + 20}px` }} // +20 to account for chevron space on folders
          >
            <FileText size={14} className={`shrink-0 ${isSelected ? 'text-primary-500' : 'text-slate-400'}`} />
            <span className="truncate">{node.name}</span>
          </div>
        );
      }

      const isExpanded = expandedFolders.has(node.name);
      return (
        <div key={node.name}>
          <div
            onClick={() => toggleFolder(node.name)}
            className="flex items-center gap-1.5 cursor-pointer transition-colors py-1.5 pr-2 hover:bg-slate-100/80 text-slate-700 text-[12px] font-medium"
            style={{ paddingLeft: `${basePadding + indent}px` }}
          >
            <ChevronRight 
              size={14} 
              className={`shrink-0 text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
            />
            {isExpanded ? (
              <FolderOpen size={14} className="shrink-0 text-primary-500" />
            ) : (
              <Folder size={14} className="shrink-0 text-slate-400" />
            )}
            <span className="truncate">{node.name}</span>
          </div>
          
          <div className="flex flex-col">
            {isExpanded && node.children?.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        </div>
      );
    },
    [expandedFolders, selectedFilePath, selectFile, toggleFolder]
  );

  // ─── Render ──────────────────────────────────────────────────────────────
  if (!project?.id) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 text-[13px]">
        No project selected.
      </div>
    );
  }

  return (
    <div
      className="flex h-screen min-h-0 gap-0 overflow-hidden rounded-2xl border border-slate-200 shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
    >
      {/* ── File Tree Panel ─────────────────────────────────────────────── */}
      <div className="w-[280px] flex-shrink-0 flex flex-col border-r border-white/40 bg-white/40 backdrop-blur-xl z-10 shadow-[inset_-1px_0_0_rgba(255,255,255,0.3)]">
        {/* Search */}
        <div className="p-4 pb-3 border-b border-white/40">
          <div className="relative group">
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none transition-colors group-focus-within:text-primary-500"
            />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2 text-[13px] font-medium border border-slate-200 rounded-xl bg-white text-slate-700 outline-none transition-all shadow-sm hover:border-slate-300 focus:border-primary-400 focus:ring-4 focus:ring-primary-500/10 placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* File Tree */}
        <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
          {fileTreeLoading ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 animate-in fade-in duration-500">
              <div className="p-3 bg-white/50 rounded-2xl shadow-sm mb-3">
                <Loader2 size={24} className="animate-spin text-primary-500" />
              </div>
              <span className="text-[12px] font-bold text-slate-500 tracking-wide">LOADING FILES</span>
            </div>
          ) : filteredTree && filteredTree.length > 0 ? (
            <div className="space-y-0.5">
              {filteredTree.map((node) => renderTreeNode(node, 0))}
            </div>
          ) : searchQuery.trim() ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-3 bg-white/50 rounded-2xl shadow-sm mb-3 border border-white/60">
                <Search size={24} className="text-slate-400" />
              </div>
              <span className="text-[13px] font-bold text-slate-600 mb-1">No results found</span>
              <span className="text-[11px] font-medium text-slate-400 text-center px-4 leading-relaxed">
                "{searchQuery}" didn't match any files in the workspace.
              </span>
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-12 text-red-400 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-3 bg-red-50/80 rounded-2xl shadow-sm mb-3 border border-red-100">
                <AlertCircle size={24} className="text-red-500" />
              </div>
              <span className="text-[13px] font-bold text-red-600 mb-1">Failed to load</span>
              <span className="text-[11px] font-medium text-red-400/80 text-center px-4 leading-relaxed">
                {fetchError}
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 animate-in fade-in zoom-in-95 duration-300">
              <div className="p-4 bg-white/60 rounded-2xl shadow-sm mb-4 border border-white/80">
                <Folder size={28} className="text-slate-300" />
              </div>
              <span className="text-[13px] font-bold text-slate-600 mb-1">Workspace Empty</span>
              <span className="text-[11px] font-medium text-slate-400 text-center px-4 leading-relaxed">
                Generate memory to populate the file explorer.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Main Content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 border-l border-slate-200">
        {/* ── Topbar ── */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0 gap-3">
          <h2 className="flex items-center gap-2 text-[13px] font-bold text-slate-900 tracking-tight m-0">
            <Database size={14} className="text-primary-500" />
            Memory Management
          </h2>

          {/* Tabs */}
          <div className="flex items-center gap-0.5 bg-slate-50 p-[3px] rounded-xl border border-slate-200">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-[5px] rounded-lg border-none cursor-pointer text-[11px] font-semibold tracking-[0.02em] uppercase transition-all ${
                  activeTab === tab.key
                    ? 'bg-white text-slate-900 shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-[12px] opacity-100'
                    : 'bg-transparent text-slate-500 hover:bg-slate-200 text-[10px] opacity-80'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Generate Memory Button */}
            <button
              onClick={handleGenerateMemory}
              className={`flex items-center gap-1.5 px-3.5 py-[6px] border-none rounded-lg text-[11px] font-semibold text-white transition-all ${
                memoryProgress?.status === 'running'
                  ? 'bg-primary-100 cursor-not-allowed'
                  : 'bg-primary-600 hover:bg-primary-700'
              }`}
              disabled={memoryProgress?.status === 'running' || checkingRequirements}
            >
              {checkingRequirements ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Generate Memory
            </button>

            {memoryProgress?.status === 'running' && (
              <>
                <div className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg bg-primary-50 border border-primary-200">
                  <Loader2 size={12} className="animate-spin text-primary-500" />
                  <span className="text-[11px] text-primary-700 font-semibold">
                    {memoryProgress.phase}
                  </span>
                  <span className="text-[10px] font-bold text-primary-500 bg-white px-1.5 py-px rounded-full">
                    {memoryProgress.progress}%
                  </span>
                </div>
                <button
                  onClick={() => setPendingCancel(true)}
                  disabled={cancelling}
                  className="flex items-center gap-1.5 px-3.5 py-[6px] border-none rounded-lg text-[11px] font-semibold text-white transition-all bg-red-600 hover:bg-red-700 disabled:opacity-50"
                >
                  {cancelling ? <Loader2 size={12} className="animate-spin" /> : <Ban size={12} />}
                  {cancelling ? 'Stopping...' : 'Cancel'}
                </button>
              </>
            )}

            {memoryProgress?.status === 'complete' && (
              <div className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 size={12} className="text-green-600" />
                <span className="text-[11px] text-green-700 font-semibold">
                  {memoryProgress.phase}
                </span>
              </div>
            )}

            {memoryProgress?.status === 'cancelled' && (
              <div className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg bg-amber-50 border border-amber-200">
                <Ban size={12} className="text-amber-600" />
                <span className="text-[11px] text-amber-700 font-semibold">
                  {memoryProgress.phase}
                </span>
              </div>
            )}

            {memoryProgress?.status === 'error' && (
              <div className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg bg-red-50 border border-red-200">
                <AlertCircle size={12} className="text-red-600" />
                <span className="text-[11px] text-red-700 font-semibold">
                  Generation failed
                </span>
              </div>
            )}

            <div className="w-px h-[18px] bg-slate-200" />

            {/* Clear Memory Button — only usable when knowledge files exist */}
            <button
              onClick={() => setPendingClear(true)}
              disabled={clearing || memoryProgress?.status === 'running' || !memoryFiles?.length}
              className={`flex items-center gap-1.5 px-3.5 py-[6px] border-none rounded-lg text-[11px] font-semibold text-white transition-all bg-red-600 hover:bg-red-700 ${
                clearing || memoryProgress?.status === 'running' || !memoryFiles?.length
                  ? 'opacity-50 cursor-not-allowed'
                  : 'opacity-100 cursor-pointer'
              }`}
            >
              {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              {clearing ? 'Clearing...' : 'Clear Memory'}
            </button>
          </div>
        </div>

        {/* ── Workspace Row ── */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* Editor Pane */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {selectedFilePath ? (
              <>
                {/* Editor Subheader */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-slate-500" />
                    <span className="text-[12px] font-semibold text-slate-700 font-mono">
                      {selectedFilePath.split('/').pop()}
                    </span>
                    {saved && (
                      <span className="text-[10px] font-bold text-green-600 flex items-center gap-1">
                        <Check size={11} /> Saved
                      </span>
                    )}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 flex overflow-hidden">
                  {/* Content Section */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-y-auto p-6 bg-transparent">
                      {/* Preview Section & Edit Section */}
                      {detailMode === 'preview' ? (
                        <div className="max-w-[800px] mx-auto prose prose-sm prose-slate prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 prose-h1:text-[1.75em] prose-h1:font-bold prose-h1:mt-6 prose-h1:mb-4 relative prose-h2:text-[1.4em] prose-h2:font-semibold prose-h2:mt-6 prose-h2:mb-3 prose-h3:text-[1.15em] prose-h3:font-semibold prose-h3:text-slate-800 prose-p:text-[14px] prose-p:leading-[1.75] prose-p:text-slate-900 prose-strong:text-slate-900 prose-code:bg-slate-50 prose-code:px-[6px] prose-code:py-[3px] prose-code:rounded prose-code:text-[13px] prose-code:text-[#cf222e] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-50 prose-pre:rounded-lg prose-pre:border prose-pre:border-slate-200 prose-pre:shadow-none prose-pre:overflow-x-auto prose-pre:px-4 prose-pre:py-3 prose-pre-code:bg-none prose-pre-code:p-0 prose-pre-code:text-slate-900 prose-blockquote:border-l-[4px] prose-blockquote:border-l-slate-200 prose-blockquote:pl-4 prose-blockquote:my-3 prose-blockquote:text-slate-500 prose-blockquote:italic prose-li:text-[14px] prose-li:leading-[1.75] prose-li:text-slate-900 prose-table:border-collapse prose-table:w-full prose-table:my-3 prose-table:text-[13px] prose-th:border prose-th:border-slate-200 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:bg-slate-50 prose-th:font-semibold prose-th:text-slate-900 prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:text-slate-900 prose-a:text-primary-500 prose-a:no-underline prose-hr:border-slate-200 prose-hr:my-6">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                            a: ({ href, children }) => <span className="text-primary-500 cursor-default">{children}</span>,
                            h1: ({ children, ...props }) => {
                              const text = children?.toString() || '';
                              const id = text.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '');
                              return <h1 ref={el => { if (el) headingRefs.current[id] = el; }} id={id} className="group"><a href={`#${id}`} className="absolute -ml-[24px] opacity-0 group-hover:opacity-100 text-primary-500 hover:text-primary-700 transition-opacity no-underline">#</a><span>{children}</span></h1>;
                            },
                            h2: ({ children, ...props }) => {
                              const text = children?.toString() || '';
                              const id = text.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '');
                              return <h2 ref={el => { if (el) headingRefs.current[id] = el; }} id={id} className="group"><a href={`#${id}`} className="absolute -ml-[24px] opacity-0 group-hover:opacity-100 text-primary-500 hover:text-primary-700 transition-opacity no-underline">#</a><span>{children}</span></h2>;
                            },
                            h3: ({ children, ...props }) => {
                              const text = children?.toString() || '';
                              const id = text.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^\w-]/g, '');
                              return <h3 ref={el => { if (el) headingRefs.current[id] = el; }} id={id} className="group"><a href={`#${id}`} className="absolute -ml-[24px] opacity-0 group-hover:opacity-100 text-primary-500 hover:text-primary-700 transition-opacity no-underline">#</a><span>{children}</span></h3>;
                            },
                          }}>
                            {stripFrontmatter(fileContent) || 'No content to display.'}
                          </ReactMarkdown>
                        </div>
                      ) :
                      (
                        <div className="relative">
                          <div className="absolute inset-0 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow" />
                          <textarea
                            value={editingContent}
                            onChange={(e) => setEditingContent(e.target.value)}
                            className="relative w-full min-h-[600px] p-5 bg-transparent border border-transparent rounded-xl font-mono text-[12px] leading-[1.8] resize-none outline-none text-slate-800 placeholder-slate-400"
                            placeholder="Start editing..."
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* TOC Sidebar */}
                  {detailMode === 'preview' && headings.length > 0 && (
                    <div className="w-[240px] border-l border-slate-200 bg-white/30 backdrop-blur-xl flex-shrink-0 flex flex-col shadow-[inset_1px_0_0_rgba(255,255,255,0.4)] z-10">
                      <div className="px-5 py-4 border-b border-slate-200 bg-white/40 backdrop-blur-sm sticky top-0 z-10 shadow-sm">
                        <span className="text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase">
                          Table of Contents
                        </span>
                      </div>
                      <div className="p-3 flex-1 overflow-y-auto custom-scrollbar space-y-0.5">
                        {headings.map((h) => (
                          <button
                            key={h.idx}
                            onClick={() => headingRefs.current[h.id]?.scrollIntoView({ behavior: 'smooth' })}
                            className={`group w-full flex items-center gap-2.5 pr-3 py-1.5 cursor-pointer text-left transition-all rounded-xl ${
                              h.level === 1 
                                ? 'text-[12px] font-bold text-slate-700 mt-2 pl-2' 
                                : h.level === 2 ? 'text-[11px] font-medium text-slate-500 pl-6'
                                : 'text-[11px] font-medium text-slate-500 pl-10'
                            } hover:text-primary-600 hover:bg-white/60 hover:shadow-sm active:scale-[0.98]`}
                          >
                            <div className={`flex items-center justify-center rounded-lg flex-shrink-0 transition-colors ${
                              h.level === 1 ? 'w-5 h-5 bg-white shadow-sm border border-slate-100 text-slate-400 group-hover:border-primary-200 group-hover:text-primary-500' : 'text-slate-300 group-hover:text-primary-400'
                            }`}>
                              <Hash size={h.level === 1 ? 10 : 9} strokeWidth={h.level === 1 ? 3 : 2} />
                            </div>
                            <span className="truncate leading-tight">{h.title}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button (Edit Mode) */}
                {detailMode === 'edit' && (
                  <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-slate-200 bg-white flex-shrink-0">
                    <button
                      onClick={() => {
                        setEditingContent(fileContent);
                        setSaved(false);
                      }}
                      className="px-3 py-[5px] text-[11px] font-medium text-slate-500 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-all cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveContent}
                      disabled={saving}
                      className="px-3 py-[5px] text-[11px] font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-all disabled:opacity-60 cursor-not-allowed disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {saving && <Loader2 size={12} className="animate-spin" />}
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-slate-400 text-[13px]">
                Select a file from the tree to view its content
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Cancel Generation Confirmation Dialog ─────────────────────────── */}
      {pendingCancel && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/60 w-full max-w-md overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-200/50">
                <Ban size={28} className="text-white" />
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2">Cancel Generation?</h3>
              <p className="text-sm text-slate-500 mb-1">
                Memory generation is currently in progress.
              </p>
              <p className="text-[11px] text-slate-400">
                Cancelling will stop the process and progress made so far may be lost.
              </p>
            </div>

            <div className="px-8 pb-8 flex items-center gap-3">
              <button
                onClick={() => setPendingCancel(false)}
                className="flex-1 px-5 py-3 bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
              >
                Keep Generating
              </button>
              <button
                onClick={confirmCancel}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-red-200/50 hover:shadow-red-300/50 active:scale-95"
              >
                Yes, Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Clear Memory Confirmation Dialog ──────────────────────────────── */}
      {pendingClear && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/60 w-full max-w-md overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-200/50">
                <Trash2 size={28} className="text-white" />
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2">Clear Memory?</h3>
              <p className="text-sm text-slate-500 mb-1">
                All memory files will be permanently deleted.
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
                onClick={async () => {
                  setPendingClear(false);
                  setClearing(true);
                  try {
                    await clearMemory(project.id);
                    await refreshFiles();
                  } catch (err) {
                    alert('Failed to clear memory: ' + err.message);
                  } finally {
                    setClearing(false);
                    setSelectedFilePath(null);
                    setFileContent('');
                  }
                }}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-red-200/50 hover:shadow-red-300/50 active:scale-95"
              >
                Yes, Delete All
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* ── Full Screen Modal ─────────────────────────────────────────────── */}
      {fullScreen && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col rounded-2xl">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-slate-50 flex-shrink-0">
            <span className="text-[11px] font-medium text-slate-500 font-mono truncate max-w-[300px]">
              {selectedFilePath}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setDetailMode(detailMode === 'preview' ? 'edit' : 'preview')}
                className="flex items-center gap-1.5 px-2.5 py-[5px] rounded-lg border border-slate-200 bg-white cursor-pointer text-[11px] font-medium text-slate-500 hover:bg-slate-50 transition-all"
              >
                {detailMode === 'preview' ? <Edit3 size={12} /> : <Eye size={12} />}
                {detailMode === 'preview' ? 'Edit' : 'Preview'}
              </button>
              <button
                onClick={() => setFullScreen(false)}
                className="p-1.5 rounded-lg border-none bg-transparent cursor-pointer text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <X size={13} />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {detailMode === 'preview' ? (
              <div className="prose prose-sm prose-slate prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-slate-900 prose-p:text-[14px] prose-p:leading-[1.75] prose-p:text-slate-900 prose-strong:text-slate-900 prose-code:bg-slate-50 prose-code:px-[6px] prose-code:py-[3px] prose-code:rounded prose-code:text-[13px] prose-code:text-[#cf222e] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-50 prose-pre:rounded-lg prose-pre:border prose-pre:border-slate-200 prose-pre:overflow-x-auto prose-pre:px-4 prose-pre:py-3 prose-pre-code:bg-none prose-pre-code:p-0 prose-pre-code:text-slate-900 prose-blockquote:border-l-[4px] prose-blockquote:border-l-slate-200 prose-blockquote:pl-4 prose-blockquote:my-3 prose-blockquote:text-slate-500 prose-blockquote:italic prose-li:text-[14px] prose-li:leading-[1.75] prose-li:text-slate-900 prose-table:border-collapse prose-table:w-full prose-table:my-3 prose-table:text-[13px] prose-th:border prose-th:border-slate-200 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:bg-slate-50 prose-th:font-semibold prose-th:text-slate-900 prose-td:border prose-td:border-slate-200 prose-td:px-3 prose-td:py-2 prose-td:text-slate-900 prose-a:text-primary-500 prose-a:no-underline prose-hr:border-slate-200 prose-hr:my-6 p-8 max-w-[900px] mx-auto">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: ({ href, children }) => <span className="text-primary-500 cursor-default">{children}</span> }}>
                  {stripFrontmatter(fileContent) || 'No content to display.'}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="relative h-full">
                <div className="absolute inset-0 bg-white rounded-xl border border-slate-200 shadow-sm" />
                <textarea
                  value={editingContent}
                  onChange={(e) => setEditingContent(e.target.value)}
                  className="relative w-full h-full min-h-[600px] p-5 bg-transparent border border-transparent rounded-xl font-mono text-[13px] leading-[1.8] resize-none outline-none text-slate-800 placeholder-slate-400"
                  placeholder="Start editing..."
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
