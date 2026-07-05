import { useState } from 'react';
import { FileText, Plus, Loader2, Trash2, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * SectionList - Renders the left-panel file list for template sections.
 * Each row shows a file with its section number and a prominent MEM indicator:
 *   - Green with glow = generated
 *   - Red = not generated
 * @param {Object} props
 * @param {Array<{filename: string, title: string, section_number: number, is_generated: boolean}>} props.sections
 * @param {string} props.selectedFilename
 * @param {(filename: string) => void} props.onSelect
 * @param {(filename: string) => void} props.onDelete
 * @param {() => void} props.onAddClick
 * @param {boolean} props.loading
 */
export default function SectionList({ sections, selectedFilename, onSelect, onDelete, onAddClick, loading }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  if (loading) {
    return (
      <div className={`border-r border-slate-200 bg-white flex-shrink-0 flex items-center justify-center transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
        <Loader2 size={14} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className={`border-r border-slate-100 bg-white/50 backdrop-blur-md flex-shrink-0 overflow-y-auto flex flex-col z-10 relative transition-all duration-300 ${isCollapsed ? 'w-16' : 'w-64'}`}>
      {/* Header */}
      <div className={`flex h-16 items-center border-b border-slate-100 bg-white/80 backdrop-blur-xl sticky top-0 z-20 overflow-hidden ${isCollapsed ? 'px-4 py-5 justify-center' : 'px-4 py-5 justify-between'}`}>
        {!isCollapsed && (
          <span className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] flex items-center gap-2 shrink-0">
            <BookOpen size={14} className="text-primary-500" />
            Template
          </span>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors shrink-0"
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* File list */}
      <div className="p-3">
        {sections.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center shadow-inner">
              <FileText size={20} className="text-slate-300" />
            </div>
            {!isCollapsed && (
              <>
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400 mt-4">No sections</p>
                <p className="text-[10px] font-semibold text-slate-400 mt-1.5">Click + New to create one</p>
              </>
            )}
          </div>
        ) : (
          sections.map((s) => (
            <div
              key={s.filename}
              className={`group flex items-center cursor-pointer transition-all duration-300 ${
                isCollapsed 
                  ? 'justify-center mb-3 w-10 h-10' 
                  : `justify-between px-3 py-2.5 rounded-xl mb-2 border ${
                      selectedFilename === s.filename
                        ? 'bg-white shadow-md shadow-slate-200/50 border-slate-200 scale-[1.02] z-10'
                        : 'bg-transparent border-transparent hover:bg-white/60 hover:shadow-sm'
                    }`
              }`}
              onClick={() => onSelect(s.filename)}
              title={isCollapsed ? s.title : undefined}
            >
              <div className={`flex items-center overflow-hidden flex-1 min-w-0 ${isCollapsed ? 'justify-center gap-0' : 'gap-2.5'}`}>
                <div className={`flex items-center justify-center transition-all duration-300 shrink-0 ${
                  isCollapsed 
                    ? 'w-8 h-8 rounded-xl border m-2' 
                    : 'w-7 h-7 rounded-[10px] shadow-sm border border-slate-200/60'
                } ${
                  selectedFilename === s.filename 
                    ? (isCollapsed 
                        ? 'bg-gradient-to-br from-primary-500 to-primary-600 border-primary-500 shadow-lg shadow-primary-500/30 scale-100 z-20' 
                        : 'bg-primary-600')
                    : (isCollapsed 
                        ? 'bg-white border-slate-200 hover:border-primary-300 hover:shadow-md hover:scale-105' 
                        : 'bg-slate-100 group-hover:bg-primary-50')
                }`}>
                  {isCollapsed ? (
                    <span className={`text-[13px] font-black tracking-widest ${selectedFilename === s.filename ? 'text-white drop-shadow-md' : 'text-slate-500 group-hover:text-primary-600'}`}>
                      {String(s.section_number).padStart(2, '0')}
                    </span>
                  ) : (
                    <FileText size={13} className={selectedFilename === s.filename ? 'text-white' : 'text-slate-400 group-hover:text-primary-500'} />
                  )}
                </div>
                {!isCollapsed && (
                  <div className="flex flex-col overflow-hidden min-w-0 flex-1">
                    <span className={`text-[9px] font-black uppercase tracking-widest mb-0.5 transition-colors ${
                       selectedFilename === s.filename ? 'text-primary-500' : 'text-slate-400'
                    }`}>
                      Section {String(s.section_number).padStart(2, '0')}
                    </span>
                    <span className={`text-xs font-bold overflow-hidden text-ellipsis whitespace-nowrap transition-colors ${
                      selectedFilename === s.filename ? 'text-slate-900' : 'text-slate-600 group-hover:text-slate-800'
                    }`}>
                      {s.title}
                    </span>
                  </div>
                )}
              </div>
              {!isCollapsed && sections.length > 1 && (
                <span className="flex items-center gap-1 shrink-0 ml-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(s.filename); }}
                    className="border-none bg-white shadow-sm cursor-pointer p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 hover:scale-110"
                    title="Delete section"
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
