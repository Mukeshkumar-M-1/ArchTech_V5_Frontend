import {
  useEditor,
  EditorContent,
  NodeViewWrapper,
  NodeViewContent,
  ReactNodeViewRenderer,
  Extension,
  Node as TiptapNode,
} from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Plugin, Selection } from "prosemirror-state";
import { BubbleMenu as BubbleMenuExtension } from "@tiptap/extension-bubble-menu";
import { StarterKit } from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import { TableRow } from "@tiptap/extension-table-row";
import { TableHeader } from "@tiptap/extension-table-header";
import { TableCell } from "@tiptap/extension-table-cell";
import { Fragment } from "@tiptap/pm/model";
import { getHTMLFromFragment } from "@tiptap/core";
import SlashCommands, {
  getSuggestionItems,
  renderItems,
} from "./SlashCommands";
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import debounce from "lodash.debounce";
import { getApiUrl } from "../utils/apiConfig";
import { Markdown } from "tiptap-markdown";
import { marked } from "marked";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  Link as LinkIcon,
  Plus,
  Minus,
  Trash,
  Columns,
  Table as TableIcon,
  Copy,
  ArrowDown,
  CopyPlus,
  Repeat,
  Type,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  GripVertical,
  Sparkles,
  FileText,
  Hash,
  Check,
  Image,
  ArrowUp,
  ArrowDown as ArrowDownIcon,
  ArrowLeft,
  ArrowRight,
  MoreHorizontal,
  MoreVertical,
  BetweenVerticalStart,
  BetweenVerticalEnd,
  BetweenHorizontalStart,
  BetweenHorizontalEnd,
  MessageSquare,
} from "lucide-react";

