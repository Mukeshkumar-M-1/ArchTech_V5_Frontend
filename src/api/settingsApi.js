import { getApiUrl } from '../utils/apiConfig';

/**
 * Shared fetch wrapper for settings API calls.
 * @param {string} url - API endpoint path (relative).
 * @param {Object} [options] - Fetch options.
 * @param {'GET' | 'POST'} [options.method='GET'] - HTTP method.
 * @param {Object} [options.body] - JSON body to send.
 * @returns {Promise<Object>} Parsed JSON response.
 * @throws {Error} On non-OK HTTP responses.
 */
async function request(url, options = {}) {
  const jsonBody = options.body ? JSON.stringify(options.body) : undefined;
  const response = await fetch(getApiUrl(url), {
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json' },
    body: jsonBody,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || `API error ${response.status}`);
  }

  return response.json();
}

/**
 * Fetch the LLM settings for a project (saved values merged over defaults).
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<{api_url: string, api_key: string, timeout: number, default_model: string}>}
 */
export async function fetchProjectSettings(projectId) {
  return request(`/settings/${projectId}`);
}

/**
 * Fetch the list of LLM models available on the project's provider.
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<Array<{key: string, display_name: string, description: string}>>}
 */
export async function fetchAvailableModels(projectId) {
  return request(`/settings/${projectId}/models`);
}

/**
 * Save the LLM settings for a project to .ArchTech/{projectId}/settings.json.
 * @param {string} projectId - The unique project identifier.
 * @param {{api_url: string, api_key: string, default_model: string}} llmSettings - Values to persist.
 * @returns {Promise<{status: string, project_id: string, message: string}>}
 */
export async function saveProjectSettings(projectId, llmSettings) {
  return request(`/settings/${projectId}`, {
    method: 'POST',
    body: {
      api_url: llmSettings.api_url,
      api_key: llmSettings.api_key,
      default_model: llmSettings.default_model,
    },
  });
}
