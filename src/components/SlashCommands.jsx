import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import CommandsList from './CommandsList';
import React from 'react';
import { Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, List, ListOrdered, CheckSquare, Quote, Code, Table, Minus, Image, Info, AlertTriangle, AlertCircle, FileText } from 'lucide-react';

export default Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        startOfLine: true,
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const getSuggestionItems = ({ query }) => {
  return [
    {
      title: 'Heading 1',
      description: 'Large section heading',
      icon: <Heading1 size={18} />,
      iconBg: 'bg-slate-100',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
      },
    },
    {
      title: 'Heading 2',
      description: 'Medium section heading',
      icon: <Heading2 size={18} />,
      iconBg: 'bg-slate-100',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
      },
    },
    {
      title: 'Heading 3',
      description: 'Small section heading',
      icon: <Heading3 size={18} />,
      iconBg: 'bg-slate-100',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
      },
    },
    {
      title: 'Heading 4',
      description: 'Sub-section heading',
      icon: <Heading4 size={18} />,
      iconBg: 'bg-slate-100',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run();
      },
    },
    {
      title: 'Heading 5',
      description: 'Sub-sub-section heading',
      icon: <Heading5 size={18} />,
      iconBg: 'bg-slate-100',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 5 }).run();
      },
    },
    {
      title: 'Heading 6',
      description: 'Smallest heading',
      icon: <Heading6 size={18} />,
      iconBg: 'bg-slate-100',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 6 }).run();
      },
    },
    {
      title: 'Bullet List',
      description: 'Unordered list with bullets',
      icon: <List size={18} />,
      iconBg: 'bg-blue-50',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: 'Numbered List',
      description: 'Ordered numbered list',
      icon: <ListOrdered size={18} />,
      iconBg: 'bg-blue-50',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: 'To-do List',
      description: 'Task list with checkboxes',
      icon: <CheckSquare size={18} />,
      iconBg: 'bg-green-50',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: 'Quote',
      description: 'Blockquote / citation',
      icon: <Quote size={18} />,
      iconBg: 'bg-amber-50',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
    {
      title: 'Note',
      description: 'Informative callout',
      icon: <Info size={18} />,
      iconBg: 'bg-blue-50',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent(`> [!NOTE]\n`).run();
      },
    },
    {
      title: 'Warning',
      description: 'Warning callout',
      icon: <AlertTriangle size={18} />,
      iconBg: 'bg-amber-50',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent('> [!WARNING]\n').run();
      },
    },
    {
      title: 'Caution',
      description: 'Caution callout',
      icon: <AlertCircle size={18} />,
      iconBg: 'bg-orange-50',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent('> [!CAUTION]\n').run();
      },
    },
    {
      title: 'Important',
      description: 'Important callout',
      icon: <FileText size={18} />,
      iconBg: 'bg-green-50',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertContent('> [!IMPORTANT]\n').run();
      },
    },
    {
      title: 'Code Block',
      description: 'Monospace code block',
      icon: <Code size={18} />,
      iconBg: 'bg-slate-100',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: 'Table',
      description: 'Editable data table',
      icon: <Table size={18} />,
      iconBg: 'bg-indigo-50',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      },
    },
    {
      title: 'Divider',
      description: 'Horizontal rule separator',
      icon: <Minus size={18} />,
      iconBg: 'bg-slate-100',
      command: ({ editor, range }) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: 'Image',
      description: 'Upload an image',
      icon: <Image size={18} />,
      iconBg: 'bg-emerald-50',
      command: ({ editor, range }) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.onchange = (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            const imgSrc = ev.target.result;
            // Insert image using markdown syntax. The tiptap-markdown plugin
            // intercepts insertContent → parses via markdown-it which converts
            // ![alt](src) → <img>, and stores it as an imageNode TipTap node.
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertContent(`![${file.name}](${imgSrc})`)
              .run();
          };
          reader.readAsDataURL(file);
        };
        input.click();
      },
    },
  ].filter(item => item.title.toLowerCase().startsWith(query.toLowerCase()));
};

export const renderItems = () => {
  let component;
  let popup;

  return {
    onStart: props => {
      console.log('⌨️ Slash: Command palette opened');
      component = new ReactRenderer(CommandsList, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) {
        console.warn('⚠️ Slash: Missing clientRect for positioning');
        return;
      }

      popup = tippy(props.editor.options.element, {
        getReferenceClientRect: props.clientRect,
        appendTo: () => props.editor.options.element.closest('[data-editor-container]') || document.body,
        content: component.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
        zIndex: 40,
      });
    },

    onUpdate(props) {
      component.updateProps(props);
      if (!props.clientRect || !popup || !popup[0]) return;
      
      const rect = props.clientRect();
      if (!rect) return;
      
      popup[0].setProps({ getReferenceClientRect: props.clientRect });
    },

    onKeyDown(props) {
      if (props.event.key === 'Escape') {
        console.log('⌨️ Slash: Palette closed via Escape');
        if (popup && popup[0]) popup[0].hide();
        return true;
      }
      if (!props.event) return false;
      return component.ref?.onKeyDown(props.event);
    },

    onExit() {
      console.log('⌨️ Slash: Palette destroyed');
      if (popup && popup[0]) {
        popup[0].destroy();
      }
      component.destroy();
    },
  };
};
