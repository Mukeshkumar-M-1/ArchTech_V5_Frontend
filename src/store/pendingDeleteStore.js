import { create } from 'zustand';

const usePendingDeleteStore = create((set) => ({
  filename: null,
  callback: null,
  setPending: (filename, callback) => set({ filename, callback }),
  execute: () => set((state) => {
    if (state.callback && state.filename) state.callback(state.filename);
    return { filename: null, callback: null };
  }),
  dismiss: () => set({ filename: null, callback: null }),
}));

export default usePendingDeleteStore;
