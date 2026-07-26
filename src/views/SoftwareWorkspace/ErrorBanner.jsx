import { X } from 'lucide-react';

/**
 * ErrorBanner - A dismissible error banner shown when API calls fail.
 * @param {Object} props
 * @param {string} props.message - Error message to display.
 * @param {() => void} props.onDismiss - Callback to dismiss the banner.
 */
export default function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;

  return (
    <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-2 rounded-lg flex items-center gap-2 mx-4 my-2">
      <span className="text-xs flex-1">{message}</span>
      <button
        onClick={onDismiss}
        className="shrink-0 text-rose-400 hover:text-rose-600 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
