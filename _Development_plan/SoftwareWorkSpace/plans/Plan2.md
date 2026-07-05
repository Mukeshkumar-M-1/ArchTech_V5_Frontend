# SoftwareWorkspace UI Theme Changes

## Context
Update SoftwareWorkspace UI to a clean, GitHub-inspired light theme and replace the terminal panel with an AI chat assistant panel that works like the VS Code Copilot Chat extension.

## Changes

### 1. Update requirement list background
- **File**: `src/views/SoftwareWorkspace.jsx` line 560
- `background: '#fafafa'` → `background: '#ffffff'`

### 2. Update Source Specifications header card
- **File**: `src/views/SoftwareWorkspace.jsx` lines 597-624
- Filter bar background: `#f6f8fa`, border: `#d0d7de`
- Text colors: `#1f2328` headings, `#656b73` muted text
- Intelligence Pool count styling

### 3. Update requirement cards styling
- **File**: `src/views/SoftwareWorkspace.jsx` lines 636-639
- Card borders: `#d0d7de`, selected state uses blue tint
- Subtle shadow and smoother transitions

### 4. Replace terminal panel with AI chat assistant panel
- **File**: `src/views/SoftwareWorkspace.jsx` lines 772-859

**State changes:**
- `terminalOpen` → `chatOpen`
- `terminalOutput` → `chatMessages` (array of `{ role: 'user'|'bot', content, streaming }`)
- `terminalRef` → `chatRef`

**Panel structure (like VS Code Copilot Chat):**
- Header bar: "Chat Assistant" + bot icon + close button
- Messages area (scrollable):
  - Default welcome message: "Hi! I'm your AI assistant. Ask me anything about your project, requirements, or SRS document."
  - Bot messages: left-aligned, light bg (#f6f8fa), rounded, with bot avatar
  - User messages: right-aligned, blue bg (#2563eb), white text
  - Typing indicator: animated three dots
  - Markdown support for bot responses (ReactMarkdown)
- Input area at bottom:
  - Textarea with placeholder "Ask me anything about your project..."
  - File attachment button (icon-only)
  - Send button (paper plane icon, blue when input has text)
  - Auto-resize textarea, max 3 lines

**Topbar toggle:**
- Button: "Chat" (not "Console")
- Icon: `Bot` from lucide-react
- Remove StatusDot (not needed for chat)

**Import changes:**
- Add: `Bot, Paperclip, Send` to lucide-react imports
- Remove: `Terminal as TerminalIcon, Activity, RefreshCw` (no longer needed)

### 5. Clean up unused terminal code
- Remove `TermLine` component
- Remove `ProgressBar` component (not used after terminal removal)
- Remove `loadingReqs` spinner (optional, if not needed)

## Files Modified
- `/home/devusr/Mukesh/ArchTech_V5/Frontend/src/views/SoftwareWorkspace.jsx`

## Verification
- Check chat panel toggles open/close in place of terminal
- Welcome message shows when chat opens
- User messages appear right-aligned in blue
- Bot messages appear left-aligned in light gray
- Typing indicator animates
- Input field accepts text, send button enabled
- Requirements cards and header look clean with new theme
