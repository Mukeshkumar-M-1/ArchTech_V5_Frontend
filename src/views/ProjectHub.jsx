import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Layers, 
  Cpu, 
  Code2, 
  ArrowRight, 
  Activity,
  History,
  ShieldCheck,
  Zap,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getApiUrl } from '../utils/apiConfig';

export default function ProjectHub({ project }) {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = React.useState(false);

  const handleGenerate = async () => {
    if (!project?.id) return;
    setIsGenerating(true);
    try {
      console.log(`[FRONTEND] Sending POST request to /api/projects/${project.id}/generate`);
      const res = await fetch(getApiUrl(`/projects/${project.id}/generate`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doc_types: ['SYRS', 'HRS', 'SRS', 'SDD'] })
      });
      console.log(`[FRONTEND] Received response: ${res.status}`);
      if (!res.ok) throw new Error('Generation failed');
      const data = await res.json();
      alert(`Synthesis Complete: Generated ${data.generated_documents.length} artifacts.`);
    } catch (err) {
      alert("Synthesis failed. Ensure Project Hub is properly synced.");
    } finally {
      setIsGenerating(false);
    }
  };

  const hubs = [
    {
      id: 'system',
      title: 'System Workspace',
      desc: 'Architectural baseline & SyRS Synthesis',
      icon: Layers,
      color: 'blue',
      path: '/workspace/system',
      tags: ['SyRS', 'Traceability', 'ODT']
    },
    {
      id: 'hardware',
      title: 'Hardware Workspace',
      desc: 'HRS generation & Block diagram parsing',
      icon: Cpu,
      color: 'indigo',
      path: '/workspace/hardware',
      tags: ['HRS', 'ICD', 'Vision AI']
    },
    {
      id: 'software',
      title: 'Software Workspace',
      desc: 'SRS refinement & Synthetic code generation',
      icon: Code2,
      color: 'violet',
      path: '/workspace/software',
      tags: ['SRS', 'SDD', 'Code Gen']
    }
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] p-12 flex flex-col items-center">
      <header className="w-full max-w-7xl flex justify-between items-end mb-16">
        <div>
           <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-[0.4em] mb-2">
             <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
             Project Dashboard Active
           </div>
           <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight">{project?.name || 'Gateway Node B'}</h1>
           <p className="text-slate-400 font-bold text-sm mt-1 uppercase tracking-widest">{project?.id || 'ARCH-2026-X1'}</p>
        </div>
        
        <div className="flex gap-4">
           <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><Zap size={20} /></div>
              <div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Health</div>
                <div className="text-sm font-bold text-slate-700">100% Synced</div>
              </div>
           </div>
           <div className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center"><History size={20} /></div>
              <div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest">Version</div>
                <div className="text-sm font-bold text-slate-700">v3.4.2-LCA</div>
              </div>
           </div>
        </div>
      </header>

      <div className="w-full max-w-7xl grid grid-cols-1 md:grid-cols-3 gap-8">
        {hubs.map((hub, i) => (
          <motion.div
            key={hub.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            onClick={() => navigate(hub.path)}
            className="group cursor-pointer"
          >
            <div className="bg-white rounded-[40px] p-10 border border-slate-100 shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-500 transform hover:-translate-y-2 flex flex-col h-full">
              <div className={`w-16 h-16 rounded-2xl bg-${hub.color}-50 text-${hub.color}-600 flex items-center justify-center mb-8 transform group-hover:scale-110 transition-transform`}>
                 <hub.icon size={32} />
              </div>

              <h2 className="text-2xl font-black text-slate-900 mb-3 tracking-tight group-hover:text-blue-600 transition-colors">{hub.title}</h2>
              <p className="text-slate-500 font-medium leading-relaxed mb-10">{hub.desc}</p>
              
              <div className="flex flex-wrap gap-2 mb-10">
                 {hub.tags.map(tag => (
                   <span key={tag} className="px-3 py-1 bg-slate-50 text-slate-400 text-[10px] uppercase font-black tracking-widest rounded-lg border border-slate-100">
                     {tag}
                   </span>
                 ))}
              </div>

              <div className="mt-auto flex items-center justify-between pt-6 border-t border-slate-50">
                 <span className="text-xs font-black text-slate-900 uppercase tracking-widest">Enter Workspace</span>
                 <div className={`p-3 rounded-xl bg-${hub.color}-600 text-white shadow-lg shadow-${hub.color}-900/20 group-hover:translate-x-2 transition-transform`}>
                    <ArrowRight size={18} />
                 </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="w-full max-w-7xl mt-12 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="p-8 bg-slate-900 rounded-[32px] text-white flex items-center justify-between shadow-2xl relative overflow-hidden">
           <div className="absolute top-[-50%] left-[-10%] w-64 h-64 bg-blue-500/10 rounded-full blur-3xl"></div>
           <div className="flex items-center gap-6 relative z-10 text-left">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-emerald-400"><ShieldCheck size={28} /></div>
              <div>
                 <h4 className="text-lg font-bold">Bi-Traceability Matrix</h4>
                 <p className="text-slate-400 text-xs font-medium">Validating cross-domain requirements.</p>
              </div>
           </div>
           <button 
              onClick={handleGenerate}
              disabled={isGenerating}
              className="px-6 py-3 bg-white text-slate-900 font-black rounded-xl text-xs shadow-xl hover:bg-blue-50 transition-all flex items-center gap-2 group disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={14} className="animate-spin text-blue-600" />
                  Generating...
                </>
              ) : (
                <>
                  Run AI Synthesis
                  <Activity size={14} className="group-hover:rotate-12" />
                </>
              )}
            </button>
        </div>

        <div className="p-8 bg-white rounded-[32px] text-slate-900 flex items-center justify-between shadow-xl border border-slate-100">
           <div className="flex items-center gap-6 text-left">
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-blue-600"><History size={28} /></div>
              <div>
                 <h4 className="text-lg font-bold text-slate-900">Import Legacy Dataset</h4>
                 <p className="text-slate-400 text-xs font-medium">Point backend to old document folders.</p>
              </div>
           </div>
           <button 
            onClick={async () => {
              const defaultPath = "Dataset";
              const path = prompt("Enter local path to Dataset folder:", defaultPath);
              if (!path) return;
              try {
                console.log(`[FRONTEND] Sending POST request to /api/reference-projects/import-path`);
                const res = await fetch(getApiUrl('/reference-projects/import-path'), {
                  method: 'POST',
                  headers: {'Content-Type': 'application/json'},
                  body: JSON.stringify({ folder_path: path })
                });
                console.log(`[FRONTEND] Received response: ${res.status}`);
                const data = await res.json();
                alert(`Successfully imported ${data.count || 0} sections from ${path}`);
              } catch (err) {
                alert("Import failed. Check if path exists on server.");
              }
            }}
            className="px-6 py-3 bg-blue-600 text-white font-black rounded-xl text-xs shadow-xl hover:bg-blue-500 transition-all flex items-center gap-2 group"
          >
              Import Data
              <ArrowRight size={14} className="group-hover:translate-x-1" />
            </button>
        </div>
      </div>
    </div>
  );
}
