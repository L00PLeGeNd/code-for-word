/**
 * Preview ↔ source navigation helpers.
 */

/**
 * Run `fn` on the next frame after a modal dialog has closed.
 * If `dialog` is already closed (or missing), still wait one frame so a
 * stacked confirm dialog can release focus first.
 * @param {{ open?: boolean, addEventListener?: Function } | null | undefined} dialog
 * @param {() => void} fn
 */
export function queueAfterDialogClose(dialog, fn) {
  const later = () => {
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(fn)
    else fn()
  }
  if (dialog && dialog.open && typeof dialog.addEventListener === 'function') {
    dialog.addEventListener('close', later, { once: true })
    return
  }
  later()
}

/**
 * Character offsets for each 1-based source line.
 * @param {string} source
 * @returns {{ start: number, end: number, text: string }[]}
 */
export function sourceLineRanges(source) {
  const text = String(source ?? '')
  /** @type {{ start: number, end: number, text: string }[]} */
  const out = []
  if (!text) return out
  let i = 0
  while (i <= text.length) {
    if (i === text.length) {
      // Trailing newline already closed the last line; only add empty if source ended mid-line logic.
      break
    }
    const start = i
    while (i < text.length && text[i] !== '\n' && text[i] !== '\r') i++
    out.push({ start, end: i, text: text.slice(start, i) })
    if (i >= text.length) break
    if (text[i] === '\r' && text[i + 1] === '\n') i += 2
    else i += 1
  }
  // Preserve a final empty line when source ends with a newline
  if (text.endsWith('\n') || text.endsWith('\r')) {
    out.push({ start: text.length, end: text.length, text: '' })
  }
  return out
}

/**
 * 1-based line number from a preview DOM node (walks up to [data-src-line]).
 * @param {EventTarget | null | undefined} target
 * @returns {number}
 */
export function srcLineFromTarget(target) {
  if (!target || typeof target !== 'object') return 0
  /** @type {Element | null} */
  let node = null
  if ('closest' in /** @type {any} */ (target) && typeof /** @type {any} */ (target).closest === 'function') {
    node = /** @type {Element} */ (/** @type {any} */ (target).closest('[data-src-line]'))
  } else {
    node = /** @type {Element | null} */ (
      'nodeType' in target && /** @type {Node} */ (target).nodeType === 1
        ? target
        : /** @type {Node} */ (target).parentElement
    )
    while (node && !node.getAttribute?.('data-src-line')) {
      node = node.parentElement
    }
  }
  if (!node) return 0
  const n = Number(node.getAttribute('data-src-line'))
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 0
}

/**
 * Select and scroll a textarea to a character range (and optional 1-based line for scroll).
 * @param {HTMLTextAreaElement | null | undefined} textarea
 * @param {number} start
 * @param {number} end
 * @param {number} [lineNumber]
 * @returns {boolean}
 */
export function focusSourceRange(textarea, start, end, lineNumber) {
  if (!textarea || !Number.isFinite(start) || !Number.isFinite(end)) return false
  const a = Math.max(0, Math.min(start, end))
  const b = Math.max(a, Math.max(start, end))
  textarea.focus()
  textarea.setSelectionRange(a, b === a ? a : b)
  let line = lineNumber
  if (!line || line < 1) {
    line = String(textarea.value || '').slice(0, a).split(/\r\n|\r|\n/).length
  }
  const style = typeof window !== 'undefined' ? window.getComputedStyle(textarea) : null
  const lineHeight = style ? (parseFloat(style.lineHeight) || parseFloat(style.fontSize) * 1.65 || 22) : 22
  const paddingTop = style ? (parseFloat(style.paddingTop) || 0) : 0
  const targetTop = paddingTop + (line - 1) * lineHeight - textarea.clientHeight * 0.28
  textarea.scrollTop = Math.max(0, targetTop)
  return true
}

