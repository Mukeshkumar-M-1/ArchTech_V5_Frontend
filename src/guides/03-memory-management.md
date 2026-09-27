# Memory Management

The **Memory Management** workspace builds the project's knowledge base. It processes the documents you uploaded in Data Extraction and generates structured memory files that are used as context for template analysis, section generation and the AI assistant.

## Opening Memory Management

In the workspace sidebar, select **Memory Management**. It sits between Data Extraction and Software SRS/SDD.

![Memory Management entry highlighted in the workspace sidebar](/guides/images/3_memory_management_menu.png)

The workspace header shows the source document currently loaded — for example `DP-VPX-6025-000-HRS-0Y03.PDF` — together with the **Generate Memory** and **Clear Memory** actions on the right.

## The Workspace Empty State

A fresh workspace shows the **Workspace Empty** placeholder: *"Generate memory to populate the file explorer."*

![Memory Management workspace with the empty state and Generate Memory button highlighted](/guides/images/3_memory_management_empty.png)

This is expected before the first run — start **Generate Memory** to populate the file explorer with the generated memory files.

## Generating Memory

1. Make sure the correct source document is shown in the header.
2. Click **Generate Memory**.

While generation runs, the button is replaced by a progress status showing the active phase and item count — for example **Phase A — Requirements (0/159)** — alongside a percentage indicator.

![Generation progress showing Phase A requirements counter](/guides/images/3_memory_management_loading.png)

> [!NOTE]
> Generation runs in phases. The phase label and counter update automatically until all items are processed. Keep the page open until the run completes.

### Cancelling a Generation Run

If you need to stop a run in progress, click **Cancel** next to the progress status.

![Cancel button highlighted next to the generation progress status](/guides/images/3_memory_management_loading_cancel.png)

> [!WARNING]
> Cancelling stops generation mid-phase. Any memory files already written remain in the workspace, but the interrupted phase must be re-run by starting Generate Memory again.

## Managing Existing Memory

- **Search files** — use the search box above the file explorer to filter memory files by name.
- **Clear Memory** — removes all generated memory files for the project. The workspace returns to the empty state.

> [!IMPORTANT]
> Clear Memory cannot be undone. Re-run Generate Memory afterwards if you need the memory again.

## Next Steps

With the project memory in place, continue to [Template Analysis](/guide?page=template-analysis) to prepare your document templates.
