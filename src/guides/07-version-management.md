# Version Management

**Version Management** keeps a complete history of every generated document revision. Each generation run is stored as a separate version, so you can inspect what changed between runs, view any previous version of a section, and download any revision for offline review or archiving.

## Opening Version Management

1. In the workspace sidebar, open **Software SRS/SDD**.
2. In the sub-tabs, select **VERSION MANAGEMENT**.

![Version Management tab highlighted in the workspace sub-tabs](/guides/images/7_1_version_management_menu.png)

The workspace splits into two panels: **SECTIONS** on the left and **VERSIONS** on the right.

## Browsing Sections

The **SECTIONS** panel lists every section of the generated document with its status — sections marked *Generated* have content in the stored versions.

![Sections panel listing generated document sections](/guides/images/7_2_version_management_section_select.png)

- Click a section to expand it and inspect its stored revisions.
- Section names mirror the template structure, for example `03_introduction`, `06_functional_requirements`, `10_appendix_a_kc_mapping`.

## Browsing Versions

The **VERSIONS** panel lists every stored revision, newest first — `version_v4`, `version_v3`, `version_v2`, `version_v1`. Each entry shows the version name and a counter of stored sections.

![Versions list with version_v3 active](/guides/images/7_3_version_management_download.png)

- Click a version to make it active — the active version is highlighted, and the section panel reflects its content.
- The number next to a version indicates how many blocks or messages it contains.

## Viewing a Version

Click the **eye icon** on a version row to open a read-only view of that revision. This shows exactly what the document looked like after that generation run — useful for comparing an earlier revision against the current one.

![Eye icon for viewing a version](/guides/images/7_4_version_management_view.png)

## Downloading a Version

Click the **download icon** on a version row to export that revision to a file. The download contains the document exactly as it was in that version.

> [!NOTE]
> Older versions are never deleted automatically. Download any version you want to archive outside the application.

## Next Steps

This completes the SDG AI guide. Revisit [Document Generation](/guide?page=document-generation) to produce new versions, or [Template Analysis](/guide?page=template-analysis) to change the document structure before the next run.
