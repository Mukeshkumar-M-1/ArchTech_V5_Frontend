/**
 * Copy text to the clipboard, falling back to a hidden textarea when the
 * async Clipboard API is unavailable or the document is not focused
 * (e.g. right after opening a context menu).
 * @param {string} text
 * @returns {Promise<void>} Resolves on success, rejects on failure.
 */
export async function copyTextToClipboard(text) {
  if (navigator.clipboard && document.hasFocus()) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);
}
