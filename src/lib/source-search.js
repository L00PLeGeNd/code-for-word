/**
 * Source editor find helpers (pure).
 */

/**
 * @typedef {{ start: number, end: number, line: number }} SourceMatch
 */

/**
 * All case-insensitive (default) occurrences of `query` in `source`.
 * Empty / whitespace-only query → [].
 * @param {string} source
 * @param {string} query
 * @param {{ caseSensitive?: boolean }} [opts]
 * @returns {SourceMatch[]}
 */
export function findAllMatches(source, query, opts = {}) {
  const text = String(source ?? '')
  const raw = String(query ?? '')
  if (!raw || !text) return []
  const caseSensitive = Boolean(opts.caseSensitive)
  const hay = caseSensitive ? text : text.toLowerCase()
  const needle = caseSensitive ? raw : raw.toLowerCase()
  if (!needle) return []

  /** @type {SourceMatch[]} */
  const out = []
  let from = 0
  while (from <= hay.length - needle.length) {
    const idx = hay.indexOf(needle, from)
    if (idx < 0) break
    const line = text.slice(0, idx).split(/\r\n|\r|\n/).length
    out.push({ start: idx, end: idx + needle.length, line })
    from = idx + Math.max(1, needle.length)
  }
  return out
}

/**
 * Next index in a circular match list.
 * @param {number} count
 * @param {number} current -1 means “before first”
 * @param {1 | -1} direction
 * @returns {number} -1 if count is 0
 */
export function nextMatchIndex(count, current, direction = 1) {
  if (!count || count < 1) return -1
  const dir = direction < 0 ? -1 : 1
  if (current < 0 || current >= count) {
    return dir > 0 ? 0 : count - 1
  }
  return (current + dir + count) % count
}
