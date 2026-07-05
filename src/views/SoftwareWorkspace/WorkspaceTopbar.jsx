import { Bot, BookOpen, ShieldCheck, FileText, Zap } from 'lucide-react';

function TabPill({ label, icon, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-2.5 px-5 py-2.5 rounded-[14px] cursor-pointer text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
        active 
          ? 'bg-white text-primary-600 shadow-md shadow-slate-200/50 scale-105 z-10 border border-slate-100' 
          : 'bg-transparent text-slate-500 hover:bg-slate-200/40 hover:text-slate-700 border border-transparent'
      }`}
    >
      <span className={`transition-transform duration-300 ${active ? 'text-primary-600 scale-110' : 'text-slate-400 group-hover:scale-110'}`}>
        {icon}
      </span>
      {label}
      {badge && (
        <span className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-full border border-primary-200 bg-primary-50 text-primary-600 shadow-sm">
          <div className="w-1 h-1 bg-primary-500 rounded-full animate-pulse" />
          {badge}
        </span>
      )}
    </button>
  );
}

export default function WorkspaceTopbar({
  TABS, activeMainTab, isGenerating, onTabChange, chatOpen, onChatToggle
}) {
  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-slate-100 flex-shrink-0 gap-3 relative z-30 shadow-sm">
      {/* Tab pills */}
      <div className="flex items-center gap-1 bg-slate-100/50 p-1.5 rounded-[18px] border border-slate-200/60 shadow-inner">
        {TABS.map(t => (
          <TabPill
            key={t.id} label={t.label} icon={t.icon}
            active={activeMainTab === t.id}
            onClick={() => onTabChange(t.id)}
            badge={t.id === 'srs' && isGenerating ? 'live' : null}
          />
        ))}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-3">
        <button
          onClick={onChatToggle}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-[14px] cursor-pointer text-[10px] font-black uppercase tracking-widest transition-all duration-300 border ${
            chatOpen 
              ? 'bg-primary-50 text-primary-600 border-primary-200 shadow-lg shadow-primary-100'
              : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800 hover:border-slate-300 hover:shadow-md'
          }`}
        >
          <Bot size={14} className={chatOpen ? 'animate-pulse' : ''} />
          Assistant
        </button>
      </div>
    </div>
  );
}
