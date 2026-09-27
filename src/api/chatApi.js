import { getApiUrl } from '../utils/apiConfig';

/**
 * Send a chat message and stream back SSE events.
 * @param {Object} options
 * @param {string} options.message - The user message.
 * @param {string} [options.session_id] - Optional existing session ID (auto-created if omitted).
 * @param {string} [options.project_id] - Optional project ID for context.
 * @param {AbortSignal} [options.signal] - Optional AbortController signal to cancel the stream.
 * @returns {AsyncGenerator<{type: string, [key: string]: any}>} SSE event stream.
 */
export async function* sendChatMessage({ message, session_id, project_id, template_type, signal, contextBlocks, mentions }) {
  const res = await fetch(getApiUrl('/chat/send'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // template_type is dropped by JSON.stringify when undefined — backend defaults to "srs".
    body: JSON.stringify({ session_id, message, project_id, template_type, context_blocks: contextBlocks, mentions }),
    signal,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Chat API error ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event = JSON.parse(line.slice(6));
            yield event;
          } catch (error){
            console.error(`[ERROR] : ${error}`)
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Fetch conversation history for a session.
 * @param {string} sessionId
 * @param {string} [projectId] - Scopes the session lookup to this project's session records.
 * @returns {Promise<Array<{role: string, content: string, timestamp: number}>>}
 */
export async function fetchChatMessages(sessionId, projectId) {
  const res = await fetch(getApiUrl(`/chat/messages/${sessionId}?project_id=${encodeURIComponent(projectId ?? "")}`));
  if (!res.ok) throw new Error('Failed to fetch chat messages');
  return res.json();
}

/**
 * List all chat sessions, newest first.
 * @param {string} [projectId] - When given, lists only this project's sessions.
 * @returns {Promise<Array<{sessionId: string, startedAt: number}>>}
 */
export async function fetchChatSessions(projectId) {
  const res = await fetch(getApiUrl(`/chat/sessions?project_id=${encodeURIComponent(projectId ?? "")}`));
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}

/**
 * Submit a user response to a tool interaction (e.g. selection/prompt).
 * @param {Object} options
 * @param {string} options.session_id
 * @param {string} options.tool_call_id
 * @param {any} options.response - User's selection or typed response.
 * @returns {Promise<{status: string}>}
 */
export async function sendChatInteraction({ session_id, tool_call_id, response }) {
  const res = await fetch(getApiUrl('/chat/interact'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, tool_call_id, response }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Chat interaction error ${res.status}`);
  }
  return res.json();
}
