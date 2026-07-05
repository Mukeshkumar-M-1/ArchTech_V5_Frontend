# Plan: Add Slash Commands for Headings 4/5/6, Callouts/Notes, Image Upload

## Context

The editor currently supports 10 slash commands (H1-H3, lists, quote, code block, table, divider). The user wants to add 3 new groups: Heading 4/5/6, callout/note blocks, and image upload. The editor uses TipTap with `tiptap-markdown` for serialization and `react-markdown + remarkGfm` for preview rendering.

## Files to Modify

| File | Role |
|------|------|
| `src/components/SlashCommands.jsx` | Add new command items to `getSuggestionItems()` |
| `src/components/TiptapEditor.jsx` | Add `ImageNode` extension, bubble menu buttons, context menu entries |
| `src/views/SoftwareWorkspace/SectionContent.jsx` | Add callout remark plugin for styled preview rendering |

## No Changes Needed

- `src/components/CommandsList.jsx` — Generic rendering, handles any item shape
- No new npm dependencies required

---

## Step 1: Headings 4, 5, 6

**Trivial change. StarterKit already supports all heading levels 1–6.**

### `src/components/SlashCommands.jsx`

1. Add `Heading4`, `Heading5`, `Heading6` to lucide import (line 7)
2. Add 3 new items to `getSuggestionItems()` after the existing H3 item (line 62):

```javascript
{
  title: 'Heading 4', description: 'Sub-section heading',
  icon: <Heading4 size={18} />, iconBg: 'bg-slate-100',
  command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run(),
},
// ... same for level 5 and 6
```

### `src/components/TiptapEditor.jsx`

1. Add `Heading4`, `Heading5`, `Heading6` to lucide import (line 23)
2. Add 3 entries to `turnIntoItems` array (after H3, ~line 242):
   ```javascript
   { key: 'heading 4', label: 'Heading 4', icon: <Heading4 size={13} /> },
   { key: 'heading 5', label: 'Heading 5', icon: <Heading5 size={13} /> },
   { key: 'heading 6', label: 'Heading 6', icon: <Heading6 size={13} /> },
   ```
3. Add 3 cases in `handleCtxAction` switch (after H3 case, ~line 510):
   ```javascript
   case 'turn-heading 4':
     editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 4 }).run(); break;
   // ... same for 5, 6
   ```
4. Add 3 bubble menu buttons (after existing H2 button, ~line 608):
   ```javascript
   <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
     active={editor.isActive('heading', { level: 4 })} title="Heading 4">
     <Heading4 size={15} />
   </BubbleBtn>
   // ... same for 5, 6
   ```

---

## Step 2: Note / Callout / Alert Blocks

These insert markdown callout syntax (`> [!NOTE]`, `> [!CAUTION]`, etc.) via blockquotes.

### `src/components/SlashCommands.jsx`

1. Add `Info`, `AlertTriangle`, `AlertCircle`, `FileText` to lucide import (line 7)
2. Add 4 new items to `getSuggestionItems()` after the Quote item (line 98):

```javascript
// Note / Info
{
  title: 'Note', description: 'Informative callout',
  icon: <Info size={18} />, iconBg: 'bg-blue-50',
  command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('\n> [!NOTE]\n').run(),
},
// Warning
{
  title: 'Warning', description: 'Warning callout',
  icon: <AlertTriangle size={18} />, iconBg: 'bg-amber-50',
  command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('\n> [!WARNING]\n').run(),
},
// Caution
{
  title: 'Caution', description: 'Caution callout',
  icon: <AlertCircle size={18} />, iconBg: 'bg-orange-50',
  command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('\n> [!CAUTION]\n').run(),
},
// Important
{
  title: 'Important', description: 'Important callout',
  icon: <FileText size={18} />, iconBg: 'bg-green-50',
  command: ({ editor, range }) => editor.chain().focus().deleteRange(range).insertContent('\n> [!IMPORTANT]\n').run(),
},
```

**How it works:** `insertContent` with `> [!NOTE]\n` inserts raw markdown. `tiptap-markdown`'s blockquote serializer (using `prosemirror-markdown`'s `defaultMarkdownSerializer.nodes.blockquote`) serializes blockquotes as `> ` prefixed content. The `[!NOTE]` text is just a paragraph inside the blockquote — it survives the round-trip because it's literal text content.

### `src/views/SoftwareWorkspace/SectionContent.jsx`

Add a custom remark plugin and component mapping for styled callout rendering:

1. Add `remarkCallouts` plugin inline (before the component):

