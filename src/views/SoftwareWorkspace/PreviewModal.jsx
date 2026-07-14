import React, { useState } from "react";
import { FileText, X, List, ChevronRight, ChevronDown, PanelRightClose, PanelRightOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function PreviewModal({ displayDoc, onClose }) {
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [collapsedHeadings, setCollapsedHeadings] = useState(new Set());

  // Extract headings for the TOC
  const headings = displayDoc
    ? displayDoc
        .split('\n')
        .filter(line => /^#{1,6}\s+/.test(line))
        .map((line, index) => {
          const match = line.match(/^(#{1,6})\s+(.*)/);
          const text = match[2].trim();
          return { 
            level: match[1].length, 
            text,
            slug: text.toLowerCase().replace(/[^\w]+/g, '-')
          };
        })
    : [];

  // Compute visibility and tree hierarchy properties for flat headings
  const visibleHeadings = [];
  let hideThreshold = null;

  for (let i = 0; i < headings.length; i++) {
    const h = headings[i];
    
    if (hideThreshold !== null && h.level <= hideThreshold) {
      hideThreshold = null; // exited the collapsed section
    }

    if (hideThreshold === null) {
      const hasChildren = i + 1 < headings.length && headings[i + 1].level > h.level;
      const isCollapsed = collapsedHeadings.has(i);
      
      visibleHeadings.push({ ...h, originalIndex: i, hasChildren, isCollapsed });
      
      if (isCollapsed) {
        hideThreshold = h.level;
      }
    }
  }

  const toggleHeading = (index) => {
    setCollapsedHeadings(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) newSet.delete(index);
      else newSet.add(index);
      return newSet;
    });
  };

  const scrollToHeading = (slug) => {
    const element = document.getElementById(slug);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderHeading = ({node, children, ...props}) => {
    const extractText = (kids) => {
      if (typeof kids === 'string' || typeof kids === 'number') return String(kids);
      if (Array.isArray(kids)) return kids.map(extractText).join('');
      if (kids && kids.props && kids.props.children) return extractText(kids.props.children);
      return '';
    };
    const text = extractText(children);
    const slug = (text || `h-${Math.random()}`).toLowerCase().replace(/[^\w]+/g, '-');
    const Tag = node.tagName;
    return <Tag id={slug} className="scroll-mt-6" {...props}>{children}</Tag>;
  };

  const mdComponents = {
    h1: renderHeading, h2: renderHeading, h3: renderHeading, 
    h4: renderHeading, h5: renderHeading, h6: renderHeading,
    img: ({node, ...props}) => (
      <span className="block my-6 text-center">
        <img className="max-w-full inline-block shadow-sm border border-gray-200 rounded" style={{ maxHeight: '15cm' }} {...props} />
      </span>
    )
  };

  return (
    <div className="fixed inset-0 z-[100] pl-[150px] pr-[100px] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-xl w-[95vw] max-w-7xl max-h-[90vh] flex flex-col overflow-hidden transition-all duration-300">
        <div className="flex items-center justify-between px-4 py-3 border-b border-light bg-muted/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 rounded-md text-accent">
              <FileText size={16} />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-bold text-primary">
                ODT Document Preview
              </h3>
              <div className="text-[10px] text-secondary">
                Open Document Text format
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsTocOpen(!isTocOpen)}
              className="px-2 py-1.5 hover:bg-primary-50 rounded-md text-accent transition-colors flex items-center gap-1 text-xs font-semibold"
              title="Toggle Table of Contents"
            >
              {isTocOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
              {isTocOpen ? "Hide TOC" : "Show TOC"}
            </button>
            <div className="w-px h-4 bg-primary-200 mx-1"></div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-primary-50 rounded-md text-muted hover:text-secondary transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden flex">
          {/* Main Content Area */}
          <div className="flex-1 overflow-auto p-8 bg-slate-200 flex flex-col items-center gap-8">
          <style>{`
            .odt-preview.prose table {
              box-shadow: 2px 2px 4px rgba(128, 128, 128, 0.5);
              border-collapse: collapse;
              width: 100%;
              margin-bottom: 1.5rem;
              margin-top: 1.5rem;
            }
            .odt-preview.prose th, .odt-preview.prose td {
              padding: 0.35rem 0.5rem;
            }
            
            /* Default grey tables */
            .odt-preview.prose th {
              background-color: #f1f5f9;
              border: 1px solid #cbd5e1;
              color: #0f172a;
              font-weight: bold;
            }
            .odt-preview.prose td {
              background-color: transparent;
              border: 1px solid #cbd5e1;
              color: #0f172a;
            }

            /* First two navy tables */
            .odt-preview.prose table:nth-of-type(1) th,
            .odt-preview.prose table:nth-of-type(2) th {
              background-color: #1e3a8a;
              color: #ffffff;
              border: 1px solid #0f172a;
            }
            .odt-preview.prose table:nth-of-type(1) td,
            .odt-preview.prose table:nth-of-type(2) td {
              border: 1px solid #0f172a;
            }
          `}</style>

          {displayDoc
            ? displayDoc
                .split(/(?:^|\n)(?=# )/)
                .filter(Boolean)
                .map((pageContent, index) => (
                  <div
                    key={index}
                    className="bg-white shadow-lg w-full max-w-[21cm] min-h-[29.7cm] p-12 shrink-0"
                  >
                    <div
                      className="odt-preview prose prose-sm max-w-none text-primary leading-[1.5] text-justify prose-headings:text-left prose-headings:font-bold prose-a:text-accent font-sans"
                    >
                      <ReactMarkdown 
                        remarkPlugins={[remarkGfm]} 
                        components={mdComponents}
                        urlTransform={(url) => url}
                      >
                  {pageContent}
                </ReactMarkdown>
                    </div>
                  </div>
                ))
            : null}
          </div>

          {/* Table of Contents Sidebar */}
          {isTocOpen && (
            <div className="w-80 bg-default border-l border-light flex flex-col flex-shrink-0">
              <div className="p-4 border-b border-light bg-muted/50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <List size={16} className="text-secondary" />
                  <h4 className="text-sm font-bold text-primary">Table of Contents</h4>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                {visibleHeadings.length > 0 ? (
                  <ul className="space-y-1">
                    {visibleHeadings.map((h) => (
                      <li 
                        key={h.originalIndex} 
                        className="flex items-start gap-1"
                        style={{ paddingLeft: `${(h.level - 1) * 16}px` }}
                      >
                        {h.hasChildren ? (
                          <button 
                            onClick={() => toggleHeading(h.originalIndex)}
                            className="p-0.5 hover:bg-slate-100 rounded mt-0.5 text-secondary flex-shrink-0"
                          >
                            {h.isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                          </button>
                        ) : (
                          <div className="w-[18px] flex-shrink-0"></div>
                        )}
                        <span 
                          onClick={() => scrollToHeading(h.slug)}
                          className={`text-xs ${h.level === 1 ? 'font-bold text-primary' : 'text-secondary'} hover:text-accent cursor-pointer transition-colors leading-tight py-1`}
                          title={h.text}
                        >
                          {h.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-sm text-muted text-center mt-10">No headings found</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
