import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { GUIDE_PAGES } from '../../guides/registry';
import slugify, { resetSlugs } from '../../utils/slugify';
import GuideSidebarList from './GuideSidebarList';
import MarkdownContent from './MarkdownContent';
import TocPanel from './TocPanel';

// Extract h2/h3 headings from raw markdown for the right-hand TOC
function extractToc(md) {
  resetSlugs();
  const toc = [];
  const lines = md.split('\n');
  let inCodeBlock = false;
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const depth = match[1].length;
      const text = match[2].replace(/[#*`]/g, '').trim();
      toc.push({ depth, text, id: slugify(text, true) });
    }
  }
  return toc;
}

export default function GuidePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeHeadingId, setActiveHeadingId] = useState(null);
  const scrollRef = useRef(null);

  // URL is the single source of truth for the active page (?page=)
  const pageParam = searchParams.get('page');
  const activeId = GUIDE_PAGES.some((p) => p.id === pageParam) ? pageParam : GUIDE_PAGES[0]?.id;

  const selectPage = useCallback((id) => {
    setSearchParams(id ? { page: id } : {}, { replace: false });
  }, [setSearchParams]);

  const activePage = GUIDE_PAGES.find((p) => p.id === activeId) || GUIDE_PAGES[0];

  // Reset scroll position and slugs when switching pages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setActiveHeadingId(null);
  }, [activeId]);

  const toc = useMemo(
    () => (activePage ? extractToc(activePage.md) : []),
    [activePage]
  );

  const activeHeading = toc.find((h) => h.id === activeHeadingId);

  if (!activePage) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white text-slate-400 text-sm">
        No guide pages found in src/guides.
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-black font-sans">
      {/* Left: pages menu */}
      <GuideSidebarList
        pages={GUIDE_PAGES}
        activeId={activePage.id}
        onSelect={selectPage}
      />

      {/* Center: content */}
      <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
        {/* Top bar */}
        <header className="shrink-0 h-16 flex items-center gap-3 px-8 border-b border-slate-100 bg-white/90 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                Guide / Manual
              </span>
              <span className="text-sm font-bold text-slate-900">
                {activePage.title}
              </span>
            </div>
            {activeHeading && (
              <>
                <span className="ml-2 text-slate-200">/</span>
                <span className="text-sm font-semibold text-slate-500 truncate max-w-[320px]">
                  {activeHeading.text}
                </span>
              </>
            )}
          </div>
        </header>

        {/* Scrollable markdown content */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-8 py-10 relative z-10">
            <MarkdownContent md={activePage.md} />
          </div>
        </div>
      </main>

      {/* Right: on-this-page TOC */}
      <TocPanel
        toc={toc}
        scrollRef={scrollRef}
        pageId={activePage.id}
        activeId={activeHeadingId}
        onActiveChange={setActiveHeadingId}
      />
    </div>
  );
}
