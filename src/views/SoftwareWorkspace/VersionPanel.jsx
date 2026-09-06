import { useState, useEffect, useCallback, useMemo } from 'react';
import { GitCommit, FileText, Loader2, BookOpen, ChevronRight, Eye, Download } from 'lucide-react';
import { fetchDocumentVersions, fetchVersionSections, fetchVersionContent } from '../../api/templateApi';
import TiptapEditor from '../../components/TiptapEditor';
import PreviewModal from './PreviewModal';
import ExportModal from './ExportModal';

/**
 * VersionPanel — Three-column, version-centric layout for browsing document versions.
 *   Left:   All document versions (v1, v2, v3...)
 *   Center: Markdown content for the selected section + version
 *   Right:  Sections generated for the selected version
 */
export default function VersionPanel({ project }) {
  const projectId = project?.id || project?._id;

  /* Document-level versions */
  const [versions, setVersions] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [versionsError, setVersionsError] = useState(null);

  /* Sections for the selected version */
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsError, setSectionsError] = useState(null);

  /* Selection state */
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [selectedSectionFilename, setSelectedSectionFilename] = useState(null);

  /* Content state */
  const [content, setContent] = useState('');
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState(null);

  /* Modal state */
  const [showPreview, setShowPreview] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [fullDoc, setFullDoc] = useState('');
  const [fullDocLoading, setFullDocLoading] = useState(false);
  const [fullDocVersion, setFullDocVersion] = useState(null);

  // ── Fetch all document versions ──────────────────────────────────
  useEffect(() => {
    if (!projectId) {
      setVersionsLoading(false);
      return;
    }
    setVersionsLoading(true);
    setVersionsError(null);
    fetchDocumentVersions(projectId)
      .then(data => {
        setVersions(data);
        // Auto-select the latest version (first item — newest first)
        if (data.length > 0) {
          setSelectedVersion(data[0].version);
        }
      })
      .catch(err => setVersionsError(err.message))
      .finally(() => setVersionsLoading(false));
  }, [projectId]);

  // ── Fetch sections for the selected version ──────────────────────
  useEffect(() => {
    if (!projectId || !selectedVersion) {
      setSections([]);
      setSelectedSectionFilename(null);
      setContent('');
      return;
    }
    setSectionsLoading(true);
    setSectionsError(null);
    fetchVersionSections(projectId, selectedVersion)
      .then(data => {
        setSections(data.sections || []);
        // Auto-select the first section
        if (data.sections?.length > 0) {
          setSelectedSectionFilename(data.sections[0].section_filename);
        }
      })
      .catch(err => setSectionsError(err.message))
      .finally(() => setSectionsLoading(false));
  }, [projectId, selectedVersion]);

  // Clear content when section changes
  useEffect(() => {
    setContent('');
    setContentError(null);
  }, [selectedSectionFilename]);

  // ── Fetch content for selected section + version ─────────────────
  const loadContent = useCallback(async () => {
    if (!projectId || !selectedSectionFilename || !selectedVersion) return;
    setContentLoading(true);
    setContentError(null);
    try {
      const data = await fetchVersionContent(projectId, selectedSectionFilename, selectedVersion);
      setContent(data.content || '');
    } catch (err) {
      setContentError(err.message);
    } finally {
      setContentLoading(false);
    }
  }, [projectId, selectedSectionFilename, selectedVersion]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  // ── Aggregate all sections of a version into a single markdown doc ──
  const loadFullDocument = useCallback(async (version) => {
    if (version === fullDocVersion) return fullDoc;
    setFullDocLoading(true);
    setFullDocVersion(null);
    try {
      const data = await fetchVersionSections(projectId, version);
      const secs = data.sections || [];
      let md = '';
      for (const sec of secs) {
        if (!sec.has_content) continue;
        const content = await fetchVersionContent(projectId, sec.section_filename, version);
        md += content.content + '\n\n---\n\n';
      }
      setFullDoc(md.trim());
      setFullDocVersion(version);
      return md.trim();
    } catch (err) {
      setFullDoc('');
      throw err;
    } finally {
      setFullDocLoading(false);
    }
  }, [projectId, fullDocVersion, fullDoc]);

  const handlePreview = useCallback(async (e, version) => {
    e.stopPropagation();
    await loadFullDocument(version);
    setShowPreview(true);
  }, [loadFullDocument]);

  const handleExport = useCallback(async (e, version) => {
    e.stopPropagation();
    await loadFullDocument(version);
    setShowExport(true);
  }, [loadFullDocument]);

  // ── Derived state ────────────────────────────────────────────────
  const activeSectionMeta = useMemo(
    () => sections.find(s => s.section_filename === selectedSectionFilename),
    [sections, selectedSectionFilename]
  );

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* ─── Left: Version List ─── */}
      <div className="w-64 flex-shrink-0 bg-[#fafbfc] border-r border-[#e5e7eb] flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-[#e5e7eb] flex items-center gap-2">
          <GitCommit size={14} className="text-[#64748b]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
            Versions
          </span>
        </div>

        {versionsLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#94a3b8]">
            <Loader2 size={16} className="animate-spin mb-2" />
            <span className="text-[11px]">Loading versions...</span>
          </div>
        ) : versionsError ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#dc2626] px-4">
            <span className="text-[11px] text-center">{versionsError}</span>
          </div>
        ) : versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
            <BookOpen size={20} className="opacity-30 mb-2" />
            <span className="text-[10px] text-center px-4">
              No generated versions found.<br />Run document generation first.
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {versions.map((v) => {
              const isActive = v.version === selectedVersion;
              return (
                <div
                  key={v.version}
                  className="group relative mb-0.5"
                >
                  <button
                    onClick={() => setSelectedVersion(v.version)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-all pr-16 ${
                      isActive
                        ? 'bg-white shadow-sm border border-[#e5e7eb] text-[#2563eb]'
                        : 'hover:bg-[#f1f5f9] text-[#475569] border border-transparent'
                    }`}
                  >
                    <GitCommit size={12} className={isActive ? 'text-[#2563eb]' : 'text-[#94a3b8]'} />
                    <span className={`text-[11px] font-semibold flex-1 truncate ${isActive ? 'font-bold' : ''}`}>
                      version_v{v.version}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 ${
                      isActive
                        ? 'bg-blue-50 text-[#2563eb]'
                        : 'bg-slate-100 text-[#94a3b8]'
                    }`}>
                      {v.section_count}
                    </span>
                  </button>

                  {/* Action buttons */}
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <button
                      onClick={(e) => handlePreview(e, v.version)}
                      disabled={fullDocLoading}
                      className="p-1.5 rounded-md bg-white/90 hover:bg-blue-50 text-[#475569] hover:text-[#2563eb] shadow-sm border border-[#e5e7eb] transition-colors disabled:opacity-50"
                      title="Preview"
                    >
                      <Eye size={11} />
                    </button>
                    <button
                      onClick={(e) => handleExport(e, v.version)}
                      disabled={fullDocLoading}
                      className="p-1.5 rounded-md bg-white/90 hover:bg-emerald-50 text-[#475569] hover:text-[#059669] shadow-sm border border-[#e5e7eb] transition-colors disabled:opacity-50"
                      title="Export"
                    >
                      <Download size={11} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── Center: Content Display ─── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-white">
        {activeSectionMeta && (
          <div className="px-4 py-2 border-b border-[#e5e7eb] flex items-center gap-2 flex-shrink-0 bg-[#fafbfc]">
            <FileText size={12} className="text-[#64748b]" />
            <span className="text-[11px] font-semibold text-[#334155] truncate">
              {activeSectionMeta.section_filename.replace(/\.md$/, '')}
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium bg-blue-50 text-[#2563eb] ml-auto flex-shrink-0">
              version_v{selectedVersion}
            </span>
          </div>
        )}

        <div className="flex-1 overflow-auto bg-[#fafafa]">
          {contentLoading ? (
            <div className="flex flex-col items-center justify-center h-full text-[#94a3b8]">
              <Loader2 size={20} className="animate-spin mb-3" />
              <span className="text-xs">Loading content...</span>
            </div>
          ) : contentError ? (
            <div className="flex flex-col items-center justify-center h-full text-[#dc2626] px-6">
              <span className="text-xs text-center">{contentError}</span>
            </div>
          ) : content ? (
            <TiptapEditor
              content={content}
              onChange={() => {}}
              project={project}
              requirementId={`DOC_V${selectedVersion}`}
              className="h-full border-none shadow-none rounded-none"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-[#94a3b8]">
              <BookOpen size={28} className="opacity-30 mb-3" />
              <span className="text-sm font-semibold text-[#64748b]">No section selected</span>
              <span className="text-[11px] mt-1">Pick a section from the right panel</span>
            </div>
          )}
        </div>
      </div>

      {/* ─── Right: Section List (for selected version) ─── */}
      <div className="w-56 flex-shrink-0 bg-[#fafbfc] border-l border-[#e5e7eb] flex flex-col overflow-hidden">
        <div className="px-3 py-2.5 border-b border-[#e5e7eb] flex items-center gap-2">
          <FileText size={13} className="text-[#64748b]" />
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
            Sections
          </span>
        </div>

        {sectionsLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#94a3b8]">
            <Loader2 size={16} className="animate-spin mb-2" />
            <span className="text-[11px]">Loading sections...</span>
          </div>
        ) : sectionsError ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#dc2626] px-4">
            <span className="text-[11px] text-center">{sectionsError}</span>
          </div>
        ) : sections.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
            <FileText size={20} className="opacity-30 mb-2" />
            <span className="text-[10px] text-center px-4">
              No sections for this version.
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {sections.map((sec) => {
              const isActive = sec.section_filename === selectedSectionFilename;
              return (
                <button
                  key={sec.section_filename}
                  onClick={() => setSelectedSectionFilename(sec.section_filename)}
                  className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all mb-0.5 ${
                    isActive
                      ? 'bg-white shadow-sm border border-[#e5e7eb]'
                      : 'hover:bg-[#f1f5f9] border border-transparent'
                  }`}
                >
                  <ChevronRight size={12} className={`flex-shrink-0 mt-0.5 ${
                    isActive ? 'text-[#2563eb]' : 'text-[#94a3b8]'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11px] font-semibold truncate ${
                      isActive ? 'text-[#2563eb]' : 'text-[#334155]'
                    }`}>
                      {sec.section_filename.replace(/\.md$/, '')}
                    </div>
                    <div className="text-[9px] text-[#94a3b8] mt-0.5">
                      {sec.has_content ? 'Generated' : 'Empty'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <PreviewModal
          displayDoc={fullDoc}
          onClose={() => setShowPreview(false)}
        />
      )}

      {/* Export Modal */}
      {showExport && (
        <ExportModal
          displayDoc={fullDoc}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  );
}