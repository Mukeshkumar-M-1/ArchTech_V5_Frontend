import { ChevronRight, Bot } from 'lucide-react';

export default function GuideSidebarList({ pages, activeId, onSelect }) {
  return (
    <aside className="w-[300px] shrink-0 bg-white flex flex-col border-r border-slate-100 z-20 shadow-sm">
      {/* Brand */}
      <div className="px-5 pt-6 pb-10 flex items-center gap-3">
        <div className="min-w-[40px] w-10 h-10 bg-primary-50 border border-primary-200 rounded-lg flex items-center justify-center text-accent shadow-sm shadow-primary-500/10 shrink-0">
          <Bot size={20} />
        </div>
        <div className="flex flex-col whitespace-nowrap overflow-hidden">
          <span className="flex items-center gap-2">
            <span className="font-extrabold text-lg tracking-tighter text-slate-900 leading-tight">
              SDG <span className="text-primary-500">AI</span>
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-primary-600 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-full">
              Beta v1
            </span>
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Guide / Manual
          </span>
        </div>
      </div>

      <p className="px-7 mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
        Contents
      </p>

      <nav className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-1.5">
        {pages.map((page) => {
          const isActive = page.id === activeId;
          return (
            <button
              key={page.id}
              onClick={() => onSelect(page.id)}
              className={`group flex items-center gap-2 w-full px-3 py-3 rounded-xl text-sm font-semibold text-left transition-all duration-300 ${
                isActive
                  ? 'bg-slate-200 text-slate-800'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex-1 whitespace-nowrap">{page.title}</span>
              <ChevronRight
                size={14}
                className={`shrink-0 transition-transform ${
                  isActive
                    ? 'opacity-100 translate-x-1'
                    : 'opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0'
                }`}
              />
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
