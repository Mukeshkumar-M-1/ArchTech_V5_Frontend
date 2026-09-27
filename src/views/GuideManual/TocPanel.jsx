import { useEffect, useCallback } from 'react';
import { ListTree } from 'lucide-react';

export default function TocPanel({ toc, scrollRef, pageId, activeId, onActiveChange }) {
  const setActiveId = onActiveChange;

  // Scroll-spy: watch headings inside the center scroll container
  useEffect(() => {
    setActiveId(toc[0]?.id);
    const container = scrollRef.current;
    if (!container || toc.length === 0) return undefined;

    const headings = toc
      .map(({ id }) => container.querySelector(`#${CSS.escape(id)}`))
      .filter(Boolean);

    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the topmost heading currently visible
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActiveId(visible[0].target.id);
      },
      { root: container, rootMargin: '0px 0px -70% 0px', threshold: 0 }
    );

    headings.forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [toc, scrollRef, pageId, setActiveId]);

  const handleClick = useCallback((id) => {
    const container = scrollRef.current;
    const el = container?.querySelector(`#${CSS.escape(id)}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }, [scrollRef, setActiveId]);

  if (toc.length === 0) return null;

  return (
    <aside className="w-[260px] shrink-0 hidden xl:block bg-white border-l border-slate-100 overflow-y-auto">
      <div className="px-6 py-8 sticky top-0">
        <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400 mb-4">
          <ListTree size={13} />
          On this page
        </p>
        <nav className="flex flex-col border-l border-slate-100">
          {toc.map(({ id, text, depth }) => (
            <button
              key={id}
              onClick={() => handleClick(id)}
              className={`text-left text-[12px] leading-snug py-1.5 pl-3 -ml-px border-l-2 transition-all duration-200 truncate ${
                depth === 3 ? 'pl-6' : ''
              } ${
                activeId === id
                  ? 'border-primary-500 text-primary-600 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-900 hover:border-slate-300'
              }`}
              title={text}
            >
              {text}
            </button>
          ))}
        </nav>
      </div>
    </aside>
  );
}
