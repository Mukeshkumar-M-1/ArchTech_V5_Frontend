import { create } from 'zustand';

const useKnowledgeStore = create((set, get) => ({
  // Data
  knowledgeList: [],
  customSections: ['Communication Protocols', 'Power Systems', 'Safety Standards'], // Defaults

  // Memory Files (new)
  memoryFiles: [],           // file tree from knowledge-files API
  selectedFilePath: null,    // currently viewed file path
  fileContent: '',           // markdown content of selected file
  fileTreeLoading: false,    // loading state for tree fetch
  memoryProgress: null,      // { status, progress, phase }
  detailMode: 'preview',     // 'preview' | 'edit'
  fullScreen: false,         // fullscreen editor mode

  // View State
  viewMode: 'table', // 'table' or 'grid'
  selectedDoc: null,
  
  // Filters
  searchQuery: '',
  filterSection: 'All',
  filterTags: [],
  filterType: 'All',
  
  // Upload State
  uploadFiles: [], // { file: File, section: string, tags: string[], status: 'pending'|'uploading'|'success'|'error' }
  isUploading: false,

  // Actions
  setKnowledgeList: (list) => set({ knowledgeList: list }),

  // Memory file actions
  setMemoryFiles: (files) => set({ memoryFiles: files }),
  setSelectedFilePath: (path) => set({ selectedFilePath: path }),
  setFileContent: (content) => set({ fileContent: content }),
  setFileTreeLoading: (loading) => set({ fileTreeLoading: loading }),
  setMemoryProgress: (progress) => set({ memoryProgress: progress }),
  setDetailMode: (mode) => set({ detailMode: mode }),
  setFullScreen: (fs) => set({ fullScreen: fs }),
  
  addCustomSection: (section) => set((state) => {
    if (!state.customSections.includes(section)) {
      return { customSections: [...state.customSections, section] };
    }
    return state;
  }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedDoc: (doc) => set({ selectedDoc: doc }),
  
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterSection: (section) => set({ filterSection: section }),
  setFilterTags: (tags) => set({ filterTags: tags }),
  setFilterType: (type) => set({ filterType: type }),
  
  // Upload Queue Management
  addUploadFiles: (files) => {
    const state = get();
    const ALLOWED_EXTS = ['PDF', 'DOCX', 'MD', 'TXT', 'ODT'];
    
    // Create unique keys for files already in the queue
    const existingKeys = new Set(state.uploadFiles.map(f => `${f.name}-${f.size}`));
    
    let addedCount = 0;
    let skippedDuplicates = 0;
    let skippedInvalidType = 0;
    
    const newFileEntries = [];

    files.forEach(f => {
      const ext = f.name.split('.').pop().toUpperCase();
      const isDuplicate = existingKeys.has(`${f.name}-${f.size}`);
      const isInvalid = !ALLOWED_EXTS.includes(ext);

      if (isDuplicate) {
        skippedDuplicates++;
      } else if (isInvalid) {
        skippedInvalidType++;
      } else {
        newFileEntries.push({
          file: f,
          name: f.name,
          size: f.size,
          type: ext,
          section: 'Datasheets',
          tags: [],
          status: 'pending'
        });
        addedCount++;
      }
    });

    if (newFileEntries.length > 0) {
      set({ uploadFiles: [...state.uploadFiles, ...newFileEntries] });
    }

    return { addedCount, skippedDuplicates, skippedInvalidType };
  },
  
  removeUploadFile: (index) => set((state) => {
    const newFiles = [...state.uploadFiles];
    newFiles.splice(index, 1);
    return { uploadFiles: newFiles };
  }),
  
  updateUploadFile: (index, updates) => set((state) => {
    const newFiles = [...state.uploadFiles];
    newFiles[index] = { ...newFiles[index], ...updates };
    return { uploadFiles: newFiles };
  }),
  
  clearUploads: () => set({ uploadFiles: [] }),
  setIsUploading: (status) => set({ isUploading: status }),
}));

export default useKnowledgeStore;