/**
 * Select and scroll a textarea to a 1-based line.
 * @param {HTMLTextAreaElement | null | undefined} textarea
 * @param {number} lineNumber
 * @param {{ start: number, end: number, text: string }[]} [ranges]
 * @returns {boolean}
 */
export function focusSourceLine(textarea, lineNumber, ranges) {
  if (!textarea || !Number.isFinite(lineNumber) || lineNumber < 1) return false
  const list = ranges || sourceLineRanges(textarea.value)
  const row = list[lineNumber - 1]
  if (!row) return false
  const start = row.start
  const end = Math.max(row.end, start)
  return focusSourceRange(textarea, start, end === start ? start : end, lineNumber)
}

/**
 * Focus a line and briefly flash the editor so the jump is obvious.
 * @param {HTMLTextAreaElement | null | undefined} textarea
 * @param {number} lineNumber
 * @param {{ durationMs?: number, className?: string, ranges?: { start: number, end: number, text: string }[] }} [opts]
 * @returns {boolean}
 */
export function flashSourceLine(textarea, lineNumber, opts = {}) {
  if (!focusSourceLine(textarea, lineNumber, opts.ranges)) return false
  const className = opts.className || 'is-src-flash'
  const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : 1400
  textarea.classList.remove(className)
  // Restart CSS animation if the class was already present.
  void textarea.offsetWidth
  textarea.classList.add(className)
  const prev = /** @type {any} */ (textarea)._srcFlashTimer
  if (prev) clearTimeout(prev)
  /** @type {any} */ (textarea)._srcFlashTimer = setTimeout(() => {
    textarea.classList.remove(className)
    /** @type {any} */ (textarea)._srcFlashTimer = 0
  }, Math.max(200, durationMs))
  return true
}

/**
 * Focus a match range and flash the editor.
 * @param {HTMLTextAreaElement | null | undefined} textarea
 * @param {{ start: number, end: number, line?: number }} match
 * @param {{ durationMs?: number, className?: string }} [opts]
 * @returns {boolean}
 */
export function flashSourceRange(textarea, match, opts = {}) {
  if (!match || !focusSourceRange(textarea, match.start, match.end, match.line)) return false
  const className = opts.className || 'is-src-flash'
  const durationMs = Number.isFinite(opts.durationMs) ? opts.durationMs : 1400
  textarea.classList.remove(className)
  void textarea.offsetWidth
  textarea.classList.add(className)
  const prev = /** @type {any} */ (textarea)._srcFlashTimer
  if (prev) clearTimeout(prev)
  /** @type {any} */ (textarea)._srcFlashTimer = setTimeout(() => {
    textarea.classList.remove(className)
    /** @type {any} */ (textarea)._srcFlashTimer = 0
  }, Math.max(200, durationMs))
  return true
}

/**
 * First 1-based source line where `snippet` occurs (trimmed match).
 * @param {string} source
 * @param {string} snippet
 * @returns {number}
 */
export function findSourceLineForSnippet(source, snippet) {
  const needle = String(snippet ?? '').replace(/\s+/g, ' ').trim()
  if (!needle || !source) return 0
  const compact = String(source).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const probe = needle.slice(0, Math.min(needle.length, 120))
  let idx = compact.indexOf(probe)
  if (idx < 0) {
    const first = needle.split('\n')[0]?.trim()
    if (!first || first.length < 2) return 0
    idx = compact.indexOf(first)
    if (idx < 0) return 0
  }
  return compact.slice(0, idx).split('\n').length
}

/**
 * Line base (0 = first source line is data-src-line 1) for a code block body in source.
 * @param {string} source
 * @param {string} code
 * @returns {number} 0-based offset added to listing index
 */
export function sourceLineBaseForCode(source, code) {
  const body = String(code ?? '')
  if (!source || !body.trim()) return 0
  const line = findSourceLineForSnippet(source, body)
  return line > 0 ? line - 1 : 0
}
