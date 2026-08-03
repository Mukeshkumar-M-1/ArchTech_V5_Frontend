import { useState, useEffect, useRef, useCallback } from 'react';
import debounce from 'lodash.debounce';
import useToastStore from '../../store/toastStore';
import {
  fetchSections,
  fetchSectionContent,
  deleteSectionFile,
  createSectionFile,
  createTemplateType,
  generateSections,
  cancelGeneration,
  updateSectionContent,
  fetchPhase3Analysis,
  fetchProgress,
  fetchTemplateTypeRegistry,
  fetchTemplateLocks,
  fetchSelectedTemplate,
  selectProjectTemplateType,
} from '../../api/templateApi';
import SectionList from './SectionList';
import SectionToolbar from './SectionToolbar';
import SectionContent from './SectionContent';
import TemplateDetailsDialog from './TemplateDetailsDialog';
import JsonViewer from './JsonViewer';
import ErrorBanner from './ErrorBanner';
import { Plus, Loader2, FilePlus } from 'lucide-react';

/**
 * Normalize template registry into a flat array for UI consumption.
 * The backend returns templates as an object keyed by name:
 *   { "Standard": { ... }, "Compact": { ... } }
 * This converts it to: [ { name: "Standard", ... }, { name: "Compact", ... } ]
 */
function _toTemplateArray(templatesObj) {
  if (!templatesObj) return [];
  if (Array.isArray(templatesObj)) return templatesObj;
  return Object.entries(templatesObj).map(([name, entry]) => ({ name, ...entry }));
}

/**
 * TemplatePanel - Orchestrates template section management with full backend integration.
 * Handles CRUD, LLM generation with progress polling, auto-save, and JSON viewer.
 * @param {Object} props
 * @param {Object} props.project - The active project object.
 * @param {(sections: Array) => void} [props.onSectionsChange] - Callback when sections list changes.
 */
