// One .md file per guide page. Editing any .md file here hot-reloads the guide page.
const raws = import.meta.glob('./*.md', { query: '?raw', import: 'default', eager: true });

export const GUIDE_PAGES = [
  { id: 'llm-config', file: '01-llm-config.md', title: 'LLM Configuration' },
  { id: 'data-extraction', file: '02-data-extraction.md', title: 'Data Extraction' },
  { id: 'memory-management', file: '03-memory-management.md', title: 'Memory Management' },
  { id: 'template-analysis', file: '04-template-analysis.md', title: 'Template Analysis' },
  { id: 'document-generation', file: '05-document-generation.md', title: 'Document Generation' },
  { id: 'ai-assistant', file: '06-ai-assistant.md', title: 'AI Assistant' },
  { id: 'version-management', file: '07-version-management.md', title: 'Version Management' },
]
  .map((p) => ({ ...p, md: raws[`./${p.file}`] }))
  .filter((p) => typeof p.md === 'string');
