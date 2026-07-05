# SoftwareWorkspace Tab Restructuring & SRS Panel Layout

## Context
Restructure top-level tabs (Requirements, SRS Document, SDD), add SRS sub-tabs (Document Template, Document Generation), and implement a two-panel template editor layout within the SRS section.

## Changes to `src/views/SoftwareWorkspace.jsx`

### 1. Top-level tabs (line ~344)
```js
const TABS = [
  { id: 'requirements', label: 'Requirements', icon: <ClipboardList size={13} /> },
  { id: 'srs', label: 'SRS Document', icon: <BookOpen size={13} /> },
  { id: 'sdd', label: 'SDD', icon: <ShieldCheck size={13} /> },
];
```

### 2. State additions
```js
const [activeMainTab, setActiveMainTab] = useState('requirements');
const [srsSubTab, setSrsSubTab] = useState('srs-template');
const [templateViewMode, setTemplateViewMode] = useState('editor'); // 'preview' | 'editor'
const [templateFiles, setTemplateFiles] = useState([
  { name: 'SRS_Template.md', content: '# SRS Document\n\n' },
]);
const [selectedTemplate, setSelectedTemplate] = useState('SRS_Template.md');
const [addModalOpen, setAddModalOpen] = useState(false);
const [newTemplateName, setNewTemplateName] = useState('');
const [newTemplateContent, setNewTemplateContent] = useState('');
```

### 3. SRS sub-tabs (new bar below topbar)
When `activeMainTab === 'srs'`, render sub-tab selector:
```jsx
<div style={{ display: 'flex', gap: 2, background: C.bg, padding: 4, borderRadius: 10, border: `1px solid ${C.border}` }}>
  <button onClick={() => setSrsSubTab('srs-template')} style={active === srsSubTab ? activeStyle : inactiveStyle}>
    <FileText size={13} /> Document Template
  </button>
  <button onClick={() => setSrsSubTab('srs-generation')} style={...}>
    <Zap size={13} /> Document Generation
  </button>
</div>
```

### 4. Document Template panel — Two-panel layout

#### Left Panel (~260px) — Template File List
- Header: "Templates" with `+` icon button
- List of template files:
  - Each row: `FileText` icon, filename, clickable
  - Active file: blue left border + light blue bg
  - Delete button on hover (X icon)
- **"+ Add New Section"** button at bottom:
  - Opens modal form with:
    - Input: "Section Name" (e.g., "Introduction")
    - Textarea: "Template Content" (markdown, min-height 100px)
    - Cancel / Save buttons
  - On save: adds to `templateFiles`, auto-selects new file
  - On cancel: closes modal

#### Right Panel — Preview / Editor
- Header bar:
  - Filename: `selectedTemplate`
  - Toggle: "Preview" | "Editor" (pill-style switcher)
- Content area:
  - **Editor mode**: `TiptapEditor` with `selectedTemplate` content
  - **Preview mode**: `ReactMarkdown` rendered content, GitHub light theme

### 5. Document Generation panel

#### Left Panel (~260px) — Template File List
- Same template file list as above
- Files act as selection context

#### Right Panel
- Header: "Generate Document"
- Description: "Select requirements and generate an SRS document"
- Generate button: calls `handleGenerateDoc` (existing)
- Progress bar: shown during generation
- **TiptapEditor** below progress:
  - Auto-updates as content streams in via `setSrsDoc`
  - Scrollable, dark/light themed matching
  - Shows generated sections as they arrive

### 6. SDD placeholder
```jsx
{activeMainTab === 'sdd' && (
  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: C.textFaint }}>
    <ShieldCheck size={40} style={{ opacity: 0.3, marginBottom: 16 }} />
    <div style={{ fontSize: 16, fontWeight: 600 }}>SDD Generation</div>
    <div style={{ fontSize: 13, marginTop: 4 }}>Coming soon</div>
  </div>
)}
```

### 7. Requirements tab
- Keep existing implementation unchanged
- Only update `activeTab` reference to `activeMainTab`

### 8. Chat panel toggle
- Unchanged — still toggles `chatOpen`
- Works independently of main/sub tab selection

### 9. Import changes
- Add: `ShieldCheck` to lucide-react (already imported, keep)
- Keep: `ClipboardList`, `BookOpen`, `FileText`, `Zap`
- No new imports needed

## Files Modified
- `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/views/SoftwareWorkspace.jsx`

## Verification
- Three top tabs: Requirements, SRS Document, SDD
- SRS Document shows sub-tabs: Document Template, Document Generation
- Template: left panel lists files, right panel shows preview/editor
- Add new section modal works (name + content input)
- Generation: left panel lists files, right panel has generate button + TiptapEditor for output
- SDD shows "Coming soon" placeholder
- Chat toggle still works
- No regression in requirements view