```javascript
function remarkCallouts() {
  const calloutConfig = {
    NOTE: { class: 'border-l-4 border-blue-400 bg-blue-50 text-blue-900', icon: 'Note' },
    WARNING: { class: 'border-l-4 border-amber-400 bg-amber-50 text-amber-900', icon: 'Warning' },
    CAUTION: { class: 'border-l-4 border-orange-400 bg-orange-50 text-orange-900', icon: 'Caution' },
    IMPORTANT: { class: 'border-l-4 border-green-400 bg-green-50 text-green-900', icon: 'Important' },
  };

  return (tree) => {
    const visit = (node) => {
      if (node.type === 'blockquote' && node.children?.length > 0) {
        const first = node.children[0];
        if (first.type === 'paragraph' && first.children?.length > 0) {
          const firstText = first.children[0];
          if (firstText.type === 'text' && /^\[!(NOTE|WARNING|CAUTION|IMPORTANT)\]/.test(firstText.value)) {
            const match = firstText.value.match(/^\[!(\w+)\]/);
            if (match) {
              const type = match[1];
              firstText.value = firstText.value.slice(match[0].length).trimStart();
              node.callout = type;
            }
          }
        }
      }
      if (node.children) node.children.forEach(visit);
    };
    visit(tree);
  };
}
```

2. Update the `ReactMarkdown` component (line 52) to pass the plugin and a `components` prop:

```javascript
<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkCallouts]}
  components={{
    blockquote: ({ node, ...props }) => {
      if (node?.data?.callout) {
        const type = node.data.callout;
        const cfg = {
          NOTE: 'border-l-4 border-blue-400 bg-blue-50 pl-4 py-3 rounded-r-md',
          WARNING: 'border-l-4 border-amber-400 bg-amber-50 pl-4 py-3 rounded-r-md',
          CAUTION: 'border-l-4 border-orange-400 bg-orange-50 pl-4 py-3 rounded-r-md',
          IMPORTANT: 'border-l-4 border-green-400 bg-green-50 pl-4 py-3 rounded-r-md',
        };
        const label = {
          NOTE: 'Note', WARNING: 'Warning', CAUTION: 'Caution', IMPORTANT: 'Important',
        };
        return (
          <div className={`${cfg[type] || cfg.NOTE} font-medium`}>
            <strong className="font-bold">{label[type]}</strong>
            {' '}
            <span className="font-normal" {...props} />
          </div>
        );
      }
      return <blockquote {...props} className="border-l-4 border-slate-200 pl-4 italic text-slate-600" />;
    },
  }}
>
```

---

## Step 3: Image Upload

Create a custom TipTap inline node to handle images, since `@tiptap/extension-image` is not installed.

### `src/components/TiptapEditor.jsx`

1. Add a new `ImageNode` extension after the `MermaidCodeBlock` (~line 98):

```javascript
const ImageNode = Extension.create({
  name: 'imageNode',
  inline: true,
  group: 'inline',
  selectable: true,
  atom: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'img' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', { ...HTMLAttributes, class: 'max-w-full rounded-lg' }];
  },

  addStorage() {
    return {
      markdown: {
        serialize: (state, node) => {
          const src = state.esc(node.attrs.src);
          const alt = node.attrs.alt ? state.esc(node.attrs.alt) : '';
          state.write(`![${alt}](${src})`);
        },
      },
    };
  },
});
```

2. Register `ImageNode` in `useEditor` extensions array (~line 444, right after `StarterKit.configure(...)`):
   ```javascript
   ImageNode,
   ```

3. Add `Image` to lucide import (line 19-24)

### `src/components/SlashCommands.jsx`

Add 1 new item to `getSuggestionItems()`:

```javascript
{
  title: 'Image', description: 'Upload an image',
  icon: <Image size={18} />, iconBg: 'bg-emerald-50',
  command: ({ editor, range }) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        editor.chain().focus().deleteRange(range)
          .insertContent({
            type: 'imageNode',
            attrs: { src: ev.target.result, alt: file.name },
          })
          .run();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  },
},
```

**How it works:** Opens a native file picker. Reads the file as a Data URL and inserts it as the custom `imageNode` TipTap node. On serialization, `addStorage.markdown.serialize` outputs `![alt](data:...)` markdown syntax. The `react-markdown` preview renders `![alt](src)` natively (no changes needed).

---

## Verification

1. **Headings:** Type `/h` → verify H4/H5/H6 appear in menu. Click each → verify correct heading level applied. Check bubble menu shows H4/H5/H6 buttons. Check "Turn into" context menu shows H4/H5/H6.
2. **Callouts:** Type `/note` → verify Note/Warning/Caution/Important appear. Click each → verify `> [!TYPE]` inserted as a blockquote. In preview mode, verify styled colored cards render correctly.
3. **Image:** Type `/image` → verify Image appears. Click → file picker opens. Select image → verify image renders in editor. Switch to preview → verify image displays. Export markdown → verify `![alt](data:...)` in output.
4. **Round-trip:** Add callouts and images via editor → switch to preview → switch back to editor → verify content preserved.
