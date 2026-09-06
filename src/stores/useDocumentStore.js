import { create } from 'zustand';

export const DocumentSyncStatus = {
    LOADING: "loading",
    SAVED: "saved",
    UNSAVED: "unsaved",
    SAVING: "saving",
    SAVE_FAILED: "save_failed",
    CONFLICT: "conflict",
    OFFLINE: "offline"
};

// Simple IndexedDB wrapper for document recovery
const DB_NAME = 'ArchTech_Documents';
const STORE_NAME = 'local_recovery';

const initDB = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'document_id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

const saveToLocal = async (document_id, version, content) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.put({
            document_id,
            version,
            content,
            local_modified_at: new Date().toISOString()
        });
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error("Local save failed", e);
    }
};

const getFromLocal = async (document_id) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(document_id);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("Local load failed", e);
        return null;
    }
};

const removeFromLocal = async (document_id) => {
    try {
        const db = await initDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.delete(document_id);
    } catch (e) {
        console.error("Local delete failed", e);
    }
};

export const useDocumentStore = create((set, get) => ({
    document: null,
    documentVersion: 0,
    syncStatus: DocumentSyncStatus.LOADING,
    hasUnsavedChanges: false,
    isLoadingDocument: false,
    isSavingDocument: false,
    lastSuccessfullySavedAt: null,
    saveError: null,
    hasLocalRecoveryCopy: false,
    
    // Save Queue
    saveQueue: [],
    
    // Actions
    setDocument: (doc) => set({ 
        document: doc, 
        documentVersion: doc.version || 0,
        syncStatus: DocumentSyncStatus.SAVED,
        hasUnsavedChanges: false,
        isLoadingDocument: false,
        isSavingDocument: false,
        lastSuccessfullySavedAt: doc.updated_at || new Date().toISOString(),
        saveError: null
    }),

    markUnsaved: (newContent) => {
        set({ 
            hasUnsavedChanges: true, 
            syncStatus: DocumentSyncStatus.UNSAVED,
            document: { ...get().document, content: newContent }
        });
        // Optimistically save to local recovery
        const doc = get().document;
        if (doc?.id) {
            saveToLocal(doc.id, get().documentVersion, newContent);
        }
    },

    setSyncStatus: (status, error = null) => set({ 
        syncStatus: status, 
        saveError: error,
        isSavingDocument: status === DocumentSyncStatus.SAVING,
        isLoadingDocument: status === DocumentSyncStatus.LOADING
    }),

    queueSave: async (saveFunction) => {
        const state = get();
        const queue = [...state.saveQueue, saveFunction];
        set({ saveQueue: queue });
        
        if (!state.isSavingDocument) {
            get().processSaveQueue();
        }
    },

    processSaveQueue: async () => {
        const state = get();
        if (state.saveQueue.length === 0) return;
        
        set({ isSavingDocument: true, syncStatus: DocumentSyncStatus.SAVING });
        
        // Take the latest save task and drop intermediate ones to avoid redundant network calls
        const latestSaveTask = state.saveQueue[state.saveQueue.length - 1];
        set({ saveQueue: [] }); // Clear the queue since we're taking the latest state
        
        try {
            const result = await latestSaveTask();
            set({
                documentVersion: result.version,
                syncStatus: DocumentSyncStatus.SAVED,
                hasUnsavedChanges: false,
                isSavingDocument: false,
                lastSuccessfullySavedAt: result.updated_at,
                saveError: null
            });
            // Clear local recovery copy on successful server save
            if (get().document?.id) {
                removeFromLocal(get().document.id);
            }
        } catch (error) {
            console.error("Save failed:", error);
            if (error.response?.status === 409) {
                set({ 
                    syncStatus: DocumentSyncStatus.CONFLICT, 
                    saveError: error.response.data,
                    isSavingDocument: false 
                });
            } else {
                set({ 
                    syncStatus: DocumentSyncStatus.SAVE_FAILED, 
                    saveError: error.message,
                    isSavingDocument: false 
                });
            }
        }
        
        // If more items got queued while saving, process them
        if (get().saveQueue.length > 0) {
            get().processSaveQueue();
        }
    },

    checkLocalRecovery: async (document_id) => {
        const localCopy = await getFromLocal(document_id);
        if (localCopy) {
            set({ hasLocalRecoveryCopy: true });
            return localCopy;
        }
        set({ hasLocalRecoveryCopy: false });
        return null;
    },
    
    discardLocalRecovery: async (document_id) => {
        await removeFromLocal(document_id);
        set({ hasLocalRecoveryCopy: false });
    }
}));
