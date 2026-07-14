import { ShieldCheck } from 'lucide-react';
import { SUB_TABS } from './types';
import TemplatePanel from './TemplatePanel';
import GenerationPanel from './GenerationPanel';

/**
 * EditorPanel - Routes to either the TemplatePanel (for editing) or GenerationPanel (for viewing).
 * All template CRUD and generation state is managed internally by TemplatePanel.
 * @param {Object} props
 * @param {string} props.activeMainTab - Current main tab (srs/sdd).
 * @param {string} props.subTab - Current sub-tab (document-template / document-generation).
 * @param {(tab: string) => void} props.onSubTabChange - Sub-tab change callback.
 * @param {boolean} props.isFullscreen - Whether the panel is in fullscreen mode.
 * @param {() => void} props.onFullscreenToggle - Toggle fullscreen callback.
 * @param {(type: string) => void} props.onGenerate - Document generation callback.
 * @param {boolean} props.isGenActive - Whether generation is in progress.
 * @param {string} props.srsDoc - Generated SRS document content.
 * @param {Object} [props.project] - Active project object.
 * @param {Array} props.selectedChatBlocks
 * @param {Function} props.setSelectedChatBlocks
 */
export default function EditorPanel({
  activeMainTab, subTab, onSubTabChange,
  isFullscreen, onFullscreenToggle, onGenerate, isGenActive, srsDoc, setSrsDoc, onCancel,
  project, selectedChatBlocks, setSelectedChatBlocks
}) {
  const isSdd = activeMainTab === 'sdd';

  return (
    <div className={isFullscreen
      ? 'fixed inset-6 z-[100] bg-white/95 backdrop-blur-xl rounded-[32px] border border-slate-200/80 shadow-2xl shadow-slate-300/40'
      : 'flex-1 flex overflow-hidden min-h-0 relative'}
    >
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-white">
        {/* Sub-Tab Selector */}
        <div className="flex items-center gap-1 bg-slate-50/80 backdrop-blur-md px-6 py-3 border-b border-slate-200/60 shadow-sm relative z-20">
          {SUB_TABS.map((sub) => (
            <button
              key={sub.id}
              onClick={() => onSubTabChange(sub.id)}
              className={`group relative flex items-center gap-2.5 px-5 py-2.5 rounded-[14px] cursor-pointer text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${
                subTab === sub.id
                  ? 'bg-white text-primary-600 shadow-md shadow-slate-200/50 scale-105 z-10 border-slate-200'
                  : 'bg-transparent text-slate-500 hover:bg-white/60 hover:text-slate-800 border-transparent'
              }`}
            >
              <span className={`transition-transform duration-300 ${subTab === sub.id ? 'text-primary-600 scale-110' : 'text-slate-400 group-hover:scale-110'}`}>
                {sub.icon}
              </span>
              {sub.label}
            </button>
          ))}
        </div>

        {/* Editor Body */}
        <div className="flex flex-1 overflow-hidden">
          {isSdd ? (
            <div className="flex flex-1 flex-col items-center justify-center text-slate-400">
              <ShieldCheck size={40} className="opacity-30 mb-4" />
              <div className="text-base font-semibold">SDD Generation</div>
              <div className="text-sm mt-1">Coming soon</div>
            </div>
          ) : subTab === 'document-template' ? (
            <TemplatePanel 
              project={project} 
              selectedChatBlocks={selectedChatBlocks}
              setSelectedChatBlocks={setSelectedChatBlocks}
            />
          ) : (
            <GenerationPanel
              srsDoc={srsDoc}
              setSrsDoc={setSrsDoc}
              isGenActive={isGenActive}
              activeMainTab={activeMainTab}
              project={project}
              onCancel={onCancel}
              selectedChatBlocks={selectedChatBlocks}
              setSelectedChatBlocks={setSelectedChatBlocks}
            />
          )}
        </div>
      </div>
    </div>
  );
}
