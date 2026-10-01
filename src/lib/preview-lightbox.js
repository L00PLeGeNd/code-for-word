/**
 * Preview enlarge lightbox — snapshot helpers (DOM-light seams).
 */

/**
 * Whether the preview has a sheet worth enlarging.
 * @param {ParentNode | null | undefined} previewRoot
 */
export function canOpenPreviewLightbox(previewRoot) {
  if (!previewRoot || typeof previewRoot.querySelector !== 'function') return false
  return !!previewRoot.querySelector('.preview-sheet')
}

/**
 * Snapshot the preview sheet HTML for the lightbox bubble.
 * @param {ParentNode | null | undefined} previewRoot
 * @returns {string}
 */
export function snapshotPreviewHtml(previewRoot) {
  if (!previewRoot || typeof previewRoot.querySelector !== 'function') return ''
  const sheet = previewRoot.querySelector('.preview-sheet')
  return sheet ? sheet.outerHTML : ''
}

/**
 * Mark the cloned sheet as the lightbox body so CSS can size it for the bubble.
 * @param {string} html
 * @returns {string}
 */
export function decorateLightboxHtml(html) {
  if (!html) return ''
  return html.replace(
    /class="preview-sheet([^"]*)"/,
    'class="preview-sheet$1 preview-sheet--lightbox"'
  )
}
