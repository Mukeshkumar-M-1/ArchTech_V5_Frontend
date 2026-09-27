import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  GitCommit, FileText, Loader2, BookOpen, ChevronRight, ChevronDown,
  Eye, Download, Trash2, RotateCcw, MoreVertical,
} from 'lucide-react';
import {
  fetchDocumentVersions, fetchVersionSections, fetchVersionContent,
  deleteDocumentVersion, restoreDocumentVersion,
} from '../../api/templateApi';
import usePendingDeleteStore from '../../store/pendingDeleteStore';
import useToastStore from '../../store/toastStore';
import TiptapEditor from '../../components/TiptapEditor';
import PreviewModal from './PreviewModal';
import ExportModal from './ExportModal';

/**
 * VersionPanel — Three-column, version-centric layout for browsing document versions.
 *   Left:   All document versions (v1, v2, v3...) with tag badges, template filter
 *           dropdown and a collapsible deleted-versions section at the bottom.
 *   Center: Markdown content for the selected section + version
 *   Right:  Sections generated for the selected version
 */

/* Tag badge styling per version tag ("new" = fresh generate, "regenerate" =
   single-section re-run, "legacy" = version generated before tags existed). */
const TAG_BADGE_STYLES = {
  new: 'bg-emerald-50 text-emerald-600 border border-emerald-200',
  regenerate: 'bg-amber-50 text-amber-600 border border-amber-200',
  legacy: 'bg-slate-100 text-slate-400 border border-slate-200',
};
const TAG_BADGE_LABELS = {
  new: 'NEW',
  regenerate: 'RE-GEN',
  legacy: '—',
};

/* Format an ISO timestamp (e.g. "2026-09-25T14:30:00") as "YYYY-MM-DD HH:mm". */
function formatTimestamp(isoTimestamp) {
  if (!isoTimestamp) return null;
  const parsedDate = new Date(isoTimestamp);
  if (Number.isNaN(parsedDate.getTime())) return isoTimestamp;
  const pad = (value) => String(value).padStart(2, '0');
  return `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())} ${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`;
}

/* One-line metadata string shown under a version title, e.g. "BSP-Board-1".
   Re-generated sections are rendered on their own line by the caller. */
function buildVersionMetaLine(versionEntry) {
  return versionEntry.template || '';
}

/* Single "⋯" action button per version row that opens a small dropdown with
   the row's actions (Preview / Export / Delete or Restore). A fixed full-screen
   transparent layer behind the dropdown closes it on any outside click. */
