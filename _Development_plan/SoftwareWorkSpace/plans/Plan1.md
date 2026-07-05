# SoftwareWorkspace GitHub Light Theme

## Context
SoftwareWorkspace (`src/views/SoftwareWorkspace.jsx`) uses inline styles with a custom color token object `C` for styling. The current theme is a clean blue-accented light design. We need to update it to a GitHub-light theme that matches the general feel of MemoryManagement but uses its own slightly different palette.

## Changes to `src/views/SoftwareWorkspace.jsx`

### 1. Update color tokens (lines 17-35)
Change the `C` object to a GitHub-light palette:
```js
const C = {
  bg: '#f6f8fa',          // GitHub page bg
  surface: '#ffffff',
  surfaceHover: '#f3f4f6',
  border: '#d0d7de',      // GitHub border
  borderLight: '#e8ebf0',
  text: '#0f172a',        // Near-black
  textMuted: '#4b5563',   // Muted body text
  textFaint: '#8b949e',   // GitHub muted
  accent: '#2563eb',      // Blue accent
  accentLight: '#eff6ff', // Light blue bg
  accentMuted: '#bfdbfe',
  green: '#059669',
  greenLight: '#ecfdf5',
  amber: '#d97706',
  amberLight: '#fffbeb',
  red: '#dc2626',
  redLight: '#fef2f2',
};
```

### 2. Tab pills (lines 67-92)
- Active pill: keep white bg with subtle border (not shadow-heavy)
- Inactive pill: lighter text, no border
- Hover states: subtle bg change

### 3. Terminal panel (lines 772-859)
- Background: `#fafbfc` (GitHub terminal bg)
- Line numbers: `#8b949e`
- Border: `#d0d7de`
- Scrollbar: match theme

### 4. Requirements cards (lines 636-735)
- Card bg: white with `#d0d7de` border
- Selected card: subtle blue border + light blue bg
- Category badge: use `C.accent` / `C.green` etc.
- Hover states on expand/collapse button

### 5. Category filter bar (lines 564-594)
- Filter container: rounded pills with `#d0d7de` border
- Active filter: colored pill with text shadow for contrast
- Inactive: muted gray

### 6. Topbar controls (lines 450-493)
- Export button: white bg with `#d0d7de` border
- Console toggle: match active/inactive colors
- CustomSelect: inherit theme

### 7. Progress bar (lines 146-170)
- Track: `#e5e7eb`
- Fill: blue gradient matching accent
- Labels: `#8b949e`

### 8. Source specs header card (lines 597-624)
- White card with `#d0d7de` border
- "Intelligence Pool" badge: lighter styling
- Select Visible checkbox: styled check

### 9. Scrolling / fonts
- Scrollbar: `#d1d5db` thumb, transparent track
- Font: keep existing Geist + IBM Plex Mono

## Verification
- Dev server renders with no console errors
- All interactive elements (tabs, buttons, checkboxes, filter pills) look visually consistent
- Theme matches GitHub-light aesthetic with own palette
- No regression in functionality (requirement selection, expand/collapse, generation, export)
