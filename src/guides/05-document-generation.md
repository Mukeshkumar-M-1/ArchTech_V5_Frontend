# Document Generation

**Document Generation** turns the analysed template structure into actual document content. Each section of the Document Tree is written automatically, grounded in the project's extracted requirements and memory files. You can watch the generation run, inspect which knowledge the assistant used for every section, preview and export the result, and manage the produced document versions.

## Opening Document Generation

1. In the workspace sidebar, open **Software SRS/SDD**.
2. In the sub-tabs, select **DOCUMENT GENERATION** (next to VERSION MANAGEMENT and LOGS).

The right-hand panel shows the generation controls: the primary **Generate** button with **Preview** and **Export** below it, and the **Outline** / **Execution** tabs for tracking progress.

![Document Generation tab with the Generate control](/guides/images/5_1_document_generation_menu.png)

## Starting a Generation Run

Click the primary generation button to start writing the document. The run proceeds section by section through the Document Tree.

![Generate button highlighted](/guides/images/5_2_document_generation_generate_button.png)

## Following the Run

### Execution Panel

Switch to the **Execution** tab to watch the run live. Each template section appears as a card — the section currently being written is marked **ACTIVE**, and completed sections collapse behind a tools count (for example *03 Introduction — 4 tools*).

![Execution panel with the active section and tool calls](/guides/images/5_3_document_generation_content_section_list.png)

The active section expands to show exactly what the assistant is doing: gathering knowledge, then reading the relevant memory files step by step (for example `FileRead DOR.md`, `Glob **/*`, `FileRead srs.md`, `FileRead answers.md`).

![Execution panel showing assistant tool calls for the active section](/guides/images/5_7_document_generation_execution_panel.png)

A status bar above the content shows the current step and overall progress — for example **Generating. 04 Overall Description — 1/9** — with a **Cancel** button. The footer counters track **WORDS** and the cursor **POSITION** of the document being written.

> [!NOTE]
> Generation is resumable. If a run is interrupted, the button changes to **Resume Generation** and continues from the last completed section.

### Table of Contents and Versions

The right panel groups everything produced so far:

- **Table of Contents** — the live outline of the generated document (1. Introduction, 1.1 Purpose, 2. Overall Description, …). Use it to jump between sections.
- **Versions** — each completed run produces a numbered version (v1, v2, v3…). Use the arrows or the slider to flip between versions; the label `v3 / 4` shows the active one.

![Table of Contents and Versions panel in the right sidebar](/guides/images/5_9_document_generation_table_content.png)

### Version Management

To compare or restore previous results, open **Version Management** from the sub-tabs. Each generation run is stored as a separate version of the document.

![Version Management entry for the generated document](/guides/images/5_8_document_generation_version_manage.png)

## Working with Content Blocks

Every generated paragraph is a **block**. Hovering over a block reveals the handle column on the left with selection controls.

![Content block with its hover controls next to a generated paragraph](/guides/images/5_11_document_generation_block_empty.png)

Click a block's handle to select it. Selected blocks are highlighted, and a **Blocks Selected** counter appears at the bottom of the page. A chip with the selected block is also attached to the AI Assistant input, so you can ask the assistant to revise exactly that content.

![Selected block highlighted and attached to the AI Assistant input](/guides/images/5_12_document_generation_block_select.png)

## Preview and Export

When the run is complete:

- **Preview** — open a read-only view of the fully rendered document.
- **Export** — download the document (for example as a `.docx` file) for review outside the application.
- **Outline** — collapse the view to just the document outline.

![Preview and Export buttons above the Outline and Execution tabs](/guides/images/5_4_document_generation_outline_button.png)

![Export button highlighted](/guides/images/5_5_document_generation_export_button.png)

![Preview button highlighted](/guides/images/5_6_document_generation_preview_button.png)

## Next Steps

Use the [AI Assistant](/guide?page=ai-assistant) to refine individual sections, and [Version Management](/guide?page=version-management) to keep track of every generated revision.
