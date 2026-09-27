const counts = new Map();

export function resetSlugs() {
  counts.clear();
}

export default function slugify(text, dedupe = false) {
  let slug = String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  if (!dedupe) return slug;
  if (counts.has(slug)) {
    const n = counts.get(slug) + 1;
    counts.set(slug, n);
    return `${slug}-${n}`;
  }
  counts.set(slug, 1);
  return slug;
}
