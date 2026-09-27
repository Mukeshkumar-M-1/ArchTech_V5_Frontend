import { useState, useEffect, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import TiptapEditor from '../../components/TiptapEditor';
import { Loader2, Lock } from 'lucide-react';
import { remarkCallouts } from '../../utils/remarkCallouts';

/**
 * SectionContent - Renders either the TiptapEditor or a Markdown preview of the section content.
 * Displays a save indicator in the bottom-right corner during auto-save.
 * @param {Object} props
 * @param {string} props.content - Markdown content to display/edit.
 * @param {'editor' | 'preview'} props.viewMode - Which view mode to show.
 * @param {(content: string) => void} props.onContentChange - Callback when content changes.
 * @param {boolean} props.isSaving - Whether a save operation is in progress.
 * @param {boolean} [props.isSectionLocked] - Whether this section is locked (forces preview-only).
 */
export default function SectionContent({ content, viewMode, onContentChange, isSaving, isSectionLocked, selectedChatBlocks, setSelectedChatBlocks }) {
  const [contentState, setContentState] = useState(content);

  // Sync external content changes (from API fetch) into local state
  useEffect(() => {
    setContentState(content);
  }, [content]);

  // Debounced change handler — prevents rapid re-renders from Tiptap editor
  const handleChange = useCallback((newContent) => {
    setContentState(newContent);
    onContentChange?.(newContent);
  }, [onContentChange]);

  if (!contentState && contentState !== '') {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#fafafa] text-slate-400">
        <Loader2 size={16} className="animate-spin mb-2" />
        <span className="text-xs">Loading content…</span>
      </div>
    );
  }

  const effectiveViewMode = viewMode;
  const previewContent = useMemo(() => contentState || 'No content.', [contentState]);

  return (
    <div className="h-full overflow-hidden bg-[#fafafa] relative">
      {/* Lock indicator for locked sections */}
      {isSectionLocked && (
        <div className="absolute top-11 right-3 z-10 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-semibold">
          <Lock size={12} />
          Section is locked
        </div>
      )}
      {effectiveViewMode === 'editor' ? (
        <TiptapEditor
          content={contentState}
          onChange={handleChange}
          className="w-full h-full border-none shadow-none rounded-none"
          selectedChatBlocks={selectedChatBlocks}
          setSelectedChatBlocks={setSelectedChatBlocks}
        />
      ) : (
        <div className="h-full overflow-y-auto p-6">
          <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-[#1f2328] prose-h1:text-[1.5em] prose-h1:font-bold prose-h1:mt-2 prose-h1:mb-1 prose-h2:text-[1.25em] prose-h2:font-semibold prose-h2:mt-1.5 prose-h2:mb-1 prose-p:text-[14px] prose-p:leading-[1.8] prose-p:text-slate-700 prose-code:bg-[#f6f8fa] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.9em] prose-code:text-[#cf222e] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#f6f8fa] prose-pre:rounded-lg prose-pre:border prose-pre:border-[#d0d7de] prose-pre:overflow-x-auto prose-pre:px-3.5 prose-pre:py-2.5 prose-pre-code:bg-none prose-pre-code:p-0 prose-pre-code:text-slate-800 prose-a:text-[#0969da] prose-hr:border-[#d0d7de] prose-hr:my-4 prose-blockquote:quotes-none prose-blockquote:[&>p:first-of-type]:before:content-none prose-blockquote:[&>p:last-of-type]:after:content-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
            >
              {previewContent}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* Saving indicator */}
      {isSaving && (
        <div className="absolute bottom-3 right-4 flex items-center gap-1.5 text-[11px] text-slate-400">
          <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
          Saving…
        </div>
      )}
    </div>
  );
}
