import { create } from 'zustand';

const useGenerationStore = create((set, get) => ({
  isGenerating: false,
  status: 'idle',
  progress: 0,
  phase: '',
  sectionCurrent: 0,
  sectionTotal: 0,
  executionLog: [],
  currentTurn: 0,
  error: null,
  docContent: '',

  setGenerating: (status) => set({ isGenerating: status }),
  setProgressStatus: (status) => set({ status }),
  setProgress: (val) => set((state) => {
    const next = typeof val === 'function' ? val(state) : val;
    return { ...state, ...next };
  }),
  setPhase: (phase) => set({ phase }),
  setSectionProgress: (current, total) => set({ sectionCurrent: current, sectionTotal: total }),
  setExecutionLog: (val) => set((state) => {
    const next = typeof val === 'function' ? val(state.executionLog) : val;
    return { executionLog: next };
  }),
  setCurrentTurn: (turn) => set({ currentTurn: turn }),
  setError: (err) => set({ error: err }),
  setDocContent: (content) => set({ docContent: content }),
  resetGeneration: () => set({
    isGenerating: false,
    status: 'idle',
    progress: 0,
    phase: '',
    sectionCurrent: 0,
    sectionTotal: 0,
    executionLog: [],
    currentTurn: 0,
    error: null,
    docContent: '',
  }),
}));

export default useGenerationStore;
