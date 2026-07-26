import { create } from 'zustand';

const useBuildCompleteStore = create((set) => ({
  activeTab: null, // 'srs' | 'sdd' | null
  setActiveTab: (tab) => set({ activeTab: tab }),
  dismiss: () => set({ activeTab: null }),
}));

export default useBuildCompleteStore;
