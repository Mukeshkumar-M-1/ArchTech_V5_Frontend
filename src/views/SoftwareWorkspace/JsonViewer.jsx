import { useState } from 'react';
import { ChevronRight, ChevronDown, FileText, GitBranch, Sparkles, Table2, Link as LinkIcon } from 'lucide-react';

/**
 * JsonViewer - Displays Phase 3 analysis data in a structured, collapsible panel.
 * @param {Object} props
 * @param {Object|null} props.data - Phase 3 analysis result object.
 * @param {boolean} props.loading - Whether data is being fetched.
 */
export default function JsonViewer({ data, loading }) {
  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white/50 backdrop-blur-md">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-inner">
          <div className="w-5 h-5 border-[3px] border-slate-300 border-t-primary-500 rounded-full animate-spin" />
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Loading Analysis...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-white/50 backdrop-blur-md text-slate-400">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-4 shadow-inner">
          <Sparkles size={20} className="text-slate-300" />
        </div>
        <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">No analysis data</span>
        <span className="text-[10px] font-semibold text-slate-400 mt-1.5">Waiting for processing...</span>
      </div>
    );
  }

  const fieldCounts = data.fields?.fields_by_file
    ? Object.values(data.fields.fields_by_file).reduce((sum, f) => sum + (f?.length || 0), 0)
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-slate-50/50 p-4 space-y-3 relative">
      {/* Document Tree */}
      {data.document_tree?.length > 0 && (
        <CollapsibleSection
          title={`Document Tree`}
          subtitle={`${data.document_tree.length} sections`}
          icon={<FileText size={14} className="text-primary-500" />}
          defaultOpen
        >
          {data.document_tree.map((node, i) => (
            <DocumentTreeNode key={i} node={node} depth={0} />
          ))}
        </CollapsibleSection>
      )}

      {/* Table of Contents */}
      {data.table_of_contents?.length > 0 && (
        <CollapsibleSection
          title="Table of Contents"
          subtitle={`${data.table_of_contents.length} entries`}
          icon={<GitBranch size={14} className="text-primary-500" />}
          defaultOpen
        >
          {data.table_of_contents.map((toc, i) => (
            <div key={i} className="group flex items-center gap-3 px-3 py-2 text-xs border-b border-slate-100/50 last:border-0 hover:bg-white transition-colors cursor-default">
              <span className="font-black text-slate-300 w-8 text-right shrink-0 tracking-wider group-hover:text-primary-400 transition-colors">{toc.section_number}</span>
              <span className="text-slate-600 font-bold truncate group-hover:text-slate-900 transition-colors">{toc.title}</span>
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Fields */}
      {fieldCounts > 0 && (
        <CollapsibleSection
          title="Fields"
          subtitle={`${fieldCounts} total`}
          icon={<Table2 size={14} className="text-primary-500" />}
        >
          <div className="p-3 space-y-3 max-h-60 overflow-y-auto">
            {Object.entries(data.fields?.fields_by_file || {}).map(([filename, fields]) => {
              if (!fields?.length) return null;
              const placeholders = fields.filter((f) => f.field_type === 'placeholder').length;
              const inferred = fields.filter((f) => f.field_type === 'inferred').length;
              const blankTables = fields.filter((f) => f.field_type === 'blank_table').length;
              return (
                <div key={filename} className="bg-slate-50 rounded-xl p-2.5 border border-slate-100">
                  <div className="inline-block text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white shadow-sm rounded-lg px-2 py-1 mb-2">
                    {filename}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {placeholders > 0 && (
                      <span className="text-[9px] uppercase tracking-wider px-2 py-1 bg-amber-50 border border-amber-200/50 text-amber-600 rounded-lg font-black shadow-sm">
                        {placeholders} placeholders
                      </span>
                    )}
                    {inferred > 0 && (
                      <span className="text-[9px] uppercase tracking-wider px-2 py-1 bg-primary-50 border border-primary-200/50 text-primary-600 rounded-lg font-black shadow-sm">
                        {inferred} inferred
                      </span>
                    )}
                    {blankTables > 0 && (
                      <span className="text-[9px] uppercase tracking-wider px-2 py-1 bg-slate-200 border border-slate-300/50 text-slate-600 rounded-lg font-black shadow-sm">
                        {blankTables} blank tables
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Dependency DAG */}
      {data.dependency_dag && Object.keys(data.dependency_dag).length > 0 && (
        <CollapsibleSection
          title="Dependencies"
          subtitle={`${Object.keys(data.dependency_dag).length} files`}
          icon={<LinkIcon size={14} className="text-primary-500" />}
          defaultOpen
        >
          {Object.entries(data.dependency_dag).map(([file, deps]) => (
            <div key={file} className="px-3 py-2.5 border-b border-slate-100/50 last:border-0 hover:bg-white transition-colors">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary-500 shadow-[0_0_8px_rgba(var(--color-primary-500),0.6)]" />
                <span className="font-black text-slate-700 text-xs tracking-wide truncate">{file}</span>
                {deps?.length > 0 && (
                  <span className="text-[9px] font-black text-slate-400 shrink-0 bg-slate-100 px-1.5 py-0.5 rounded-full">{deps.length}</span>
                )}
              </div>
              {deps?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 ml-3.5">
                  {deps.map((dep, di) => (
                    <span key={di} className="text-[9px] uppercase tracking-wider px-2 py-0.5 bg-primary-50 border border-primary-100 text-primary-600 rounded-lg font-bold shadow-sm truncate max-w-[150px]">
                      {dep}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* Styling Rules */}
      {data.styling_rules && Object.keys(data.styling_rules).length > 0 && (
        <CollapsibleSection
          title="Styling Rules"
          subtitle={`${Object.values(data.styling_rules).reduce((s, r) => s + (r?.length || 0), 0)} rules`}
          icon={<Sparkles size={14} className="text-primary-500" />}
        >
          <div className="p-3 space-y-3 max-h-60 overflow-y-auto">
            {Object.entries(data.styling_rules).map(([filename, rules]) => (
              <div key={filename} className="bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                <div className="inline-block text-[10px] font-black uppercase tracking-widest text-slate-500 bg-white shadow-sm rounded-lg px-2 py-1 mb-2">
                  {filename}
                </div>
                <div className="space-y-2">
                  {(rules || []).map((rule, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-800 truncate flex-1 tracking-wide">
                          {rule.subsection || rule.section}
                        </span>
                        <span className={`text-[9px] px-2 py-1 rounded-lg font-black uppercase tracking-widest shadow-sm shrink-0 ${
                          rule.output_type === 'paragraph' ? 'bg-amber-50 text-amber-600 border border-amber-200/50' :
                          rule.output_type === 'table' ? 'bg-primary-50 text-primary-600 border border-primary-200/50' :
                          rule.output_type === 'diagram' ? 'bg-purple-50 text-purple-600 border border-purple-200/50' :
                          rule.output_type === 'mixed' ? 'bg-green-50 text-green-600 border border-green-200/50' :
                          'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {rule.output_type || 'content'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {rule.needs_tables && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-primary-50 text-primary-600 rounded-md">tables ({rule.table_count ?? 0})</span>}
                        {rule.needs_paragraphs && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded-md">paragraphs</span>}
                        {rule.needs_diagrams && <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-md">diagrams</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CollapsibleSection>
      )}
    </div>
  );
}

function CollapsibleSection({ title, subtitle, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-slate-200/80 rounded-[16px] bg-white/80 backdrop-blur-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50/80 transition-colors group"
      >
        <span className="p-1.5 rounded-xl bg-primary-50/50 group-hover:bg-primary-100 transition-colors shrink-0">
          {icon}
        </span>
        <span className="flex-1 text-[10px] font-black uppercase tracking-widest text-slate-800">{title}</span>
        {subtitle && <span className="text-[9px] font-black tracking-wider text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{subtitle}</span>}
        <span className="p-1 rounded-lg hover:bg-slate-200 transition-colors shrink-0 ml-1">
          {open ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
        </span>
      </button>
      {open && (
        <div className="border-t border-slate-100/80 bg-white/40">
          {children}
        </div>
      )}
    </div>
  );
}

function DocumentTreeNode({ node, depth }) {
  const [open, setOpen] = useState(depth < 1);
  const hasSubsections = node.subsections && node.subsections.length > 0;
  const level = node.level || depth;

  const levelColors = {
    1: 'bg-primary-100 text-primary-700 border border-primary-200/50',
    2: 'bg-purple-100 text-purple-700 border border-purple-200/50',
    3: 'bg-amber-100 text-amber-700 border border-amber-200/50',
    4: 'bg-green-100 text-green-700 border border-green-200/50',
    5: 'bg-rose-100 text-rose-700 border border-rose-200/50',
  };

  const levelLabels = { 1: 'H1', 2: 'H2', 3: 'H3', 4: 'H4', 5: 'H5' };

  return (
    <div className="py-0.5">
      <div
        className="group flex items-center gap-2 py-1.5 text-xs hover:bg-white rounded-lg px-2 cursor-pointer transition-all duration-300 hover:shadow-sm border border-transparent hover:border-slate-100 hover:translate-x-1"
        style={{ marginLeft: `${depth * 14 + 4}px`, marginRight: '4px' }}
        onClick={() => hasSubsections && setOpen((o) => !o)}
      >
        <span className="w-4 flex justify-center shrink-0">
          {hasSubsections ? (
            <span className="text-slate-300 group-hover:text-primary-500 transition-colors">
              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            </span>
          ) : (
            <span className="w-1.5 h-1.5 rounded-full bg-slate-200 group-hover:bg-primary-300 transition-colors" />
          )}
        </span>
        <span className={`text-[8px] px-1.5 py-0.5 rounded shadow-sm font-black uppercase tracking-widest ${levelColors[level] || 'bg-slate-100 text-slate-500 border border-slate-200'} shrink-0`}>
          {levelLabels[level] || `H${level}`}
        </span>
        <span className="font-black text-slate-400 text-[10px] w-6 shrink-0 group-hover:text-primary-400 transition-colors tracking-wider">
          {node.section_number}
        </span>
        <span className="font-bold text-slate-600 truncate group-hover:text-slate-900 transition-colors">
          {node.heading}
        </span>
      </div>
      {hasSubsections && open && (
        <div className="mt-0.5">
          {node.subsections.map((sub, i) => (
            <DocumentTreeNode key={i} node={sub} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
