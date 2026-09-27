import { useState, useEffect, useRef, useCallback } from 'react';
import debounce from 'lodash.debounce';
import useToastStore from '../../store/toastStore';
import useTemplateStore from '../../store/templateStore';
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
import { fetchProjectSettings } from '../../api/settingsApi';
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

  // Generation progress lives in the global store so it survives sub-tab switches
  const isGenerating = useTemplateStore((s) => s.isGenerating);
  const storeProjectId = useTemplateStore((s) => s.projectId);
  const setIsGenerating = useTemplateStore((s) => s.setIsGenerating);
  const setProgress = useTemplateStore((s) => s.setProgress);

  // State
  const [sections, setSections] = useState([]);
  const [selectedFilename, setSelectedFilename] = useState(null);
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showJsonViewer, setShowJsonViewer] = useState(false);
  const [phase3Data, setPhase3Data] = useState(null);
  const [jsonViewerLoading, setJsonViewerLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [jsonViewerWidth, setJsonViewerWidth] = useState(400);

  // Template type management state
  const [selectedTemplateName, setSelectedTemplateName] = useState('BSP-Board-1');
  const [availableTemplates, setAvailableTemplates] = useState([]);
  const [templateLockStateMap, setTemplateLockStateMap] = useState({});
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);

  // New template creation state
  const [showCreateTemplateForm, setShowCreateTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isCreatingTemplate, setIsCreatingTemplate] = useState(false);
  const templateNameInvalid =
    newTemplateName.trim() !== '' && !/^[a-zA-Z0-9_ -]+$/.test(newTemplateName.trim());

  // Computed: is the current template type locked (prevents deletion)?
  const currentTemplateEntry = availableTemplates?.find(
    (tmpl) => tmpl.name === selectedTemplateName,
  );
  const templateLocked = currentTemplateEntry?.locked ?? false;

  // Refs for polling
  const projectRef = useRef(project);

  // Keep refs in sync
  useEffect(() => { projectRef.current = project; }, [project]);

  // ─── Load template registry on mount ─────────────────────────────
  useEffect(() => {
    if (!project?.id) return;
    fetchTemplateTypeRegistry(project.id)
      .then((registryData) => {
        setAvailableTemplates(_toTemplateArray(registryData?.templates));
      })
      .catch((err) => {
        addToast(`Failed to load templates: ${err.message}`, 'error');
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
    // Reset generation progress when switching to a different project
    const templateStore = useTemplateStore.getState();
    if (templateStore.projectId !== project.id) {
      templateStore.resetTemplateProgress();
      templateStore.setProjectId(project.id);
    }

    // Fetch the persisted selected template name
    fetchSelectedTemplate(project.id)
      .then((selectedData) => {
        if (cancelled) return;
        const persistedTemplateName = selectedData?.template_type ?? 'BSP-Board-1';
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

  // ─── Load Phase 3 analysis into the Report/JSON viewer ───────────
  // Defined outside the polling effect on purpose: the analysis fetch must
  // NOT be gated by the polling effect's isPollingActive flag, because
  // setIsGenerating(false) at the terminal state re-runs that effect's
  // cleanup before this fetch resolves — which previously left the Report
  // panel stuck on "Loading Analysis..." forever.
  const loadPhase3Analysis = useCallback(async () => {
    if (!project?.id) return;
    setJsonViewerLoading(true);
    setShowJsonViewer(true);
    try {
      const analysisData = await fetchPhase3Analysis(project.id);
      setPhase3Data(analysisData);
    } catch (err) {
      addToast('No analysis data available', 'info');
    } finally {
      setJsonViewerLoading(false);
    }
  }, [project?.id, addToast]);

  // ─── Progress polling (store-driven; resumes after remount) ──────
  useEffect(() => {
    if (!project?.id || !isGenerating || storeProjectId !== project.id) return;
    // False only when this effect instance is torn down (dep change/unmount);
    // it no longer guards the terminal-state analysis load above.
    let isPollingActive = true;
    let consecutivePollFailures = 0;

    const poll = async () => {
      try {
        const progressPayload = await fetchProgress(project.id);
        if (!isPollingActive) return;
        consecutivePollFailures = 0;
        setProgress(progressPayload);
        // Stop polling when terminal state reached
        if (progressPayload?.status === 'complete' || progressPayload?.status === 'error') {
          setIsGenerating(false);
          if (progressPayload.status === 'complete') {
            // Fetch phase 3 data and open the Report panel
            loadPhase3Analysis();
          } else {
            addToast(`Generation failed: ${progressPayload.error || 'Unknown error'}`, 'error');
          }
        }
      } catch {
        // fetchProgress throws on non-OK responses (e.g. backend lost the
        // generation); 3 consecutive failures mean it is no longer running
        consecutivePollFailures += 1;
        if (isPollingActive && consecutivePollFailures >= 3) {
          setIsGenerating(false);
          setProgress(null);
          addToast('Generation is no longer running', 'info');
        }
      }
    };

    poll(); // immediate first poll (also reconciles state after a remount)
    const pollingInterval = setInterval(poll, 3000);
    return () => {
      isPollingActive = false;
      clearInterval(pollingInterval);
    };
  }, [project?.id, isGenerating, storeProjectId, setIsGenerating, setProgress, loadPhase3Analysis, addToast]);

  // Clean up auto-save on unmount
  useEffect(() => {
    return () => {
      if (saveRef.current) {
        saveRef.current.cancel();
        saveRef.current = null;
      }
    };
  }, []);

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
        addToast(`Save failed: ${err.message}`, 'error');
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
    if (!newTemplateName.trim() || templateNameInvalid || isCreatingTemplate || !project?.id) return;
    setIsCreatingTemplate(true);
    try {
      const result = await createTemplateType(project.id, newTemplateName.trim());
      addToast(result.message || `Template '${newTemplateName.trim()}' created`, 'success');
      setNewTemplateName('');
      setShowCreateTemplateForm(false);
      // Refresh template registry
      const registryData = await fetchTemplateTypeRegistry(project.id);
      setAvailableTemplates(_toTemplateArray(registryData?.templates));
    } catch (err) {
      addToast(`Failed to create template: ${err.message}`, 'error');
    } finally {
      setIsCreatingTemplate(false);
    }
  }, [newTemplateName, templateNameInvalid, isCreatingTemplate, project?.id, addToast]);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!project?.id || useTemplateStore.getState().isGenerating) return;

    // LLM settings must be configured before generation can run
    try {
      const settings = await fetchProjectSettings(project.id);
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

    setIsLoading(true);
    setError(null);

    try {
      await generateSections(project.id);
      setProgress(null);
      setIsGenerating(true); // polling effect starts on the next render

      // Refresh sections list
      const updated = await fetchSections(project.id, selectedTemplateName);
      setSections(updated);
      if (updated?.length && !selectedFilename) {
        setSelectedFilename(updated[0].filename);
      }
    } catch (err) {
      setError(err.message);
      addToast(`Generation failed: ${err.message}`, 'error');
      setIsGenerating(false);
    } finally {
      setIsLoading(false);
    }
  }, [project?.id, addToast, selectedTemplateName, setIsGenerating, setProgress]);

  const handleCancelGeneration = useCallback(async () => {
    if (!project?.id) return;
    try {
      await cancelGeneration(project.id);
    } catch (err) {
      setError(err.message);
    }
    setIsGenerating(false);
    setProgress(null);
    addToast('Generation cancelled', 'info');
  }, [project?.id, addToast, setIsGenerating, setProgress]);

  const handleShowJsonViewer = useCallback(() => {
    if (showJsonViewer) {
      setShowJsonViewer(false);
      setPhase3Data(null);
    } else {
      loadPhase3Analysis();
    }
  }, [showJsonViewer, loadPhase3Analysis]);

  const handleCreateSection = useCallback(async () => {
    if (!project?.id || !newSectionName.trim()) return;
    try {
      const result = await createSectionFile(project.id, newSectionName.trim());
      addToast(`Created: ${result.filename}`, 'success');
      setNewSectionName('');
      setShowCreateModal(false);
      // Creating a section inside a global template flips it to project origin
      // backend-side — refresh the registry so the Global/Local badge updates.
      fetchTemplateTypeRegistry(project.id).then((registryData) => {
        setAvailableTemplates(_toTemplateArray(registryData?.templates));
      }).catch(() => {});
      fetchSections(project.id, selectedTemplateName).then((updated) => {
        setSections(updated);
        setSelectedFilename(result.filename);
      });
    } catch (err) {
      addToast(`Failed to create section: ${err.message}`, 'error');
    }
  }, [project?.id, newSectionName, addToast, selectedTemplateName]);

  const handleDeleteSection = useCallback(async (filename) => {
    if (!project?.id) return;
    try {
      await deleteSectionFile(project.id, filename);
      addToast(`Deleted: ${filename}`, 'success');
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
      addToast(`Delete failed: ${err.message}`, 'error');
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
      addToast(`Switched to '${newTemplateName}' template`, 'success');
    } catch (err) {
      addToast(`Failed to switch template: ${err.message}`, 'error');
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

  // ─── Template deleted (from TemplateDetailsDialog) ────────────────
  // Refresh the registry so the deleted template disappears from the dropdown;
  // if it was the selected one, switch to the first remaining template.
  const handleTemplateDeleted = useCallback(async (deletedTemplateName) => {
    if (!project?.id) return;
    try {
      const registryData = await fetchTemplateTypeRegistry(project.id);
      const remainingTemplates = _toTemplateArray(registryData?.templates);
      setAvailableTemplates(remainingTemplates);

      const locksData = await fetchTemplateLocks(project.id);
      setTemplateLockStateMap(locksData || {});

      if (deletedTemplateName === selectedTemplateName && remainingTemplates.length) {
        const fallbackName = remainingTemplates[0].name;
        const syncedSections = await selectProjectTemplateType(project.id, fallbackName);
        setSelectedTemplateName(fallbackName);
        setSections(syncedSections);
        setSelectedFilename(syncedSections?.[0]?.filename ?? null);
        setContent('');
      }
    } catch {
      // Registry refresh is best-effort; the dropdown reloads on next mount anyway
    }
  }, [project?.id, selectedTemplateName]);

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
            showJsonViewer={showJsonViewer}
            hasJsonData={phase3Data}
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
                className={`w-full px-3 py-2 rounded-lg border text-sm text-slate-900 font-sans outline-none ${
                  templateNameInvalid ? 'border-rose-300' : 'border-slate-200'
                }`}
              />
            </div>
            {templateNameInvalid && (
              <p className="text-xs text-rose-500 -mt-2 mb-3">
                Only letters, numbers, spaces, hyphens, and underscores are allowed.
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowCreateTemplateForm(false); setNewTemplateName(''); }}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-500 cursor-pointer hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTemplate}
                disabled={!newTemplateName.trim() || templateNameInvalid || isCreatingTemplate}
                className={`px-4 py-2 rounded-lg border-none text-xs font-semibold cursor-pointer text-white transition-all duration-120 flex items-center gap-1.5 ${
                  newTemplateName.trim() && !templateNameInvalid && !isCreatingTemplate
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
          onTemplateDeleted={handleTemplateDeleted}
        />
      )}
    </div>
  );
}
