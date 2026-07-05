# Memory Management — Full Knowledge Explorer

## Context

The MemoryManagement component is a stub (`<div>Memory Management</div>`) at `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/views/MemoryManagement.jsx`. The backend at `10.5.17.83:8015` generates structured requirements knowledge bases from hardware spec PDFs. For the sample project "Sample_1_1", it produced 51 markdown files (34 individual requirements, categories, subcategories, relationships graph, generation map). The frontend never calls the existing `/api/{project_id}/project-knowledge` or `/api/{project_id}/requirements` endpoints — they are unconnected. The Zustand `knowledgeStore.js` has state pre-wired but unused.

**Goal:** Build a full knowledge explorer with sidebar tree, detail panel, relationship graph visualization, and SRS generation/upload capabilities.

---

## Step 1: Add backend endpoint for knowledge markdown files

**File:** `/home/devusr/Mukesh/ArchTech_V5/Backend/backend/Routes/knowledge_routes.py`

Add two new endpoints:

```python
@router.get("/{project_id}/knowledge-files")
def get_knowledge_files(project_id: str):
    from pathlib import Path
    knowledge_dir = Path(__file__).resolve().parent.parent.parent / "output" / "memory" / project_id / "knowledge"
    files = []
    if knowledge_dir.exists():
        for md in knowledge_dir.rglob("*.md"):
            rel = str(md.relative_to(knowledge_dir))
            files.append({"path": rel, "name": md.name, "type": "markdown"})
    return files

@router.get("/{project_id}/knowledge-file/{filepath:path}")
def get_knowledge_file(project_id: str, filepath: str):
    from pathlib import Path
    base = Path(__file__).resolve().parent.parent.parent / "output" / "memory" / project_id / "knowledge"
    target = (base / filepath).resolve()
    if not str(target).startswith(str(base)):
        raise HTTPException(403, "Access denied")
    if not target.exists():
        raise HTTPException(404, "File not found")
    return {"name": target.name, "content": target.read_text(encoding="utf-8")}
```

Security: path traversal check via `str(target).startswith(str(base))` prevents accessing files outside the project directory.

---

## Step 2: Extend knowledgeStore.js

**File:** `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/store/knowledgeStore.js`

Add new state fields:

```javascript
// New state
knowledgeTree: [],        // hierarchical tree from knowledge-files API
selectedTreeItem: null,   // currently selected tree node
treeLoading: false,
selectedRequirement: null, // requirement selected in detail view
detailMode: 'view',       // 'view' | 'edit'
generatingSection: false,
generatingFull: false,
generationResults: {},    // section -> generated content

// New actions
setKnowledgeTree: (tree) => set({ knowledgeTree: tree }),
setSelectedTreeItem: (item) => set({ selectedTreeItem: item }),
setTreeLoading: (loading) => set({ treeLoading: loading }),
setSelectedRequirement: (req) => set({ selectedRequirement: req }),
setDetailMode: (mode) => set({ detailMode: mode }),
setGeneratingSection: (v) => set({ generatingSection: v }),
setGeneratingFull: (v) => set({ generatingFull: v }),
setGenerationResults: (results) => set({ generationResults: results }),
```

---

## Step 3: Build the MemoryManagement component

**File:** `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/views/MemoryManagement.jsx`

### Layout — Three-panel, 288px | flex-1 | 384px

```
┌─────────────────────────────────────────────────────────────┐
│  Sidebar (288px)        │  Detail (flex-1)      │  Right (384px)   │
│                         │                       │                  │
│  Overview               │  [Title + type badge] │  Relationship    │
│  Requirements           │  ReactMarkdown        │  Graph (@xyflow) │
│    Hardware             │  Metadata card        │                  │
│    Software             │  Edit toggle          │  SRS Generation  │
│    Functional           │                       │  + Upload zone   │
│  Categories             │                       │                  │
│  Subcategories          │                       │                  │
│  Relationships          │                       │                  │
│  Generation Map         │                       │                  │
└─────────────────────────────────────────────────────────────┘
```

