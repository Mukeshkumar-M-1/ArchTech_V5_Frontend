import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X, Copy, Check } from 'lucide-react';
import useToastStore from '../../store/toastStore';
import { copyTextToClipboard } from '../../utils/clipboard';

const icons = {
  success: <CheckCircle2 className="text-emerald-500" size={20} />,
  error: <AlertCircle className="text-rose-500" size={20} />,
  info: <Info className="text-blue-500" size={20} />
};

const bgColors = {
  success: 'bg-emerald-50 border-emerald-100',
  error: 'bg-rose-50 border-rose-100',
  info: 'bg-blue-50 border-blue-100'
};

function CopyButton({ message }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await copyTextToClipboard(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      console.error('Failed to copy toast message');
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="text-slate-400 hover:text-slate-600 transition-colors p-1"
      title="Copy message"
    >
      {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
    </button>
  );
}

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border shadow-lg ${bgColors[toast.type] || bgColors.info}`}
          >
            <div className="shrink-0 mt-0.5">
              {icons[toast.type] || icons.info}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 leading-tight">
                {toast.message}
              </p>
            </div>
            <div className="shrink-0 flex items-center gap-0.5">
              <CopyButton message={toast.message} />
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
