import { useState } from 'react';
import { Download, X, FileText, Loader2 } from 'lucide-react';
import { getApiUrl } from '../../utils/apiConfig';

export default function ExportModal({ onClose, displayDoc }) {
  const [filename, setFilename] = useState('Document');
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState(null);

  const handleExportOdt = async () => {
    if (!displayDoc) {
      setError("No document content to export.");
      return;
    }
    
    setIsExporting(true);
    setError(null);
    try {
      const response = await fetch(getApiUrl('/export-document'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: displayDoc,
          format: 'odt',
          filename: filename || 'Document'
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to export document. Please make sure the backend is running and pandoc is installed.");
      }

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `${filename || 'Document'}.odt`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-light">
          <div className="flex items-center gap-2">
            <Download size={16} className="text-accent" />
            <h3 className="text-sm font-bold text-primary">Export Document</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-muted hover:text-red-600 hover:bg-red-100 transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <p className="text-xs text-secondary">Choose a format to export your generated document.</p>
          
          <div className="flex flex-col gap-1.5 mb-2">
            <label className="text-[11px] font-bold text-secondary">Filename</label>
            <input 
              type="text" 
              value={filename}
              onChange={(e) => setFilename(e.target.value)}
              placeholder="e.g. Project_SRS"
              className="w-full px-3 py-2 bg-muted border rounded-lg text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          {error && (
            <div className="px-3 py-2 bg-red-50 border border-red-100 text-red-600 rounded-lg text-xs">
              {error}
            </div>
          )}

          <button 
            onClick={handleExportOdt} 
            disabled={isExporting}
            className="flex items-center justify-between p-3 rounded-lg border hover:border-primary-300 hover:bg-primary-50 transition-colors group cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary-100 rounded-md text-accent group-hover:bg-primary-200 transition-colors">
                {isExporting ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />}
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-primary">ODT Document</div>
                <div className="text-[10px] text-muted">Open Document Text format</div>
              </div>
            </div>
            <Download size={14} className="text-muted group-hover:text-accent transition-colors" />
          </button>
        </div>
      </div>
    </div>
  );
}
