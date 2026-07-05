# Fix: Table Cell Handle Overlay Never Appears

## Context

When the user hovers over a table cell, they expect to see row/column handle buttons (Notion-style) appear at the cell edges. These buttons let them add/delete rows and columns directly from the cell. However, the overlay **never appears**. The Bubble Menu (with table actions) works fine.

## Root Cause

The `tableOverlay` state is **set** with one shape but **read** with a completely different shape — they are incompatible.

**How state is SET** (line 647-660, `mousemove` plugin):
```js
setTableOverlay({
  topButton: { top: rect.top, left: rect.left + rect.width / 2 - 12, id: th ? 'col' : 'row' },
  rightButton: { top: rect.top + rect.height / 2 - 12, left: rect.right, id: th ? 'col' : 'row' },
});
```
State shape: `{ topButton: { top, left, id }, rightButton: { top, left, id } }`

**How state is READ** (line 904-931):
```js
{tableOverlay && editor && (
  <div ...>
    {tableOverlay.type === 'row' && ...}   // ← tableOverlay.type is always undefined!
    {tableOverlay.type === 'column' && ...}
  </div>
)}
```
The render checks `tableOverlay.type` but the state object has **no `type` field** — it has `topButton` and `rightButton` with `id` fields. The render logic is entirely broken.

**Additional issue**: The `CellHandleMenu` component (lines 114-199) is defined but **never rendered** anywhere in the JSX. It uses the same `{ type, onAction, onClose }` interface but is dead code.

## Plan

### Step 1: Rewrite the table overlay rendering to match the state shape

The overlay rendering (lines 903-1019) must be restructured to:
- Render `topButton` and `rightButton` from `tableOverlay` using `tableOverlay.topButton.id` and `tableOverlay.rightButton.id` (not `tableOverlay.type`)
- Each button should render as a `<button>` with a `<MoreHorizontal>` icon
- Clicking the button toggles its corresponding menu (`rowMenuOpen` / `colMenuOpen`)
- The row menu (when `rowMenuOpen`) renders next to the **top button** (row add/delete options)
- The column menu (when `colMenuOpen`) renders next to the **right button** (column add/delete options)

### Step 2: Fix the positioning for both buttons

Currently the render only handles one button position via the `ref` callback (lines 906-927). It needs to render **two separate absolute-positioned buttons**:

- **Top button**: positioned at `tableOverlay.topButton.top` / `tableOverlay.topButton.left`
- **Right button**: positioned at `tableOverlay.rightButton.top` / `tableOverlay.rightButton.left`

Each button independently controls its own menu state.

### Step 3: Ensure proper close behavior

- Clicking anywhere outside should close open menus (already partially handled by `onClick={(e) => e.stopPropagation()}` on menu containers, but need `mousedown` document listener on the wrapper)
- `mouseout` on the editor (lines 663-668) already clears `tableOverlay` when leaving

### Key file to modify

- `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/components/TiptapEditor.jsx` (lines 903-1019 — the table overlay rendering block)

### Verification

1. Start the dev server (`npm run dev`)
2. Open a page with the TiptapEditor
3. Insert a table (via `/table` slash command)
4. Hover over any table cell
5. Confirm: two small `•••` buttons appear (top-center and right-center of the cell)
6. Click the top button → row menu appears with "Add row above / below / Delete row"
7. Click the right button → column menu appears with "Add column left / right / Delete column"
8. Clicking any action should perform the table operation
9. Hovering out should clear the buttons
