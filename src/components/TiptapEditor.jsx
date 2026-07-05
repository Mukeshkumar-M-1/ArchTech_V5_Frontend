import { useEditor, EditorContent, NodeViewWrapper, NodeViewContent, ReactNodeViewRenderer, Extension, Node as TiptapNode } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import { Plugin } from 'prosemirror-state';
import { BubbleMenu as BubbleMenuExtension } from '@tiptap/extension-bubble-menu';
import { StarterKit } from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Fragment } from '@tiptap/pm/model';
import { getHTMLFromFragment } from '@tiptap/core';
import SlashCommands, { getSuggestionItems, renderItems } from './SlashCommands';
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import debounce from 'lodash.debounce';
import { Markdown } from 'tiptap-markdown';
import { marked } from 'marked';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Code, Link as LinkIcon,
  Plus, Minus, Trash, Columns, Table as TableIcon, Copy, ArrowDown,
  CopyPlus, Repeat, Type, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, List, ListOrdered,
  CheckSquare, Quote, GripVertical, Sparkles, FileText, Hash, Check, Image, ArrowUp, ArrowDown as ArrowDownIcon, ArrowLeft, ArrowRight,
  MoreHorizontal,MoreVertical
} from 'lucide-react';

import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import CharacterCount from '@tiptap/extension-character-count';
import Typography from '@tiptap/extension-typography';
import Focus from '@tiptap/extension-focus';
import CodeBlock from '@tiptap/extension-code-block';
import { PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { CellSelection } from '@tiptap/pm/tables';

// ─── ChatSelectionPlugin ────────────────────────────────────────────────────────
const chatSelectionKey = new PluginKey('chatSelection');

function getChatSelectionPlugin() {
  return new Plugin({
    key: chatSelectionKey,
    state: {
      init() {
        return { selectedTexts: [] };
      },
      apply(tr, value) {
        const meta = tr.getMeta(chatSelectionKey);
        if (meta && meta.selectedTexts !== undefined) {
          return { selectedTexts: meta.selectedTexts };
        }
        return value;
      }
    },
    props: {
      decorations(state) {
        const { selectedTexts } = this.getState(state);
        if (!selectedTexts || selectedTexts.length === 0) return DecorationSet.empty;

        const decorations = [];
        state.doc.descendants((node, pos) => {
          if (node.isBlock && selectedTexts.includes(node.textContent)) {
            decorations.push(
              Decoration.node(pos, pos + node.nodeSize, {
                class: 'is-chat-selected'
              })
            );
          }
        });
        return DecorationSet.create(state.doc, decorations);
      }
    }
  });
}

// ─── GithubAlertsPlugin ────────────────────────────────────────────────────────
const githubAlertsKey = new PluginKey('githubAlerts');

function getGithubAlertsPlugin() {
  return new Plugin({
    key: githubAlertsKey,
    state: {
      init() { return DecorationSet.empty; },
      apply(tr, oldSet, oldState, newState) {
        if (!tr.docChanged) return oldSet.map(tr.mapping, tr.doc);

        const decorations = [];
        newState.doc.descendants((node, pos) => {
          if (node.type.name === 'blockquote') {
            const firstChild = node.firstChild;
            if (firstChild && firstChild.type.name === 'paragraph' && firstChild.textContent.trim().startsWith('[!')) {
              const text = firstChild.textContent.trim();
              const match = text.match(/^\[!(NOTE|WARNING|CAUTION|IMPORTANT|TIP)\]/i);
              if (match) {
                const type = match[1].toLowerCase();
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: `github-alert github-alert-${type}`
                  })
                );
              }
            }
          }
        });
        return DecorationSet.create(newState.doc, decorations);
      }
    },
    props: {
      decorations(state) {
        return this.getState(state);
      }
    }
  });
}

// ─── BlockHoverPlugin ────────────────────────────────────────────────────────
const BlockHoverPlugin = (onHover, hoveredBlockRef) =>
  new Plugin({
    props: {
      handleDOMEvents: {
        mousemove(view, event) {

          const pos = view.posAtCoords({ left: event.clientX, top: event.clientY });
          if (!pos) {
            if (hoveredBlockRef.current) console.log('☁️ Hover: Out of bounds');
            onHover(null);
            return false;
          }

          try {
            const $pos = view.state.doc.resolve(pos.pos);
            let depth = 1;
            if ($pos.depth < 1) { onHover(null); return false; }

            const node = $pos.node(depth);
            const nodePos = $pos.before(depth);

            const validTypes = [
              'paragraph', 'heading', 'bulletList', 'orderedList',
              'taskList', 'blockquote', 'codeBlock', 'table', 'horizontalRule',
            ];
            if (!validTypes.includes(node.type.name)) { onHover(null); return false; }

            if (hoveredBlockRef.current?.pos !== nodePos) {
              // console.log(`🎯 Hover: ${node.type.name} at pos ${nodePos}`);
            }

            const dom = view.nodeDOM(nodePos);
            if (!(dom instanceof HTMLElement)) { onHover(null); return false; }

            const rect = dom.getBoundingClientRect();
            onHover({ pos: nodePos, node, rect });
          } catch (_) { onHover(null); }

          return false;
        },
        mouseleave(_view, _event) {
          return false;
        },
      },
    },
});

