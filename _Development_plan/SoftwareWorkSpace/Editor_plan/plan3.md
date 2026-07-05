# Fix: Table Header Markdown Rendering

## Context
Two issues cause tables with headers to render as raw HTML instead of markdown:
1. **Structural bug in `handleTableAction`**: `addRowAbove` and `deleteRow` use `findCurrentRow().isHeader` to decide whether to promote a header, but this checks if the *cursor's row* is a header — when adding above or deleting a header row, it should always promote the new row 0, not conditionally based on cursor position. This causes `<th>` rows to appear in the middle of tables.
2. **`tiptap-markdown` serializer fallback**: The library's `isMarkdownSerializable` rejects tables where any cell has `childCount > 1` (inline formatting like bold/italic), falling back to raw HTML.

Both must be fixed.

## Fix Plan

### Step 1: Fix `handleTableAction` in `src/components/TiptapEditor.jsx` (lines 754-856)

Replace the entire `handleTableAction` function with a corrected version that:
- **Only row index 0 can be a header** (markdown spec requirement)
- `addRowAbove`: Always promote the new row 0 to header (no conditional on cursor position)
- `deleteRow`: If row 0 (header) is deleted, promote the new row 0 to header
- Add robust table finding (deep scan if table isn't first child)
- Check `isHeader` before calling `toggleHeaderRow()` to avoid demoting existing headers

### Step 2: Override the Table serializer to avoid HTML fallback

Add a custom Table extension **before** `Table.configure({ resizable: true })` in the extensions array that provides a relaxed markdown serializer:
- Remove the `childCount > 1` restriction so cells with inline formatting serialize as markdown
- Still use `|---|` delimiter for header rows
- Gracefully fall back to HTML only when absolutely necessary (rowspan/colspan, mixed headers in body rows)

### Critical Files

1. **`src/components/TiptapEditor.jsx`** — Two changes:
  a. Lines ~754-856: Replace `handleTableAction` 
  b. Lines ~603: Insert custom Table extension before `Table.configure({ resizable: true })`

### Verification
1. Create table → toggle header → save → verify markdown output uses `|---|---|` delimiter, not HTML
2. Add inline formatting to header cells → save → verify it still serializes as markdown (not HTML)
3. Add row above a header row → verify new row 0 is promoted to header
4. Delete header row → verify new top row becomes header
5. Reload saved table in editor and preview — should render correctly in both modes
