// ─── Tab Definitions ─────────────────────────────────────────────────────────
import { BookOpen, ShieldCheck, FileText, Zap } from 'lucide-react';

export const TABS = [
  { id: 'srs', label: 'SRS Document', icon: <BookOpen size={13} /> },
  { id: 'sdd', label: 'SDD Document', icon: <ShieldCheck size={13} /> },
];

export const SUB_TABS = [
  { id: 'document-template', label: 'Document Template', icon: <FileText size={13} /> },
  { id: 'document-generation', label: 'Document Generation', icon: <Zap size={13} /> },
];

// ─── Color Tokens ────────────────────────────────────────────────────────────
export const C = {
  bg: '#f8fafc',
  surface: '#ffffff',
  surfaceHover: '#f4f5f8',
  border: '#e2e8f0',
  borderLight: '#f0f2f6',
  text: '#0f1117',
  textMuted: '#64748b',
  textFaint: '#94a3b8',
  accent: '#2563eb',
  accentLight: '#eff6ff',
  accentMuted: '#bfdbfe',
  green: '#059669',
  greenLight: '#ecfdf5',
  amber: '#d97706',
  amberLight: '#fffbeb',
  red: '#dc2626',
  redLight: '#fef2f2',
};
