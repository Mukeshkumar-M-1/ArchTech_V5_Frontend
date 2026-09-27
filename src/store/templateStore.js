import { create } from 'zustand';

/**
 * Global store for template section generation progress.
 * Lives outside the component tree so progress survives
 * sub-tab switches (TemplatePanel unmount/remount).
 */
const useTemplateStore = create((set) => ({
  projectId: null,   // project the current generation belongs to
  isGenerating: false,
  progress: null,    // raw fetchProgress payload: { status, progress, phase, error, ... }

  setProjectId: (projectId) => set({ projectId }),
  setIsGenerating: (isGenerating) => set({ isGenerating }),
  setProgress: (progressPayload) => set({ progress: progressPayload }),
  resetTemplateProgress: () => set({ projectId: null, isGenerating: false, progress: null }),
}));

export default useTemplateStore;
