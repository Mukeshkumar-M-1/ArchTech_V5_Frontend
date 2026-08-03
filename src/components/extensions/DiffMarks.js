import { Mark, mergeAttributes } from '@tiptap/core';

export const DiffAdd = Mark.create({
  name: 'diffAdd',

  parseHTML() {
    return [
      {
        tag: 'ins',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['ins', mergeAttributes(HTMLAttributes, { class: 'bg-emerald-100 text-emerald-800 decoration-emerald-500 rounded px-1' }), 0];
  },
});

export const DiffDelete = Mark.create({
  name: 'diffDelete',

  parseHTML() {
    return [
      {
        tag: 'del',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['del', mergeAttributes(HTMLAttributes, { class: 'bg-rose-100 text-rose-800 line-through rounded px-1' }), 0];
  },
});
