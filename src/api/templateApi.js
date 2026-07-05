import { getApiUrl } from '../utils/apiConfig';

/**
 * Shared fetch wrapper for template API calls.
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

// ============================================================================
// Section CRUD
// ============================================================================

/**
 * Fetch the list of template sections for a project.
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<Array<{filename: string, title: string, section_number: number, is_generated: boolean}>>}
 */
export async function fetchSections(projectId) {
  return request(`/template-sections/${projectId}`);
}

/**
 * Fetch the markdown content of a single template file.
 * @param {string} projectId - The unique project identifier.
 * @param {string} filename - The template file name.
 * @returns {Promise<{filename: string, content: string, path: string}>}
 */
export async function fetchSectionContent(projectId, filename) {
  return request(`/template-section/${projectId}/${filename}`);
}

/**
 * Delete a template section file.
 * @param {string} projectId - The unique project identifier.
 * @param {string} filename - The template file name.
 * @returns {Promise<{status: string, message: string}>}
 */
export async function deleteSectionFile(projectId, filename) {
  return request(`/template-section/${projectId}/${filename}`, {
    method: 'DELETE',
  });
}

/**
 * Create a new template section file.
 * @param {string} projectId - The unique project identifier.
 * @param {string} filename - The new section file name.
 * @returns {Promise<{status: string, message: string, filename: string}>}
 */
export async function createSectionFile(projectId, filename) {
  return request(`/template-section/${projectId}/create`, {
    method: 'POST',
    body: { filename },
  });
}

/**
 * Generate sections with LLM.
 * @param {string} projectId - The unique project identifier.
 * @param {Object} [options] - Generation options.
 * @param {string} [options.filename] - Target section to generate.
 * @param {string[]} [options.requirementIds] - Requirement IDs to use.
 * @returns {Promise<{status: string, message: string}>}
 */
export async function generateSections(projectId, options = {}) {
  return request(`/template-section/${projectId}/generate`, {
    method: 'POST',
    body: {
      filename: options.filename ?? null,
      requirement_ids: options.requirementIds ?? [],
    },
  });
}

/**
 * Cancel the running generation task for a project.
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<{status: string, message: string}>}
 */
export async function cancelGeneration(projectId) {
  return request(`/template-section/${projectId}/cancel`, { method: 'POST' });
}

/**
 * Update the content of a template section file.
 * @param {string} projectId - The unique project identifier.
 * @param {string} filename - The template file name.
 * @param {string} content - The new file content.
 * @returns {Promise<{status: string, message: string}>}
 */
export async function updateSectionContent(projectId, filename, content) {
  return request(`/template-section/${projectId}/${filename}`, {
    method: 'PUT',
    body: { content },
  });
}

/**
 * Fetch Phase 3 analysis JSON for a project.
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<Object>} Phase 3 analysis result.
 */
export async function fetchPhase3Analysis(projectId) {
  return request(`/template-analysis/${projectId}`);
}

/**
 * Fetch generation progress for a project.
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<{status: string, progress: number, phase: string, tool_calls: Object, tool_calls_count: number, sessions: Array}>}
 */
export async function fetchProgress(projectId) {
  return request(`/template-progress/${projectId}`);
}

/**
 * Validate the document (structural + semantic checks on all sections).
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<Object>} Validation report.
 */
export async function validateDocument(projectId) {
  return request(`/template-section/${projectId}/validate`, { method: 'POST' });
}
