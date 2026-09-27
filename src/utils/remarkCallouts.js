// ─── Custom remark plugin: transform [!TYPE] blockquotes into callouts ────────
export function remarkCallouts() {
  return (tree) => {
    const visit = (node) => {
      if (node.type === 'blockquote' && node.children?.length > 0) {
        const first = node.children[0];
        if (first.type === 'paragraph' && first.children?.length > 0) {
          const firstText = first.children[0];
          if (firstText.type === 'text') {
            const match = firstText.value.match(/^\\?\[!(NOTE|WARNING|CAUTION|IMPORTANT)(?:\\]|\])?\s*(.*)$/);
            if (match) {
              const type = match[1];
              firstText.value = match[2].trimStart();
              node.data = node.data || {};
              node.data.hProperties = {
                ...node.data.hProperties,
                'data-callout': type,
              };
            }
          }
        }
      }
      if (node.children) node.children.forEach(visit);
    };
    visit(tree);
  };
}

export const CALLOUT_CLASSES = {
  NOTE: 'border-l-4 border-primary-400 bg-primary-50 pl-4 py-3 rounded-r-md',
  WARNING: 'border-l-4 border-amber-400 bg-amber-50 pl-4 py-3 rounded-r-md',
  CAUTION: 'border-l-4 border-orange-400 bg-orange-50 pl-4 py-3 rounded-r-md',
  IMPORTANT: 'border-l-4 border-red-300 bg-red-50 pl-4 py-3 rounded-r-md',
};
