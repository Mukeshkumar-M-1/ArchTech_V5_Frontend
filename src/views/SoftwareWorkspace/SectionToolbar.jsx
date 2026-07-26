import { Brain, Plus, Loader2 } from 'lucide-react';

/**
 * SectionToolbar - Renders the top toolbar with Generate, Cancel, View JSON, and New buttons.
 * Shows a progress bar below the buttons during generation.
 * @param {Object} props
 * @param {string} props.selectedFilename - Current file name for display.
 * @param {() => void} props.onGenerate - LLM generation callback.
 * @param {() => void} props.onCancel - Cancel generation callback.
 * @param {() => void} [props.onShowJsonViewer] - Toggle JSON viewer callback.
 * @param {() => void} [props.onCreateSection] - Create new section callback.
 * @param {boolean} props.isGenerating - Whether generation is in progress.
 * @param {boolean} [props.showJsonViewer] - Whether the JSON viewer is visible.
 * @param {Object|null} [props.progress] - Progress data from backend polling.
 */
export default function SectionToolbar({
  selectedFilename,
  onGenerate,
  onCancel,
  onShowJsonViewer,
  onCreateSection,
  isGenerating,
  showJsonViewer,
  progress,
}) {
  const phaseText = progress?.phase || '';
  const progressPercent = progress?.progress ?? 0;
  const progressStatus = progress?.status || '';

  const isTerminal = progressStatus === 'complete' || progressStatus === 'error';

  return (
    <div className="flex flex-col px-4 py-2 border-b border-slate-200 bg-white flex-shrink-0">
      {/* Buttons row */}
      <div className="flex items-center justify-between">
        {/* File name */}
        <span className="text-sm font-medium text-slate-900 truncate max-w-[200px]">
          {selectedFilename || 'No file selected'}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-2">
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
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-rose-200 cursor-pointer text-xs font-semibold transition-all duration-120 bg-white text-rose-600 hover:bg-rose-50 hover:border-rose-300"
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
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border cursor-pointer text-xs font-semibold transition-all duration-120 ${
                showJsonViewer
                  ? 'bg-slate-800 text-white border-slate-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title="View generated analysis JSON"
            >
              View JSON
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
              New
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
