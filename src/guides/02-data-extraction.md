# Data Extraction

The **Data Extraction** workspace is where you bring your source documents into the project. Upload requirement documents such as SyRS or HRS PDFs, and the system scans them page by page to detect and extract the requirement content that feeds every downstream workspace — Memory Management, Template Analysis and Document Generation.

## Opening the Data Extraction Workspace

From the workspace sidebar, select **Data Extraction**. The page opens with an empty document list and the extraction toolbar in the header.

## Choosing the Target Document Type

Before uploading, choose which specification the extracted data belongs to. Use the dropdown in the toolbar — for example **SYSTEM REQUIREMENTS (SYRS)** or **HARDWARE REQUIREMENTS (HRS)** — and pick the target from the list.

![Target document type dropdown with SyRS and HRS options](/guides/images/2_data_extraction_select.png)

The selected document type is highlighted with a check mark. Every document you upload is filed under this type until you change it.

## Uploading a Document

1. Click the **UPLOAD DOCUMENT** button in the top-right corner of the toolbar.
2. Select the PDF file you want to process in the file dialog and click **Open**.

![Upload Document button with the system file dialog open](/guides/images/2_data_extraction_upload.png)

> [!NOTE]
> Use the **LIST** / **PAGE** toggle in the toolbar to switch between viewing extracted requirements as a flat list or grouped by page. The **VISIBLE SELECTION** and **TOTAL** counters on the right track how many items are currently shown and selected.

## Monitoring the Extraction

As soon as a document is uploaded, extraction starts automatically. A status indicator in the header shows the current progress, for example **DETECTING PAGE 3 — RUNNING**, together with a spinner.

![Extraction status showing page detection in progress](/guides/images/2_data_extraction_loading.png)

Extraction runs in the background — you can keep browsing the list while it processes the remaining pages.

## Cancelling a Running Extraction

If you uploaded the wrong file or no longer need the result, click **CANCEL EXTRACTION** while the status shows **RUNNING**.

![Cancel Extraction button highlighted during a running extraction](/guides/images/2_data_extraction_loading-cancel.png)

> [!WARNING]
> Cancelling stops the extraction immediately. Partial results may remain in the list, and the cancelled pages have to be re-extracted by uploading the document again.

## Next Steps

Once your documents are extracted, continue to [Memory Management](/guide?page=memory-management) to review and curate the extracted knowledge.
