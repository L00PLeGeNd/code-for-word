/**
 * Accent frame around the listing.
 *  - bar: left vertical only (current default)
 *  - rails: left + right vertical; line numbers stay on the left
 *  - box: top + bottom + left + right around the pasted block
 * @typedef {'bar' | 'rails' | 'box'} FrameStyle
 */

/** @param {unknown} id @returns {FrameStyle} */
export function resolveFrameStyle(id) {
  if (id === 'rails' || id === 'box') return id
  return 'bar'
}

/**
 * RTF paragraph border controls for bar/rails (one \\par per line).
 * Box uses a stacked table in linesToRtf (hard Enter per line) — this returns ''
 * so callers do not double-apply paragraph borders.
 * @param {FrameStyle} frame
 * @param {number} colorIndex colortbl index for accent
 * @param {number} index line index
 * @param {number} total line count
 * @param {boolean} [hasCaption] kept for API stability
 */
export function rtfParaBorders(frame, colorIndex, index, total, hasCaption = false) {
  void hasCaption
  void index
  void total
  const s = `\\brdrs\\brdrw40\\brdrcf${colorIndex}`
  if (frame === 'bar') return `\\brdrl${s}`
  if (frame === 'rails') return `\\brdrl${s}\\brdrr${s}`
  return ''
}

/**
 * CSS border shorthand pieces for preview / HTML fallback.
 * @param {FrameStyle} frame
 * @param {string} accent hex color
 */
export function cssFrameBorders(frame, accent) {
  const w = '2.25pt'
  const c = accent
  if (frame === 'bar') {
    return {
      border: 'none',
      borderLeft: `${w} solid ${c}`
    }
  }
  if (frame === 'rails') {
    return {
      border: 'none',
      borderLeft: `${w} solid ${c}`,
      borderRight: `${w} solid ${c}`
    }
  }
  return {
    border: `${w} solid ${c}`,
    borderLeft: `${w} solid ${c}`,
    borderRight: `${w} solid ${c}`,
    borderTop: `${w} solid ${c}`,
    borderBottom: `${w} solid ${c}`
  }
}

/**
 * @param {{ border?: string, borderLeft?: string, borderRight?: string, borderTop?: string, borderBottom?: string }} b
 */
export function cssBorderStyle(b) {
  return (
    `border:${b.border || 'none'};` +
    (b.borderTop ? `border-top:${b.borderTop};` : '') +
    (b.borderRight ? `border-right:${b.borderRight};` : '') +
    (b.borderBottom ? `border-bottom:${b.borderBottom};` : '') +
    (b.borderLeft ? `border-left:${b.borderLeft};` : '')
  )
}

const FRAME_W = '2.25pt'
const CAPTION_UNDER_W = '1pt'

/**
 * Caption row borders for **preview divs** (outer frame is on the parent).
 * Only the underline — sides come from the outer listing box.
 * @param {string} accent
 */
export function cssCaptionDivider(accent) {
  return {
    border: 'none',
    borderBottom: `${CAPTION_UNDER_W} solid ${accent}`
  }
}

/**
 * Caption row borders (legacy / preview rows that also need side rails).
 * Prefer outer-table + {@link cssCaptionDivider} for Word paste to avoid hairlines.
 * @param {FrameStyle} frame
 * @param {string} accent
 * @param {boolean} isFirst
 */
export function cssCaptionBorders(frame, accent, isFirst) {
  const under = `${CAPTION_UNDER_W} solid ${accent}`
  const side = `${FRAME_W} solid ${accent}`
  if (frame === 'box') {
    return {
      border: 'none',
      borderTop: isFirst ? side : 'none',
      borderBottom: under,
      borderLeft: side,
      borderRight: side
    }
  }
  if (frame === 'rails') {
    return {
      border: 'none',
      borderBottom: under,
      borderLeft: side,
      borderRight: side
    }
  }
  return {
    border: 'none',
    borderBottom: under,
    borderLeft: side
  }
}

/**
 * Code block borders when a caption may sit above (legacy per-cell sides).
 * Word paste should use {@link cssOuterTableBorders} instead — cell sides cause hairlines.
 * @param {FrameStyle} frame
 * @param {string} accent
 * @param {boolean} hasCaption
 */
export function cssCodeBorders(frame, accent, hasCaption) {
  if (!hasCaption) {
    return { border: 'none' }
  }
  const side = `${FRAME_W} solid ${accent}`
  if (frame === 'box') {
    return {
      border: 'none',
      borderTop: 'none',
      borderBottom: side,
      borderLeft: side,
      borderRight: side
    }
  }
  if (frame === 'rails') {
    return {
      border: 'none',
      borderLeft: side,
      borderRight: side
    }
  }
  return {
    border: 'none',
    borderLeft: side
  }
}

/**
 * Outer frame on the paste/DOCX table — one continuous stroke (no per-cell side seams).
 * @param {FrameStyle} frame
 * @param {string} accent
 */
export function cssOuterTableBorders(frame, accent) {
  const w = FRAME_W
  const c = accent
  if (frame === 'box') {
    return {
      border: `${w} solid ${c}`,
      borderTop: `${w} solid ${c}`,
      borderBottom: `${w} solid ${c}`,
      borderLeft: `${w} solid ${c}`,
      borderRight: `${w} solid ${c}`
    }
  }
  if (frame === 'rails') {
    return {
      border: 'none',
      borderLeft: `${w} solid ${c}`,
      borderRight: `${w} solid ${c}`
    }
  }
  return {
    border: 'none',
    borderLeft: `${w} solid ${c}`
  }
}

/**
 * Borders for one row in a stacked caption→code paste table.
 * Word often drops the bottom edge when caption+code share a single mega-cell;
 * splitting top onto the first row and bottom onto the last keeps the box closed.
 *
 * @param {FrameStyle} frame
 * @param {string} accent
 * @param {{ top?: boolean, bottom?: boolean, divider?: boolean }} edges
 */
export function cssStackedRowBorders(frame, accent, edges = {}) {
  const F = `${FRAME_W} solid ${accent}`
  const U = `${CAPTION_UNDER_W} solid ${accent}`
  const top = edges.top ? F : 'none'
  const bottom = edges.bottom ? F : (edges.divider ? U : 'none')
  if (frame === 'box') {
    return {
      border: 'none',
      borderTop: top,
      borderBottom: bottom,
      borderLeft: F,
      borderRight: F
    }
  }
  if (frame === 'rails') {
    return {
      border: 'none',
      borderTop: 'none',
      borderBottom: bottom === 'none' ? 'none' : bottom,
      borderLeft: F,
      borderRight: F
    }
  }
  return {
    border: 'none',
    borderTop: 'none',
    borderBottom: bottom === 'none' ? 'none' : bottom,
    borderLeft: F
  }
}
