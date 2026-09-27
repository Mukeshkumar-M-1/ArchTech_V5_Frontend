import { useMemo, useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { findBestMatchInMarkdown } from "../../utils/markdownMatch";

const mdClasses =
  "prose prose-sm max-w-none text-primary leading-[1.5] prose-headings:font-bold prose-a:text-accent font-sans";

/**
 * Renders one markdown segment inside a highlight wrapper (or plain if none).
 */
function MarkdownSegment({ markdown, highlightClass }) {
  return (
    <div className={highlightClass || ""}>
      <div className={mdClasses}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}

/**
 * ContentEditPreviewPanel — inline Current/Proposed tabbed preview for a
 * content_edit proposal, rendered in place of (over) the TiptapEditor pane for
 * the proposal's section.
 *
 * "Current" renders the backend-stored section markdown with the matched region
 * rose-highlighted; "Proposed" renders the same doc with the edit applied
 * (emerald-highlighted) — the exact string the parent persists on Accept.
 * The live editor stays mounted (hidden by the parent), so its state is intact.
 */
export default function ContentEditPreviewPanel({
  edit,
  sourceMarkdown,
  saving,
  error,
  onAccept,
  onReject,
}) {
  const [tab, setTab] = useState("proposed");
  const [showRawDiff, setShowRawDiff] = useState(false);

  const matchedSegment = useMemo(
    () => findBestMatchInMarkdown(edit?.original_text, sourceMarkdown),
    [edit, sourceMarkdown],
  );

  const segments = useMemo(() => {
    if (!sourceMarkdown || !matchedSegment) return null;
    const idx = sourceMarkdown.indexOf(matchedSegment);
    if (idx === -1) {
      return { before: sourceMarkdown, matched: "", after: "", plain: true };
    }
    return {
      before: sourceMarkdown.slice(0, idx),
      matched: matchedSegment,
      after: sourceMarkdown.slice(idx + matchedSegment.length),
      plain: false,
    };
  }, [sourceMarkdown, matchedSegment]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* Current/Proposed toggle row */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-gray-50/80 shrink-0">
        <div className="flex p-0.5 bg-gray-100/80 rounded-lg">
          <button
            onClick={() => setTab("current")}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all duration-200 cursor-pointer ${
              tab === "current"
                ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Current
          </button>
          <button
            onClick={() => setTab("proposed")}
            className={`px-3 py-1 text-[11px] font-semibold rounded-md transition-all duration-200 cursor-pointer ${
              tab === "proposed"
                ? "bg-white text-gray-900 shadow-sm ring-1 ring-black/5"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Proposed
          </button>
        </div>
        {edit?.version && (
          <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-100 text-[9px] text-blue-600 font-bold">
            v{edit.version}
          </span>
        )}
        {edit?.block_number != null && (
          <span className="px-1.5 py-0.5 rounded bg-gray-100 border border-gray-200 text-[9px] text-gray-500 font-bold">
            Block {edit.block_number}
          </span>
        )}
        <div className="flex-1" />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-8 py-5 select-text min-h-0">
        {!matchedSegment ? (
          <>
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
              Original text not found in{" "}
              <span className="font-bold">
                {edit?.section_filename || "the stored section"}
                {edit?.version ? ` (v${edit.version})` : ""}
              </span>{" "}
              — showing the file's current content below. The proposal may be
              stale.
            </div>
            {sourceMarkdown && (
              <div className="flex flex-col gap-1 max-w-3xl mx-auto mt-4">
                {tab === "current" ? (
                  <MarkdownSegment markdown={sourceMarkdown} />
                ) : (
                  edit?.proposed_text && (
                    <MarkdownSegment
                      markdown={edit.proposed_text}
                      highlightClass="bg-emerald-50 border-l-2 border-emerald-300 rounded-r px-2 py-1"
                    />
                  )
                )}
              </div>
            )}
          </>
        ) : !segments ? (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-700">
            Section content could not be loaded for preview.
          </div>
        ) : tab === "current" ? (
          <div className="flex flex-col gap-1 max-w-3xl mx-auto">
            {segments.before && <MarkdownSegment markdown={segments.before} />}
            {segments.matched && (
              <MarkdownSegment
                markdown={segments.matched}
                highlightClass="bg-rose-50 border-l-2 border-rose-300 rounded-r px-2 py-1"
              />
            )}
            {segments.after && <MarkdownSegment markdown={segments.after} />}
          </div>
        ) : (
          <div className="flex flex-col gap-1 max-w-3xl mx-auto">
            {segments.before && <MarkdownSegment markdown={segments.before} />}
            {edit?.proposed_text && (
              <MarkdownSegment
                markdown={edit.proposed_text}
                highlightClass="bg-emerald-50 border-l-2 border-emerald-300 rounded-r px-2 py-1"
              />
            )}
            {segments.after && <MarkdownSegment markdown={segments.after} />}
          </div>
        )}
      </div>

      {/* Raw diff strip */}
      <div className="border-t border-gray-100 shrink-0">
        <button
          onClick={() => setShowRawDiff((v) => !v)}
          className="flex items-center gap-1.5 px-4 py-1.5 text-[11px] font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          {showRawDiff ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Raw diff
        </button>
        {showRawDiff && (
          <div className="mx-4 mb-2 flex flex-col gap-0 border border-gray-100 rounded-md overflow-hidden text-[11px] font-mono">
            <div className="bg-rose-50 text-rose-600 relative">
              <div className="absolute top-1 left-2 select-none text-rose-400 font-bold z-10">
                -
              </div>
              <div className="p-3 pl-4 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {edit?.original_text}
              </div>
            </div>
            <div className="bg-emerald-50 text-emerald-600 relative">
              <div className="absolute top-1 left-2 select-none text-emerald-500 font-bold z-10">
                +
              </div>
              <div className="p-3 pl-4 whitespace-pre-wrap max-h-40 overflow-y-auto">
                {edit?.proposed_text}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-rose-50 border-t border-rose-200 text-xs text-rose-700 shrink-0">
          {error}
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-t border-gray-200 bg-gray-50/80 shrink-0">
        <button
          onClick={onReject}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-100 transition-colors disabled:opacity-40 cursor-pointer"
        >
          <XCircle size={12} />
          Reject
        </button>
        <button
          onClick={onAccept}
          disabled={saving || !matchedSegment}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-white rounded-md shadow-sm transition-colors ${
            saving || !matchedSegment
              ? "bg-emerald-400 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
          }`}
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <CheckCircle2 size={12} />
          )}
          {saving ? "Saving…" : "Accept"}
        </button>
      </div>
    </div>
  );
}
