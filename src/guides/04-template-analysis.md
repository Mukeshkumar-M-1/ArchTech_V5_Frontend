# Template Analysis

**Template Analysis** is where you define the structure of the documents the system will generate. A *template* is a named set of ordered sections — such as *Project Table*, *Revision History* or *Introduction* — that mirrors the outline of your target specification. You select a template, review and adjust its sections, lock it, and then run the analysis so the application maps each section against the project's extracted requirements. The result is a **Document Tree** that drives the Document Generation workspace.

## Opening the Template Workspace

1. In the workspace sidebar, open **Software SRS/SDD**.
2. In the top tabs, choose **SRS DOCUMENT** (or **SDD DOCUMENT** for software design descriptions).
3. In the sub-tabs below, select **DOCUMENT TEMPLATE**.

The TEMPLATE panel on the left lists the sections of the currently selected template, and the toolbar above the editor shows the template controls.

![Software workspace with the Document Template tab active](/guides/images/4_1_template_analysis_menu_main.png)

![Template panel in the left sidebar listing template sections](/guides/images/4_2_template_analysis_menu_template.png)

## Selecting a Template

Click the template dropdown in the toolbar. All templates available to the project are listed — for example **BSP-Board-1**, **BSP-System-1**, **BSP-ATE-ATP-1** and **BSP-MCU-1**.

![Template dropdown with the available templates](/guides/images/4_3_template_analysis_select.png)

- Templates with a **lock icon** are locked and cannot be edited.
- The currently active template is marked with a highlighted dot.

Pick the template you want to work with; the section list in the TEMPLATE panel updates immediately.

![Choosing a template from the dropdown list](/guides/images/4_4_template_analysis_choose_template.png)

## Working with Template Sections

Click **Template Sections** in the toolbar to open the section manager for the active template.

![Toolbar with the Template Sections button highlighted](/guides/images/4_5_template_analysis_template_section.png)

The dialog shows a table with every section of the template — its number, name and origin (sections marked **GLOBAL** come from the global template library).

![Template Sections dialog listing the sections of BSP-System-1](/guides/images/4_6_template_analysis_locktemplate.png)

### Locking a Template

Locking freezes the template's section structure. Locked templates can be selected and analysed but not modified.

1. Open **Template Sections** for the template.
2. Click **Lock Template** in the footer of the dialog.

![Selecting Lock Template in the section panel](/guides/images/4_6_1_template_analysis_select_lockpanel.png)

A locked template shows the lock icon in the template dropdown.

> [!IMPORTANT]
> Lock a template once its section structure is final. Generation runs against the locked structure, so later structural changes require unlocking and re-analysis.

### Unlocking a Template

To modify a locked template, open **Template Sections** and click **Unlock Template**. The lock icon disappears and sections can be edited again.

![Unlock Template button in the section panel](/guides/images/4_6_2_template_analysis_unlock_template.png)

### Resetting a Template

Click **Reset Template** in the dialog footer to discard all local modifications and restore the template to its original set of sections.

![Reset Template button highlighted in the section panel](/guides/images/4_7_template_analysis_reset_template.png)

> [!WARNING]
> Reset discards every custom section you added to the template. This cannot be undone.

## Adding a New Section

1. Click **+ New Section** in the toolbar.

![New Section button highlighted in the toolbar](/guides/images/4_8_template_analysis_select_new_section.png)

2. A dialog opens where you enter the section title and content. Fill in the details and confirm.

![New Section dialog](/guides/images/4_9_template_analysis_new_section_menu.png)

3. The new section is appended to the template and appears in the TEMPLATE panel on the left.

![New section added to the template section list](/guides/images/4_10_template_analysis_select_new_section.png)

### Deleting a Section

Inside the **Template Sections** dialog you can remove sections you no longer need. Deleting removes the section and its content from the template.

![Delete option for a template section](/guides/images/4_10_1_template_analysis_delete.png)

> [!WARNING]
> Deleted sections are removed immediately. Use **Reset Template** afterwards only if you want to start over from the original structure.

## Creating a New Template

1. Click **New Template** in the toolbar.

![New Template button in the toolbar](/guides/images/4_11_template_analysis_new_template_menu.png)

2. Enter a unique template name — for example `BSP-MCU-2` — and confirm.

![New Template dialog](/guides/images/4_12_template_analysis_select_new_Template.png)

3. The new template is created empty and becomes the active template. Add sections to it as described above, then lock it when the structure is final.

![New template selected in the dropdown](/guides/images/4_12_1_template_analysis_select_new_Template_select.png)

## Running the Analysis

Once the template structure is complete, click **Analysis** in the toolbar.

![Analysis button highlighted in the toolbar](/guides/images/4_13_template_analysis_select_analysis_button.png)

While the analysis runs, a progress bar shows the current step — for example **Parsing template tree** — together with a percentage. You can abort with **Cancel**.

![Analysis progress bar with the Cancel option](/guides/images/4_14_template_analysis_select_analysis_loading.png)

> [!NOTE]
> Analysis parses each section of the template and matches it against the project's extracted requirements and memory. Larger templates take longer to process.

## Viewing the Report

Click **Report** to open the analysis result.

![Report button highlighted in the toolbar](/guides/images/4_15_template_analysis_empty_report.png)

The report renders the analysed **Document Tree**: every section of the template appears with its heading level (H1/H2), number and title — for example *03 Introduction* with sub-headings *1.1 Purpose*, *1.2 Scope*, *1.3 Definitions, Acronyms, and Abbreviations*, and so on. The section counter in the header shows how many sections were parsed.

![Document Tree report with heading levels and section numbers](/guides/images/4_16_template_analysis_report.png)

If the analysis has not been run yet, the report area is empty — run **Analysis** first to populate it.

## Next Steps

With the template analysed, continue to [Document Generation](/guide?page=document-generation) to produce the document content from the Document Tree.