export default function TemplatePanel({ project, onSectionsChange, selectedChatBlocks, setSelectedChatBlocks }) {
  const addToast = useToastStore((s) => s.addToast);

  // State
  const [sections, setSections] = useState([]);
  const [selectedFilename, setSelectedFilename] = useState(null);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showJsonViewer, setShowJsonViewer] = useState(false);
  const [phase3Data, setPhase3Data] = useState(null);
  const [jsonViewerLoading, setJsonViewerLoading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [jsonViewerWidth, setJsonViewerWidth] = useState(400);

  // Template type management state
  const [selectedTemplateName, setSelectedTemplateName] = useState('Standard');
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [templateLockStateMap, setTemplateLockStateMap] = useState({});
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // New template creation state
  const [showCreateTemplateForm, setShowCreateTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);

  // Computed: is the current template type locked (prevents deletion)?
  const currentTemplateEntry = availableTemplates?.find(
    (tmpl) => tmpl.name === selectedTemplateName,
  );
  const templateLocked = currentTemplateEntry?.locked ?? false;

  // Refs for polling
  const progressIntervalRef = useRef(null);
  const projectRef = useRef(project);
  const isGeneratingRef = useRef(false);

  // Keep refs in sync
  useEffect(() => { projectRef.current = project; }, [project]);
  useEffect(() => { isGeneratingRef.current = isGenerating; }, [isGenerating]);

  // ─── Load template registry on mount ─────────────────────────────
  useEffect(() => {
    if (!project?.id) return;
    fetchTemplateTypeRegistry(project.id)
      .then((registryData) => {
        setAvailableTemplates(_toTemplateArray(registryData?.templates));
      })
      .catch((err) => {
        addToast('error', `Failed to load templates: ${err.message}`);
      });
  }, [project?.id, addToast]);

  // ─── Load per-project section locks on mount ─────────────────────
  useEffect(() => {
    if (!project?.id) return;
    fetchTemplateLocks(project.id)
      .then((lockMap) => {
        setTemplateLockStateMap(lockMap || {});
      })
      .catch(() => {
        // Lock state is optional; default to empty
      });
  }, [project?.id]);

  // ─── Load sections on mount ──────────────────────────────────────
  useEffect(() => {
    if (!project?.id) return;
    let cancelled = false;

    setIsLoading(true);
    setError(null);
    // Clear progress on project change
    setProgress(null);

    // Fetch the persisted selected template name
    fetchSelectedTemplate(project.id)
      .then((selectedData) => {
        if (cancelled) return;
        const persistedTemplateName = selectedData?.template_type ?? 'Standard';
        setSelectedTemplateName(persistedTemplateName);
        return fetchSections(project.id, persistedTemplateName);
      })
      .then((data) => {
        if (cancelled) return;
        setSections(data);
        if (data?.length && !selectedFilename) {
          setSelectedFilename(data[0].filename);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
        setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [project?.id]);

  // ─── Load content when a section is selected ─────────────────────
  useEffect(() => {
    if (!selectedFilename || !project?.id) return;

    fetchSectionContent(project.id, selectedFilename)
      .then((data) => setContent(data.content))
      .catch((err) => setError(err.message));
  }, [selectedFilename, project?.id, selectedTemplateName]);

  // ─── Progress polling ────────────────────────────────────────────
  const startProgressPolling = useCallback((projectId) => {
    // Clear any existing interval
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

    // Poll immediately then every 3s
    const poll = async () => {
      if (!isGeneratingRef.current) {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
        return;
      }
      try {
        const data = await fetchProgress(projectId);
        setProgress(data);
        // Stop polling when terminal state reached
        if (data?.status === 'complete' || data?.status === 'error') {
          if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
          progressIntervalRef.current = null;
          setIsGenerating(false);
          if (data.status === 'complete') {
            // Fetch phase 3 data and show JSON viewer
            setJsonViewerLoading(true);
            setShowJsonViewer(true);
            try {
              const analysisData = await fetchPhase3Analysis(projectId);
              setPhase3Data(analysisData);
            } catch {
              addToast('info', 'No analysis data available');
            } finally {
              setJsonViewerLoading(false);
            }
          } else {
            addToast('error', `Generation failed: ${data.error || 'Unknown error'}`);
          }
        }
      } catch {
        // Ignore polling errors
      }
    };

    poll(); // immediate first poll
    progressIntervalRef.current = setInterval(poll, 3000);
  }, [addToast]);

  const stopProgressPolling = useCallback(() => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    isGeneratingRef.current = false;
    setIsGenerating(false);
  }, []);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopProgressPolling();
      if (saveRef.current) {
        saveRef.current.cancel();
        saveRef.current = null;
      }
    };
  }, [stopProgressPolling]);

  // ─── Auto-save with 100ms debounce ───────────────────────────────
  const saveRef = useRef(null);
  const selectedFilenameRef = useRef(selectedFilename);

  useEffect(() => { selectedFilenameRef.current = selectedFilename; }, [selectedFilename]);

  useEffect(() => {
    if (saveRef.current) saveRef.current.cancel();

    // Use refs for filename so the debounced fn never captures stale values
    saveRef.current = debounce(async (projectId, newContent) => {
      const filename = selectedFilenameRef.current;
      if (!projectId || !filename) return;
      setIsSaving(true);
      try {
        await updateSectionContent(projectId, filename, newContent);
      } catch (err) {
        addToast('error', `Save failed: ${err.message}`);
      } finally {
        setIsSaving(false);
      }
    }, 100);

    return () => {
      if (saveRef.current) {
        saveRef.current.cancel();
        saveRef.current = null;
      }
    };
  }, []);

  const debouncedSave = useCallback((newContent) => {
    saveRef.current?.(project?.id, newContent);
  }, [project?.id]);

  // ─── Template creation handler ───────────────────────────────────
  const handleCreateTemplate = useCallback(async () => {
    if (!newTemplateName.trim() || isCreatingTemplate || !project?.id) return;
    setIsCreatingTemplate(true);
    try {
      const result = await createTemplateType(project.id, newTemplateName.trim());
      addToast('success', result.message || `Template '${newTemplateName.trim()}' created`);
      setNewTemplateName('');
      setShowCreateTemplateForm(false);
      // Refresh template registry
      const registryData = await fetchTemplateTypeRegistry(project.id);
      setAvailableTemplates(_toTemplateArray(registryData?.templates));
    } catch (err) {
      addToast('error', `Failed to create template: ${err.message}`);
    } finally {
      setIsCreatingTemplate(false);
    }
  }, [newTemplateName, isCreatingTemplate, project?.id, addToast]);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!project?.id || isGeneratingRef.current) return;
    setIsLoading(true);
    setError(null);

    try {
      await generateSections(project.id);
      isGeneratingRef.current = true;
      setIsGenerating(true);
      setProgress(null);

      // Start polling for progress
      startProgressPolling(project.id);

      // Refresh sections list
      const updated = await fetchSections(project.id, selectedTemplateName);
      setSections(updated);
      if (updated?.length && !selectedFilename) {
        setSelectedFilename(updated[0].filename);
      }
    } catch (err) {
      setError(err.message);
      addToast('error', `Generation failed: ${err.message}`);
      setIsGenerating(false);
      isGeneratingRef.current = false;
    } finally {
      setIsLoading(false);
    }
  }, [project?.id, addToast, startProgressPolling]);

  const handleCancelGeneration = useCallback(async () => {
    if (!project?.id) return;
    try {
      await cancelGeneration(project.id);
    } catch (err) {
      setError(err.message);
    }
    stopProgressPolling();
    addToast('info', 'Generation cancelled');
  }, [project?.id, addToast, stopProgressPolling]);

  const fetchJsonViewerData = useCallback(async () => {
    if (!project?.id) return;
    setJsonViewerLoading(true);
    setShowJsonViewer(true);
    try {
      const data = await fetchPhase3Analysis(project.id);
      setPhase3Data(data);
    } catch (err) {
      addToast('info', 'No analysis data available');
    } finally {
      setJsonViewerLoading(false);
    }
  }, [project?.id, addToast]);

  const handleShowJsonViewer = useCallback(() => {
    if (showJsonViewer) {
      setShowJsonViewer(false);
      setPhase3Data(null);
    } else {
      fetchJsonViewerData();
    }
  }, [showJsonViewer, fetchJsonViewerData]);

  const handleCreateSection = useCallback(async () => {
    if (!project?.id || !newSectionName.trim()) return;
    try {
      const result = await createSectionFile(project.id, newSectionName.trim());
      addToast('success', `Created: ${result.filename}`);
      setNewSectionName('');
      setShowCreateModal(false);
      fetchSections(project.id, selectedTemplateName).then((updated) => {
        setSections(updated);
        setSelectedFilename(result.filename);
      });
    } catch (err) {
      addToast('error', `Failed to create section: ${err.message}`);
    }
  }, [project?.id, newSectionName, addToast]);

  const handleDeleteSection = useCallback(async (filename) => {
    if (!project?.id) return;
    try {
      await deleteSectionFile(project.id, filename);
      addToast('info', `Deleted: ${filename}`);
      fetchSections(project.id, selectedTemplateName).then((updated) => {
        setSections(updated);
        if (selectedFilename === filename) {
          const next = updated?.[0]?.filename ?? null;
          setSelectedFilename(next);
          setContent('');
        }
      });
    } catch (err) {
      setError(err.message);
      addToast('error', `Delete failed: ${err.message}`);
    }
  }, [project?.id, selectedFilename, addToast]);

  // ─── Template type change ────────────────────────────────────────
  const handleTemplateTypeChange = useCallback(async (newTemplateName) => {
    if (!project?.id || newTemplateName === selectedTemplateName) return;
    setIsLoading(true);
    try {
      const syncedSections = await selectProjectTemplateType(project.id, newTemplateName);
      setSelectedTemplateName(newTemplateName);
      setSections(syncedSections);
      setSelectedFilename(syncedSections?.[0]?.filename ?? null);
      setContent('');
      addToast('success', `Switched to '${newTemplateName}' template`);
    } catch (err) {
      addToast('error', `Failed to switch template: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, [project?.id, selectedTemplateName, addToast]);

  // ─── Section lock change (from TemplateDetailsDialog) ────────────
  const handleSectionLockChange = useCallback((_sectionFilename, _newLockState) => {
    if (!project?.id) return;
    Promise.all([
      fetchTemplateLocks(project.id),
      fetchSections(project.id, selectedTemplateName),
    ]).then(([lockData, updatedSections]) => {
      setTemplateLockStateMap(lockData || {});
      setSections(updatedSections);
    }).catch(() => {});
  }, [project?.id, selectedTemplateName]);

  // ─── Template lock change (from TemplateDetailsDialog) ────────────
  const handleTemplateLockChange = useCallback((_templateName, _newLockState) => {
    if (!project?.id) return;
    fetchTemplateTypeRegistry(project.id).then((registryData) => {
      setAvailableTemplates(_toTemplateArray(registryData?.templates));
    }).catch(() => {});
  }, [project?.id]);

  // ─── Determine if the currently selected section is locked ───────
  const currentSectionIsLocked = templateLockStateMap?.template_type === selectedTemplateName;

  return (
    <div className="h-full w-full flex flex-col bg-[#fafafa]">
      {/* Error banner */}
      <ErrorBanner error={error} clearError={() => setError(null)} />

      {/* Section list + Toolbar + split panes */}
      <div className="flex flex-1 overflow-hidden bg-white">
        {/* Far-left section list */}
        <SectionList
          sections={sections}
          selectedFilename={selectedFilename}
          onSelect={setSelectedFilename}
          onDelete={handleDeleteSection}
          onAddClick={() => setShowCreateModal(true)}
          loading={isLoading}
          templateLocked={templateLocked}
          showTemplateType
          templateName={selectedTemplateName}
        />

        <div className="w-full h-full flex flex-col overflow-hidden">
          {/* Toolbar */}
          <SectionToolbar
            selectedFilename={selectedFilename}
            selectedTemplateName={selectedTemplateName}
            availableTemplates={availableTemplates}
            onGenerate={handleGenerate}
            onCancel={handleCancelGeneration}
            onShowJsonViewer={isGenerating ? undefined : handleShowJsonViewer}
            onCreateSection={() => setShowCreateModal(true)}
            onCreateTemplate={() => setShowCreateTemplateForm(true)}
            onTemplateChange={handleTemplateTypeChange}
            onShowTemplateDetails={() => setShowTemplateDialog(true)}
            isGenerating={isGenerating}
            showJsonViewer={showJsonViewer}
            hasJsonData={phase3Data}
            progress={progress}
            templateLocked={templateLocked}
          />

          {/* Split: Content (left) + JSON Viewer (right) */}
          <div className="flex flex-row overflow-hidden flex-1 relative">
            {/* Section content */}
            <div 
              className="h-full overflow-hidden shrink-0"
              style={{ width: showJsonViewer ? `calc(100% - ${jsonViewerWidth}px)` : '100%' }}
            >
              <SectionContent
                content={content}
                selectedFilename={selectedFilename}
                loading={isLoading}
                viewMode="editor"
                onContentChange={debouncedSave}
                isSaving={isSaving}
                isSectionLocked={currentSectionIsLocked}
                selectedChatBlocks={selectedChatBlocks}
                setSelectedChatBlocks={setSelectedChatBlocks}
              />
            </div>

            {/* JSON Viewer — right pane (shows when toggled on) */}
            {showJsonViewer && (
              <>
                {/* Resizer */}
                <div
                  className="w-1 cursor-col-resize hover:bg-primary-500/50 transition-colors bg-transparent relative z-30 group shrink-0"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    const startX = e.clientX;
                    const startWidth = jsonViewerWidth;
                    
                    const onMouseMove = (moveEvent) => {
                      const delta = startX - moveEvent.clientX;
                      let newWidth = startWidth + delta;
                      
                      // Constraints: Min 300px, Max 600px (but always leave at least 500px for the editor)
                      const maxWidth = Math.min(600, window.innerWidth - 500);
                      
                      if (newWidth < 300) newWidth = 300;
                      if (newWidth > maxWidth) newWidth = maxWidth;
                      setJsonViewerWidth(newWidth);
                    };
                    
                    const onMouseUp = () => {
                      document.removeEventListener('mousemove', onMouseMove);
                      document.removeEventListener('mouseup', onMouseUp);
                      document.body.style.cursor = 'default';
                    };
                    
                    document.addEventListener('mousemove', onMouseMove);
                    document.addEventListener('mouseup', onMouseUp);
                    document.body.style.cursor = 'col-resize';
                  }}
                >
                  <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary-500/10 transition-colors" />
                </div>

                <div 
                  className="overflow-hidden min-w-0 border-l border-slate-200 shrink-0"
                  style={{ width: jsonViewerWidth }}
                >
                  <JsonViewer
                    data={phase3Data}
                    loading={jsonViewerLoading}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Create new section modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-[400px] border border-slate-200 shadow-lg">
            <div className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Plus size={14} className="text-slate-400" />
              New Section Name
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-1 rounded">
                0{sections.length + 1}_
              </span>
              <input
                type="text"
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="e.g., Introduction"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateSection();
                  if (e.key === 'Escape') setShowCreateModal(false);
                }}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 font-sans outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSection}
                disabled={!newSectionName.trim()}
                className={`px-4 py-2 rounded-lg border-none text-xs font-semibold cursor-pointer text-white transition-all duration-120 ${
                  newSectionName.trim()
                    ? 'bg-primary-600 hover:bg-primary-700'
                    : 'text-slate-400 bg-slate-100 cursor-default'
                }`}
              >
                Create Section
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create new template modal */}
      {showCreateTemplateForm && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-4 w-[400px] border border-slate-200 shadow-lg">
            <div className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <FilePlus size={14} className="text-slate-400" />
              New Template Name
            </div>
            <div className="flex items-center gap-2 mb-4">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., My Custom Template"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateTemplate();
                  if (e.key === 'Escape') { setShowCreateTemplateForm(false); setNewTemplateName(''); }
                }}
                disabled={isCreatingTemplate}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 font-sans outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreateTemplateForm(false); setNewTemplateName(''); }}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim() || isCreatingTemplate}
                className={`px-4 py-2 rounded-lg border-none text-xs font-semibold cursor-pointer text-white transition-all duration-120 flex items-center gap-1.5 ${
                  newTemplateName.trim() && !isCreatingTemplate
                    ? 'bg-primary-600 hover:bg-primary-700'
                    : 'text-slate-400 bg-slate-100 cursor-default'
                }`}
              >
                {isCreatingTemplate && <Loader2 size={12} className="animate-spin" />}
                Create Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template details / sections dialog */}
      {showTemplateDialog && (
        <TemplateDetailsDialog
          projectId={project?.id}
          selectedTemplateName={selectedTemplateName}
          templateLocked={templateLocked}
          templateOrigin={currentTemplateEntry?.origin}
          onClose={() => setShowTemplateDialog(false)}
          onSectionLockChange={handleSectionLockChange}
          onTemplateLockChange={handleTemplateLockChange}
        />
      )}
    </div>
  );
}
