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
 * @param {string} [templateType='Standard'] - The template type to sync.
 * @returns {Promise<Array<{filename: string, title: string, section_number: number, is_generated: boolean}>>}
 */
export async function fetchSections(projectId, templateType = 'Standard') {
  return request(`/template-sections/${projectId}`, {
    method: 'POST',
    body: { template_type: templateType },
  });
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

/**
 * Fetch all document-level versions with section counts.
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<Array<{version: number, section_count: number, sections: Array}>>}
 */
export async function fetchDocumentVersions(projectId) {
  return request(`/document-versions/${projectId}`);
}

/**
 * Fetch all sections for a specific document version.
 * @param {string} projectId - The unique project identifier.
 * @param {number} version - The document version number.
 * @returns {Promise<{version: number, sections: Array<{section_number: string, section_filename: string, has_content: boolean}>>}>}
 */
export async function fetchVersionSections(projectId, version) {
  return request(`/document-version/${projectId}/${version}`);
}

/**
 * Fetch the cleaned markdown content for a specific section + version.
 * @param {string} projectId - The unique project identifier.
 * @param {string} sectionFilename - The section filename (e.g. "01_project_table.md").
 * @param {number} version - The version number.
 * @returns {Promise<{section_number: string, section_filename: string, version: number, content: string}>}
 */
export async function fetchVersionContent(projectId, sectionFilename, version) {
  return request(`/document-version-content/${projectId}/${sectionFilename}/${version}`);
}

/**
 * Update the markdown content for a specific section + version.
 * @param {string} projectId - The unique project identifier.
 * @param {string} sectionFilename - The section filename (e.g. "01_project_table.md").
 * @param {number} version - The version number.
 * @param {string} content - The new content to save.
 * @returns {Promise<{status: string, message: string}>}
 */
export async function updateVersionContent(projectId, sectionFilename, version, content) {
  return request(`/document-version-content/${projectId}/${sectionFilename}/${version}`, {
    method: 'PUT',
    body: { content },
  });
}

// ============================================================================
// TEMPLATE MANAGEMENT API FUNCTIONS
// ============================================================================

/**
 * Fetch the per-project template registry (global + project-specific templates).
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<{templates: Array<{name: string, path: string, locked: boolean, section_count: number}>}>}
 */
export async function fetchTemplateTypeRegistry(projectId) {
  return request(`/api/templates/registry/${projectId}`);
}

/**
 * Fetch the per-project section lock mapping.
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<{[filename: string]: boolean}>}
 */
export async function fetchTemplateLocks(projectId) {
  return request(`/api/templates/locks/${projectId}`);
}

/**
 * Fetch the currently selected template name for a project.
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<{template_type: string}>}
 */
export async function fetchSelectedTemplate(projectId) {
  return request(`/api/templates/selected/${projectId}`);
}

/**
 * Fetch the currently selected template name for a project.
 * @param {string} projectId - The unique project identifier.
 * @returns {Promise<{template_type: string}>}
 */
export async function fetchSelectedTemplateName(projectId) {
  return request(`/api/templates/selected/${projectId}`);
}

/**
 * Fetch the source section list for a specific template type.
 * @param {string} projectId - The unique project identifier.
 * @param {string} templateTypeName - The name of the template type (e.g., "Standard", "Compact").
 * @returns {Promise<Array<{section_number: number, filename: string, title: string, locked: boolean}>>}
 */
export async function fetchSourceTemplateSections(projectId, templateTypeName) {
  return request(`/api/templates/sections/${projectId}`, {
    method: 'POST',
    body: { template_type: templateTypeName },
  });
}

/** Alias for fetchSourceTemplateSections (used by TemplateDetailsDialog). */
export const fetchTemplateSections = fetchSourceTemplateSections;

/**
 * Switch the project to use a different template type.
 * @param {string} projectId - The unique project identifier.
 * @param {string} selectedTemplateName - The name of the template type to switch to.
 * @returns {Promise<Array<{filename: string, path: string, section_number: number, title: string, is_generated: boolean}>>}
 */
export async function selectProjectTemplateType(projectId, selectedTemplateName) {
  return request(`/api/templates/select/${projectId}`, {
    method: 'PUT',
    body: { template_name: selectedTemplateName },
  });
}

/**
 * Toggle the lock state of a specific section within a project.
 * @param {string} projectId - The unique project identifier.
 * @param {string} sectionFilename - The filename of the section to lock/unlock.
 * @param {boolean} sectionIsLocked - Whether the section should be locked.
 * @returns {Promise<{status: string, filename: string, locked: boolean, template_locked: boolean}>}
 */
export async function toggleSectionLock(projectId, sectionFilename, sectionIsLocked) {
  return request(`/api/templates/lock-section/${projectId}`, {
    method: 'PUT',
    body: { filename: sectionFilename, locked: sectionIsLocked },
  });
}

/**
 * Lock or unlock all sections for the project template.
 * @param {string} projectId - The unique project identifier.
 * @param {boolean} [locked=true] - True to lock, false to unlock.
 * @returns {Promise<{status: string, locked: boolean, sections_count: number}>}
 */
export async function lockTemplate(projectId, locked = true) {
  return request(`/api/templates/lock-template/${projectId}`, {
    method: 'POST',
    body: { locked },
  });
}

/**
 * Delete a template type from a project.
 * @param {string} projectId - The unique project identifier.
 * @param {string} templateTypeName - The name of the template type to delete.
 * @returns {Promise<{status: string, message: string}>}
 */
export async function removeTemplateType(projectId, templateTypeName) {
  return request(`/api/templates/delete/${projectId}`, {
    method: 'DELETE',
    body: { template_name: templateTypeName },
  });
}

/**
 * Reset a template's sections back to the source files (preserves locked sections).
 * @param {string} projectId - The unique project identifier.
 * @param {string} templateName - The name of the template to reset.
 * @returns {Promise<{status: string, message: string, sections_reset: number}>}
 */
export async function resetTemplateToSource(projectId, templateName) {
  return request(`/api/templates/reset/${projectId}`, {
    method: 'POST',
    body: { template_type: templateName },
  });
}

/**
 * Create a new template type scoped to a project.
 * @param {string} projectId - The unique project identifier.
 * @param {string} templateName - The name for the new template.
 * @param {string} [sourceTemplateName="Standard"] - Template to copy sections from.
 * @returns {Promise<{status: string, message: string, template: Object}>}
 */
export async function createTemplateType(projectId, templateName, sourceTemplateName = 'Standard') {
  return request(`/api/templates/create/${projectId}`, {
    method: 'POST',
    body: { template_name: templateName, source_template: sourceTemplateName },
  });
}
