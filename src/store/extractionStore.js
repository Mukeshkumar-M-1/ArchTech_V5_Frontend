import { create } from 'zustand';

const useExtractionStore = create((set, get) => ({
  // Extraction state
  isExtracting: false,
  extractionProgress: null, // { status, message, ... }
  isCancelling: false,

  // Actions
  setIsExtracting: (status) => set({ isExtracting: status }),
  setExtractionProgress: (progress) => set({ extractionProgress: progress }),
  setIsCancelling: (status) => set({ isCancelling: status }),
}));

export default useExtractionStore;