### Data fetching (on mount, all using native fetch + getApiUrl):

| Data | Endpoint |
|------|----------|
| Knowledge file tree | `GET /{project.id}/knowledge-files` |
| Individual file content | `GET /{project.id}/knowledge-file/{path}` (on-demand when tree node clicked) |
| Requirements list | `GET /{project.id}/requirements` (for metadata + tree grouping) |
| Generate single section | `POST /{project.id}/generate-section` |
| Generate full SRS | `POST /{project.id}/generate-full` |

### Sidebar tree structure

Uses `lucide-react` icons (`FolderOpen`, `FileText`, `GitBranch`, `Map`, `Info`). Collapsible groups with `motion.div` for expand/collapse. Search filters via existing `searchQuery` state.

Tree nodes map to paths like:
- `overview.md`
- `requirements/REQ-0002.md`
- `categories/category_Hardware.md`
- `subcategories/subcategory_FPGA.md`
- `relationships.md`
- `generation_map.md`

### Detail panel

- **View mode:** Renders markdown via `ReactMarkdown` with `remark-gfm` (pattern from RequirementListing.jsx)
- **Metadata card:** For requirements, shows id, category, sub-category, priority, confidence, source, page (pattern from RequirementListing.jsx metadata display)
- **Edit mode:** Toggle to `TiptapEditor` (pattern from RequirementListing.jsx) — save is in-memory only for MVP
- **Copy button:** Copy rendered content to clipboard
- **Full-screen modal:** Expand to full viewport (pattern from RequirementListing.jsx)

### Relationship panel (right side)

- **Graph:** Parse `relationships.md` to extract nodes and edges. Render with `@xyflow/react` (already installed). Nodes color-coded by ID prefix (`HAR-`=blue, `REQ-`=indigo, `SOF-`=violet, `FUN-`=emerald). Use `MarkerArrow` for edges.
- **SRS Generation:** "Generate Full SRS" button calls `POST /generate-full`. "Generate Section" buttons for each of 7 sections call `POST /generate-section`. Results shown inline.
- **Upload zone:** Drag-and-drop using `react-dropzone` (already installed). Reuses `uploadFiles` state from knowledgeStore.

---

## Step 4: Verify sidebar nav

Check that the "Memory Management" nav item in `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/components/layout/WorkspaceLayout.jsx` is uncommented. If commented, uncomment it.

---

## Files to modify

| File | Action |
|------|--------|
| `/home/devusr/Mukesh/ArchTech_V5/Backend/backend/Routes/knowledge_routes.py` | Add `knowledge-files` and `knowledge-file/{filepath}` endpoints |
| `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/store/knowledgeStore.js` | Add new state fields and actions |
| `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/views/MemoryManagement.jsx` | Full implementation (main work) |
| `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/components/layout/WorkspaceLayout.jsx` | Verify nav item is enabled |

## Existing patterns to reuse

- **Data fetching:** native `fetch()` + `getApiUrl()` from `src/utils/apiConfig.js`
- **Markdown rendering:** `ReactMarkdown` + `remark-gfm` from RequirementListing.jsx
- **Color tokens:** `{ bg, surface, border, text, accent, ... }` pattern from workspace views
- **TiptapEditor:** shared component from RequirementListing.jsx AI panel
- **react-markdown + remark-gfm:** already in package.json
- **@xyflow/react:** already in package.json for relationship graph
- **react-dropzone:** already in package.json for upload zone
- **Zustand store:** knowledgeStore.js for state management

## Verification

1. Start backend, confirm `GET /api/Sample_1_1/knowledge-files` returns the 51-file tree
2. Confirm `GET /api/Sample_1_1/knowledge-file/overview.md` returns markdown content
3. Run frontend dev server, navigate to `/workspace/Memory`
4. Test sidebar tree expands/collapses, clicking items loads content in detail panel
5. Test relationship graph renders with `@xyflow/react`
6. Test "Generate Full SRS" and "Generate Section" buttons work
7. Test upload zone accepts files and shows in queue