import Highlight from "@tiptap/extension-highlight";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import Focus from "@tiptap/extension-focus";
import CodeBlock from "@tiptap/extension-code-block";
import { PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import { CellSelection } from "@tiptap/pm/tables";

import { DiffAdd, DiffDelete } from "./extensions/DiffMarks";
import { useDocumentStore } from "../stores/useDocumentStore";
import { copyTextToClipboard } from "../utils/clipboard";
import { findBestMatchInMarkdown } from "../utils/markdownMatch";
import useToastStore from "../store/toastStore";

const normalizeText = (str) => (str || "").replace(/\s+/g, " ").trim();

// ─── ChatSelectionPlugin ────────────────────────────────────────────────────────
const chatSelectionKey = new PluginKey("chatSelection");

// Shared state: currently focused block number for highlight data attribute
let focusedChatBlockNumber = null;

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
      },
    },
    props: {
      decorations(state) {
        const { selectedTexts } = this.getState(state);
        if (!selectedTexts || selectedTexts.length === 0)
          return DecorationSet.empty;

        const blockMap = new Map();
        for (const b of selectedTexts) {
          if (typeof b === "object") {
            blockMap.set(normalizeText(b.text), b.blockNumber);
          } else {
            blockMap.set(normalizeText(b), 1);
          }
        }

        const decorations = [];
        state.doc.descendants((node, pos) => {
          if (node.isBlock) {
            const normText = normalizeText(node.textContent);
            if (blockMap.has(normText)) {
              const blockNumber = blockMap.get(normText);
              decorations.push(
                Decoration.node(pos, pos + node.nodeSize, {
                  class: "is-chat-selected",
                  "data-chat-block-number": String(blockNumber),
                  "data-is-focused": String(
                    focusedChatBlockNumber === blockNumber ? "true" : "false",
                  ),
                  style: "display: block; position: relative; margin-left: -11px;",
                }),
              );
              return false; // do not descend into child nodes to prevent overlapping decorations
            }
          }
        });
        console.log(
          "[TiptapEditor] Total decorations created:",
          decorations.length,
        );
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

// ─── GithubAlertsPlugin ────────────────────────────────────────────────────────
const githubAlertsKey = new PluginKey("githubAlerts");

function getGithubAlertsPlugin() {
  return new Plugin({
    key: githubAlertsKey,
    state: {
      init() {
        return DecorationSet.empty;
      },
      apply(tr, oldSet, oldState, newState) {
        if (!tr.docChanged) return oldSet.map(tr.mapping, tr.doc);

        const decorations = [];
        newState.doc.descendants((node, pos) => {
          if (node.type.name === "blockquote") {
            const firstChild = node.firstChild;
            if (
              firstChild &&
              firstChild.type.name === "paragraph" &&
              firstChild.textContent.trim().startsWith("[!")
            ) {
              const text = firstChild.textContent.trim();
              const match = text.match(
                /^\[!(NOTE|WARNING|CAUTION|IMPORTANT|TIP)\]/i,
              );
              if (match) {
                const type = match[1].toLowerCase();
                decorations.push(
                  Decoration.node(pos, pos + node.nodeSize, {
                    class: `github-alert github-alert-${type}`,
                  }),
                );
              }
            }
          }
        });
        return DecorationSet.create(newState.doc, decorations);
      },
    },
    props: {
      decorations(state) {
        return this.getState(state);
      },
    },
  });
}

// ─── BlockHoverPlugin ────────────────────────────────────────────────────────
const BlockHoverPlugin = (onHover, hoveredBlockRef) =>
  new Plugin({
    props: {
      handleDOMEvents: {
        mousemove(view, event) {
          const pos = view.posAtCoords({
            left: event.clientX,
            top: event.clientY,
          });
          if (!pos) {
            if (hoveredBlockRef.current) console.log("☁️ Hover: Out of bounds");
            onHover(null);
            return false;
          }

          try {
            const $pos = view.state.doc.resolve(pos.pos);
            let depth = 1;
            if ($pos.depth < 1) {
              onHover(null);
              return false;
            }

            const node = $pos.node(depth);
            const nodePos = $pos.before(depth);

            const validTypes = [
              "paragraph",
              "heading",
              "bulletList",
              "orderedList",
              "taskList",
              "blockquote",
              "codeBlock",
              "table",
              "horizontalRule",
            ];
            if (!validTypes.includes(node.type.name)) {
              onHover(null);
              return false;
            }

            if (hoveredBlockRef.current?.pos !== nodePos) {
              // console.log(`🎯 Hover: ${node.type.name} at pos ${nodePos}`);
            }

            const dom = view.nodeDOM(nodePos);
            if (!(dom instanceof HTMLElement)) {
              onHover(null);
              return false;
            }

            const rect = dom.getBoundingClientRect();
            onHover({ pos: nodePos, node, rect });
          } catch (_) {
            onHover(null);
          }

          return false;
        },
        mouseleave(_view, _event) {
          return false;
        },
      },
    },
  });

const ChatSelectionExtension = Extension.create({
  name: "chatSelection",
  addProseMirrorPlugins() {
    return [getChatSelectionPlugin()];
  },
});

const GithubAlertsExtension = Extension.create({
  name: "githubAlerts",
  addProseMirrorPlugins() {
    return [getGithubAlertsPlugin()];
  },
});

const BlockHoverExtension = Extension.create({
  name: "blockHover",
  addOptions() {
    return { onHover: null, hoveredBlockRef: null };
  },
  addProseMirrorPlugins() {
    return [
      BlockHoverPlugin(this.options.onHover, this.options.hoveredBlockRef),
    ];
  },
});

// Uses position:absolute with coordinates relative to the editor container.
function BlockActions({
  rect,
  containerRect,
  onPlusClick,
  onGripClick,
  isSelected,
  selectedBlockNumber,
  onToggleSelect,
  enableChatContext = false,
}) {
  const top = rect.top - containerRect.top + 2;
  let leftOffset = 52;
  if (enableChatContext) {
    leftOffset = isSelected ? 41 : 52;
  } else {
    leftOffset = 46;
  }
  const left = rect.left - containerRect.left - leftOffset;

  return (
    <div
      style={{
        position: "absolute",
        top,
        left,
        width: 32,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 4,
        zIndex: 10,
        pointerEvents: "auto",
      }}
    >
      <div
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onGripClick(e);
        }}
        style={{
          width: 24,
          height: 24,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          border: "1px solid #e2e8f0",
          background: "#fff",
          color: "#94a3b8",
          cursor: "pointer",
          transition: "all .15s",
          flexShrink: 0,
          userSelect: "none",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.background = "#f0f4ff";
          e.currentTarget.style.color = "#3b82f6";
          e.currentTarget.style.borderColor = "#bfdbfe";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.background = "#fff";
          e.currentTarget.style.color = "#94a3b8";
          e.currentTarget.style.borderColor = "#e2e8f0";
        }}
        title="Click for options"
      >
        <GripVertical size={13} />
      </div>

      {enableChatContext && (
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleSelect();
          }}
          className={`w-6 h-6 flex items-center justify-center rounded-md border transition-all ${
            isSelected
              ? "bg-primary-500 border-primary-500 text-white"
              : "bg-white border-slate-300 text-transparent hover:border-primary-400"
          }`}
          title="Use this block as context in Chat"
        >
          {isSelected ? (
            <span className="text-[11px] font-bold">{selectedBlockNumber}</span>
          ) : (
            <Check
              size={14}
              className="opacity-0 hover:opacity-100"
              strokeWidth={3}
            />
          )}
        </button>
      )}

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
  const [view, setView] = useState("main");

  const topOffset = position.top - containerRect.top;
  const leftOffset = position.left - containerRect.left + 30;

  // Render upwards if close to the bottom of the viewport
  const isNearBottom = position.top + 320 > window.innerHeight;
  const bottomOffset = containerRect.bottom - (position.top - 28);

  const menuStyle = isNearBottom
    ? {
        position: "absolute",
        bottom: bottomOffset,
        left: leftOffset,
        zIndex: 20,
      }
    : { position: "absolute", top: topOffset, left: leftOffset, zIndex: 20 };

  useEffect(() => {
    const handleScroll = (e) => {
      if (!ref.current?.contains(e.target)) {
        e.preventDefault();
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("wheel", handleScroll, { passive: false });
    document.addEventListener("touchmove", handleScroll, { passive: false });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("wheel", handleScroll);
      document.removeEventListener("touchmove", handleScroll);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const mainItems = [
    // Hidden for now — will re-enable later
    { key: "turnInto", icon: <Repeat size={13} />, label: "Turn into…" },
    {
      key: "duplicate",
      icon: <CopyPlus size={13} />,
      label: "Duplicate block",
    },
    { key: "copy", icon: <Copy size={13} />, label: "Copy text" },
    {
      key: "delete",
      icon: <Trash size={13} />,
      label: "Delete block",
      danger: true,
    },
  ];

  const turnIntoItems = [
    { key: "paragraph", label: "Text", icon: <Type size={13} /> },
    { key: "heading 1", label: "Heading 1", icon: <Heading1 size={13} /> },
    { key: "heading 2", label: "Heading 2", icon: <Heading2 size={13} /> },
    { key: "heading 3", label: "Heading 3", icon: <Heading3 size={13} /> },
    { key: "heading 4", label: "Heading 4", icon: <Heading4 size={13} /> },
    { key: "heading 5", label: "Heading 5", icon: <Heading5 size={13} /> },
    { key: "heading 6", label: "Heading 6", icon: <Heading6 size={13} /> },
    { key: "bulletList", label: "Bulleted List", icon: <List size={13} /> },
    {
      key: "orderedList",
      label: "Numbered List",
      icon: <ListOrdered size={13} />,
    },
    { key: "taskList", label: "To-do List", icon: <CheckSquare size={13} /> },
    { key: "blockquote", label: "Quote", icon: <Quote size={13} /> },
    { key: "codeBlock", label: "Code", icon: <Code size={13} /> },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-10"
        onMouseDown={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onClose();
        }}
      />
      <div
        ref={ref}
        style={menuStyle}
        className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl w-52 py-1.5 flex flex-col"
      >
        {view === "main" ? (
          <div className="px-1.5 space-y-0.5">
            {mainItems.map((item) => (
              <button
                key={item.key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (item.key === "turnInto") {
                    setView("turnInto");
                    return;
                  }
                  onAction(item.key);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-colors text-left ${
                  item.danger
                    ? "text-rose-600 hover:bg-rose-50"
                    : "text-slate-600 hover:bg-primary-50 hover:text-primary-700"
                }`}
              >
                <span
                  className={item.danger ? "text-rose-400" : "text-slate-400"}
                >
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.key === "turnInto" && (
                  <span className="text-slate-300">›</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <>
            <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2 mb-1">
              <button
                onMouseDown={(e) => {
                  e.preventDefault();
                  setView("main");
                }}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
              >
                <ArrowDown size={13} className="rotate-90" />
              </button>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Turn into
              </span>
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
    </>
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
            (cell) =>
              cell.type.name === "tableHeader" &&
              cell.attrs.colspan === 1 &&
              cell.attrs.rowspan === 1,
          );

          // Check if body rows contain any tableHeader cells (can't serialize as markdown)
          const hasHeaderInBody = bodyRows.some((row) =>
            row.content.content.some(
              (cell) => cell.type.name === "tableHeader",
            ),
          );

          if (hasHeaderInBody) {
            // Fall back to HTML for complex mixed tables
            state.write(
              "\n" +
                getHTMLFromFragment(Fragment.from(node), node.type.schema) +
                "\n",
            );
            state.closeBlock(node);
            return;
          }

          state.inTable = true;

          // Helper to cleanly render rows with explicit markdown pipe borders
          const renderRowCells = (row) => {
            state.write("| ");
            row.content.content.forEach((cell, i) => {
              if (i > 0) state.write(" | ");
              const content = cell.firstChild;
              if (content?.textContent?.trim()) {
                state.renderInline(content);
              } else {
                state.write(" "); // Pad empty cells to maintain structural integrity
              }
            });
            state.write(" |");
            state.ensureNewLine();
          };

          // Render first row (header or data)
          renderRowCells(firstRow);

          // Delimiter row if first row is header
          if (isHeaderRow) {
            state.write(
              "| " +
                Array.from({ length: firstRow.content.content.length })
                  .map(() => "---")
                  .join(" | ") +
                " |",
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
export default function TiptapEditor({
  content,
  onChange,
  className,
  project,
  requirementId,
  versionNumber,
  selectedChatBlocks: selectedChatBlocksProp,
  setSelectedChatBlocks,
  activeSection,
  focusedChatBlock,
  setFocusedChatBlock,
  enableChatContext = false,
  useDocumentSync = false,
  documentId = null,
}) {
  const { markUnsaved, queueSave } = useDocumentStore();
  const addToast = useToastStore((s) => s.addToast);
  // Default params only catch undefined, not null — normalize so .filter/.some below are safe.
  const selectedChatBlocks = selectedChatBlocksProp ?? [];
  const currentVersionRef = useRef(versionNumber || 1);

  // Only update from props if the incoming version is higher (prevents stale props from overriding after a save)
  useEffect(() => {
    if (versionNumber && versionNumber > currentVersionRef.current) {
      currentVersionRef.current = versionNumber;
    }
  }, [versionNumber]);

  // Hard reset when switching documents
  useEffect(() => {
    currentVersionRef.current = versionNumber || 1;
  }, [documentId]);

  const debouncedOnChange = useMemo(
    () => debounce((val) => {
      onChange?.(val);
      if (useDocumentSync && documentId) {
        queueSave(async () => {
           const projectId = project?.id || project?._id;
           const res = await fetch(getApiUrl(`/api/documents/${documentId}`), {
               method: 'PATCH',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({ 
                   content: val, 
                   base_version: currentVersionRef.current,
                   project_id: projectId,
                   title: documentId
               })
           });
           if (!res.ok) {
               if (res.status === 409) {
                   const errorData = await res.json();
                   throw { response: { status: 409, data: errorData.detail } };
               }
               throw new Error('Failed to save document');
           }
           const data = await res.json();
           if (data.version) {
               currentVersionRef.current = data.version;
           }
           return { version: data.version, updated_at: data.updated_at };
        });
      }
    }, 1000),
    [onChange, useDocumentSync, documentId, queueSave, versionNumber],
  );

  useEffect(() => {
    return () => debouncedOnChange.cancel();
  }, [debouncedOnChange]);

  const [isCopied, setIsCopied] = useState(false);
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
  useEffect(() => {
    rowMenuOpenRef.current = rowMenuOpen;
  }, [rowMenuOpen]);
  useEffect(() => {
    colMenuOpenRef.current = colMenuOpen;
  }, [colMenuOpen]);
  const setRowMenuOpen = (v) => {
    setRowMenuOpen_(v);
  };
  const setColMenuOpen = (v) => {
    setColMenuOpen_(v);
  };

  useEffect(() => {
    hoveredBlockRef.current = hoveredBlock;
  }, [hoveredBlock]);

  // Close table menus when clicking outside
  useEffect(() => {
    if (!rowMenuOpenRef.current && !colMenuOpenRef.current) return;
    const handler = (e) => {
      setRowMenuOpen(false);
      setColMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Block scrolling while a table menu is open — same approach as BlockContextMenu,
  // so the menu/highlight stays anchored to the row/column instead of drifting
  useEffect(() => {
    if (!rowMenuOpen && !colMenuOpen) return;
    const blockScroll = (e) => {
      // Allow scrolling that starts inside the menu itself (e.g. overflow within menu)
      if (e.target.closest?.("[data-table-handle]")) return;
      e.preventDefault();
    };
    document.addEventListener("wheel", blockScroll, { passive: false });
    document.addEventListener("touchmove", blockScroll, { passive: false });
    return () => {
      document.removeEventListener("wheel", blockScroll);
      document.removeEventListener("touchmove", blockScroll);
    };
  }, [rowMenuOpen, colMenuOpen]);

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
      Placeholder.configure({
        placeholder: "Press '/' to add text, tables, images or bullet points.",
      }),
      // Bubble Menu
      BubbleMenuExtension,
      // Image Node Rendering
      TiptapNode.create({
        name: "imageNode",
        inline: true,
        group: "inline",
        selectable: true,
        atom: true,
        addAttributes() {
          return { src: { default: "" }, alt: { default: "" } };
        },
        parseHTML() {
          return [{ tag: "img" }];
        },
        renderHTML({ HTMLAttributes }) {
          return ["img", { ...HTMLAttributes, class: "max-w-full rounded-lg" }];
        },
        addStorage() {
          return {
            markdown: {
              serialize: (state, node) => {
                const src = state.esc(node.attrs.src);
                const alt = node.attrs.alt ? state.esc(node.attrs.alt) : "";
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
      SlashCommands.configure({
        suggestion: { items: getSuggestionItems, render: renderItems },
      }),
      // Highlight
      Highlight.configure({ multicolor: true }),
      // TODO List Item
      TaskList.configure({
        HTMLAttributes: {
          class: "not-prose pl-2",
        },
      }),
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
      Focus.configure({ className: "has-focus", mode: "all" }),
      // Markdown configuration
      Markdown.configure({
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
      // Custom Extensions for Plugins
      ChatSelectionExtension,
      GithubAlertsExtension,
      BlockHoverExtension.configure({
        onHover: (info) => onHoverRef.current?.(info),
        hoveredBlockRef: hoveredBlockRef,
      }),
      DiffAdd,
      DiffDelete,
    ],
    // Content Updation (Markdown to HTML)
    content: typeof content === 'string' ? marked.parse(content || "") : content,
    // Content Updation
    onUpdate: ({ editor }) => {
      if (useDocumentSync && documentId) {
         const jsonContent = editor.getJSON();
         markUnsaved(jsonContent);
         debouncedOnChange(jsonContent);
      } else {
         debouncedOnChange(editor.storage.markdown.getMarkdown());
      }
    },
    // Custom Editing Props
    editorProps: {
      attributes: {
        class:
          "prose prose-slate max-w-none focus:outline-none min-h-[120px] text-[16px] text-slate-900 font-medium leading-relaxed " +
          "prose-table:border-collapse prose-table:border-slate-300 " +
          "prose-td:border prose-td:border-slate-300 prose-td:p-2 " +
          "prose-th:border prose-th:border-slate-300 prose-th:bg-slate-100 prose-th:p-2 " +
          "prose-blockquote:border-l-4 prose-blockquote:border-slate-300 prose-blockquote:bg-slate-50 prose-blockquote:pl-4 prose-blockquote:py-3 prose-blockquote:rounded-r-md prose-blockquote:italic prose-blockquote:text-slate-600 " +
          "prose-blockquote:quotes-none prose-blockquote:[&>p:first-of-type]:before:content-none prose-blockquote:[&>p:last-of-type]:after:content-none " +
          "[&_.selectedCell]:bg-primary-50/80" +
          "[&_add_content_table]:border-emerald-300 [&_add_content_th]:bg-emerald-100/50 " +
          "[&_delete_content_table]:border-red-300 [&_delete_content_th]:bg-red-100/50",
      },
    },
  });

  // Listen for agent-based content edits
  useEffect(() => {
    const emitPreviewResult = (detail, success, reason) => {
      window.dispatchEvent(
        new CustomEvent("content-edit-preview-result", {
          detail: { tool_call_id: detail?.tool_call_id, success, reason },
        }),
      );
    };

    const handlePreviewContentEdit = (e) => {
      if (!editor) {
        emitPreviewResult(e.detail, false, "Editor is not ready yet");
        return;
      }
      const { original_text, proposed_text, source_markdown } = e.detail;
      console.log("Original : ", original_text, "\n Proposed : ", proposed_text);

      if (!original_text || !proposed_text) {
        emitPreviewResult(e.detail, false, "Proposal is missing original/proposed text");
        return;
      }

      const editorMarkdown = editor.storage.markdown.getMarkdown();

      // Prefer the editor's live markdown (it may hold unsaved user edits that the stored
      // file lacks); fall back to the backend-stored section markdown.
      let baseMarkdown = null;
      let matchedSegment = findBestMatchInMarkdown(original_text, editorMarkdown);
      if (matchedSegment) {
        baseMarkdown = editorMarkdown;
      } else if (source_markdown) {
        matchedSegment = findBestMatchInMarkdown(original_text, source_markdown);
        if (matchedSegment) baseMarkdown = source_markdown;
      }

      console.log("Matched Markdown : ", matchedSegment);
      if (matchedSegment && baseMarkdown) {
        window.__archtech_preview_original = baseMarkdown;

        // DO NOT strip the table separators.
        // Instead, parse the original and proposed markdown into full HTML first.
        // This ensures `marked` successfully converts |---| into a real <table>.
        const matchedHtml = marked.parse(matchedSegment, { gfm: true, breaks: true });
        const proposedHtml = marked.parse(proposed_text, { gfm: true, breaks: true });

        // Wrap the fully rendered HTML tables in your diff tags.
        // Note: Added \n so the parser treats these as block-level elements.
        const diffPreviewHtml = `\n<delete_content>\n${matchedHtml}\n</delete_content>\n<add_content>\n${proposedHtml}\n</add_content>\n`;

        // Replace the markdown segment with the HTML diff block
        const previewMarkdown = baseMarkdown.replace(matchedSegment, diffPreviewHtml);

        // Set the editor content. WHY emitUpdate:false: the preview is transient — firing
        // onUpdate would push the diff markup into the debounced save and corrupt the section.
        editor.commands.setContent(marked.parse(previewMarkdown, { gfm: true, breaks: true }), { emitUpdate: false });
        emitPreviewResult(e.detail, true, "matched");
        return;
      }

      // DOM-based fallback: find matching block, apply diff marks
      const normalizedOriginalText = typeof normalizeText === 'function' ? normalizeText(original_text) : original_text.trim();
      let matchedBlockPosition = null;
      let matchedBlockNode = null;
      editor.state.doc.descendants((node, pos) => {
        const nodeText = typeof normalizeText === 'function' ? normalizeText(node.textContent) : node.textContent.trim();
        if (node.isBlock && nodeText === normalizedOriginalText) {
          matchedBlockPosition = pos;
          matchedBlockNode = node;
        }
      });

      if (matchedBlockPosition !== null) {
        window.__archtech_preview_original = editorMarkdown;
        const blockPosition = editor.state.doc.resolve(matchedBlockPosition);
        const blockDepth = Math.max(blockPosition.depth, 1);
        const blockStart = blockPosition.before(blockDepth);
        const blockEnd = blockStart + matchedBlockNode.nodeSize;

        // Apply diffDelete mark to old content
        const applyDeleteMark = editor.state.tr;
        applyDeleteMark.addMark(blockStart + 1, blockEnd - 1, editor.state.schema.marks.diffDelete.create());
        editor.view.dispatch(applyDeleteMark);

        // Parse proposed markdown as HTML, wrap in <add_content> for diffAdd styling
        const proposedContentHtml = marked.parse(proposed_text, { gfm: true, breaks: true });
        const diffAddedHtml = `<add_content>${proposedContentHtml}</add_content>`;
        editor.commands.insertContentAt(blockEnd, diffAddedHtml);
        emitPreviewResult(e.detail, true, "dom-fallback");
      } else {
        console.warn("Could not find block in editor for original_text:", original_text);
        emitPreviewResult(
          e.detail,
          false,
          "Original text not found in the open section or the stored section file",
        );
      }
    };

    const handleAcceptContentEdit = (e) => {
      if (!editor) return;
      const { original_text, proposed_text } = e.detail;
      if (original_text && proposed_text) {
        const baseMarkdown = window.__archtech_preview_original || editor.storage.markdown.getMarkdown();
        const matchedMarkdownSegment = findBestMatchInMarkdown(original_text, baseMarkdown);
        if (matchedMarkdownSegment) {
          const updatedMarkdown = baseMarkdown.replace(matchedMarkdownSegment, proposed_text);
          editor.commands.setContent(marked.parse(updatedMarkdown), true);
        } else {
          // Fallback: match by plain text, replace block content preserving structure
          const normalizedOriginalText = normalizeText(original_text);
          let matchedBlockPosition = null;
          editor.state.doc.descendants((node, pos) => {
            if (node.isBlock && normalizeText(node.textContent) === normalizedOriginalText) {
              matchedBlockPosition = pos;
            }
          });
          if (matchedBlockPosition !== null) {
            const blockPosition = editor.state.doc.resolve(matchedBlockPosition);
            const blockDepth = Math.max(blockPosition.depth, 1);
            const blockNode = blockPosition.node(blockDepth);
            const blockStart = blockPosition.before(blockDepth);
            const blockEnd = blockStart + blockNode.nodeSize;
            editor.chain().focus()
              .setTextSelection({ from: blockStart + 1, to: blockEnd - 1 })
              .clearNodes()
              .insertContentAt(blockStart, proposed_text)
              .run();
          }
        }
        window.__archtech_preview_original = null;
      }
    };

    const handleRejectContentEdit = (e) => {
      if (!editor) return;
      if (window.__archtech_preview_original) {
        editor.commands.setContent(marked.parse(window.__archtech_preview_original), true);
      }
      window.__archtech_preview_original = null;
    };

    window.addEventListener('preview-content-edit', handlePreviewContentEdit);
    window.addEventListener('apply-content-edit-accept', handleAcceptContentEdit);
    window.addEventListener('apply-content-edit-reject', handleRejectContentEdit);
    return () => {
      window.removeEventListener('preview-content-edit', handlePreviewContentEdit);
      window.removeEventListener('apply-content-edit-accept', handleAcceptContentEdit);
      window.removeEventListener('apply-content-edit-reject', handleRejectContentEdit);
    };
  }, [editor]);

  // Sync selected blocks to plugin state
  useEffect(() => {
    if (!editor) return;
    const { state, view } = editor;
    const filteredBlocks = selectedChatBlocks.filter(
      (b) => b.section === undefined || b.section === activeSection,
    );
    const tr = state.tr.setMeta(chatSelectionKey, {
      selectedTexts: filteredBlocks,
    });
    view.dispatch(tr);
  }, [selectedChatBlocks, editor, activeSection]);

  // Scroll to focused chat block
  useEffect(() => {
    if (!editor || !focusedChatBlock) {
      return;
    }
    console.log("[TiptapEditor] focusedChatBlock set:", focusedChatBlock);

    const timeoutId = setTimeout(() => {
      const editorContainer = containerRef.current;
      console.log("[TiptapEditor] editorContainer:", editorContainer);
      if (!editorContainer) {
        console.log("[TiptapEditor] Editor container not found");
        if (setFocusedChatBlock) setFocusedChatBlock(null);
        return;
      }

      const blockElement = editorContainer.querySelector(
        `[data-chat-block-number="${focusedChatBlock.blockNumber}"]`,
      );
      console.log(
        "[TiptapEditor] querySelector for block",
        focusedChatBlock.blockNumber,
        ":",
        blockElement,
      );

      if (blockElement) {
        console.log(
          "[TiptapEditor] Block element found, applying highlight",
          blockElement,
        );
        blockElement.scrollIntoView({ behavior: "smooth", block: "center" });

        // Set shared variable so the decoration metadata gets the right data-is-focused value
        focusedChatBlockNumber = focusedChatBlock.blockNumber;

        setTimeout(() => {
          console.log("[TiptapEditor] Removing highlight after 2s");
          focusedChatBlockNumber = null;
        }, 1000);
      } else {
        console.log(
          "[TiptapEditor] Block element not found. Searching for debug:",
        );
        const blockElements = editorContainer.querySelectorAll("[data-chat-block-number]");
        console.log(
          "[TiptapEditor] All matching block elements:",
          blockElements,
        );
        console.log(
          "[TiptapEditor] Looking for block number:",
          focusedChatBlock.blockNumber,
        );
      }

      if (setFocusedChatBlock) setFocusedChatBlock(null);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [focusedChatBlock, setFocusedChatBlock]);

  // Table Overlay Ref
  const stateTableOverlayRef = useRef({
    topButton: null,
    rightButton: null,
    cellRect: null,
    tableRect: null,
    containerRect: null,
  });

  const tableHoverTimerRef = useRef(null);

  // Button Positions Table Overlay
  const TableButtonPositions = useCallback(
    (cellRect, tableRect, containerRect) => {
      const scrollY = containerRef.current?.scrollTop || 0;
      const scrollX = containerRef.current?.scrollLeft || 0;
      const topY = tableRect.top - containerRect.top + scrollY;
      const topX = cellRect.left - containerRect.left + scrollX;
      const rightY = cellRect.top - containerRect.top + scrollY;
      const rightX = tableRect.left - containerRect.left + scrollX;
      return {
        topButton: {
          top: topY - 16,
          left: topX + cellRect.width / 2 - 16,
          id: "col",
        },
        rightButton: {
          top: rightY + cellRect.height / 2 - 16,
          left: rightX - 16,
          id: "row",
        },
        absoluteCell: {
          top: rightY,
          left: topX,
          width: cellRect.width,
          height: cellRect.height,
        },
        absoluteTable: {
          top: topY,
          left: rightX,
          width: tableRect.width,
          height: tableRect.height,
        },
      };
    },
    [],
  );

  // Unified table handle system — single source of truth using refs to prevent race conditions
  useEffect(() => {
    if (!editor) return;

    let referenceID = null;

    const showOverlay = (data) => {
      setTableOverlay(data);
      stateTableOverlayRef.current = data;
    };

    // Hide overlay — only if no menu is open
    const hideOverlay = () => {
      if (!rowMenuOpenRef.current && !colMenuOpenRef.current) {
        setTableOverlay(null);
        stateTableOverlayRef.current = {
          topButton: null,
          rightButton: null,
          cellRect: null,
          tableRect: null,
          containerRect: null,
        };
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

              const td = target.closest?.("td");
              const th = target.closest?.("th");
              const cell = td || th;
              const table = target.closest?.("table");

              const containerRect =
                containerRef.current?.getBoundingClientRect();
              if (!containerRect) return;

              if (cell && table) {
                // Do not update or close if a menu is already open
                if (rowMenuOpenRef.current || colMenuOpenRef.current) return;

                if (tableHoverTimerRef.current) {
                  clearTimeout(tableHoverTimerRef.current);
                  tableHoverTimerRef.current = null;
                }
                // Mouse over a table cell — show buttons immediately
                const pos = view.posAtDOM(cell, 0);
                const rect = cell.getBoundingClientRect();
                const tableRect = table.getBoundingClientRect();

                const scrollY = containerRef.current.scrollTop || 0;
                const scrollX = containerRef.current.scrollLeft || 0;
                const topY = tableRect.top - containerRect.top + scrollY;
                const topX = rect.left - containerRect.left + scrollX;
                const rightY = rect.top - containerRect.top + scrollY;
                const rightX = tableRect.left - containerRect.left + scrollX;

                const data = {
                  topButton: {
                    top: topY - 16,
                    left: topX + rect.width / 2 - 16,
                    id: "col",
                  },
                  rightButton: {
                    top: rightY + rect.height / 2 - 16,
                    left: rightX - 16,
                    id: "row",
                  },
                  absoluteCell: {
                    top: rightY,
                    left: topX,
                    width: rect.width,
                    height: rect.height,
                  },
                  absoluteTable: {
                    top: topY,
                    left: rightX,
                    width: tableRect.width,
                    height: tableRect.height,
                  },
                  cellPos: pos,
                  cellRect: rect,
                  tableRect,
                  containerRect,
                };
                setRowMenuOpen(false);
                setColMenuOpen(false);
                showOverlay(data);
              } else {
                // Mouse left the cell — delay hide so user can reach the handles
                if (!tableHoverTimerRef.current) {
                  tableHoverTimerRef.current = setTimeout(() => {
                    hideOverlay();
                    tableHoverTimerRef.current = null;
                  }, 300);
                }
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

    // Global click to close table menus
    const handleGlobalClick = (e) => {
      if (rowMenuOpenRef.current || colMenuOpenRef.current) {
        // If click is inside the table handle wrapper, ignore
        if (e.target.closest?.("[data-table-handle]")) return;
        setRowMenuOpen(false);
        setColMenuOpen(false);
        setTableOverlay(null);
      }
    };
    document.addEventListener("mousedown", handleGlobalClick);

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
          stateTableOverlayRef.current = {
            topButton: null,
            rightButton: null,
            cellRect: null,
            tableRect: null,
            containerRect: null,
          };
        }
        hideTimer = null;
      }, 100);
    };

    el.addEventListener("mouseout", handleMouseOut);

    return () => {
      document.removeEventListener("mousedown", handleGlobalClick);
      el.removeEventListener("mouseout", handleMouseOut);
      if (hideTimer) clearTimeout(hideTimer);
    };
  }, [editor]);

  // Handle Table Actions
  const handleTableAction = useCallback(
    (action, cellPos) => {
      if (!editor) return;

      // Use Prosemirror's native Selection.near to robustly find the nearest valid text cursor
      // position inside the cell, completely avoiding Tiptap's setTextSelection failures.
      if (cellPos !== undefined) {
        try {
          const { state, view } = editor;
          const sel = Selection.near(state.doc.resolve(cellPos));
          view.dispatch(state.tr.setSelection(sel));
        } catch (err) {
          console.warn("Could not set cell text selection:", err);
        }
      }

      // Helper: find table node (deep scan if not first child), cursor row index, header status, and total rows
      const findCurrentRow = () => {
        const { state } = editor;
        let pos = state.selection.from;
        let targetRowIndex = null;
        let isHeader = false;
        let totalRows = 0;
        let tableNode = state.doc.firstChild;

        // Resolve the actual table position accurately from the current selection
        let tablePos = null;
        const $pos = editor.state.doc.resolve(state.selection.from);
        for (let d = $pos.depth; d > 0; d--) {
          if ($pos.node(d).type.name === "table") {
            tablePos = $pos.before(d);
            tableNode = $pos.node(d);
            break;
          }
        }

        if (tableNode) {
          totalRows = tableNode.childCount;
          let currentRowIdx = 0;
          tableNode.descendants((node, offset) => {
            if (targetRowIndex !== null) return false;
            if (node.type.name === "tableRow") {
              const end = offset + node.nodeSize;
              // offset is relative to tableNode, so absolute pos is tablePos + 1 + offset
              const absoluteRowPos = tablePos + 1 + offset;
              const absoluteRowEnd = absoluteRowPos + node.nodeSize;

              if (pos >= absoluteRowPos && pos < absoluteRowEnd) {
                targetRowIndex = currentRowIdx;
                if (node.firstChild?.type.name === "tableHeader") {
                  isHeader = true;
                }
              }
              currentRowIdx++;
              return false; // skip traversing inside the row
            }
          });
        }
        return { targetRowIndex, isHeader, totalRows, tablePos };
      };

      // Helper: ensure exactly the first row is a header, and no other rows are headers.
      // Modifies the document directly via setNodeMarkup to prevent selection side-effects.
      const fixTableHeaders = (tablePos) => {
        if (tablePos === null) return;
        setTimeout(() => {
          const { state, view } = editor;
          let tr = state.tr;
          let changed = false;

          const tableNode = tr.doc.nodeAt(tablePos);
          if (
            !tableNode ||
            tableNode.type.name !== "table" ||
            tableNode.childCount === 0
          )
            return;

          let rowIdx = 0;
          tableNode.descendants((rowNode, rowPosRel) => {
            if (rowNode.type.name === "tableRow") {
              const rowPosAbs = tablePos + 1 + rowPosRel;

              rowNode.descendants((cellNode, cellPosRel) => {
                if (
                  cellNode.type.name === "tableCell" ||
                  cellNode.type.name === "tableHeader"
                ) {
                  const cellPosAbs = rowPosAbs + 1 + cellPosRel;
                  if (rowIdx === 0 && cellNode.type.name === "tableCell") {
                    tr = tr.setNodeMarkup(
                      cellPosAbs,
                      state.schema.nodes.tableHeader,
                    );
                    changed = true;
                  } else if (
                    rowIdx > 0 &&
                    cellNode.type.name === "tableHeader"
                  ) {
                    tr = tr.setNodeMarkup(
                      cellPosAbs,
                      state.schema.nodes.tableCell,
                    );
                    changed = true;
                  }
                  return false; // skip traversing inside the cell
                }
              });

              rowIdx++;
              return false; // skip traversing inside the row
            }
          });

          if (changed) {
            view.dispatch(tr);
          }
        }, 10);
      };

      switch (action) {
        case "addRowAbove": {
          const { tablePos } = findCurrentRow();
          editor.chain().addRowBefore().run();
          fixTableHeaders(tablePos);
          break;
        }
        case "addRowBelow": {
          const { tablePos } = findCurrentRow();
          editor.chain().addRowAfter().run();
          fixTableHeaders(tablePos);
          break;
        }
        case "deleteRow": {
          const { totalRows, tablePos } = findCurrentRow();
          editor.chain().deleteRow().run();
          if (totalRows > 1) fixTableHeaders(tablePos);
          break;
        }
        case "addColumnLeft":
          editor.chain().addColumnBefore().run();
          break;
        case "addColumnRight":
          editor.chain().addColumnAfter().run();
          break;
        case "deleteColumn":
          editor.chain().deleteColumn().run();
          break;
      }
    },
    [editor],
  );

  // Block markdown context Rendering
  useEffect(() => {
    if (editor && !editor.isFocused) {
      // WHY emitUpdate:false: programmatic content loading must not fire onUpdate — with
      // Tiptap v3's options-object signature the old `setContent(x, false)` was ignored,
      // every section switch emitted a spurious onChange, and the debounced save wiped
      // the stored section content ~1s after it was viewed.
      if (typeof content === 'string') {
        const cur = editor.storage.markdown.getMarkdown();
        if (content !== cur) {
          editor.commands.setContent(marked.parse(content || ""), { emitUpdate: false });
        }
      } else if (content && typeof content === 'object') {
        // If content is already a JSON document, set it directly.
        // Tiptap's internal diffing will ensure it only updates changed nodes.
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }
  }, [content, editor]);

  // Handle Block context Menu
  const handleCtxAction = useCallback(
    (action) => {
      if (!ctxMenu || !editor) return;
      const { pos } = ctxMenu;
      const node = editor.state.doc.nodeAt(pos);
      if (!node) return;
      const { nodeSize, textContent } = node;

      switch (action) {
        case "delete":
          editor
            .chain()
            .focus()
            .deleteRange({ from: pos, to: pos + nodeSize })
            .run();
          break;
        case "duplicate":
          editor
            .chain()
            .focus()
            .insertContentAt(pos + nodeSize, node.toJSON())
            .run();
          break;
        case "copy": {
          const markdown =
            editor.storage.markdown?.serializer?.serialize(
              Fragment.from(node),
            ) ?? textContent;
          copyTextToClipboard(markdown)
            .then(() => addToast("Text copied to clipboard", "success"))
            .catch(() => addToast("Failed to copy text", "error"));
          break;
        }
        case "turn-paragraph":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .setParagraph()
            .run();
          break;
        case "turn-heading 1":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleHeading({ level: 1 })
            .run();
          break;
        case "turn-heading 2":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleHeading({ level: 2 })
            .run();
          break;
        case "turn-heading 3":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleHeading({ level: 3 })
            .run();
          break;
        case "turn-heading 4":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleHeading({ level: 4 })
            .run();
          break;
        case "turn-heading 5":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleHeading({ level: 5 })
            .run();
          break;
        case "turn-heading 6":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleHeading({ level: 6 })
            .run();
          break;
        case "turn-bulletList":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleBulletList()
            .run();
          break;
        case "turn-orderedList":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleOrderedList()
            .run();
          break;
        case "turn-taskList":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleTaskList()
            .run();
          break;
        case "turn-blockquote":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleBlockquote()
            .run();
          break;
        case "turn-codeBlock":
          editor
            .chain()
            .focus()
            .setTextSelection(pos + 1)
            .toggleCodeBlock()
            .run();
          break;
        default:
          break;
      }
    },
    [ctxMenu, editor, addToast],
  );

  // Export Context Block MD File
  const exportMarkdown = () => {
    if (!editor) return;
    const md = editor.storage.markdown.getMarkdown();
    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "export.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  // Copy the whole document as markdown
  const copyMarkdown = () => {
    if (!editor) return;
    const md = editor.storage.markdown.getMarkdown();
    copyTextToClipboard(md)
      .then(() => addToast("Markdown copied to clipboard", "success"))
      .catch(() => addToast("Failed to copy markdown", "error"));
  };

  return (
    <div
      ref={containerRef}
      data-editor-container
      className={`${className} relative group bg-white border border-slate-200 rounded-md shadow-sm flex flex-col transition-all z-0`}
    >
      {/* ── Toolbar ── */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between text-xs opacity-0 group-hover:opacity-100 transition-opacity rounded-t-md">
        {/* Focus Button */}
        <button
          onClick={() => setFocusMode((f) => !f)}
          className={`px-2 py-1 rounded-md font-semibold transition-all ${
            focusMode
              ? "bg-primary-100 text-primary-700"
              : "text-slate-500 hover:bg-white border border-transparent hover:border-slate-200"
          }`}
        >
          {focusMode ? "Focus On" : "Focus Off"}
        </button>
        {/* Export Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={copyMarkdown}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-500 hover:text-primary-600 hover:bg-white border border-transparent hover:border-slate-200 font-semibold transition-all cursor-pointer"
          >
            <Copy size={14} /> Copy MD
          </button>
          <button
            onClick={exportMarkdown}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-slate-500 hover:text-primary-600 hover:bg-white hover:border-slate-200 border border-transparent font-semibold transition-all cursor-pointer"
          >
            <ArrowDown size={14} /> Export MD
          </button>
        </div>
      </div>

      {/* Custom Styles */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
        ${
          focusMode
            ? `
          .has-focus { border-radius: 3px; box-shadow: 0 0 0 3px rgba(59, 130, 246,0.15); }
          .ProseMirror > *:not(.has-focus) { opacity: 0.3; transition: opacity 0.3s; }
          .ProseMirror:hover > *:not(.has-focus) { opacity: 0.6; }
        `
            : ""
        }
        .is-chat-selected {
          border-left: 3px solid #3b82f6;
          background-color: #eff6ff;
          padding-left: 8px;
          padding-right: 32px;
          border-radius: 2px;
          margin-left: -11px;
          position: relative;
          transition: all 0.3s ease;
        }
        .is-chat-selected[data-is-focused="true"] {
          background-color: #eff6ff !important;
          border: 2px solid #3b82f6 !important;
          border-radius: 4px !important;
          padding-top: 10px !important;
          padding-bottom: 10px !important;
          padding-left: 20px !important;
          padding-right: 20px !important;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.15) !important;
        }
        .is-chat-selected::after {
          content: attr(data-chat-block-number);
          position: absolute;
          right: 6px;
          top: 6px;
          width: 20px;
          height: 20px;
          background-color: #3b82f6;
          color: white;
          font-size: 10px;
          font-weight: bold;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 5;
          pointer-events: none;
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

        /* Suppress decorative blockquote quote marks from the typography plugin */
        .ProseMirror blockquote { quotes: none; }
        .ProseMirror blockquote p:first-of-type::before,
        .ProseMirror blockquote p:last-of-type::after { content: none; }

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
        .ProseMirror p.is-editor-empty:first-child::before,
        .ProseMirror p.is-empty::before {
          color: #adb5bd; content: attr(data-placeholder);
          float: left; height: 0; pointer-events: none;
        }
        .scrollbar-pro::-webkit-scrollbar { width: 6px; }
        .scrollbar-pro::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-pro::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; transition: background 0.2s; }
        .scrollbar-pro::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `,
        }}
      />

      {/* Markdown Content rendering */}
      <div className="flex-1 flex overflow-hidden min-h-[400px]">
        <div
          className={`flex-1 pl-16 py-8 pr-4 relative scrollbar-pro overflow-y-auto`}
          ref={containerRef}
        >
          {/* Bubble Menu */}
          {editor && (
            <BubbleMenu
              editor={editor}
              tippyOptions={{ duration: 150, placement: "top-start" }}
              className="flex bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl p-1.5 shadow-2xl"
            >
              <div className="flex items-center gap-0.5">
                <BubbleBtn
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  active={editor.isActive("bold")}
                  title="Bold"
                >
                  <Bold size={15} />
                </BubbleBtn>
                <BubbleBtn
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  active={editor.isActive("italic")}
                  title="Italic"
                >
                  <Italic size={15} />
                </BubbleBtn>
                <BubbleBtn
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  active={editor.isActive("underline")}
                  title="Underline"
                >
                  <UnderlineIcon size={15} />
                </BubbleBtn>
                <BubbleBtn
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  active={editor.isActive("strike")}
                  title="Strike"
                >
                  <Strikethrough size={15} />
                </BubbleBtn>
                <BubbleSep />
                <BubbleBtn
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 1 }).run()
                  }
                  active={editor.isActive("heading", { level: 1 })}
                  title="Heading 1"
                >
                  <Heading1 size={15} />
                </BubbleBtn>
                <BubbleBtn
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 2 }).run()
                  }
                  active={editor.isActive("heading", { level: 2 })}
                  title="Heading 2"
                >
                  <Heading2 size={15} />
                </BubbleBtn>
                <BubbleBtn
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 3 }).run()
                  }
                  active={editor.isActive("heading", { level: 3 })}
                  title="Heading 3"
                >
                  <Heading3 size={15} />
                </BubbleBtn>
                <BubbleBtn
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 4 }).run()
                  }
                  active={editor.isActive("heading", { level: 4 })}
                  title="Heading 4"
                >
                  <Heading4 size={15} />
                </BubbleBtn>
                <BubbleBtn
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 5 }).run()
                  }
                  active={editor.isActive("heading", { level: 5 })}
                  title="Heading 5"
                >
                  <Heading5 size={15} />
                </BubbleBtn>
                <BubbleBtn
                  onClick={() =>
                    editor.chain().focus().toggleHeading({ level: 6 }).run()
                  }
                  active={editor.isActive("heading", { level: 6 })}
                  title="Heading 6"
                >
                  <Heading6 size={15} />
                </BubbleBtn>
                <BubbleSep />
                {/* <BubbleBtn
                  onClick={() =>
                    editor.chain().focus().toggleBulletList().run()
                  }
                  active={editor.isActive("bulletList")}
                  title="Bullet List"
                >
                  <List size={15} />
                </BubbleBtn>
                <BubbleBtn
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                  active={editor.isActive("taskList")}
                  title="Task List"
                >
                  <CheckSquare size={15} />
                </BubbleBtn>
                <BubbleSep />
                <BubbleBtn
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  active={editor.isActive("code")}
                  title="Inline code"
                >
                  <Code size={15} />
                </BubbleBtn>
                <BubbleSep /> */}
                {enableChatContext && (
                  <BubbleBtn
                    onClick={() => {
                      if (!setSelectedChatBlocks) return;
                      const { from, to } = editor.state.selection;
                      const text = editor.state.doc.textBetween(from, to, "\n");
                      const normText = normalizeText(text);
                      
                      let markdown = text;
                      try {
                        const slice = editor.state.selection.content();
                        const tempDoc = editor.state.doc.type.create(null, slice.content);
                        markdown = editor.storage.markdown.serializer.serialize(tempDoc);
                      } catch {
                        markdown = text;
                      }
                      
                      const preview = markdown.slice(0, 80);
                      
                      const isSelected = selectedChatBlocks.some(
                        (b) =>
                          normalizeText(b.text) === normText &&
                          (b.section === undefined || b.section === activeSection)
                      );
                      
                      if (isSelected) {
                        setSelectedChatBlocks((prev) =>
                          prev.filter(
                            (b) =>
                              !(
                                normalizeText(b.text) === normText &&
                                (b.section === undefined || b.section === activeSection)
                              )
                          )
                        );
                      } else {
                        setSelectedChatBlocks((prev) => [
                          ...prev,
                          {
                            text,
                            markdown,
                            blockNumber: prev.length + 1,
                            preview,
                            section: activeSection,
                            ...(versionNumber ? { version: versionNumber } : {}),
                          },
                        ]);
                      }
                    }}
                    title="Send to Chat Context"
                    active={(() => {
                      if (!editor) return false;
                      const { from, to } = editor.state.selection;
                      const text = editor.state.doc.textBetween(from, to, "\n");
                      const normText = normalizeText(text);
                      return selectedChatBlocks?.some(
                        (b) =>
                          normalizeText(b.text) === normText &&
                          (b.section === undefined || b.section === activeSection)
                      );
                    })()}
                  >
                    <MessageSquare size={15} />
                  </BubbleBtn>
                )}
                <BubbleBtn
                  onClick={() => {
                    const { from, to } = editor.state.selection;
                    const slice = editor.state.doc.slice(from, to);
                    const markdown =
                      editor.storage.markdown?.serializer?.serialize(
                        slice.content,
                      ) ??
                      editor.state.doc.textBetween(from, to, "\n");
                    copyTextToClipboard(markdown)
                      .then(() => {
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 1000);
                      })
                      .catch(() => addToast("Failed to copy text", "error"));
                  }}
                  title={isCopied ? "Copied!" : "Copy markdown"}
                  success={isCopied}
                >
                  {isCopied ? <Check size={15} /> : <Copy size={15} />}
                </BubbleBtn>
              </div>
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
            if (tableHoverTimerRef.current) {
              clearTimeout(tableHoverTimerRef.current);
              tableHoverTimerRef.current = null;
            }
            const cached = stateTableOverlayRef.current;
            if (cached.cellRect && cached.tableRect && cached.containerRect) {
              const positions = TableButtonPositions(
                cached.cellRect,
                cached.tableRect,
                cached.containerRect,
              );
              setTableOverlay((prev) => ({
                ...prev,
                topButton: positions.topButton,
                rightButton: positions.rightButton,
                absoluteCell: positions.absoluteCell,
                absoluteTable: positions.absoluteTable,
              }));
            }
          }}
          onMouseLeave={() => {
            if (!rowMenuOpen && !colMenuOpen) {
              if (tableHoverTimerRef.current)
                clearTimeout(tableHoverTimerRef.current);
              tableHoverTimerRef.current = setTimeout(() => {
                setTableOverlay(null);
                stateTableOverlayRef.current = {
                  topButton: null,
                  rightButton: null,
                  cellRect: null,
                  tableRect: null,
                  containerRect: null,
                };
                tableHoverTimerRef.current = null;
              }, 300);
            }
          }}
        >
          {/* Column Highlight Overlay */}
          {colMenuOpen &&
            tableOverlay.absoluteCell &&
            tableOverlay.absoluteTable && (
              <div
                className="absolute border-[2px] border-primary-500 bg-primary-500/10 pointer-events-none z-30 transition-all duration-200"
                style={{
                  top: tableOverlay.absoluteTable.top,
                  left: tableOverlay.absoluteCell.left,
                  width: tableOverlay.absoluteCell.width,
                  height: tableOverlay.absoluteTable.height,
                }}
              />
            )}

          {/* Row Highlight Overlay */}
          {rowMenuOpen &&
            tableOverlay.absoluteCell &&
            tableOverlay.absoluteTable && (
              <div
                className="absolute border-[2px] border-primary-500 bg-primary-500/10 pointer-events-none z-30 transition-all duration-200"
                style={{
                  top: tableOverlay.absoluteCell.top,
                  left: tableOverlay.absoluteTable.left,
                  width: tableOverlay.absoluteTable.width,
                  height: tableOverlay.absoluteCell.height,
                }}
              />
            )}

          {/* Top button (column handle) */}
          {tableOverlay.topButton && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (tableOverlay.cellPos !== undefined) {
                  try {
                    const sel = Selection.near(
                      editor.state.doc.resolve(tableOverlay.cellPos),
                    );
                    editor.view.dispatch(editor.state.tr.setSelection(sel));
                    editor.chain().selectColumn().run();
                  } catch (err) {}
                }
                setRowMenuOpen(false);
                setColMenuOpen(true);
              }}
              className={`pointer-events-auto absolute z-40 w-[32px] h-[16px] flex items-center justify-center rounded-full transition-colors bg-white border border-slate-200 text-slate-400 hover:text-primary-600 hover:bg-primary-50 hover:border-primary-300 shadow-sm ${
                colMenuOpen
                  ? "text-primary-600 bg-primary-50 !border-primary-500 ring-2 ring-primary-100"
                  : ""
              }`}
              style={{
                top: tableOverlay.topButton.top,
                left: tableOverlay.topButton.left,
              }}
            >
              <MoreHorizontal size={14} strokeWidth={2.5} />
            </button>
          )}

          {/* Left button (row handle) */}
          {tableOverlay.rightButton && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (tableOverlay.cellPos !== undefined) {
                  try {
                    const sel = Selection.near(
                      editor.state.doc.resolve(tableOverlay.cellPos),
                    );
                    editor.view.dispatch(editor.state.tr.setSelection(sel));
                    editor.chain().selectRow().run();
                  } catch (err) {}
                }
                setColMenuOpen(false);
                setRowMenuOpen(true);
              }}
              className={`pointer-events-auto absolute z-40 w-[16px] h-[32px] flex items-center justify-center rounded-full transition-colors bg-white border border-slate-200 text-slate-400 hover:text-primary-600 hover:bg-primary-50 hover:border-primary-300 shadow-sm ${
                rowMenuOpen
                  ? "text-primary-600 bg-primary-50 !border-primary-500 ring-2 ring-primary-100"
                  : ""
              }`}
              style={{
                top: tableOverlay.rightButton.top,
                left: tableOverlay.rightButton.left,
              }}
            >
              <MoreVertical size={14} strokeWidth={2.5} />
            </button>
          )}

          {/* Row menu */}
          {rowMenuOpen && (
            <div
              className="absolute bg-white border border-slate-200 rounded-xl shadow-xl py-1 z-50 pointer-events-auto"
              style={{
                top:
                  (tableOverlay.rightButton?.top ?? 0) -
                  2 -
                  ((tableOverlay.rightButton?.top ?? 0) -
                    (containerRef.current?.scrollTop || 0) +
                    130 >
                  (tableOverlay.containerRect?.height || 500)
                    ? 110
                    : 0),
                left: (tableOverlay.rightButton?.left ?? 0) + 25,
                minWidth: 150,
              }}
              onMouseEnter={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {[
                {
                  icon: <BetweenVerticalStart size={13} />,
                  label: "Add row above",
                  action: "addRowAbove",
                },
                {
                  icon: <BetweenVerticalEnd size={13} />,
                  label: "Add row below",
                  action: "addRowBelow",
                },
                {
                  icon: <Trash size={13} />,
                  label: "Delete row",
                  action: "deleteRow",
                  danger: true,
                },
              ].map((item, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTableAction(item.action, tableOverlay.cellPos);
                    setRowMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium transition-colors text-left ${
                    item.danger
                      ? "text-rose-600 hover:bg-rose-50"
                      : "text-slate-700 hover:bg-slate-100"
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
                top: (tableOverlay.topButton?.top ?? 0) + 25,
                left:
                  (tableOverlay.topButton?.left ?? 0) -
                  2 -
                  ((tableOverlay.topButton?.left ?? 0) -
                    (containerRef.current?.scrollLeft || 0) +
                    160 >
                  (tableOverlay.containerRect?.width || 500)
                    ? 120
                    : 0),
                minWidth: 150,
              }}
              onMouseEnter={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {[
                {
                  icon: <BetweenHorizontalStart size={13} />,
                  label: "Add column left",
                  action: "addColumnLeft",
                },
                {
                  icon: <BetweenHorizontalEnd size={13} />,
                  label: "Add column right",
                  action: "addColumnRight",
                },
                {
                  icon: <Trash size={13} />,
                  label: "Delete column",
                  action: "deleteColumn",
                  danger: true,
                },
              ].map((item, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleTableAction(item.action, tableOverlay.cellPos);
                    setColMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium transition-colors text-left ${
                    item.danger
                      ? "text-rose-600 hover:bg-rose-50"
                      : "text-slate-700 hover:bg-slate-100"
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
          isSelected={selectedChatBlocks.some(
            (b) =>
              normalizeText(b.text) ===
                normalizeText(hoveredBlock.node.textContent) &&
              (b.section === undefined || b.section === activeSection),
          )}
          selectedBlockNumber={
            selectedChatBlocks.find(
              (b) =>
                normalizeText(b.text) ===
                  normalizeText(hoveredBlock.node.textContent) &&
                (b.section === undefined || b.section === activeSection),
            )?.blockNumber
          }
          onToggleSelect={() => {
            if (!setSelectedChatBlocks) return;
            const text = hoveredBlock.node.textContent;
            const normText = normalizeText(text);

            // Get markdown representation of the block node
            let markdown = text;
            if (editor) {
              try {
                const tempDoc = editor.state.doc.type.create(null, [hoveredBlock.node]);
                markdown = editor.storage.markdown.serializer.serialize(tempDoc);
              } catch {
                markdown = text;
              }
            }
            const preview = markdown.slice(0, 80);

            if (
              selectedChatBlocks.some(
                (b) =>
                  normalizeText(b.text) === normText &&
                  (b.section === undefined || b.section === activeSection),
              )
            ) {
              setSelectedChatBlocks((prev) =>
                prev.filter(
                  (b) =>
                    !(
                      normalizeText(b.text) === normText &&
                      (b.section === undefined || b.section === activeSection)
                    ),
                ),
              );
            } else {
              setSelectedChatBlocks((prev) => [
                ...prev,
                {
                  text,
                  markdown,
                  blockNumber: prev.length + 1,
                  preview,
                  section: activeSection,
                  ...(versionNumber ? { version: versionNumber } : {}),
                },
              ]);
            }
          }}
          enableChatContext={enableChatContext}
          onPlusClick={() => {
            if (!editor || !hoveredBlock) return;
            editor
              .chain()
              .focus()
              .insertContentAt(hoveredBlock.pos + hoveredBlock.node.nodeSize, {
                type: "paragraph",
              })
              .run();
          }}
          onGripClick={(e) => {
            const hb = hoveredBlock;
            setCtxMenu({
              position: { top: hb.rect.top + 28, left: hb.rect.left - 48 },
              pos: hb.pos,
            });
            if (editor) {
              editor.chain().setNodeSelection(hb.pos).run();
            }
          }}
        />
      )}

      {/* ── Block Context menu ── */}
      {ctxMenu && containerRef.current && (
        <BlockContextMenu
          position={ctxMenu.position}
          containerRect={containerRef.current.getBoundingClientRect()}
          onClose={() => {
            if (editor && ctxMenu) {
              const { selection } = editor.state;
              if (
                selection &&
                selection.node &&
                selection.from === ctxMenu.pos
              ) {
                editor
                  .chain()
                  .setTextSelection(ctxMenu.pos + 1)
                  .run();
              }
            }
            setCtxMenu(null);
          }}
          onAction={(action) => {
            handleCtxAction(action);
          }}
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
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                Words
              </span>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-200" />
          {/* Content positions */}
          <div className="flex items-center gap-2">
            <Hash size={14} className="text-primary-600" />
            <div className="flex flex-col">
              <span className="text-[12px] font-mono font-bold leading-none text-slate-900 tracking-tighter">
                {(() => {
                  if (editor.isActive("table")) return "TBL";
                  const { from } = editor.state.selection;
                  const text = editor.state.doc.textBetween(0, from, "\n");
                  const lines = text.split("\n");
                  return `${lines.length}:${lines[lines.length - 1].length + 1}`;
                })()}
              </span>
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-400">
                Position
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Bubble button helpers ────────────────────────────────────────────────────────────
function BubbleBtn({ onClick, active, danger, success, title, children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`p-2 rounded-xl transition-all ${
        success
          ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30"
          : active
            ? "bg-primary-500 text-white shadow-lg shadow-primary-500/30"
            : danger
              ? "text-rose-400 hover:bg-rose-500/20"
              : "text-slate-500 hover:bg-slate-100"
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
