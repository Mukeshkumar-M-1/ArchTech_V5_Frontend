import { useState, useEffect } from 'react';
import { X, Loader2, Lock, Unlock, Trash2, LayoutTemplate, RotateCcw } from 'lucide-react';
import useToastStore from '../../store/toastStore';
import {
  fetchTemplateSections,
  fetchTemplateLocks,
  lockTemplate,
  removeTemplateType,
  resetTemplateToSource,
} from '../../api/templateApi';

/**
 * TemplateDetailsDialog — Modal displaying all sections for the selected template type.
 * The footer provides "Delete Template" and "Lock Template" buttons.
 * @param {Object} props
 * @param {string} props.projectId - The active project identifier.
 * @param {string} props.selectedTemplateName - Currently selected template name.
 * @param {boolean} props.templateLocked - Whether the template type itself is locked (cannot delete).
 * @param {string} props.templateOrigin - Template origin: "global" or "project". Global templates cannot be deleted.
 * @param {() => void} props.onClose - Callback to close the dialog.
 * @param {(filename: string, isLocked: boolean) => void} [props.onSectionLockChange] - Callback when section lock changes.
 * @param {(templateName: string, isLocked: boolean) => void} [props.onTemplateLockChange] - Callback when template lock changes.
 * @param {(templateName: string) => void} [props.onTemplateDeleted] - Callback after a template is deleted (refreshes the dropdown).
 */