// Uses position:absolute with coordinates relative to the editor container.
function BlockActions({ rect, containerRect, onPlusClick, onGripClick, isSelected, onToggleSelect }) {
  const BUTTON_HEIGHT = 24;
  const top = (rect.top - containerRect.top) + 2;
  const left = (rect.left - containerRect.left) - 40; // Adjusted for vertical stack

  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width: 32,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        zIndex: 10,
        pointerEvents: 'auto',
      }}
    >
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onGripClick(e);
        }}
        style={{
          width: 24, height: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 6,
          border: '1px solid #e2e8f0',
          background: '#fff',
          color: '#94a3b8',
          cursor: 'pointer',
          transition: 'all .15s',
          flexShrink: 0,
          userSelect: 'none',
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = '#f0f4ff'; e.currentTarget.style.color = '#3b82f6'; e.currentTarget.style.borderColor = '#bfdbfe'; }}
        onMouseOut={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
        title="Click for options"
      >
        <GripVertical size={13} />
      </div>

      

      <button
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggleSelect();
        }}
        className={`w-6 h-6 flex items-center justify-center rounded-md border transition-all ${
          isSelected ? 'bg-primary-500 border-primary-500 text-white' : 'bg-white border-slate-300 text-transparent hover:border-primary-400'
        }`}
        title="Use this block as context in Chat"
      >
        <Check size={14} className={isSelected ? "opacity-100" : "opacity-0"} strokeWidth={3} />
      </button>

      <button
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onPlusClick();
        }}
        className="w-6 h-6 flex items-center justify-center rounded-md text-slate-300 hover:bg-slate-100 hover:text-slate-500 transition-all"
        title="Click to add a block below"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}

