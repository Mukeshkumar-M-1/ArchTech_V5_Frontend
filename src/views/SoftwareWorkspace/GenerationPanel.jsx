import { useState, useCallback, useRef } from 'react';
import TiptapEditor from '../../components/TiptapEditor';
import { Zap, FileText, Loader2, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getApiUrl } from '../../utils/apiConfig';

/**
 * Recursive heading tree component.
 */
function HeadingTree({ nodes, depth, currentSection, expandedSections, toggleSection }) {
  if (!nodes || nodes.length === 0) return null;

  const levelColors = {
    1: 'bg-blue-50 text-blue-600',
    2: 'bg-purple-50 text-purple-600',
    3: 'bg-amber-50 text-amber-600',
    4: 'bg-green-50 text-green-600',
    5: 'bg-rose-50 text-rose-600',
  };
  const levelLabels = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };

  return (
    <div className="flex flex-col">
      {nodes.map((node, i) => {
        const hasChildren = node.children && node.children.length > 0;
        const isExpanded = expandedSections.has(node.text);

        return (
          <div key={i}>
            <div
              className={`flex items-center gap-1 py-0.5 text-xs rounded cursor-pointer transition-colors ${
                currentSection === node.text ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-50 text-gray-700'
              }`}
              style={{ paddingLeft: `${depth * 14 + 12}px` }}
              onClick={() => {
                if (hasChildren) toggleSection(node.text);
              }}
            >
              {hasChildren ? (
                <span className="text-gray-400 shrink-0">
                  {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </span>
              ) : (
                <span className="w-2.5 shrink-0" />
              )}
              <span
                className={`text-[9px] px-1 py-0.5 rounded font-bold shrink-0 ${
                  levelColors[node.level] || 'bg-gray-100 text-gray-500'
                }`}
              >
                {levelLabels[node.level] || node.level}
              </span>
              <span className="truncate">{node.text}</span>
            </div>
            {hasChildren && isExpanded && (
              <div className="flex flex-col">
                <HeadingTree
                  nodes={node.children}
                  depth={depth + 1}
                  currentSection={currentSection}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * GenerationPanel — SRS/SDD document generation with streaming progress.
 *
 * Manages its own document state during generation. On completion,
 * passes the full document to the parent via setSrsDoc.
 */
export default function GenerationPanel({
  srsDoc: parentSrsDoc,
  isGenActive,
  activeMainTab,
  project,
  onCancel,
  setSrsDoc,
}) {
  // Local state for streaming generation
  const [docContent, setDocContent] = useState('');
  const [headings, setHeadings] = useState([]);
  const [expandedSections, setExpandedSections] = useState(new Set());
  const [progress, setProgress] = useState({
    progress: 0,
    phase: '',
    section_current: 0,
    section_total: 0,
    status: 'idle',
  });
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const isGenerating = progress.status === 'generating';

  /**
   * Start document generation via SSE.
   */
  const handleGenerate = useCallback(async () => {
    const abortCtrl = new AbortController();
    abortRef.current = abortCtrl;
    setError(null);
    setDocContent('');
    setHeadings([]);
    setExpandedSections(new Set());
    setProgress({
      progress: 0,
      phase: 'Initializing...',
      section_current: 0,
      section_total: 0,
      status: 'generating',
    });

    const projectId = project?.id || project?._id;
    const type = activeMainTab === 'srs' ? 'srs' : 'sdd';

    try {
      const res = await fetch(getApiUrl('/generate-document-stream'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirement_ids: [],
          template_type: type,
          project_id: projectId,
        }),
        signal: abortCtrl.signal,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let docContentAccum = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const data = JSON.parse(line.slice(6));
            const { type: eventType } = data;

            if (eventType === 'gen_start') {
              setProgress(p => ({
                ...p,
                section_total: data.section_count,
                section_current: 0,
                progress: 5,
                phase: `Starting document generation — ${data.section_count} sections`,
              }));
            } else if (eventType === 'section_start') {
              setProgress(p => ({
                ...p,
                phase: `Generating: ${data.heading}`,
                section_current: data.section_current,
              }));
              // Auto-expand the current section
              setExpandedSections(prev => {
                const next = new Set(prev);
                if (data.heading) next.add(data.heading);
                return next;
              });
            } else if (eventType === 'section_chunk') {
              docContentAccum += data.content || '';
              setDocContent(docContentAccum);
            } else if (eventType === 'section_complete') {
              const parsed = data.headings_parsed || [];
              setHeadings(prev => {
                const next = [...prev];
                for (const h of parsed) next.push(h);
                return next;
              });
              setExpandedSections(prev => {
                const next = new Set(prev);
                if (data.heading) next.add(data.heading);
                return next;
              });
            } else if (eventType === 'progress') {
              setProgress(p => ({
                ...p,
                progress: data.progress,
                phase: data.phase,
                section_current: data.section_current,
                section_total: data.section_total,
              }));
            } else if (eventType === 'gen_complete') {
              setProgress(p => ({
                ...p,
                progress: 100,
                phase: `Complete — ${data.total_sections} sections generated`,
                status: 'complete',
              }));
              // Sync with parent
              if (setSrsDoc) setSrsDoc(docContentAccum);
            } else if (eventType === 'gen_error') {
              setError(data.error);
              setProgress(p => ({ ...p, status: 'error' }));
            } else if (eventType === 'cancel') {
              setProgress(p => ({ ...p, status: 'cancelled' }));
            }
          } catch {
            // Skip malformed SSE events
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      setError(err.message);
      setProgress(p => ({ ...p, status: 'error' }));
    } finally {
      abortRef.current = null;
    }
  }, [project, activeMainTab, setSrsDoc]);

  const handleCancel = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort('user cancelled');
    }
    if (onCancel) onCancel();
    setProgress(p => ({ ...p, status: 'cancelled' }));
  }, [onCancel]);

  const toggleSection = useCallback((path) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }, []);

  // Use local doc during generation, fall back to parent doc when idle
  const displayDoc = isGenerating ? docContent : (parentSrsDoc || '');

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ── Main Content Area ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Progress Bar */}
        {isGenerating && (
          <div className="px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
            <div className="flex items-center gap-2 mb-1">
              <Loader2 size={13} className="animate-spin text-blue-500 shrink-0" />
              <span className="text-[11px] text-gray-600 truncate flex-1">
                {progress.phase}
              </span>
              <span className="text-[10px] font-mono text-gray-400 shrink-0">
                {progress.section_current}/{progress.section_total}
              </span>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold text-red-600 border border-red-200 hover:bg-red-50 cursor-pointer shrink-0"
              >
                <X size={9} /> Cancel
              </button>
            </div>
            <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error Banner */}
        {progress.status === 'error' && error && (
          <div className="px-3 py-2 bg-red-50 border-b border-red-200 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-red-700">Error:</span>
              <span className="text-xs text-red-600 truncate flex-1">{error}</span>
              {progress.section_current > 0 && (
                <span className="text-[10px] text-red-500 shrink-0">
                  {progress.section_current} of {progress.section_total} sections
                </span>
              )}
            </div>
          </div>
        )}

        {progress.status === 'cancelled' && (
          <div className="px-3 py-2 bg-amber-50 border-b border-amber-200 flex-shrink-0">
            <span className="text-xs text-amber-700">Generation cancelled. {progress.section_current} of {progress.section_total} sections generated.</span>
          </div>
        )}

        {/* Document View */}
        <div className="flex-1 overflow-hidden bg-[#fafafa]">
          {displayDoc ? (
            <TiptapEditor
              content={displayDoc}
              onChange={() => {}}
              project={project}
              requirementId="SRS_DOC"
              className="h-full border-none shadow-none rounded-none"
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-gray-400 p-10">
              <Zap size={32} className="opacity-30 mb-4" />
              <div className="text-sm font-semibold text-gray-500 mb-2">No document generated yet</div>
              <div className="text-xs text-center max-w-[280px] mb-4">
                Click <strong>Generate {activeMainTab?.toUpperCase()}</strong> to create a document.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── TOC Sidebar ── */}
      <div className="w-64 border-r border-l border-gray-200 bg-white flex-shrink-0 overflow-y-auto flex flex-col">
        <div className="flex justify-center items-center px-3 py-2">
          <button
            onClick={handleGenerate}
            disabled={isGenActive}
            className="px-4 py-2 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            {isGenActive ? 'Generating...' : 'Generate Document'}
          </button>
          <button></button>
        </div>
        <div className="px-4 py-[10px] border-b border-t border-gray-200 text-xs font-bold text-gray-900 font-mono flex items-center justify-between">
          <span>DOCUMENT OUTLINE</span>
          {isGenerating && (
            <Loader2 size={12} className="animate-spin text-blue-500" />
          )}
        </div>

        <div className="p-3 flex-1">
          {displayDoc ? (
            <>
              <div className="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-600 mb-3 flex items-center gap-1.5">
                <FileText size={11} className="inline shrink-0" />
                <span className="truncate">SRS_Document.md</span>
                {progress.status === 'complete' && (
                  <span className="ml-1 text-[10px] text-green-600 font-semibold">✓</span>
                )}
              </div>

              {headings.length > 0 ? (
                <HeadingTree
                  nodes={headings}
                  depth={0}
                  currentSection={progress.phase.replace('Generating: ', '').replace('Completed: ', '')}
                  expandedSections={expandedSections}
                  toggleSection={toggleSection}
                />
              ) : (
                <div className="px-3 py-4 text-center text-xs text-gray-400">
                  Building document outline...
                </div>
              )}
            </>
          ) : (
            <div className="py-5 text-center text-gray-400 text-xs">
              No document generated yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
