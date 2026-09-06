import React from 'react';
import { useDocumentStore, DocumentSyncStatus } from '../stores/useDocumentStore';
import { Loader2, CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';

export default function SaveStatusIndicator() {
    const { syncStatus, lastSuccessfullySavedAt, hasLocalRecoveryCopy } = useDocumentStore();

    let content = null;

    switch (syncStatus) {
        case DocumentSyncStatus.SAVING:
            content = (
                <div className="flex items-center gap-1.5 text-slate-500">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving...</span>
                </div>
            );
            break;
        case DocumentSyncStatus.SAVED:
            content = (
                <div className="flex items-center gap-1.5 text-emerald-600">
                    <CheckCircle2 size={14} />
                    <span>Saved</span>
                </div>
            );
            break;
        case DocumentSyncStatus.UNSAVED:
            content = (
                <div className="flex items-center gap-1.5 text-slate-400">
                    <div className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Unsaved changes</span>
                </div>
            );
            break;
        case DocumentSyncStatus.CONFLICT:
            content = (
                <div className="flex items-center gap-1.5 text-rose-500 font-medium">
                    <AlertCircle size={14} />
                    <span>Version conflict</span>
                </div>
            );
            break;
        case DocumentSyncStatus.SAVE_FAILED:
            content = (
                <div className="flex items-center gap-1.5 text-rose-500">
                    <AlertCircle size={14} />
                    <span>Save failed</span>
                </div>
            );
            break;
        case DocumentSyncStatus.OFFLINE:
            content = (
                <div className="flex items-center gap-1.5 text-amber-600">
                    <WifiOff size={14} />
                    <span>Offline (Saved locally)</span>
                </div>
            );
            break;
        case DocumentSyncStatus.LOADING:
        default:
            content = null;
    }

    if (!content) return null;

    return (
        <div className="flex items-center gap-3 text-xs">
            {content}
            {hasLocalRecoveryCopy && (
                <span className="text-amber-500 border border-amber-200 bg-amber-50 px-1.5 py-0.5 rounded ml-2">
                    Pending local changes
                </span>
            )}
        </div>
    );
}
