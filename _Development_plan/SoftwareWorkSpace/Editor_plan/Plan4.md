# Fix Admonition Rendering & Table Serialization in Tiptap Editor

## Context

The editor supports GitHub-style admonition callouts (`> [!NOTE]`, `> [!WARNING]`, `> [!CAUTION]`, `> [!IMPORTANT]`) via slash commands, but they render as plain blockquotes everywhere:

1. **In the editor** — `marked.parse()` (TiptapEditor.jsx:447) doesn't understand admonition syntax; `[!NOTE]` is treated as plain text inside a blockquote
2. **In preview** — `remarkCallouts()` is defined in SectionContent.jsx:8-37 but never used — only `remarkGfm` is passed to `ReactMarkdown`
3. **Tables** — complex tables fall back to raw HTML serialization instead of markdown pipe syntax (TiptapEditor.jsx:362-371)

## Implementation

### Step 1: Create Callout Node Extension

**New file:** `src/components/CalloutNode.jsx`

Export a TipTap node (`Callout`) and a React component (`CalloutNodeView`) for in-editor rendering.

**Node design:**
- Name: `callout`, Group: `block`, Content: `block+`, Defining: `true`
- Attribute: `type` (NOTE/WARNING/CAUTION/IMPORTANT)
- `parseHTML()` matches `<blockquote>` whose first `<p>` starts with `[!TYPE]`
- `renderHTML()` produces `<blockquote data-callout-type="NOTE"><p>[!NOTE] ...</p></blockquote>`
- `addNodeView()` uses `ReactNodeViewRenderer` to render a styled callout box with colored left border, icon header, and label
- `addCommands()` provides `setCallout({type})`
- `addStorage().markdown.serialize` writes `> [!TYPE]` prefix then renders children
- `addStorage().markdown.parse: {}` (handled by markdown-it's native blockquote parsing + our parseHTML)

```jsx
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import { Info, AlertTriangle, AlertCircle, FileText } from 'lucide-react';
import React from 'react';

const CALLOUT_CONFIG = {
  NOTE:     { label: 'Note',     icon: Info,     color: 'border-l-4 border-blue-500 bg-blue-50 pl-4 py-3 rounded-r-md' },
  WARNING:  { label: 'Warning',  icon: AlertTriangle, color: 'border-l-4 border-amber-500 bg-amber-50 pl-4 py-3 rounded-r-md' },
  CAUTION:  { label: 'Caution',  icon: AlertCircle, color: 'border-l-4 border-orange-500 bg-orange-50 pl-4 py-3 rounded-r-md' },
  IMPORTANT:{ label: 'Important',icon: FileText, color: 'border-l-4 border-green-500 bg-green-50 pl-4 py-3 rounded-r-md' },
};

function CalloutNodeView({ node }) {
  const type = node.attrs.type;
  const config = CALLOUT_CONFIG[type] || CALLOUT_CONFIG.NOTE;
  const Icon = config.icon;
  return (
    <NodeViewWrapper className={`my-3 ${config.color}`} contentEditable={false}>
      <div className="flex items-center gap-2 font-bold text-sm uppercase tracking-wide mb-1">
        <Icon size={16} />
        <span>{config.label}</span>
      </div>
      <NodeViewContent className="text-sm leading-relaxed" />
    </NodeViewWrapper>
  );
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  draggable: true,
  addAttributes() {
    return {
      type: {
        default: null,
        parseHTML: (el) => {
          const firstP = el.querySelector?.('p');
          if (!firstP) return null;
          const match = firstP.textContent.trim().match(/^\[!(NOTE|WARNING|CAUTION|IMPORTANT)\]/);
          return match ? match[1] : null;
        },
        renderHTML: (attrs) => ({ 'data-callout-type': attrs.type }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'blockquote', getAttrs: (el) => {
      const firstP = el.querySelector?.('p');
      if (!firstP) return false;
      return firstP.textContent.trim().match(/^\[!(NOTE|WARNING|CAUTION|IMPORTANT)\]/) ? null : false;
    }}];
  },
  renderHTML({ node, HTMLAttributes }) {
    const type = node.attrs.type;
    return ['blockquote', mergeAttributes(HTMLAttributes, { 'data-callout-type': type }), ['p', `[!${type}] `, 0]];
  },
  addCommands() {
    return {
      setCallout: (attrs) => ({ commands }) =>
        commands.insertContent({ type: this.name, attrs: { type: attrs.type }, content: [{ type: 'paragraph' }] }),
    };
  },
  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const type = node.attrs.type;
          // Serialize children as blockquote content, prefixing first with [!TYPE]
          node.content.forEach((child, i) => {
            if (i === 0) {
              state.write('> [!'+type+'] ');
              state.renderInline(child);
            } else {
              state.write('> ');
              state.renderBlock(child);
            }
          });
          state.closeBlock(node);
        },
        parse: {},
      },
    };
  },
  addNodeView() {
    return ReactNodeViewRenderer(CalloutNodeView);
  },
});
```

### Step 2: Register Callout in TiptapEditor.jsx

**File:** `src/components/TiptapEditor.jsx`

1. Import: Add `Callout` to the import line (line 27 area)
2. Register: Add `Callout` to the `extensions` array (after line 422, before SlashCommands)
3. Update SlashCommands: Change the `/note`, `/warning`, `/caution`, `/important` commands (lines 127-160 in SlashCommands.jsx) to use `editor.chain().focus().deleteRange(range).setCallout({type: 'NOTE'}).run()` instead of `insertContent('> [!NOTE]\\n')`

### Step 3: Wire Up `remarkCallouts` in Preview

**File:** `src/views/SoftwareWorkspace/SectionContent.jsx`

1. Import the existing `remarkCallouts` function (it's already defined at lines 8-37, just not used)
2. Pass it to `ReactMarkdown` at line 95:
```jsx
<ReactMarkdown remarkPlugins={[remarkGfm, remarkCallouts]}>
```
3. Add a `components` prop to render blockquotes with `data-callout` as styled callout cards (use the existing `CALLOUT_CLASSES` and `CALLOUT_LABELS` constants defined at lines 39-47)

```jsx
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkCallouts]}
  components={{
    blockquote: ({ node, ...props }) => {
      const calloutType = node?.data?.hProperties?.['data-callout'];
      if (calloutType && CALLOUT_LABELS[calloutType]) {
        const config = { NOTE: CALLOUT_CLASSES.NOTE, WARNING: CALLOUT_CLASSES.WARNING, CAUTION: CALLOUT_CLASSES.CAUTION, IMPORTANT: CALLOUT_CLASSES.IMPORTANT };
        return (
          <blockquote className={config[calloutType]}>
            <strong>{CALLOUT_LABELS[calloutType]}:</strong> <span {...props}>{props.children}</span>
          </blockquote>
        );
      }
      return <blockquote {...props} />;
    }
  }}
>
```

### Step 4: Fix Table HTML Fallback (Optional)

**File:** `src/components/TiptapEditor.jsx` (lines 343-418)

The `markdownTable` extension falls back to raw HTML when body rows contain `tableHeader` cells (line 362-371). The fix is to improve the serialization to handle mixed headers by converting header cells in body rows to regular cells before serializing, or to add a proper `parse` function so markdown tables roundtrip correctly.

For now, leave this as-is since it only affects edge-case tables and the HTML output is still valid.

## Files Modified

| File | Action |
|------|--------|
| `src/components/CalloutNode.jsx` | **New** — Callout TipTap node + ReactNodeView |
| `src/components/TiptapEditor.jsx` | Import Callout, register in extensions array |
| `src/components/SlashCommands.jsx` | Replace `insertContent('> [!...]\n')` with `setCallout({type: '...'})` |
| `src/views/SoftwareWorkspace/SectionContent.jsx` | Wire `remarkCallouts` + custom blockquote component |

## Verification

1. Open editor → type `/note` → should render a styled callout box with blue left border and "Note" label
2. Type `/warning` → should render amber callout with "Warning" label
3. Switch to preview mode → admonitions should render as styled callout cards (not plain blockquotes)
4. Edit content inside callout → should roundtrip correctly through markdown serialization
5. Create a table → switch to preview → should render as markdown table (not raw HTML)