// ─── BlockContextMenu ────────────────────────────────────────────────────────
function BlockContextMenu({ position, containerRect, onClose, onAction }) {
  const ref = useRef(null);
  const [view, setView] = useState('main');

  const top = position.top - containerRect.top;
  const left = position.left - containerRect.left;

  useEffect(() => {
    const handler = (e) => {
      if (!ref.current?.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const mainItems = [
    { key: 'turnInto', icon: <Repeat size={13} />, label: 'Turn into…' },
    { key: 'duplicate', icon: <CopyPlus size={13} />, label: 'Duplicate block' },
    { key: 'copy', icon: <Copy size={13} />, label: 'Copy text' },
    { key: 'delete', icon: <Trash size={13} />, label: 'Delete block', danger: true },
  ];

  const turnIntoItems = [
    { key: 'paragraph', label: 'Text', icon: <Type size={13} /> },
    { key: 'heading 1', label: 'Heading 1', icon: <Heading1 size={13} /> },
    { key: 'heading 2', label: 'Heading 2', icon: <Heading2 size={13} /> },
    { key: 'heading 3', label: 'Heading 3', icon: <Heading3 size={13} /> },
    { key: 'heading 4', label: 'Heading 4', icon: <Heading4 size={13} /> },
    { key: 'heading 5', label: 'Heading 5', icon: <Heading5 size={13} /> },
    { key: 'heading 6', label: 'Heading 6', icon: <Heading6 size={13} /> },
    { key: 'bulletList', label: 'Bulleted List', icon: <List size={13} /> },
    { key: 'orderedList', label: 'Numbered List', icon: <ListOrdered size={13} /> },
    { key: 'taskList', label: 'To-do List', icon: <CheckSquare size={13} /> },
    { key: 'blockquote', label: 'Quote', icon: <Quote size={13} /> },
    { key: 'codeBlock', label: 'Code', icon: <Code size={13} /> },
  ];

  return (
    <div
      ref={ref}
      style={{ position: 'absolute', top, left, zIndex: 20 }}
      className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl w-52 py-1.5"
    >
      {view === 'main' ? (
        <div className="px-1.5 space-y-0.5">
          {mainItems.map((item) => (
            <button
              key={item.key}
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (item.key === 'turnInto') { setView('turnInto'); return; }
                onAction(item.key);
                onClose();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors text-left ${item.danger
                ? 'text-rose-600 hover:bg-rose-50'
                : 'text-slate-600 hover:bg-primary-50 hover:text-primary-700'
                }`}
            >
              <span className={item.danger ? 'text-rose-400' : 'text-slate-400'}>{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.key === 'turnInto' && <span className="text-slate-300">›</span>}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 mb-1">
            <button
              onMouseDown={(e) => { e.preventDefault(); setView('main'); }}
              className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
            >
              <ArrowDown size={13} className="rotate-90" />
            </button>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Turn into</span>
          </div>
          <div className="px-1.5 space-y-0.5 max-h-64 overflow-y-auto">
            {turnIntoItems.map((opt) => (
              <button
                key={opt.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onAction(`turn-${opt.key}`);
                  onClose();
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold text-slate-600 hover:bg-primary-50 hover:text-primary-700 transition-colors text-left"
              >
                <span className="w-6 h-6 flex items-center justify-center bg-slate-100 rounded-lg text-slate-400">
                  {opt.icon}
                </span>
                {opt.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const MarkdownTable = Table.extend({
  // Do NOT override the 'name' property. Keep it as 'table' (inherited)
  // so all standard Tiptap table commands work flawlessly out of the box.

  addStorage() {
    return {
      markdown: {
        serialize(state, node) {
          const rows = node.content.content;
          if (rows.length === 0) return;

          const firstRow = rows[0];
          const bodyRows = rows.slice(1);

          // Check if first row is a valid header row
          const isHeaderRow = firstRow.content.content.every(
            (cell) => cell.type.name === 'tableHeader' && cell.attrs.colspan === 1 && cell.attrs.rowspan === 1
          );

          // Check if body rows contain any tableHeader cells (can't serialize as markdown)
          const hasHeaderInBody = bodyRows.some((row) =>
            row.content.content.some((cell) => cell.type.name === 'tableHeader')
          );

          if (hasHeaderInBody) {
            // Fall back to HTML for complex mixed tables
            state.write('\n' + getHTMLFromFragment(Fragment.from(node), node.type.schema) + '\n');
            state.closeBlock(node);
            return;
          }

          state.inTable = true;

          // Helper to cleanly render rows with explicit markdown pipe borders
          const renderRowCells = (row) => {
            state.write('| ');
            row.content.content.forEach((cell, i) => {
              if (i > 0) state.write(' | ');
              const content = cell.firstChild;
              if (content?.textContent?.trim()) {
                state.renderInline(content);
              } else {
                state.write(' '); // Pad empty cells to maintain structural integrity
              }
            });
            state.write(' |');
            state.ensureNewLine();
          };

          // Render first row (header or data)
          renderRowCells(firstRow);

          // Delimiter row if first row is header
          if (isHeaderRow) {
            state.write(
              '| ' +
              Array.from({ length: firstRow.content.content.length })
                .map(() => '---')
                .join(' | ') +
              ' |'
            );
            state.ensureNewLine();
          }

          // Render body rows
          bodyRows.forEach((row) => {
            renderRowCells(row);
          });

          state.closeBlock(node);
          state.inTable = false;
        },
        parse: {},
      },
    };
  },
});

// ─── Main Editor ─────────────────────────────────────────────────────────────
export default function TiptapEditor({ content, onChange, className, project, requirementId, selectedChatBlocks = [], setSelectedChatBlocks }) {
  const debouncedOnChange = useMemo(() => debounce((val) => onChange(val), 300), [onChange]);

  const containerRef = useRef(null);

  const [focusMode, setFocusMode] = useState(false);
  const [hoveredBlock, setHoveredBlock] = useState(null);
  const [ctxMenu, setCtxMenu] = useState(null);

  const hoveredBlockRef = useRef(null);
  const hoverClearTimer = useRef(null);
  const onHoverRef = useRef(null);

  // Table handle state
  const [tableOverlay, setTableOverlay] = useState(null);
  const [rowMenuOpen, setRowMenuOpen_] = useState(false);
  const [colMenuOpen, setColMenuOpen_] = useState(false);
  const rowMenuOpenRef = useRef(false);
  const colMenuOpenRef = useRef(false);
  useEffect(() => { rowMenuOpenRef.current = rowMenuOpen; }, [rowMenuOpen]);
  useEffect(() => { colMenuOpenRef.current = colMenuOpen; }, [colMenuOpen]);
  const setRowMenuOpen = (v) => { setRowMenuOpen_(v); };
  const setColMenuOpen = (v) => { setColMenuOpen_(v); };

  useEffect(() => { hoveredBlockRef.current = hoveredBlock; }, [hoveredBlock]);

  // Close table menus when clicking outside
  useEffect(() => {
    if (!rowMenuOpenRef.current && !colMenuOpenRef.current) return;
    const handler = (e) => {
      setRowMenuOpen(false);
      setColMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);


  onHoverRef.current = (info) => {
    if (hoverClearTimer.current) {
      clearTimeout(hoverClearTimer.current);
      hoverClearTimer.current = null;
    }
    if (info) {
      setHoveredBlock(info);
    } else {
      hoverClearTimer.current = setTimeout(() => setHoveredBlock(null), 150);
    }
  };

  const editor = useEditor({
    // Custom Editor Extensions creation
    extensions: [
      // Markdown Starter Kit 
      StarterKit.configure({ codeBlock: false }),
      // Initial Place holder
      Placeholder.configure({ placeholder: 'Type "/" for commands…' }),
      // Bubble Menu 
      BubbleMenuExtension,
      // Image Node Rendering
      TiptapNode.create({
        name: 'imageNode',
        inline: true,
        group: 'inline',
        selectable: true,
        atom: true,
        addAttributes() { return { src: { default: '' }, alt: { default: '' } }; },
        parseHTML() { return [{ tag: 'img' }]; },
        renderHTML({ HTMLAttributes }) { return ['img', { ...HTMLAttributes, class: 'max-w-full rounded-lg' }]; },
        addStorage() {
          return {
            markdown: {
              serialize: (state, node) => {
                const src = state.esc(node.attrs.src);
                const alt = node.attrs.alt ? state.esc(node.attrs.alt) : '';
                state.write(`![${alt}](${src})`);
              },
            },
          };
        },
      }),
      
      MarkdownTable.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      // Custom /command popup
      SlashCommands.configure({ suggestion: { items: getSuggestionItems, render: renderItems } }),
      // Highlight
      Highlight.configure({ multicolor: true }),
      // TODO List Item 
      TaskList,
      // List Item
      TaskItem.configure({ nested: true }),
      // UnderLine 
      Underline,
      // Link 
      Link,
      //Code Block
      CodeBlock,
      // Word/character counting
      CharacterCount,
      // Smart quotes, dashes, etc
      Typography,
      // Focus Mode creation
      Focus.configure({ className: 'has-focus', mode: 'all' }),
      // Markdown configuration 
      Markdown.configure({ transformPastedText: true, transformCopiedText: true }),
    ],
    // Content Updation (Markdown to HTML)
    content: marked.parse(content || ''),
    // Content Updation (HTML to Markdown)
    onUpdate: ({ editor }) => {
      debouncedOnChange(editor.storage.markdown.getMarkdown());
      console.log("Markdown Rendering : ", editor.storage.markdown.getMarkdown())
    },
    // Custom Editing Props
    editorProps: {
      attributes: {
        class:
          'prose prose-slate max-w-none focus:outline-none min-h-[120px] text-[16px] text-slate-900 font-medium leading-relaxed ' +
          'prose-table:border-collapse prose-table:border-slate-300 ' +
          'prose-td:border prose-td:border-slate-300 prose-td:p-2 ' +
          'prose-th:border prose-th:border-slate-300 prose-th:bg-slate-100 prose-th:p-2 ' +
          'prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:bg-slate-50 prose-blockquote:pl-4 prose-blockquote:py-3 prose-blockquote:rounded-r-md prose-blockquote:italic prose-blockquote:text-slate-600',
      },
    },
    // On Create Hooks for debugging
    onCreate({ editor }) {
      editor.registerPlugin(BlockHoverPlugin((info) => onHoverRef.current?.(info), hoveredBlockRef));
      editor.registerPlugin(getChatSelectionPlugin());
      editor.registerPlugin(getGithubAlertsPlugin());
    },
  });

  // Sync selected blocks to plugin state
  useEffect(() => {
    if (!editor) return;
    const { state, view } = editor;
    const tr = state.tr.setMeta(chatSelectionKey, { selectedTexts: selectedChatBlocks });
    view.dispatch(tr);
  }, [selectedChatBlocks, editor]);

  // Table Overlay Ref
  const stateTableOverlayRef = useRef({
    topButton: null,
    rightButton: null,
    cellRect: null,
    containerRect: null,
  });

  // Button Positions Table Overlay
  const TableButtonPositions = useCallback((cellRect, containerRect) => {
    const topY = cellRect.top - containerRect.top;
    const topX = cellRect.left - containerRect.left + cellRect.width / 2 - 10;
    const rightY = cellRect.top - containerRect.top + cellRect.height / 2 - 10;
    const rightX = cellRect.left - containerRect.left + cellRect.width - 20;
    return {
      topButton: { top: topY, left: topX, id: 'row' },
      rightButton: { top: rightY, left: rightX, id: 'col' },
    };
  }, []);

  // Unified table handle system — single source of truth using refs to prevent race conditions
  useEffect(() => {
    if (!editor) return;

    let referenceID = null;

    // Show overlay — always sets the same state shape
    const showOverlay = (data) => {
      setTableOverlay({
        topButton: data.topButton,
        rightButton: data.rightButton,
      });
      stateTableOverlayRef.current = data;
    };

    // Hide overlay — only if no menu is open
    const hideOverlay = () => {
      if (!rowMenuOpenRef.current && !colMenuOpenRef.current) {
        setTableOverlay(null);
        stateTableOverlayRef.current = { topButton: null, rightButton: null, cellRect: null, containerRect: null };
      }
    };

    const plugin = new Plugin({
      props: {
        handleDOMEvents: {
          mousemove(view, event) {
            if (referenceID) cancelAnimationFrame(referenceID);
            referenceID = requestAnimationFrame(() => {
              const target = event.target;
              if (!(target instanceof HTMLElement)) return;

              const td = target.closest?.('td');
              const th = target.closest?.('th');
              const cell = td || th;

              const containerRect = containerRef.current?.getBoundingClientRect();
              if (!containerRect) return;

              if (cell) {
                // Mouse over a table cell — show buttons immediately
                const pos = view.posAtDOM(cell, 0);
                const rect = cell.getBoundingClientRect();
                const data = {
                  topButton: { top: rect.top - containerRect.top, left: rect.left - containerRect.left + rect.width / 2 - 10, id: th ? 'col' : 'row' },
                  rightButton: { top: rect.top - containerRect.top + rect.height / 2 - 10, left: rect.left - containerRect.left + rect.width - 20, id: th ? 'col' : 'row' },
                  cellPos: pos,
                  cellRect: rect,
                  containerRect,
                };
                setRowMenuOpen(false);
                setColMenuOpen(false);
                showOverlay(data);
              } else {
                // Mouse left the cell — only hide if no menu is open
                hideOverlay();
              }
            });
          },
        },
      },
    });

    editor.registerPlugin(plugin);

    return () => {
      if (referenceID) cancelAnimationFrame(referenceID);
    };
  }, [editor]);

  // Container-level mouseout bridge — keeps overlay alive when moving between cell, button, menu
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let hideTimer = null;
    let hideTimerId = 0; // monotonically increasing ID to ignore stale timers

    const handleMouseOut = (e) => {
      const related = e.relatedTarget;
      if (related && el.contains(related)) return; // moving within container — no-op

      const timerId = ++hideTimerId;
      hideTimer = setTimeout(() => {
        if (timerId !== hideTimerId) return; // stale
        // Check refs for latest state
        if (!rowMenuOpenRef.current && !colMenuOpenRef.current) {
          setTableOverlay(null);
          stateTableOverlayRef.current = { topButton: null, rightButton: null, cellRect: null, containerRect: null };
        }
        hideTimer = null;
      }, 100);
    };

    el.addEventListener('mouseout', handleMouseOut);

    return () => {
      el.removeEventListener('mouseout', handleMouseOut);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [editor]);

  // Handle Table Actions
  const handleTableAction = useCallback((action) => {
    if (!editor) return;

    // Helper: find table node (deep scan if not first child), cursor row index, header status, and total rows
    const findCurrentRow = () => {
      const { state } = editor;
      let pos = state.selection.from;
      let targetRowIndex = null;
      let isHeader = false;
      let totalRows = 0;
      let tableNode = state.doc.firstChild;

      // Deep scan if the table isn't the first child of the doc
      if (tableNode?.type.name !== 'table') {
        tableNode = null;
        state.doc.descendants((node) => {
          if (node.type.name === 'table') {
            tableNode = node;
            return false;
          }
          return true;
        });
      }

      if (tableNode) {
        totalRows = tableNode.childCount;
        let currentRowIdx = 0;
        tableNode.descendants((node, offset) => {
          if (targetRowIndex !== null) return;
          if (node.type.name === 'tableRow') {
            const end = offset + node.nodeSize;
            if (pos >= offset && pos < end) {
              targetRowIndex = currentRowIdx;
              // Check if any cell in this row is a tableHeader node
              node.descendants((cell) => {
                if (cell.type.name === 'tableHeader') {
                  isHeader = true;
                }
              });
            }
            currentRowIdx++;
          }
        });
      }
      return { targetRowIndex, isHeader, totalRows };
    };

    // Helper: promote ONLY the absolute first row of the table to a header
    const promoteFirstRowToHeader = () => {
      setTimeout(() => {
        const table = editor.state.doc.firstChild;
        let tableNode = table;
        // Deep scan if needed
        if (tableNode?.type.name !== 'table') {
          tableNode = null;
          editor.state.doc.descendants((node) => {
            if (node.type.name === 'table') {
              tableNode = node;
              return false;
            }
            return true;
          });
        }
        if (tableNode?.type.name === 'table' && tableNode.childCount > 0) {
          // Select first cell of first row, then toggle if not already a header
          editor.commands.setCellSelection({ anchorCell: 0, headCell: 0 });
          const { isHeader } = findCurrentRow();
          if (!isHeader) {
            editor.commands.toggleHeaderRow();
          }
        }
      }, 0);
    };

    switch (action) {
      case 'addRowAbove': {
        const { targetRowIndex } = findCurrentRow();
        editor.chain().focus().addRowBefore().run();

        // Markdown only allows row 0 to be a header. If we added a row above the previous row 0,
        // the new row is now index 0 — promote it to header.
        if (targetRowIndex === 0) {
          promoteFirstRowToHeader();
        }
        break;
      }
      case 'addRowBelow':
        editor.chain().focus().addRowAfter().run();
        break;
      case 'deleteRow': {
        const { targetRowIndex, totalRows } = findCurrentRow();

        editor.chain().focus().deleteRow().run();

        // If the top row (header) was deleted, promote the new top row to header
        if (targetRowIndex === 0) {
          promoteFirstRowToHeader();
        }
        break;
      }
      case 'addColumnLeft':
        editor.chain().focus().addColumnBefore().run();
        break;
      case 'addColumnRight':
        editor.chain().focus().addColumnAfter().run();
        break;
      case 'deleteColumn':
        editor.chain().focus().deleteColumn().run();
        break;
    }
  }, [editor]);

  // Block markdown context Rendering
  useEffect(() => {
    if (editor && !editor.isFocused) {
      const cur = editor.storage.markdown.getMarkdown();
      if (content !== cur) editor.commands.setContent(marked.parse(content || ''), false);
    }
  }, [content, editor]);

  // Handle Block context Menu
  const handleCtxAction = useCallback((action) => {
    if (!ctxMenu || !editor) return;
    const { pos } = ctxMenu;
    const node = editor.state.doc.nodeAt(pos);
    if (!node) return;
    const { nodeSize, textContent } = node;

    switch (action) {
      case 'delete':
        editor.chain().focus().deleteRange({ from: pos, to: pos + nodeSize }).run();
        break;
      case 'duplicate':
        editor.chain().focus().insertContentAt(pos + nodeSize, node.toJSON()).run();
        break;
      case 'copy':
        navigator.clipboard.writeText(textContent);
        break;
      case 'turn-paragraph':
        editor.chain().focus().setTextSelection(pos + 1).setParagraph().run(); break;
      case 'turn-heading 1':
        editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 1 }).run(); break;
      case 'turn-heading 2':
        editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 2 }).run(); break;
      case 'turn-heading 3':
        editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 3 }).run(); break;
      case 'turn-heading 4':
        editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 4 }).run(); break;
      case 'turn-heading 5':
        editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 5 }).run(); break;
      case 'turn-heading 6':
        editor.chain().focus().setTextSelection(pos + 1).toggleHeading({ level: 6 }).run(); break;
      case 'turn-bulletList':
        editor.chain().focus().setTextSelection(pos + 1).toggleBulletList().run(); break;
      case 'turn-orderedList':
        editor.chain().focus().setTextSelection(pos + 1).toggleOrderedList().run(); break;
      case 'turn-taskList':
        editor.chain().focus().setTextSelection(pos + 1).toggleTaskList().run(); break;
      case 'turn-blockquote':
        editor.chain().focus().setTextSelection(pos + 1).toggleBlockquote().run(); break;
      case 'turn-codeBlock':
        editor.chain().focus().setTextSelection(pos + 1).toggleCodeBlock().run(); break;
      default: break;
    }
  }, [ctxMenu, editor]);

  // Export Context Block MD File
  const exportMarkdown = () => {
    if (!editor) return;
    const md = editor.storage.markdown.getMarkdown();
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'export.md'; a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div
      ref={containerRef}
      data-editor-container
      className={`${className} relative group bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col transition-all z-0`}
    >
      {/* ── Toolbar ── */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between text-xs opacity-0 group-hover:opacity-100 transition-opacity rounded-t-xl">
        {/* Focus Button */}
        <button
          onClick={() => setFocusMode((f) => !f)}
          className={`px-2 py-1 rounded-md font-semibold transition-all ${focusMode ? 'bg-primary-100 text-primary-700' : 'text-slate-500 hover:bg-white border border-transparent hover:border-slate-200'
            }`}
        >
          {focusMode ? 'Focus On' : 'Focus Off'}
        </button>
        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button onClick={exportMarkdown} className="flex items-center gap-1.5 px-2 py-1 text-slate-500 hover:text-primary-600 font-semibold transition-all">
            <ArrowDown size={14} /> Export MD
          </button>
        </div>
      </div>

      {/* Custom Styles */}
      <style dangerouslySetInnerHTML={{
        __html: `
        ${focusMode ? `
          .has-focus { border-radius: 3px; box-shadow: 0 0 0 3px rgba(59, 130, 246,0.15); }
          .ProseMirror > *:not(.has-focus) { opacity: 0.3; transition: opacity 0.3s; }
          .ProseMirror:hover > *:not(.has-focus) { opacity: 0.6; }
        ` : ''}
        .is-chat-selected {
          border-left: 3px solid #3b82f6 !important;
          background-color: #eff6ff !important;
          padding-left: 8px !important;
          border-radius: 2px;
          margin-left: -11px !important;
        }
        .ProseMirror { padding: 8px 0; }
        .ProseMirror p { margin: 3px 0; }
        .ProseMirror > * + * { margin-top: 2px; }

        /* Table Selection Styling */
        .ProseMirror .selectedCell {
          background-color: rgba(59, 130, 246, 0.08) !important;
        }
        .ProseMirror tr:has(.selectedCell) {
          outline: 2px solid #3b82f6;
          outline-offset: -1px;
        }

        /* GitHub-style Alerts */
        .github-alert {
          border-left: 4px solid #e2e8f0 !important;
          padding: 8px 16px;
          margin: 16px 0;
          color: #57606a;
          background-color: #ffffff;
          border-radius: 4px;
        }
        .github-alert-note {
          border-left-color: #0969da !important;
          background-color: rgba(9, 105, 218, 0.05) !important;
        }
        .github-alert-tip {
          border-left-color: #1a7f37 !important;
          background-color: rgba(26, 127, 55, 0.05) !important;
        }
        .github-alert-important {
          border-left-color: #f97316 !important;
          background-color: rgba(249, 115, 22, 0.05) !important;
        }
        .github-alert-warning {
          border-left-color: #9a6700 !important;
          background-color: rgba(154, 103, 0, 0.05) !important;
        }
        .github-alert-caution {
          border-left-color: #cf222e !important;
          background-color: rgba(207, 34, 46, 0.05) !important;
        }

        .ProseMirror [data-type="taskItem"] {
          display: flex !important;
          align-items: flex-start;
          gap: 8px;
          list-style: none;
        }
        .ProseMirror [data-type="taskItem"] label {
          flex-shrink: 0;
          display: inline-flex;
          align-items: flex-start;
        }
        .ProseMirror [data-type="taskItem"] > div {
          flex: 1;
          min-width: 0;
        }
        .ProseMirror-selectednode { outline: 2px solid #3b82f6; background: rgba(59, 130, 246,.05); border-radius: 4px; }
        .ProseMirror p.is-editor-empty:first-child::before {
          color: #adb5bd; content: attr(data-placeholder);
          float: left; height: 0; pointer-events: none;
        }
        .scrollbar-pro::-webkit-scrollbar { width: 6px; }
        .scrollbar-pro::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-pro::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; transition: background 0.2s; }
        .scrollbar-pro::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      ` }} />

      {/* Markdown Content rendering */}
      <div className="flex-1 flex overflow-hidden min-h-[400px]">
        <div className="flex-1 px-12 py-8 relative overflow-y-auto scrollbar-pro pr-2">
          {/* Bubble Menu */}
          {editor && (
            <BubbleMenu
              editor={editor}
              tippyOptions={{ duration: 150, placement: 'top-start' }}
              className="flex bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl p-1.5 shadow-2xl"
            >
              {editor.isActive('table') ? (
                <div className="flex items-center gap-1">
                  <BubbleBtn onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row"><Plus size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().deleteRow().run()} title="Delete row" danger><Minus size={15} /></BubbleBtn>
                  <BubbleSep />
                  <BubbleBtn onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add col"><Columns size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().deleteColumn().run()} title="Delete col" danger><Trash size={15} /></BubbleBtn>
                  <BubbleSep />
                  <BubbleBtn onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table" danger><TableIcon size={15} /></BubbleBtn>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  <BubbleBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><Bold size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><Italic size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><UnderlineIcon size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strike"><Strikethrough size={15} /></BubbleBtn>
                  <BubbleSep />
                  <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1"><Heading1 size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2"><Heading2 size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Heading 3"><Heading3 size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive('heading', { level: 4 })} title="Heading 4"><Heading4 size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()} active={editor.isActive('heading', { level: 5 })} title="Heading 5"><Heading5 size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()} active={editor.isActive('heading', { level: 6 })} title="Heading 6"><Heading6 size={15} /></BubbleBtn>
                  <BubbleSep />
                  <BubbleBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet List"><List size={15} /></BubbleBtn>
                  <BubbleBtn onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="Task List"><CheckSquare size={15} /></BubbleBtn>
                  <BubbleSep />
                  <BubbleBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code"><Code size={15} /></BubbleBtn>
                </div>
              )}
            </BubbleMenu>
          )}

          {/* ── Drafting Area ── */}
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* ── Table Handle Buttons (Notion-style) ── */}
      {tableOverlay && editor && (
        <div
          className="z-40 pointer-events-none"
          data-table-handle
          onMouseEnter={() => {
            const cached = stateTableOverlayRef.current;
            if (cached.cellRect && cached.containerRect) {
              const positions = TableButtonPositions(cached.cellRect, cached.containerRect);
              setTableOverlay({
                topButton: positions.topButton,
                rightButton: positions.rightButton,
              });
            }
          }}
        >
          {/* Top button (row handle) */}
          {tableOverlay.topButton && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (tableOverlay.cellPos !== undefined) {
                  try {
                    const $pos = editor.state.doc.resolve(tableOverlay.cellPos);
                    const selection = CellSelection.rowSelection($pos);
                    editor.view.dispatch(editor.state.tr.setSelection(selection));
                  } catch (err) {}
                }
                setRowMenuOpen(true);
              }}
              className={`pointer-events-auto absolute z-40 w-[20px] h-[20px] flex items-center justify-center rounded transition-colors ${
                rowMenuOpen
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-slate-400 hover:text-primary-600 hover:bg-primary-50'
              }`}
              style={{
                top: tableOverlay.topButton.top,
                left: tableOverlay.topButton.left,
              }}
            >
              <MoreHorizontal size={16} />
            </button>
          )}

          {/* Right button (column handle) */}
          {tableOverlay.rightButton && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (tableOverlay.cellPos !== undefined) {
                  try {
                    const $pos = editor.state.doc.resolve(tableOverlay.cellPos);
                    const selection = CellSelection.colSelection($pos);
                    editor.view.dispatch(editor.state.tr.setSelection(selection));
                  } catch (err) {}
                }
                setColMenuOpen(true);
              }}
              className={`pointer-events-auto absolute z-40 w-[20px] h-[20px] flex items-center justify-center rounded transition-colors ${
                colMenuOpen
                  ? 'text-primary-600 bg-primary-50'
                  : 'text-slate-400 hover:text-primary-600 hover:bg-primary-50'
              }`}
              style={{
                top: tableOverlay.rightButton.top,
                left: tableOverlay.rightButton.left,
              }}
            >
              <MoreVertical size={16} />
            </button>
          )}

          {/* Row menu */}
          {rowMenuOpen && (
            <div
              className="absolute bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 pointer-events-auto"
              style={{
                top: (tableOverlay.topButton?.top ?? 0) - 2,
                left: (tableOverlay.topButton?.left ?? 0) + 25,
                minWidth: 150,
              }}
              onMouseEnter={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {[
                { icon: <ArrowUp size={13} />, label: 'Add row above', action: 'addRowAbove' },
                { icon: <ArrowDownIcon size={13} />, label: 'Add row below', action: 'addRowBelow' },
                { icon: <Trash size={13} />, label: 'Delete row', action: 'deleteRow', danger: true },
              ].map((item, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTableAction(item.action);
                    setRowMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium transition-colors text-left ${
                    item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          )}

          {/* Column menu */}
          {colMenuOpen && (
            <div
              className="absolute bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 pointer-events-auto"
              style={{
                top: (tableOverlay.rightButton?.top ?? 0) - 2,
                left: (tableOverlay.rightButton?.left ?? 0) + 25,
                minWidth: 150,
              }}
              onMouseEnter={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {[
                { icon: <ArrowLeft size={13} />, label: 'Add column left', action: 'addColumnLeft' },
                { icon: <ArrowRight size={13} />, label: 'Add column right', action: 'addColumnRight' },
                { icon: <Trash size={13} />, label: 'Delete column', action: 'deleteColumn', danger: true },
              ].map((item, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTableAction(item.action);
                    setColMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium transition-colors text-left ${
                    item.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Block Hovered Actions Buttons ── */}
      {hoveredBlock && containerRef.current && (
        <BlockActions
          rect={hoveredBlock.rect}
          containerRect={containerRef.current.getBoundingClientRect()}
          isSelected={selectedChatBlocks.includes(hoveredBlock.node.textContent)}
          onToggleSelect={() => {
            if (!setSelectedChatBlocks) return;
            const text = hoveredBlock.node.textContent;
            if (selectedChatBlocks.includes(text)) {
              setSelectedChatBlocks(prev => prev.filter(t => t !== text));
            } else {
              setSelectedChatBlocks(prev => [...prev, text]);
            }
          }}
          onPlusClick={() => {
            if (!editor || !hoveredBlock) return;
            editor
              .chain()
              .focus()
              .insertContentAt(hoveredBlock.pos + hoveredBlock.node.nodeSize, { type: 'paragraph' })
              .run();
          }}
          onGripClick={(e) => {
            const hb = hoveredBlock;
            setCtxMenu({
              position: { top: hb.rect.top + 28, left: hb.rect.left - 48 },
              pos: hb.pos,
            });
          }}
        />
      )}

      {/* ── Block Context menu ── */}
      {ctxMenu && containerRef.current && (
        <BlockContextMenu
          position={ctxMenu.position}
          containerRect={containerRef.current.getBoundingClientRect()}
          onClose={() => { setCtxMenu(null); }}
          onAction={(action) => { handleCtxAction(action); }}
        />
      )}

      {/* ── Bottom Status Bar ── */}
      {editor && (
        <div className="absolute bottom-5 right-6 flex items-center gap-5 px-4 py-2 bg-white/95 backdrop-blur-xl border border-slate-200 shadow-xl rounded-2xl pointer-events-none select-none transition-all duration-300 transform hover:scale-105">
          {/* Word Counts */}
          <div className="flex items-center gap-2">
            <FileText size={14} className="text-primary-600" />
            <div className="flex flex-col">
              <span className="text-[12px] font-black leading-none text-slate-900 tracking-tight">
                {editor.storage.characterCount.words()}
              </span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Words</span>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-200" />
          {/* Content positions */}
          <div className="flex items-center gap-2">
            <Hash size={14} className="text-primary-600" />
            <div className="flex flex-col">
              <span className="text-[12px] font-mono font-bold leading-none text-slate-900 tracking-tighter">
                {(() => {
                  if (editor.isActive('table')) return 'TBL';
                  const { from } = editor.state.selection;
                  const text = editor.state.doc.textBetween(0, from, '\n');
                  const lines = text.split('\n');
                  return `${lines.length}:${lines[lines.length - 1].length + 1}`;
                })()}
              </span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">Position</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bubble button helpers ────────────────────────────────────────────────────────────
function BubbleBtn({ onClick, active, danger, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-xl transition-all ${active ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
        : danger ? 'text-rose-400 hover:bg-rose-500/20'
          : 'text-slate-500 hover:bg-slate-100'
        }`}
    >
      {children}
    </button>
  );
}

// ─── Bubble Separator helpers ────────────────────────────────────────────────────────────
function BubbleSep() {
  return <div className="w-px h-4 bg-slate-200 mx-0.5 flex-shrink-0" />;
}
