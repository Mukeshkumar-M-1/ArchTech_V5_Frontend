import { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate } from 'react-router-dom';
import { StickyNote, TriangleAlert, OctagonAlert, CircleAlert } from 'lucide-react';
import { remarkCallouts, CALLOUT_CLASSES } from '../../utils/remarkCallouts';
import slugify from '../../utils/slugify';

const CALLOUT_ICONS = {
  NOTE: StickyNote,
  WARNING: TriangleAlert,
  CAUTION: OctagonAlert,
  IMPORTANT: CircleAlert,
};

const CALLOUT_LABELS = {
  NOTE: 'Note',
  WARNING: 'Warning',
  CAUTION: 'Caution',
  IMPORTANT: 'Important',
};

function toText(children) {
  if (children === null || children === undefined) return '';
  if (typeof children === 'string' || typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(toText).join('');
  if (children.props?.children) return toText(children.props.children);
  return '';
}

function Heading({ Tag, children }) {
  const id = slugify(toText(children));
  return <Tag id={id} className="scroll-mt-24">{children}</Tag>;
}

export default function MarkdownContent({ md }) {
  const navigate = useNavigate();

  const components = useMemo(
    () => ({
      h1: (props) => <Heading Tag="h1" {...props} />,
      h2: (props) => <Heading Tag="h2" {...props} />,
      h3: (props) => <Heading Tag="h3" {...props} />,
      a: ({ href = '', children, ...props }) => (
        <a
          href={href}
          onClick={(e) => {
            if (href.startsWith('/')) {
              e.preventDefault();
              navigate(href);
            }
          }}
          {...props}
        >
          {children}
        </a>
      ),
      blockquote: ({ children, ...props }) => {
        const calloutType = props['data-callout'];
        if (calloutType && CALLOUT_CLASSES[calloutType]) {
          const Icon = CALLOUT_ICONS[calloutType];
          return (
            <blockquote className={`my-4 not-italic quotes-none [&>p:first-of-type]:before:content-none [&>p:last-of-type]:after:content-none ${CALLOUT_CLASSES[calloutType]}`}>
              {Icon && (
                <p className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest mb-1 text-slate-500">
                  <Icon size={14} strokeWidth={2.25} />
                  {CALLOUT_LABELS[calloutType]}
                </p>
              )}
              {children}
            </blockquote>
          );
        }
        return <blockquote {...props}>{children}</blockquote>;
      },
      img: ({ src, alt, ...props }) => (
        <span className="block my-6">
          <img
            src={src}
            alt={alt || ''}
            loading="lazy"
            className="w-full rounded-xl border border-slate-200 shadow-sm bg-white"
            {...props}
          />
          {alt && (
            <span className="block mt-2 text-center text-[11px] text-slate-400 font-medium">
              {alt}
            </span>
          )}
        </span>
      ),
    }),
    []
  );

  return (
    <div className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-[#1f2328] prose-h1:text-[2em] prose-h1:font-black prose-h1:mb-4 prose-h2:text-[1.4em] prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-3 prose-h3:text-[1.15em] prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-2 prose-p:text-[14px] prose-p:leading-[1.8] prose-p:text-slate-700 prose-li:text-[14px] prose-li:leading-[1.8] prose-code:bg-[#f6f8fa] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.9em] prose-code:text-[#cf222e] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-[#f6f8fa] prose-pre:rounded-lg prose-pre:border prose-pre:border-[#d0d7de] prose-pre:overflow-x-auto prose-a:text-[#0969da] prose-strong:font-bold prose-blockquote:not-italic prose-hr:border-[#d0d7de] prose-hr:my-8">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkCallouts]} components={components}>
        {md}
      </ReactMarkdown>
    </div>
  );
}
