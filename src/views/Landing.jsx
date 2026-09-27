import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  ArrowRight,
  Plus,
  FolderOpen,
  RotateCcw,
  Clock,
  HardDrive,
  Trash2,
  Bot,
  Sparkles,
  MessageSquare
} from 'lucide-react';
import useToastStore from '../store/toastStore';
import { getApiUrl } from '../utils/apiConfig';

const formatModifiedAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatProjectSize = (bytes) => {
  if (bytes === null || bytes === undefined) return null;
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
};

function TabPill({ icon: TabIcon, label, isActive, onSelect, count }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-[12px] text-xs font-black uppercase tracking-wider transition-all ${
        isActive
          ? 'bg-white shadow-md text-blue-600'
          : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <TabIcon size={15} />
      {label}
      {typeof count === 'number' && (
        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none ${
          isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'
        }`}>
          {count}
        </span>
      )}
    </button>
  );
}

export default function Landing({ onProjectCreate }) {
  const { addToast } = useToastStore();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('create');
  const [formData, setFormData] = useState({ productId: '', name: '', id: '' });
  const [isUploading, setIsUploading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [existingProjects, setExistingProjects] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [projectListError, setProjectListError] = useState(null);
  const [loadingProjectId, setLoadingProjectId] = useState(null);
  const [deletingProjectId, setDeletingProjectId] = useState(null);
  const [pendingDeleteProject, setPendingDeleteProject] = useState(null);

  const fetchExistingProjects = async () => {
    setIsLoadingProjects(true);
    setProjectListError(null);
    try {
      const projectsResponse = await fetch(getApiUrl('/projects'));
      if (!projectsResponse.ok) {
        throw new Error(`Server responded with status ${projectsResponse.status}`);
      }
      const projectsPayload = await projectsResponse.json();
      setExistingProjects(projectsPayload.projects || []);
    } catch (fetchError) {
      setProjectListError(fetchError.message);
      addToast(`Failed to fetch projects: ${fetchError.message}`, 'error');
    } finally {
      setIsLoadingProjects(false);
    }
  };

  const handleTabSelect = (selectedTab) => {
    setActiveTab(selectedTab);
    if (selectedTab === 'load' && existingProjects.length === 0 && !projectListError) {
      fetchExistingProjects();
    }
  };

  const handleRetryFetchProjects = () => {
    fetchExistingProjects();
  };

  useEffect(() => {
    fetchExistingProjects();
  }, []);

  const handleCreateProject = async (submitEvent) => {
    submitEvent.preventDefault();
    if (!formData.productId || !formData.name || !formData.id) {
      addToast(`Please fill in all fields.`, 'error');
      return;
    }

    if (!/^[a-zA-Z0-9-]+$/.test(formData.productId)) {
      addToast(`Product ID may contain only letters, numbers and hyphens (-) — no spaces or special characters.`, 'error');
      return;
    }

    if (!/^[a-zA-Z0-9-]+$/.test(formData.id)) {
      addToast(`Board ID may contain only letters, numbers and hyphens (-) — no spaces or special characters.`, 'error');
      return;
    }

    setIsUploading(true);
    setLoadingStage('Validating Board ID...');

    try {
      const projectsResponse = await fetch(getApiUrl('/projects'));
      if (projectsResponse.ok) {
        const projectsPayload = await projectsResponse.json();
        const projects = projectsPayload.projects || [];
        setExistingProjects(projects);
        if (projects.some(project => project.project_id === formData.id)) {
          addToast(`Board ID "${formData.id}" already exists. Please choose a different Board ID.`, 'error');
          setIsUploading(false);
          setLoadingStage('');
          return;
        }
      }
    } catch (validationError) {
      // Registry check is best-effort — fall through and let /init-project decide.
    }

    setLoadingStage('Initializing Workspace...');

    try {
      const initResponse = await fetch(getApiUrl('/init-project'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: formData.id, name: formData.name, product_id: formData.productId }),
      });
      if (!initResponse.ok) {
        throw new Error(`Server responded with status ${initResponse.status}`);
      }
    } catch (initError) {
      addToast(`Failed to initialize workspace: ${initError.message}`, 'error');
      setIsUploading(false);
      return;
    }

    onProjectCreate({
      id: formData.id,
      name: formData.name,
      productId: formData.productId
    });

    setIsUploading(false);
    navigate(`/workspace/requirements`);
  };

  const handleLoadProject = async (selectedProjectId) => {
    setLoadingProjectId(selectedProjectId);
    try {
      const loadResponse = await fetch(getApiUrl('/load-project'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project_id: selectedProjectId }),
      });
      if (!loadResponse.ok) {
        const errorPayload = await loadResponse.json().catch(() => null);
        throw new Error(errorPayload?.detail || `Server responded with status ${loadResponse.status}`);
      }
      const loadPayload = await loadResponse.json();
      onProjectCreate({
        id: loadPayload.project_id,
        name: loadPayload.name,
        productId: loadPayload.product_id
      });
      navigate(`/workspace/requirements`);
    } catch (loadError) {
      addToast(`Failed to load project: ${loadError.message}`, 'error');
    } finally {
      setLoadingProjectId(null);
    }
  };

  const handleDeleteProject = async (project) => {
    setDeletingProjectId(project.project_id);
    try {
      const deleteResponse = await fetch(getApiUrl(`/projects/${encodeURIComponent(project.project_id)}`), {
        method: 'DELETE',
      });
      if (!deleteResponse.ok) {
        const errorPayload = await deleteResponse.json().catch(() => null);
        throw new Error(errorPayload?.detail || `Server responded with status ${deleteResponse.status}`);
      }
      setExistingProjects(projects => projects.filter(p => p.project_id !== project.project_id));
      addToast(`Project "${project.name}" deleted.`, 'success');
    } catch (deleteError) {
      addToast(`Failed to delete project: ${deleteError.message}`, 'error');
    } finally {
      setDeletingProjectId(null);
      setPendingDeleteProject(null);
    }
  };

  return (
    <div className="h-screen w-full bg-[#f8fafc] flex items-center justify-center p-4">
      {/* Mesh Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-100 rounded-full blur-[120px] opacity-40"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-indigo-100 rounded-full blur-[100px] opacity-30"></div>
      </div>

      <div className="max-w-5xl w-full flex flex-col md:flex-row bg-white rounded-[32px] shadow-2xl border border-slate-200 overflow-hidden relative z-10 transition-all">

        {/* Left Side: App Context */}
        <div className="w-full md:w-[45%] bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-[-50px] right-[-50px] w-64 h-64 bg-blue-500/20 rounded-full blur-3xl"></div>

          <div>
            <div className="flex items-center gap-3 mb-10">
              <motion.div
                className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-slate-900 shadow-lg shadow-blue-500/30"
                animate={{
                  y: [0, -4, 0, -2, 0],
                  rotate: [0, -3, 0, 3, 0],
                  boxShadow: [
                    '0 0 0px rgba(59,130,246,0.3)',
                    '0 0 18px rgba(59,130,246,0.5)',
                    '0 0 0px rgba(59,130,246,0.3)'
                  ]
                }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Bot size={24} strokeWidth={2.5} />
              </motion.div>
              <span className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-tighter uppercase whitespace-nowrap">SDG AI</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-blue-300 bg-blue-500/10 border border-blue-400/30 px-2 py-0.5 rounded-full">Beta v1</span>
              </span>
            </div>

            <h1 className="text-4xl font-extrabold leading-tight mb-6">
              AI-Generated <br />
              <span className="text-blue-400">Software Documents</span>
            </h1>

            <div className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/10 rounded-lg text-blue-400"><Sparkles size={20} /></div>
                <span className="text-sm font-bold text-slate-300">AI-Assisted Software LifeCycle</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/10 rounded-lg text-indigo-400"><ClipboardList size={20} /></div>
                <span className="text-sm font-bold text-slate-300">Requirement Gathering / Analysis</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="p-2 bg-white/10 rounded-lg text-violet-400"><MessageSquare size={20} /></div>
                <span className="text-sm font-bold text-slate-300">Interactive Chatbot for Document Generation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Action Area */}
        <div className="flex-1 p-12 bg-white flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="flex items-center gap-2 text-blue-600 font-black text-[10px] uppercase tracking-[0.3em] mb-2">Get Started</div>
            <h2 className="text-2xl font-black text-slate-900 mb-6 tracking-tight">
              {activeTab === 'create' ? 'Create your first project' : 'Load an existing project'}
            </h2>

            {/* Tab Switcher */}
            <div className="flex gap-1 p-1.5 rounded-[16px] border border-slate-200 bg-slate-100 mb-8">
              <TabPill
                icon={Plus}
                label="Create Project"
                isActive={activeTab === 'create'}
                onSelect={() => handleTabSelect('create')}
              />
              <TabPill
                icon={FolderOpen}
                label="Load Project"
                isActive={activeTab === 'load'}
                onSelect={() => handleTabSelect('load')}
                count={isLoadingProjects ? null : existingProjects.length}
              />
            </div>

            {activeTab === 'create' ? (
              <form onSubmit={handleCreateProject} className="space-y-6 animate-fade-in">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400 uppercase ml-1 tracking-widest">Project Identification</label>
                  <div className="relative">
                    <input
                      type="text"
                      className="premium-input bg-slate-50 pr-[15px]"
                      placeholder="Product ID (e.g. YEAXXX)"
                      maxLength={15}
                      value={formData.productId}
                      onChange={productIdChangeEvent => setFormData({ ...formData, productId: productIdChangeEvent.target.value })}
                      required
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black pointer-events-none bg-slate-200 rounded-full px-1.5 py-0.5 text-slate-400">
                      {15 - formData.productId.length}
                    </span>
                  </div>
                  <div className="relative mt-2">
                    <input
                      type="text"
                      className="premium-input bg-slate-50 pr-[15px]"
                      placeholder="Project Name (e.g. IRST)"
                      maxLength={24}
                      value={formData.name}
                      onChange={nameChangeEvent => setFormData({ ...formData, name: nameChangeEvent.target.value })}
                      required
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black pointer-events-none bg-slate-200 rounded-full px-1.5 py-0.5 text-slate-400">
                      {24 - formData.name.length}
                    </span>
                  </div>
                  <div className="relative mt-2">
                    <input
                      type="text"
                      className="premium-input bg-slate-50 pr-[15px]"
                      placeholder="Board ID (e.g. DP-XXX-XXXX)"
                      maxLength={15}
                      value={formData.id}
                      onChange={idChangeEvent => setFormData({ ...formData, id: idChangeEvent.target.value })}
                      required
                    />
                    <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] font-black pointer-events-none bg-slate-200 rounded-full px-1.5 py-0.5 text-slate-400">
                      {15 - formData.id.length}
                    </span>
                  </div>
                </div>

                {isUploading ? (
                  <div className="mt-4 p-6 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-2 animate-fade-in shadow-inner">
                    <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Backend Ingestion</span>
                    <span className="text-xs font-bold text-slate-700">{loadingStage}</span>
                  </div>
                ) : (
                  <button type="submit" className="btn-launch mt-4 py-4">
                    Create Project
                    <ArrowRight size={20} />
                  </button>
                )}
              </form>
            ) : (
              <div className="animate-fade-in">
                {isLoadingProjects ? (
                  <div className="p-8 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-2 shadow-inner">
                    <div className="w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Fetching Projects</span>
                  </div>
                ) : projectListError ? (
                  <div className="p-8 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-inner">
                    <span className="text-xs font-bold text-slate-700">Could not fetch your projects.</span>
                    <button
                      type="button"
                      onClick={handleRetryFetchProjects}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                    >
                      <RotateCcw size={14} />
                      Retry
                    </button>
                  </div>
                ) : existingProjects.length === 0 ? (
                  <div className="p-8 bg-slate-50 border border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center gap-3 shadow-inner">
                    <div className="p-3 bg-slate-200/60 rounded-2xl text-slate-400"><FolderOpen size={24} /></div>
                    <span className="text-xs font-bold text-slate-700">No projects yet.</span>
                    <span className="text-[11px] font-bold text-slate-400">Create your first project to get started.</span>
                    <button
                      type="button"
                      onClick={() => handleTabSelect('create')}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-700 transition-colors"
                    >
                      <Plus size={14} />
                      Create Project
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                    {existingProjects.map(existingProject => {
                      const modifiedAt = formatModifiedAt(existingProject.updated_at);
                      const projectSize = formatProjectSize(existingProject.size);
                      return (
                      <div
                        key={existingProject.project_id}
                        role="button"
                        tabIndex={0}
                        onClick={() => loadingProjectId === null && handleLoadProject(existingProject.project_id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && loadingProjectId === null) handleLoadProject(existingProject.project_id); }}
                        className={`w-full flex items-center justify-between gap-4 p-4 rounded-2xl border text-left transition-all group cursor-pointer ${
                          loadingProjectId === existingProject.project_id
                            ? 'border-blue-400 bg-blue-50/50'
                            : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-md'
                        } ${loadingProjectId !== null ? 'opacity-60 pointer-events-none' : ''}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="p-2 bg-slate-100 rounded-xl text-blue-600 shrink-0"><FolderOpen size={16} /></div>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-slate-900 truncate">{existingProject.name}</div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-black uppercase tracking-wider text-purple-600 bg-purple-50 border border-purple-100 px-1.5 py-0.5 rounded-full font-mono truncate shrink-0">
                                {existingProject.project_id}
                              </span>
                              {existingProject.product_id && (
                                <span className="text-[9px] font-black uppercase tracking-wider text-blue-600 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full shrink-0">
                                  {existingProject.product_id}
                                </span>
                              )}
                            </div>
                            {(modifiedAt || projectSize) && (
                              <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 mt-0.5">
                                {modifiedAt && (
                                  <>
                                    <Clock size={10} className="shrink-0" />
                                    <span className="truncate">Modified {modifiedAt}</span>
                                  </>
                                )}
                                {modifiedAt && projectSize && <span className="text-slate-300">·</span>}
                                {projectSize && (
                                  <>
                                    <HardDrive size={10} className="shrink-0" />
                                    <span className="truncate">{projectSize}</span>
                                  </>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {deletingProjectId === existingProject.project_id ? (
                            <div className="w-5 h-5 border-[3px] border-red-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setPendingDeleteProject(existingProject); }}
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title={`Delete project "${existingProject.name}"`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {loadingProjectId === existingProject.project_id ? (
                            <div className="w-5 h-5 border-[3px] border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                          )}
                        </div>
                      </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Delete Project Confirmation Dialog */}
      {pendingDeleteProject && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/20">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="bg-white rounded-3xl shadow-2xl border border-slate-200/60 w-full max-w-md overflow-hidden"
          >
            <div className="p-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-red-400 to-red-600 flex items-center justify-center shadow-lg shadow-red-200/50">
                <Trash2 size={28} className="text-white" />
              </div>

              <h3 className="text-xl font-black text-slate-900 mb-2">Delete Project?</h3>
              <p className="text-sm text-slate-500 mb-1">
                The project "{pendingDeleteProject.name}" ({pendingDeleteProject.project_id}) and all of its data will be permanently deleted from disk.
              </p>
              <p className="text-[11px] text-slate-400">
                This action cannot be undone.
              </p>
            </div>

            <div className="px-8 pb-8 flex items-center gap-3">
              <button
                onClick={() => setPendingDeleteProject(null)}
                className="flex-1 px-5 py-3 bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteProject(pendingDeleteProject)}
                className="flex-1 px-5 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white text-xs font-black uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-red-200/50 hover:shadow-red-300/50 active:scale-95"
              >
                Yes, Delete
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
