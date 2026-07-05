import React, { useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router-dom';
import { 
  BarChart3, 
  Cpu, 
  Code2, 
  Settings, 
  ChevronRight, 
  ChevronLeft,
  FileText, 
  LogOut,
  Layers,
  Bell,
  Search,
  Database,
  Menu
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function WorkspaceLayout({ project }) {
  const { workspaceType } = useParams();

  // Lifted parallel document states
  const [syrsDoc, setSyrsDoc] = useState('# System Requirements Specification (SyRS)\n\nGenerated template for SyRS.');
  const [archDoc, setArchDoc] = useState('# System Architecture Description\n\nGenerated template for Architecture.');
  const [hrsDoc, setHrsDoc] = useState('# Hardware Requirements Specification (HRS)\n\nGenerated template for HRS.');
  const [schemaDoc, setSchemaDoc] = useState('# Hardware Schematics Baseline\n\nGenerated template for Schematics.');
  const [srsDoc, setSrsDoc] = useState('# Software Requirements Specification (SRS)\n\nGenerated template for SRS.');
  const [sddDoc, setSddDoc] = useState('# Software Design Description (SDD)\n\nGenerated template for SDD.');

  const [isGenerating, setIsGenerating] = useState({ syrs: false, arch: false, hrs: false, schema: false, srs: false, sdd: false });
  
  // Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const workspaceNames = {
    requirements: 'Requirements Dashboard',
    system: 'System Architecture Workspace',
    hardware: 'Hardware Requirements Specification (HRS)',
    software: 'Software Requirements & Code Suite',
    traceability: 'Bi-Traceability Workspace',
    knowledge: 'Central Intelligence Knowledge Base'
  };

  const navItems = [
    { id: 'requirements', label: 'Data Extraction', icon: FileText, path: '/workspace/requirements' },
    { id: 'knowledge', label: 'Memory Management', icon: Database, path: '/workspace/Memory' },
    // { id: 'system', label: 'System Architecture', icon: Layers, path: '/workspace/system' },
    // { id: 'hardware', label: 'Hardware HRS', icon: Cpu, path: '/workspace/hardware' },
    { id: 'software', label: 'Software SRS/SDD', icon: Code2, path: '/workspace/software' },
    // { id: 'traceability', label: 'Bi-Traceability', icon: BarChart3, path: '/workspace/traceability' },
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-black font-sans">
      {/* Premium Light Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-[300px]' : 'w-[88px]'
        } bg-white flex flex-col py-6 px-4 border-r border-slate-100 z-20 shadow-2xl transition-all duration-300 relative`}
      >
        {/* Toggle Button */}
        <button 
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="absolute -right-3 top-8 bg-white border border-slate-200 text-slate-500 rounded-full p-1.5 hover:text-primary-500 hover:border-primary-500 shadow-sm transition-all z-50 focus:outline-none"
        >
          {isSidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className={`flex items-center gap-3 mb-12 ${isSidebarOpen ? 'px-2' : 'px-1 justify-center'}`}>
          <div className="min-w-[40px] w-10 h-10 bg-primary-500 rounded-xl flex items-center justify-center text-white font-black text-xl shadow-[0_0_20px_rgba(59,130,246,0.4)] shrink-0">
            A
          </div>
          {isSidebarOpen && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="flex flex-col whitespace-nowrap overflow-hidden"
            >
              <span className="font-extrabold text-lg tracking-tighter text-slate-900 leading-tight">ArchTech AI</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-black text-primary-500">Systems Core</span>
            </motion.div>
          )}
        </div>

        <div className="mb-10 overflow-hidden">
          {isSidebarOpen && (
             <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4 pl-2 whitespace-nowrap">Domains / Workspaces</p>
          )}
          <div className="flex flex-col gap-2">
            {navItems.map((item) => (
              <NavLink
                key={item.id}
                to={item.path}
                className={({ isActive }) => 
                  `group flex items-center gap-3 ${isSidebarOpen ? 'px-3 py-3' : 'p-3 justify-center'} rounded-xl text-sm font-semibold transition-all duration-300 ${
                    isActive 
                      ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30' 
                      : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
                  }`
                }
                title={!isSidebarOpen ? item.label : undefined}
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1.5 rounded-lg transition-colors shrink-0 ${isActive ? 'bg-white/20' : 'bg-slate-100 group-hover:bg-primary-50 group-hover:text-primary-500'}`}>
                      <item.icon size={18} />
                    </div>
                    {isSidebarOpen && (
                      <>
                        <span className="flex-1 whitespace-nowrap">{item.label}</span>
                        <ChevronRight size={14} className={`shrink-0 transition-transform ${isActive ? 'opacity-100 translate-x-1' : 'opacity-0 -translate-x-2 group-hover:opacity-40 group-hover:translate-x-0'}`} />
                      </>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        <div className="mt-auto overflow-hidden">
          {isSidebarOpen ? (
            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm mb-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Authenticated Session</p>
              <div className="font-bold text-sm text-slate-900 truncate relative z-10">{project?.name || 'Gateway Node B'}</div>
              <div className="text-xs font-mono text-primary-500 mt-1 relative z-10">{project?.id || 'ARCH-2026-X1'}</div>
            </div>
          ) : (
            <div className="w-10 h-10 mx-auto bg-slate-50 rounded-full border border-slate-200 flex items-center justify-center text-slate-900 font-bold shadow-sm mb-6 shrink-0" title="Gateway Node B">
              GB
            </div>
          )}
          
          <div className={`flex items-center gap-3 ${isSidebarOpen ? '' : 'flex-col'}`}>
            <button 
              className={`flex items-center justify-center gap-2 py-3 bg-primary-500 text-white rounded-xl text-xs font-bold hover:bg-primary-400 transition-all duration-300 shadow-[0_0_15px_rgba(59,130,246,0.3)] hover:shadow-[0_0_25px_rgba(59,130,246,0.5)] ${isSidebarOpen ? 'flex-1 px-4' : 'w-10 h-10 p-0 rounded-full'}`}
              title={!isSidebarOpen ? 'Sign Out' : undefined}
            >
              <LogOut size={isSidebarOpen ? 14 : 16} />
              {isSidebarOpen && <span className="whitespace-nowrap">Sign Out</span>}
            </button>
            <button 
              className={`p-3 bg-white border border-slate-200 rounded-xl text-slate-500 hover:text-slate-900 hover:border-slate-300 hover:bg-slate-50 transition-all duration-300 shadow-sm shrink-0 ${isSidebarOpen ? '' : 'w-10 h-10 rounded-full flex items-center justify-center p-0'}`}
              title={!isSidebarOpen ? 'Settings' : undefined}
            >
              <Settings size={18} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Stage */}
      <main className="flex-1 bg-white relative overflow-y-auto">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.03),transparent_70%)] pointer-events-none"></div>
        
        <div className="p-8 lg:p-12">
          {/* Content View */}
          <motion.div 
            key={workspaceType}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="min-h-0 relative z-10"
          >
            <Outlet context={{
              syrsDoc, setSyrsDoc,
              archDoc, setArchDoc,
              hrsDoc, setHrsDoc,
              schemaDoc, setSchemaDoc,
              srsDoc, setSrsDoc,
              sddDoc, setSddDoc,
              isGenerating, setIsGenerating
            }} />
          </motion.div>
        </div>
      </main>
    </div>
  );
}
