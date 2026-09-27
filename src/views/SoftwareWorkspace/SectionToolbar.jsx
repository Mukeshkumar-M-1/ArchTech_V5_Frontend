import { useState, useEffect, useRef } from 'react';
import { Brain, Plus, Loader2, ChevronDown, FileText, Lock, FileChartColumn, LayoutTemplate, FilePlus } from 'lucide-react';
import { themeTextColors, themeColors } from '../../utils/theme';
import useTemplateStore from '../../store/templateStore';

/**
 * SectionToolbar - Renders the top toolbar with template selector, actions, and progress bar.
 * @param {Object} props
 * @param {string} props.selectedFilename - Current file name for display.
 * @param {string} props.selectedTemplateName - Currently selected template type name.
 * @param {Object[]} props.availableTemplates - Template type registry entries.
 * @param {() => void} props.onGenerate - LLM generation callback.
 * @param {() => void} props.onCancel - Cancel generation callback.
 * @param {() => void} [props.onShowJsonViewer] - Toggle JSON viewer callback.
 * @param {() => void} [props.onCreateSection] - Create new section callback.
 * @param {() => void} [props.onCreateTemplate] - Create new template callback.
 * @param {(templateName: string) => void} props.onTemplateChange - Template type change callback.
 * @param {() => void} props.onShowTemplateDetails - Open template details dialog callback.
 * @param {boolean} [props.showJsonViewer] - Whether the JSON viewer is visible.
 * @param {boolean} [props.templateLocked] - Whether the current template type is locked.
 */
export default function SectionToolbar({
  selectedFilename,
  selectedTemplateName,
  availableTemplates,
  onGenerate,
  onCancel,
  onShowJsonViewer,
  onCreateSection,
  onCreateTemplate,
  onTemplateChange,
  onShowTemplateDetails,
  showJsonViewer,
  hasJsonData,
  templateLocked,
}) {
  const [isTemplateDropdownOpen, setIsTemplateDropdownOpen] = useState(false);

  // Generation state comes from the global store so it survives tab switches
  const isGenerating = useTemplateStore((s) => s.isGenerating);
  const progress = useTemplateStore((s) => s.progress);

  const phaseText = progress?.phase || '';
  const progressPercent = progress?.progress ?? 0;
  const progressStatus = progress?.status || '';

  const handleSelectTemplate = (selectedTemplateName) => {
    onTemplateChange(selectedTemplateName);
    setIsTemplateDropdownOpen(false);
  };

  // Close dropdown on click outside
  const dropdownRef = useRef(null);
  useEffect(() => {
    if (!isTemplateDropdownOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsTemplateDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isTemplateDropdownOpen]);

  return (
    <div className="flex flex-col px-4 py-2 border-b border-slate-200 bg-white flex-shrink-0">
      {/* Buttons row */}
      <div className="flex items-center justify-between gap-3">
        {/* Left side: Template selector */}
        <div className="flex items-center gap-3 shrink-0">
          {/* Template type selector dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsTemplateDropdownOpen(!isTemplateDropdownOpen)}
              disabled={isGenerating}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all duration-120 ${
                isGenerating
                  ? 'opacity-50 cursor-not-allowed border-slate-200 bg-white text-slate-400'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <FileText size={13} />
              {selectedTemplateName}
              {!isGenerating && <ChevronDown size={12} className="text-slate-400" />}
            </button>

            {/* Template dropdown menu */}
            {isTemplateDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 min-w-[180px] py-1">
                {!availableTemplates || availableTemplates.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-slate-400">No templates available</div>
                ) : (
                  availableTemplates.map((templateEntry) => (
                    <button
                      key={templateEntry.name}
                      onClick={() => handleSelectTemplate(templateEntry.name)}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors cursor-pointer ${
                        selectedTemplateName === templateEntry.name
                          ? 'bg-primary-50 text-primary-700 font-semibold'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{templateEntry.name}</span>
                      <span className="flex items-center gap-1.5">
                      {selectedTemplateName === templateEntry.name && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                        </span>
                      )}
                      {templateEntry.locked && (
                        <span className="flex items-center gap-1 bg-primary-50 px-1.5 py-0.5 rounded border border-primary-200 text-[10px] font-semibold text-primary-600">
                          <Lock size={10} className="text-accent" />
                        </span>
                      )}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Template details / sections button */}
          <button
            onClick={onShowTemplateDetails}
            disabled={isGenerating}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer text-xs font-semibold transition-all duration-120 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="View template sections"
          >
            <LayoutTemplate size={13} />
            Template Sections
          </button>
        </div>

        {/* Center: Current file name */}
        <div className="flex items-center justify-center shrink-0">
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200/80 text-xs font-semibold text-slate-700 max-w-[240px]">
            <FileText size={13} className="text-slate-500 shrink-0" />
            <span className="truncate">
              {selectedFilename || 'No file selected'}
            </span>
          </div>
        </div>


        {/* Right side: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Generate button */}
          <button
            onClick={onGenerate}
            disabled={isGenerating}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 cursor-pointer text-xs font-semibold transition-all duration-120 bg-white text-emerald-600 hover:bg-emerald-50 hover:border-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate sections with LLM"
          >
            <Brain size={13} />
            Analysis
          </button>

          {/* Cancel button */}
          {isGenerating && (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 cursor-pointer text-xs font-semibold transition-all duration-120 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300"
              title="Cancel generation"
            >
              <Loader2 size={13} className="animate-spin" />
              Cancel
            </button>
          )}

          {/* View JSON button */}
          {onShowJsonViewer && (
            <button
              onClick={onShowJsonViewer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all duration-120 ${
                showJsonViewer
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="View generated analysis JSON"
            >
              <FileChartColumn size={13} />
              Report
              {hasJsonData && !showJsonViewer && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500"></span>
                </span>
              )}
            </button>
          )}

          {/* New section button */}
          {onCreateSection && (
            <button
              onClick={onCreateSection}
              disabled={isGenerating}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer text-xs font-semibold transition-all duration-120 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add new section"
            >
              <Plus size={12} />
              New Section
            </button>
          )}

          {/* New template button */}
          {onCreateTemplate && (
            <button
              onClick={onCreateTemplate}
              disabled={isGenerating}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 cursor-pointer text-xs font-semibold transition-all duration-120 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Add new template type"
            >
              <FilePlus size={12} />
              New Template
            </button>
          )}

        </div>
      </div>

      {/* Progress bar */}
      {isGenerating && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-1">
            <Loader2 size={12} className="animate-spin text-primary-500" />
            <span className="text-[11px] text-slate-500 truncate flex-1">{phaseText || 'Analyzing...'}</span>
            <span className="text-[10px] font-mono text-slate-400">{progressPercent}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                progressStatus === 'error' ? 'bg-red-500' :
                progressStatus === 'complete' ? 'bg-emerald-500' :
                'bg-primary-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