export default function TemplateDetailsDialog({
  projectId,
  selectedTemplateName,
  templateLocked,
  templateOrigin,
  onClose,
  onSectionLockChange,
  onTemplateLockChange,
  onTemplateDeleted,
}) {
  const addToast = useToastStore((state) => state.addToast);

  // Component state
  const [sectionList, setSectionList] = useState([]);
  const [lockStateMap, setLockStateMap] = useState({});
  const [isLoadingSections, setIsLoadingSections] = useState(true);
  const [isDeletingTemplate, setIsDeletingTemplate] = useState(false);
  const [isProcessingLock, setIsProcessingLock] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Load sections and lock state when dialog opens or template changes
  useEffect(() => {
    if (!projectId || !selectedTemplateName) return;

    const loadSectionData = async () => {
      setIsLoadingSections(true);
      try {
        const [sectionsResponse, locksResponse] = await Promise.all([
          fetchTemplateSections(projectId, selectedTemplateName),
          fetchTemplateLocks(projectId),
        ]);
        setSectionList(sectionsResponse || []);
        setLockStateMap(locksResponse || {});
      } catch (sectionLoadError) {
        addToast(`Failed to load sections: ${sectionLoadError.message}`, 'error');
      } finally {
        setIsLoadingSections(false);
      }
    };

    loadSectionData();
  }, [projectId, selectedTemplateName, addToast]);

  // Handle locking/unlocking the entire template
  const allSectionsLocked = lockStateMap.template_type === selectedTemplateName;

  const handleLockTemplate = async () => {
    const newLockState = !allSectionsLocked;
    setIsProcessingLock(true);
    try {
      await lockTemplate(projectId, newLockState);
      // Refresh lock state from the backend (returns { template_type: "Standard" })
      const locks = await fetchTemplateLocks(projectId);
      setLockStateMap(locks || {});
      addToast(`Template ${newLockState ? 'locked' : 'unlocked'}.`, 'success');
      if (onSectionLockChange) {
        onSectionLockChange('', newLockState);
      }
      if (onTemplateLockChange) {
        onTemplateLockChange(selectedTemplateName, newLockState);
      }
    } catch (err) {
      addToast(`Failed: ${err.message}`, 'error');
    } finally {
      setIsProcessingLock(false);
    }
  };

  // Handle deleting the entire template type
  const handleDeleteTemplate = async () => {
    if (templateOrigin === "global" || templateLocked) return;

    setIsDeletingTemplate(true);
    try {
      await removeTemplateType(projectId, selectedTemplateName);
      addToast(`Template '${selectedTemplateName}' has been removed`, 'success');
      // Notify the parent before closing so the dropdown refreshes while the
      // dialog is closing (otherwise the deleted template stays listed).
      if (onTemplateDeleted) {
        onTemplateDeleted(selectedTemplateName);
      }
      onClose();
    } catch (templateDeleteError) {
      addToast(`Failed to delete template: ${templateDeleteError.message}`, 'error');
    } finally {
      setIsDeletingTemplate(false);
    }
  };

  // Handle resetting template sections to source
  const handleResetTemplate = async () => {
    setIsResetting(true);
    try {
      const result = await resetTemplateToSource(projectId, selectedTemplateName);
      addToast(`Template reset. ${result.sections_reset} sections restored.`, 'success');
      // Reload sections after reset
      const sections = await fetchTemplateSections(projectId, selectedTemplateName);
      setSectionList(sections || []);
    } catch (err) {
      addToast(`Failed to reset template: ${err.message}`, 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-[700px] max-h-[85vh] flex flex-col border border-slate-200 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <LayoutTemplate size={14} className="text-slate-400" />
              Template Sections — {selectedTemplateName}
            </h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {sectionList?.length || 0} sections loaded
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            title="Close dialog"
          >
            <X size={16} />
          </button>
        </div>

        {/* Section list — fixed header outside the scroll area so rows can never
            paint over the headings (sticky-on-th glitches with table borders) */}
        {!isLoadingSections && (
          <div className="px-5 pt-3">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2.5 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400 w-16">
                    No.
                  </th>
                  <th className="text-left py-2.5 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400 w-24">
                    Template
                  </th>
                  <th className="text-left py-2.5 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Section Name
                  </th>
                  <th className="text-left py-2.5 px-2 text-[10px] font-black uppercase tracking-widest text-slate-400 w-20">
                    Origin
                  </th>
                </tr>
              </thead>
            </table>
          </div>
        )}
        <div className="overflow-y-auto px-5 pb-3 min-h-0" style={{ maxHeight: 'calc(11 * 32px)' }}>
          {isLoadingSections ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Loader2 size={20} className="animate-spin mb-2" />
              <span className="text-xs">Loading sections…</span>
            </div>
          ) : (
            <table className="w-full">
              <tbody>
                {sectionList?.map((sectionEntry) => {
                  return (
                    <tr
                      key={sectionEntry.filename}
                      className="border-b border-slate-100 hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-2.5 px-2 text-xs font-mono text-slate-500 w-16">
                        {String(sectionEntry.section_number).padStart(2, '0')}
                      </td>
                      <td className="py-2.5 px-2 text-xs text-primary-600 font-semibold w-24 whitespace-nowrap">
                        {selectedTemplateName}
                      </td>
                      <td className="py-2.5 px-2 text-xs font-medium text-slate-800">
                        {sectionEntry.title}
                      </td>
                      <td className="py-2.5 px-2 w-20">
                        <span
                          className={`inline-block px-1.5 py-px rounded-full text-[9px] font-black uppercase tracking-wider border ${
                            templateOrigin === 'global'
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'bg-violet-50 text-violet-600 border-violet-200'
                          }`}
                          title={templateOrigin === 'global' ? 'System-provided template (cannot be deleted)' : 'Project-owned template'}
                        >
                          {templateOrigin === 'global' ? 'Global' : 'Local'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-slate-200 bg-slate-50/50 gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDeleteTemplate}
              disabled={templateOrigin === "global" || templateLocked || isDeletingTemplate}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                templateOrigin === "global" || templateLocked
                  ? 'text-slate-300 bg-slate-100 cursor-not-allowed'
                  : 'text-red-600 bg-white border border-red-200 hover:bg-red-50 hover:border-red-300'
              }`}
              title={templateOrigin === "global" ? 'Cannot delete a system template' : templateLocked ? 'Cannot delete a locked template' : undefined}
            >
              {isDeletingTemplate ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              {isDeletingTemplate ? 'Deleting…' : 'Delete Template'}
            </button>

            {/* Reset Template Button */}
            <button
              onClick={handleResetTemplate}
              disabled={isResetting || isLoadingSections}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 disabled:text-slate-300 disabled:bg-slate-100 disabled:cursor-not-allowed"
              title="Reset all sections back to source template"
            >
              {isResetting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <RotateCcw size={14} />
              )}
              {isResetting ? 'Resetting…' : 'Reset Template'}
            </button>
          </div>

          {/* Lock/Unlock Template Button */}
          <button
            onClick={handleLockTemplate}
            disabled={isProcessingLock || sectionList.length === 0}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              allSectionsLocked
                ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
            }`}
            title={allSectionsLocked
              ? 'Unlock template — sections become editable again'
              : 'Lock template — all sections become read-only'}
          >
            {isProcessingLock ? (
              <Loader2 size={14} className="animate-spin" />
            ) : allSectionsLocked ? (
              <Unlock size={14} />
            ) : (
              <Lock size={14} />
            )}
            {isProcessingLock ? 'Processing…' : allSectionsLocked ? 'Unlock Template' : 'Lock Template'}
          </button>
        </div>
      </div>
    </div>
  );
}