function VersionActionsMenu({ menuKey, openMenuKey, onToggleMenu, items, disabled }) {
  const isMenuOpen = openMenuKey === menuKey;
  const triggerButtonRef = useRef(null);
  const flyoutMenuRef = useRef(null);
  const [menuScreenPosition, setMenuScreenPosition] = useState(null);

  useEffect(() => {
    if (!isMenuOpen) {
      setMenuScreenPosition(null);
      return;
    }
    // Position the fly-out at the button's viewport coordinates. Absolute
    // positioning inside the scrolling version list would be clipped by the
    // panel's overflow, so the menu is fixed to the screen instead.
    const triggerRect = triggerButtonRef.current?.getBoundingClientRect();
    if (triggerRect) {
      setMenuScreenPosition({
        left: triggerRect.right + 4,
        top: triggerRect.bottom - 16,
      });
    }

    // Close when clicking anywhere outside the fly-out or its trigger button.
    // A document-level mousedown listener is used instead of a full-screen
    // overlay because other portal/toolbar layers can stack above an overlay.
    const handleOutsidePointerDown = (event) => {
      const clickedInsideMenu = flyoutMenuRef.current?.contains(event.target);
      const clickedInsideTrigger = triggerButtonRef.current?.contains(event.target);
      if (clickedInsideMenu || clickedInsideTrigger) return;
      onToggleMenu(null);
    };

    // A fixed menu doesn't follow the list, so close it on scroll/resize
    // rather than letting it float detached from its button.
    const closeMenu = () => onToggleMenu(null);
    document.addEventListener('mousedown', handleOutsidePointerDown);
    window.addEventListener('scroll', closeMenu, true);
    window.addEventListener('resize', closeMenu);
    return () => {
      document.removeEventListener('mousedown', handleOutsidePointerDown);
      window.removeEventListener('scroll', closeMenu, true);
      window.removeEventListener('resize', closeMenu);
    };
  }, [isMenuOpen, onToggleMenu]);

  return (
    <div className="relative">
      <button
        ref={triggerButtonRef}
        onClick={(e) => { e.stopPropagation(); onToggleMenu(menuKey); }}
        disabled={disabled}
        className={`p-1.5 rounded-md bg-white text-slate-500 shadow-sm border border-slate-200 transition-colors disabled:opacity-50 ${
          isMenuOpen ? 'bg-slate-100 text-slate-700' : 'hover:bg-slate-50 hover:text-slate-700'
        }`}
        title="Version actions"
      >
        <MoreVertical size={11} />
      </button>

      {isMenuOpen && menuScreenPosition && createPortal(
        <div
          ref={flyoutMenuRef}
          className="fixed z-30 w-32 rounded-xl bg-white border border-slate-200 shadow-lg shadow-slate-300/30 py-1.5 px-1 flex flex-col gap-0.5"
          style={{ left: menuScreenPosition.left, top: menuScreenPosition.top }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={(e) => { e.stopPropagation(); onToggleMenu(null); item.onClick(e); }}
              className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[10px] font-medium text-left transition-colors ${item.className || 'text-slate-700 hover:bg-primary-50'}`}
            >
              <item.icon size={12} className={`flex-shrink-0 ${item.iconClassName || 'text-slate-400'}`} />
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}

export default function VersionPanel({ project }) {
  const projectId = project?.id || project?._id;
  const addToast = useToastStore((s) => s.addToast);
  const pendingDelete = usePendingDeleteStore();

  /* Document-level versions */
  const [versions, setVersions] = useState([]);
  const [deletedVersions, setDeletedVersions] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [versionsLoading, setVersionsLoading] = useState(true);
  const [versionsError, setVersionsError] = useState(null);

  /* Sections for the selected version */
  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);
  const [sectionsError, setSectionsError] = useState(null);

  /* Selection state */
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [selectedSectionFilename, setSelectedSectionFilename] = useState(null);

  /* Filter + deleted-sidebar state */
  const [templateFilter, setTemplateFilter] = useState('all');
  const [showDeleted, setShowDeleted] = useState(false);

  /* Which version row's actions menu is open (null = none). Keys are prefixed
     "active-"/"deleted-" so the same version number can't collide across the
     two lists. */
  const [openVersionMenuKey, setOpenVersionMenuKey] = useState(null);

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

  // ── Fetch all document versions (active + deleted + template list) ──
  const loadVersions = useCallback(async () => {
    setVersionsLoading(true);
    setVersionsError(null);
    try {
      const data = await fetchDocumentVersions(projectId);
      const activeList = data.versions || [];
      setVersions(activeList);
      setDeletedVersions(data.deleted_versions || []);
      setTemplates(data.templates || []);
      // Keep the selection if it still exists in either list — a deleted
      // version stays viewable (content endpoints serve it), so selecting one
      // must survive refetches. Otherwise fall back to the newest active version.
      const selectableVersions = [...activeList, ...(data.deleted_versions || [])];
      setSelectedVersion(prevSelected =>
        selectableVersions.some(v => v.version === prevSelected)
          ? prevSelected
          : (activeList[0]?.version ?? null)
      );
    } catch (err) {
      setVersionsError(err.message);
    } finally {
      setVersionsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!projectId) {
      setVersionsLoading(false);
      return;
    }
    loadVersions();
  }, [projectId, loadVersions]);

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
        const fetchedSections = data.sections || [];
        setSections(fetchedSections);
        // Always sync the section selection — for a version with no sections
        // (empty/0-count) the previous version's section must be cleared,
        // otherwise a stale content fetch 404s against the new version.
        setSelectedSectionFilename(fetchedSections[0]?.section_filename ?? null);
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

  // ── Soft-delete / restore handlers ───────────────────────────────
  const handleDeleteVersion = useCallback(async (version) => {
    try {
      await deleteDocumentVersion(projectId, version);
      addToast(`Deleted version_v${version}`, 'success');
      await loadVersions();
    } catch (err) {
      addToast(`Delete failed: ${err.message}`, 'error');
    }
  }, [projectId, loadVersions, addToast]);

  const handleRestoreVersion = useCallback(async (version) => {
    try {
      await restoreDocumentVersion(projectId, version);
      addToast(`Restored version_v${version}`, 'success');
      await loadVersions();
      setSelectedVersion(version);
    } catch (err) {
      addToast(`Restore failed: ${err.message}`, 'error');
    }
  }, [projectId, loadVersions, addToast]);

  const requestDeleteVersion = useCallback((version) => {
    pendingDelete.setPending(`version_v${version}`, () => handleDeleteVersion(version));
  }, [pendingDelete, handleDeleteVersion]);

  const handleToggleVersionMenu = useCallback((menuKey) => {
    setOpenVersionMenuKey(prevMenuKey => (prevMenuKey === menuKey ? null : menuKey));
  }, []);

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
  const filteredVersions = useMemo(
    () => templateFilter === 'all'
      ? versions
      : versions.filter(v => v.template === templateFilter),
    [versions, templateFilter]
  );

  const sortedDeletedVersions = useMemo(
    () => [...deletedVersions].sort((a, b) => b.version - a.version),
    [deletedVersions]
  );

  const activeSectionMeta = useMemo(
    () => sections.find(s => s.section_filename === selectedSectionFilename),
    [sections, selectedSectionFilename]
  );

  /* Sections re-generated in the selected version — highlighted in the right panel */
  const regeneratedSections = useMemo(
    () => [...versions, ...deletedVersions].find(v => v.version === selectedVersion)?.regenerated_sections || [],
    [versions, deletedVersions, selectedVersion]
  );

  // True when the version open in the center panel is a soft-deleted one —
  // drives the "Deleted" badge in the content header.
  const isSelectedVersionDeleted = useMemo(
    () => deletedVersions.some(v => v.version === selectedVersion),
    [deletedVersions, selectedVersion]
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

        {/* Template filter dropdown — filters the list by the template used to generate */}
        {templates.length > 0 && (
          <div className="px-3 py-2 border-b border-[#e5e7eb]">
            <select
              value={templateFilter}
              onChange={(e) => setTemplateFilter(e.target.value)}
              className="w-full text-[11px] px-2 py-1.5 rounded-lg border border-[#e5e7eb] bg-white text-[#334155] outline-none cursor-pointer"
              title="Filter versions by template"
            >
              <option value="all">All templates</option>
              {templates.map((templateName) => (
                <option key={templateName} value={templateName}>
                  {templateName}
                </option>
              ))}
            </select>
          </div>
        )}

        {versionsLoading ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#94a3b8]">
            <Loader2 size={16} className="animate-spin mb-2" />
            <span className="text-[11px]">Loading versions...</span>
          </div>
        ) : versionsError ? (
          <div className="flex flex-col items-center justify-center py-10 text-[#dc2626] px-4">
            <span className="text-[11px] text-center">{versionsError}</span>
          </div>
        ) : filteredVersions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-[#94a3b8]">
            <BookOpen size={20} className="opacity-30 mb-2" />
            <span className="text-[10px] text-center px-4">
              {versions.length === 0
                ? <>No generated versions found.<br />Run document generation first.</>
                : 'No versions for this template.'}
            </span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {filteredVersions.map((v) => {
              const isActive = v.version === selectedVersion;
              const metaLine = buildVersionMetaLine(v);
              return (
                <div
                  key={v.version}
                  className="group relative mb-0.5"
                >
                  <button
                    onClick={() => setSelectedVersion(v.version)}
                    className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all pr-9 ${
                      isActive
                        ? 'bg-white shadow-sm border border-[#e5e7eb] text-[#2563eb]'
                        : 'hover:bg-[#f1f5f9] text-[#475569] border border-transparent'
                    }`}
                  >
                    <GitCommit size={12} className={`flex-shrink-0 mt-0.5 ${isActive ? 'text-[#2563eb]' : 'text-[#94a3b8]'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-semibold truncate ${isActive ? 'font-bold' : ''}`}>
                          version_v{v.version}
                        </span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 bg-white border border-slate-200 text-accent">
                          {v.section_count}
                        </span>
                      </div>
                      {/* Tag badge + re-gen filename (or template) on the same line */}
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        <span className={`text-[8px] px-1 py-px rounded font-bold tracking-wide ${TAG_BADGE_STYLES[v.tag] || TAG_BADGE_STYLES.legacy}`}>
                          {TAG_BADGE_LABELS[v.tag] || TAG_BADGE_LABELS.legacy}
                        </span>
                        {v.tag === 'regenerate' && v.regenerated_sections?.length > 0 ? (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded-md font-medium text-accent bg-primary-50 border border-primary-100 truncate max-w-full"
                            title={v.regenerated_sections.join(', ')}
                          >
                            {v.regenerated_sections.join(', ').replace(/\.md$/, '')}
                          </span>
                        ) : metaLine ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium text-[#94a3b8] bg-white border border-slate-200 truncate max-w-full" title={metaLine}>
                            {metaLine}
                          </span>
                        ) : null}
                      </div>
                      {/* Re-gen rows: template on the next line */}
                      {v.tag === 'regenerate' && v.regenerated_sections?.length > 0 && metaLine && (
                        <div className="mt-0.5">
                          <span className="inline-block max-w-full text-[9px] px-1.5 py-0.5 rounded-md font-medium text-[#94a3b8] bg-white border border-slate-200 truncate" title={metaLine}>
                            {metaLine}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* Single actions menu: preview / export / delete */}
                  <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                    <VersionActionsMenu
                      menuKey={`active-${v.version}`}
                      openMenuKey={openVersionMenuKey}
                      onToggleMenu={handleToggleVersionMenu}
                      disabled={fullDocLoading}
                      items={[
                        {
                          label: 'Preview',
                          icon: Eye,
                          onClick: (e) => handlePreview(e, v.version),
                          className: 'text-slate-700 hover:bg-primary-50',
                          iconClassName: 'text-accent',
                        },
                        {
                          label: 'Export',
                          icon: Download,
                          onClick: (e) => handleExport(e, v.version),
                          className: 'text-slate-700 hover:bg-primary-50',
                          iconClassName: 'text-accent',
                        },
                        {
                          label: 'Delete',
                          icon: Trash2,
                          onClick: () => requestDeleteVersion(v.version),
                          className: 'text-slate-700 hover:bg-red-50',
                          iconClassName: 'text-red-500',
                        },
                      ]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ─── Deleted versions (collapsible, pinned to the bottom) ─── */}
        <div className="border-t border-[#e5e7eb] flex-shrink-0 flex flex-col max-h-[45%]">
          <button
            onClick={() => setShowDeleted(!showDeleted)}
            className="px-3 py-2 flex items-center gap-1.5 hover:bg-[#f1f5f9] transition-colors text-left"
          >
            {showDeleted
              ? <ChevronDown size={12} className="text-[#64748b]" />
              : <ChevronRight size={12} className="text-[#64748b]" />}
            <Trash2 size={12} className="text-[#64748b]" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#475569]">
              Deleted ({deletedVersions.length})
            </span>
          </button>

          {showDeleted && (
            <div className="overflow-y-auto pb-2 px-2">
              {sortedDeletedVersions.length === 0 ? (
                <div className="text-[10px] text-[#94a3b8] text-center py-3 px-4">
                  No deleted versions.
                </div>
              ) : (
                sortedDeletedVersions.map((v) => {
                  const metaLine = buildVersionMetaLine(v);
                  const deletedTime = formatTimestamp(v.deleted_at);
                  const isSelected = v.version === selectedVersion;
                  return (
                    <div key={v.version} className="group relative mb-0.5">
                      <button
                        onClick={() => setSelectedVersion(v.version)}
                        className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left pr-9 transition-all ${
                          isSelected
                            ? 'bg-white shadow-sm border border-[#e5e7eb]'
                            : 'bg-[#f8fafc] border border-[#e5e7eb] opacity-80 hover:opacity-100'
                        }`}
                      >
                        <GitCommit size={12} className={`flex-shrink-0 mt-0.5 ${isSelected ? 'text-[#2563eb]' : 'text-[#94a3b8]'}`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-[11px] font-semibold truncate ${isSelected ? 'text-[#2563eb]' : 'text-[#64748b]'}`}>
                              version_v{v.version}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium flex-shrink-0 bg-white border border-slate-200 text-accent">
                              {v.section_count}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 mt-1 flex-wrap">
                            <span className={`text-[8px] px-1 py-px rounded font-bold tracking-wide ${TAG_BADGE_STYLES[v.tag] || TAG_BADGE_STYLES.legacy}`}>
                              {TAG_BADGE_LABELS[v.tag] || TAG_BADGE_LABELS.legacy}
                            </span>
                            {v.tag === 'regenerate' && v.regenerated_sections?.length > 0 ? (
                              <span
                                className="text-[9px] px-1.5 py-0.5 rounded-md font-medium text-accent bg-primary-50 border border-primary-100 truncate max-w-full"
                                title={v.regenerated_sections.join(', ')}
                              >
                                {v.regenerated_sections.join(', ').replace(/\.md$/, '')}
                              </span>
                            ) : metaLine ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium text-[#94a3b8] bg-white border border-slate-200 truncate max-w-full" title={metaLine}>
                                {metaLine}
                              </span>
                            ) : null}
                          </div>
                          {v.tag === 'regenerate' && v.regenerated_sections?.length > 0 && metaLine && (
                            <div className="mt-0.5">
                              <span className="inline-block max-w-full text-[9px] px-1.5 py-0.5 rounded-md font-medium text-[#94a3b8] bg-white border border-slate-200 truncate" title={metaLine}>
                                {metaLine}
                              </span>
                            </div>
                          )}
                          {deletedTime && (
                            <div className="text-[8px] text-[#94a3b8] mt-0.5">
                              Deleted: {deletedTime}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* Deleted-row actions menu: preview / export / restore */}
                      <div className="absolute right-1.5 top-1/2 -translate-y-1/2">
                        <VersionActionsMenu
                          menuKey={`deleted-${v.version}`}
                          openMenuKey={openVersionMenuKey}
                          onToggleMenu={handleToggleVersionMenu}
                          disabled={fullDocLoading}
                          items={[
                            {
                              label: 'Preview',
                              icon: Eye,
                              onClick: (e) => handlePreview(e, v.version),
                              className: 'text-slate-700 hover:bg-primary-50',
                              iconClassName: 'text-accent',
                            },
                            {
                              label: 'Export',
                              icon: Download,
                              onClick: (e) => handleExport(e, v.version),
                              className: 'text-slate-700 hover:bg-primary-50',
                              iconClassName: 'text-accent',
                            },
                            {
                              label: 'Restore',
                              icon: RotateCcw,
                              onClick: () => handleRestoreVersion(v.version),
                              className: 'text-slate-700 hover:bg-emerald-50',
                              iconClassName: 'text-emerald-500',
                            },
                          ]}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
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
            {isSelectedVersionDeleted && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-md font-medium bg-rose-50 text-[#dc2626] flex-shrink-0">
                Deleted
              </span>
            )}
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
          ) : selectedVersion && !sectionsLoading && sections.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-[#94a3b8]">
              <FileText size={28} className="opacity-30 mb-3" />
              <span className="text-sm font-semibold text-[#64748b]">
                version_v{selectedVersion} is empty
              </span>
              <span className="text-[11px] mt-1">
                No sections were generated for this version
              </span>
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
              const isRegenerated = regeneratedSections.includes(sec.section_filename);
              return (
                <button
                  key={sec.section_filename}
                  onClick={() => setSelectedSectionFilename(sec.section_filename)}
                  className={`w-full flex items-start gap-2 px-2.5 py-2 rounded-lg text-left transition-all mb-0.5 ${
                    isActive
                      ? 'bg-white shadow-sm border border-[#e5e7eb]'
                      : isRegenerated
                        ? 'bg-primary-50 border border-primary-100 hover:bg-primary-50'
                        : 'hover:bg-[#f1f5f9] border border-transparent'
                  }`}
                >
                  <ChevronRight size={12} className={`flex-shrink-0 mt-0.5 ${
                    isActive ? 'text-[#2563eb]' : isRegenerated ? 'text-accent' : 'text-[#94a3b8]'
                  }`} />
                  <div className="min-w-0 flex-1">
                    <div className={`text-[11px] font-semibold truncate ${
                      isActive ? 'text-[#2563eb]' : isRegenerated ? 'text-accent' : 'text-[#334155]'
                    }`}>
                      {sec.section_filename.replace(/\.md$/, '')}
                    </div>
                    <div className={`text-[9px] mt-0.5 ${isRegenerated ? 'text-accent' : 'text-[#94a3b8]'}`}>
                      {sec.has_content ? (isRegenerated ? 'Re-generated' : 'Generated') : 'Empty'}
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
