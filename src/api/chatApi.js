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
export async function* sendChatMessage({ message, session_id, project_id, signal }) {
  const res = await fetch(getApiUrl('/chat/send'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, message, project_id }),
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
          } catch {
            // Skip malformed JSON
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
 * @returns {Promise<Array<{role: string, content: string}>>}
 */
export async function fetchChatMessages(sessionId) {
  const res = await fetch(getApiUrl(`/chat/messages/${sessionId}`));
  if (!res.ok) throw new Error('Failed to fetch chat messages');
  return res.json();
}

/**
 * List all active chat sessions.
 * @returns {Promise<Array<{session_id: string, message_count: number}>>}
 */
export async function fetchChatSessions() {
  const res = await fetch(getApiUrl('/chat/sessions'));
  if (!res.ok) throw new Error('Failed to fetch sessions');
  return res.json();
}
