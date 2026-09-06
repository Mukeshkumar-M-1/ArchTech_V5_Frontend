import { Node, mergeAttributes } from '@tiptap/core';

export const DiffAdd = Node.create({
  name: 'diffAdd',
  group: 'block',    // Acts as a block container
  content: 'block+', // Can hold paragraphs, tables, blockquotes, etc.

  parseHTML() {
    return [{ tag: 'add_content' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'add_content',
      mergeAttributes(HTMLAttributes, {
        // Entire table/block gets ONE border and background
        class: 'block bg-emerald-50/60 border-l-4 border-emerald-500 text-emerald-950 p-4 my-4 rounded-r-md overflow-x-auto',
      }),
      0, // Holds the child block elements (e.g., the <table>)
    ];
  },
});

export const DiffDelete = Node.create({
  name: 'diffDelete',
  group: 'block',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'delete_content' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'delete_content',
      mergeAttributes(HTMLAttributes, {
        class: 'block bg-red-50/60 border-l-4 border-red-500 text-red-950 p-4 my-4 rounded-r-md opacity-85 overflow-x-auto',
      }),
      0,
    ];
  },
});