import { getApiUrl } from "../utils/apiConfig";

/**
 * Shared fetch wrapper for requirement API calls.
 */
async function request(url, options = {}) {
  const isFormData = options.body instanceof FormData;
  const headers = options.headers || {};

  if (!isFormData && !headers["Content-Type"] && options.body) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(getApiUrl(url), {
    method: options.method || "GET",
    headers,
    body: isFormData
      ? options.body
      : options.body
        ? JSON.stringify(options.body)
        : undefined,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(
      errorBody.detail || errorBody.message || `API error ${res.status}`,
    );
  }

  return res.json();
}

/**
 * Fetch the list of requirements for a project.
 * @param {string} projectId - The unique project identifier.
 */
export async function fetchRequirements(projectId) {
  return request(`/requirements/${projectId}`);
}

/**
 * Fetch the currently selected requirement IDs for a project.
 * @param {string} projectId - The unique project identifier.
 */
export async function fetchSelectedIds(projectId) {
  return request(`/selected-ids/${projectId}`);
}

/**
 * Fetch the background extraction progress for a project.
 * @param {string} projectId - The unique project identifier.
 */
export async function fetchExtractionProgress(projectId) {
  return request(`/extraction-progress/${projectId}`);
}

/**
 * Upload a document to extract requirements.
 * @param {string} projectId - The unique project identifier.
 * @param {File} file - The file object to upload.
 */
export async function uploadRequirements(projectId, file) {
  const data = new FormData();
  data.append("files", file);
  data.append("project_id", projectId);

  return request("/upload-requirements", {
    method: "POST",
    body: data,
  });
}

/**
 * Update the explanation/text of an existing requirement.
 * @param {string} projectId - The unique project identifier.
 * @param {string} reqId - The ID of the requirement.
 * @param {string} text - The new explanation text.
 */
export async function updateRequirement(projectId, reqId, text) {
  return request("/update-requirement", {
    method: "POST",
    body: { req_id: reqId, explanation: text, project_id: projectId },
  });
}

/**
 * Request AI insights for a specific requirement.
 * @param {string} projectId - The unique project identifier.
 * @param {string} text - The requirement text.
 * @param {string} action - The AI action ('summarize', 'rephrase', 'custom').
 * @param {string|null} [query=null] - Custom user query if action is 'custom'.
 */
export async function requestAiInsight(projectId, text, action, query = null) {
  return request("/ai-insight", {
    method: "POST",
    body: { text, action, user_query: query, project_id: projectId },
  });
}

/**
 * Submit selected requirement IDs to save them to the project.
 * @param {string} projectId - The unique project identifier.
 * @param {Array<string>} requirementIds - Array of selected requirement IDs.
 */
export async function submitSelectedRequirementsIds(projectId, requirementIds) {
  return request(`/submit-selected/${projectId}`, {
    method: "POST",
    body: { requirement_ids: requirementIds },
  });
}

/**
 * Get the full URL for the PDF viewer to access the document file.
 * @param {string} projectId - The unique project identifier.
 * @param {string} file - The file path/name.
 * @returns {string} The formatted URL.
 */
export function getPdfViewerUrl(projectId, file) {
  return getApiUrl(
    `/files/${encodeURIComponent(file)}?project_id=${encodeURIComponent(projectId)}`,
  );
}
