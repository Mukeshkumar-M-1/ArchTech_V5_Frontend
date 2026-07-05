# Memory Management — UI Development Plan

## Context

The data flow is:
1. User uploads files in `RequirementListing.jsx` → backend extracts requirements → writes `requirements.json`
2. Backend `MemoryAgent` runs in background → reads `requirements.json` → generates 51 markdown files under `output/memory/{project_id}/knowledge/` (requirements, categories, subcategories, relationships.md, overview.md, generation_map.md, MEMORY.md)
3. `MemoryManagement.jsx` is the UI to **view** these generated memory files

**Current state:** `MemoryManagement.jsx` is a stub (`<div>Memory Management</div>`). The backend has no endpoint to list or serve the knowledge markdown files. Memory enrichment runs fire-and-forget with no frontend progress tracking.

**Goal:** Build a UI with tab-based file selection, a memory file tree explorer, and a markdown editor with preview/edit/fullscreen.

---

## Step 1: Add backend endpoints

**File:** `/home/devusr/Mukesh/ArchTech_V5/Backend/backend/Routes/knowledge_routes.py`

### 1A. `GET /{project_id}/knowledge-files` — List memory file tree

Returns all `.md` files under `output/memory/{project_id}/knowledge/`:

```python
@router.get("/{project_id}/knowledge-files")
def get_knowledge_files(project_id: str):
    from pathlib import Path
    from fastapi import HTTPException

    knowledge_dir = Path(__file__).resolve().parent.parent.parent / "output" / "memory" / project_id / "knowledge"
    files = []
    if knowledge_dir.exists():
        for md in knowledge_dir.rglob("*.md"):
            rel = str(md.relative_to(knowledge_dir))
            files.append({"path": rel, "name": md.name, "type": "markdown"})
    return files
```

### 1B. `GET /{project_id}/knowledge-file/{filepath:path}` — Get file content

Returns the markdown content of a single file with security check:

```python
@router.get("/{project_id}/knowledge-file/{filepath:path}")
def get_knowledge_file(project_id: str, filepath: str):
    from pathlib import Path
    from fastapi import HTTPException

    base = Path(__file__).resolve().parent.parent.parent / "output" / "memory" / project_id / "knowledge"
    target = (base / filepath).resolve()
    if not str(target).startswith(str(base)):
        raise HTTPException(403, "Access denied")
    if not target.exists():
        raise HTTPException(404, "File not found")
    return {"name": target.name, "content": target.read_text(encoding="utf-8")}
```

### 1C. `GET /{project_id}/memory-progress` — Track memory generation progress

MemoryAgent runs fire-and-forget with no tracking. Add a progress store:

```python
# In requirement_extraction_routes.py, add:
memory_progress_store: dict[str, dict] = {}

def _spawn_memory_enrichment(project_id: str) -> None:
    async def _run():
        try:
            from memory_manager.memory_agent import MemoryAgent
            memory_progress_store[project_id] = {"status": "running", "progress": 0, "phase": "Initializing"}
            # ... update progress at each phase
            agent = MemoryAgent()
            stats = await agent.run(project_id)
            memory_progress_store[project_id] = {"status": "complete", "progress": 100, "phase": "Done"}
        except Exception as e:
            memory_progress_store[project_id] = {"status": "error", "error": str(e)}

@router.get("/memory-progress/{project_id}")
def get_memory_progress(project_id: str):
    return memory_progress_store.get(project_id, {"status": "idle", "progress": 0})
```

---

## Step 2: Extend knowledgeStore.js

**File:** `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/store/knowledgeStore.js`

Add new state fields:

```javascript
// Existing state (keep as-is):
// knowledgeList, customSections, viewMode, selectedDoc, searchQuery,
// filterSection, filterTags, filterType, uploadFiles, isUploading

// New fields:
memoryFiles: [],           // file tree from knowledge-files API
selectedFilePath: null,    // currently viewed file path (e.g., "requirements/REQ-0002.md")
fileContent: '',           // markdown content of selected file
fileTreeLoading: false,    // loading state for tree fetch
memoryProgress: null,      // { status: 'idle'|'running'|'complete'|'error', progress: 0-100, phase: string }
detailMode: 'preview',     // 'preview' | 'edit'
fullScreen: false,         // fullscreen editor mode

// New actions:
setMemoryFiles: (files) => set({ memoryFiles: files }),
setSelectedFilePath: (path) => set({ selectedFilePath: path }),
setFileContent: (content) => set({ fileContent: content }),
setFileTreeLoading: (loading) => set({ fileTreeLoading: loading }),
setMemoryProgress: (progress) => set({ memoryProgress: progress }),
setDetailMode: (mode) => set({ detailMode: mode }),
setFullScreen: (fs) => set({ fullScreen: fs }),
```

---

## Step 3: Build MemoryManagement.jsx — Top Section with File Tabs

### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  Memory Management                                    [Generate]│
├─────────────────────────────────────────────────────────────────┤
│  [overview.md] [relationships.md] [CATEGORY TABS] [REQ TABS]  │
│   ────────   ─────────────────     ─────────────   ────────   │
│          active tab underline                                         │
├──────────────────────────────┬────────────────────────────────────┤
│  Panel 1: File Tree          │  Panel 2: Markdown Editor/Preview  │
│  (Left sidebar, ~280px)      │  (Right, flex-1)                   │
│                              │                                    │
│  overview.md                 │  [Preview Mode] [Edit Mode]        │
│  knowledge/                  │  ────────────────────────────      │
│    requirements/             │  ReactMarkdown rendered content    │
│      REQ-0002.md             │  + metadata card                   │
│      HAR-0004.md             │                                    │
│    categories/               │  [Full Screen] [Copy]              │
│      category_Hardware.md    │                                    │
│    subcategories/            │  [Edit Mode: TiptapEditor]        │
│      subcategory_FPGA.md     │  [Save] [Cancel]                   │
│  relationships.md            │                                    │
│  generation_map.md           │                                    │
│  MEMORY.md                   │                                    │
└──────────────────────────────┴────────────────────────────────────┘
```

### Top Tabs Row

When memory files are available, render tabs for the top-level items:

```
[Overview] [Requirements] [Categories] [Subcategories] [Relationships] [Generation Map] [MEMORY]
```

- Clicking a tab scrolls/filters the file tree to show matching files
- Tab for "Requirements" shows sub-tabs or groups by category (Hardware, Software, Functional)
- Tab for "Categories" groups files under each category

### Generate Button & Progress

- **"Generate Memory" button** in the top-right header area
- When clicked: starts the memory generation (the MemoryAgent already runs automatically on upload via `_spawn_memory_enrichment`, but we show progress here)
- **Progress label** below/next to the button:
  - Idle: "Memory not generated"
  - Running: "Generating... Phase A — Requirements (45%)"
  - Complete: "Memory generated — 34 requirements"
  - Error: "Generation failed — retry"
- Progress is polled every 2 seconds via `GET /memory-progress/{project.id}`

---

## Step 4: Panel 1 — File Tree (Left Sidebar)

### Features

| Feature | Implementation |
|---------|---------------|
| **Expand/collapse folders** | Recursive tree component with `useState` for expanded state, `motion.div` for animate |
| **Folder icons** | `FolderOpen` (expanded) / `Folder` (collapsed) from lucide-react |
| **File icons** | `FileText` for `.md` files from lucide-react |
| **Search** | Input at top of panel, filters tree nodes by filename match |
| **Click to view** | Clicking a file sets `selectedFilePath` in store, loads content in Panel 2 |
| **Active file highlight** | Border/background on the selected row |

### Tree structure

Flatten the file tree into a list with indentation:

```
overview.md
knowledge/
  requirements/
    REQ-0002.md
    REQ-0003.md
    ...
  categories/
    category_Functional.md
    category_Hardware.md
    category_Software.md
  subcategories/
    subcategory_FPGA.md
    subcategory_Interface.md
    ...
  relationships.md
  generation_map.md
MEMORY.md
```

---

## Step 5: Panel 2 — Markdown Editor with Preview (Right Side)

### Preview Mode

- Renders the selected file's markdown content using `ReactMarkdown` + `remark-gfm` (pattern from RequirementListing.jsx)
- **Metadata card** for requirement files (extracted from frontmatter YAML):
  - ID, Category, Sub-category, Priority, Confidence, Source, Page
- **Action buttons**:
  - Full-screen: expand to cover viewport (reuse pattern from RequirementListing.jsx)
  - Copy: copy rendered content to clipboard
- **Tab switch** between `Preview` and `Edit` at the top of the panel

### Edit Mode

- Renders content in a `TiptapEditor` (reuse from RequirementListing.jsx AI panel)
- **Save** button: calls `POST /update-requirement` for requirement files
- **Cancel** button: reverts to original content

### Full-screen Mode

- Overlay modal covering the entire viewport
- Shows the editor/preview in full screen with close button
- Reuse pattern from RequirementListing.jsx (lines 1577-1648)

---

## Step 6: Wire up routing and nav

**File:** `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/components/layout/WorkspaceLayout.jsx`

Uncomment or ensure the "Memory Management" nav item (`'memory'`, label: "Memory Management", path: `/workspace/Memory`) is active.

---

## Files to modify

| File | Action |
|------|--------|
| `/home/devusr/Mukesh/ArchTech_V5/Backend/backend/Routes/knowledge_routes.py` | Add `knowledge-files`, `knowledge-file/{filepath}`, and `memory-progress` endpoints |
| `/home/devusr/Mukesh/ArchTech_V5/Backend/backend/Routes/requirement_extraction_routes.py` | Add `memory_progress_store` and update `_spawn_memory_enrichment` to track phase progress |
| `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/store/knowledgeStore.js` | Add `memoryFiles`, `selectedFilePath`, `fileContent`, `memoryProgress`, `detailMode`, `fullScreen` fields + actions |
| `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/views/MemoryManagement.jsx` | Full implementation (main work — tabs, file tree, markdown editor) |
| `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/components/layout/WorkspaceLayout.jsx` | Verify Memory Management nav item is active |

## Existing patterns to reuse

- **Data fetching:** native `fetch()` + `getApiUrl()` from `src/utils/apiConfig.js`
- **Markdown rendering:** `ReactMarkdown` + `remark-gfm` from RequirementListing.jsx
- **TiptapEditor:** shared component from RequirementListing.jsx AI panel
- **Full-screen modal:** pattern from RequirementListing.jsx
- **Copy to clipboard:** pattern from RequirementListing.jsx
- **Color tokens:** `{ bg, surface, border, text, accent, ... }` pattern from workspace views
- **react-markdown + remark-gfm:** already in package.json
- **framer-motion:** already in package.json for animations
- **Zustand store:** knowledgeStore.js for state management

## Verification

1. Start backend, confirm `GET /api/Sample_1_1/knowledge-files` returns the file tree
2. Confirm `GET /api/Sample_1_1/knowledge-file/requirements/REQ-0002.md` returns content
3. Run frontend dev server, navigate to `/workspace/Memory`
4. Verify tabs show (Overview, Requirements, Categories, etc.)
5. Verify file tree expands/collapses, search filters, clicking a file loads content
6. Verify Preview mode renders markdown with metadata card
7. Verify Edit mode loads TiptapEditor
8. Verify Full-screen button expands the editor
