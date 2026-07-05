import { getApiUrl } from '../utils/apiConfig';

/**
 * Shared fetch wrapper for memory API calls.
 * @param {string} url - API endpoint path (relative).
 * @param {Object} [options] - Fetch options.
 * @param {'GET' | 'POST' | 'DELETE'} [options.method='GET'] - HTTP method.
 * @param {Object} [options.body] - JSON body to send.
 * @returns {Promise<Object>} Parsed JSON response.
 * @throws {Error} On non-OK HTTP responses.
 */
async function request(url, options = {}) {
  const jsonBody = options.body ? JSON.stringify(options.body) : undefined;
  const res = await fetch(getApiUrl(url), {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: jsonBody,
  });

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}));
    throw new Error(errorBody.detail || `API error ${res.status}`);
  }

  return res.json();
}

/**
 * Fetch the list of memory files (knowledge files) for a project.
 * @param {string} projectId - The unique project identifier.
 */
export async function fetchKnowledgeFiles(projectId) {
  return request(`/${projectId}/knowledge-files`);
}

/**
 * Fetch the list of uploaded files for a project.
 * @param {string} projectId - The unique project identifier.
 */
export async function fetchUploadedFiles(projectId) {
  return request(`/${projectId}/uploaded-files`);
}

/**
 * Fetch the content of a specific knowledge file.
 * @param {string} projectId - The unique project identifier.
 * @param {string} filePath - The file path (will be URL encoded).
 */
export async function fetchKnowledgeFileContent(projectId, filePath) {
  return request(`/${projectId}/knowledge-file/${encodeURIComponent(filePath)}`);
}

/**
 * Fetch the current memory generation progress.
 * @param {string} projectId - The unique project identifier.
 */
export async function fetchMemoryProgress(projectId) {
  return request(`/${projectId}/memory-progress`);
}

/**
 * Start the memory generation process.
 * @param {string} projectId - The unique project identifier.
 */
export async function generateMemory(projectId) {
  return request(`/${projectId}/generate-memory`, { method: 'POST' });
}

/**
 * Clear all memory files.
 * @param {string} projectId - The unique project identifier.
 */
export async function clearMemory(projectId) {
  return request(`/${projectId}/clear-memory`, { method: 'POST' });
}
