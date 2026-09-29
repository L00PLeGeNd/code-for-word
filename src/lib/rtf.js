/** RTF paragraphs Word recognizes: \\b / \\cf / \\f / \\fs — not a table. */

import {
  applyListingStyle,
  resolveListingGeometry,
  codeInsetPrefix,
  codeInsetSuffix,
  lineNumberGutterTwips
} from './lines.js'
import { resolveFrameStyle, rtfParaBorders } from './frame.js'
import {
  shouldShowCaption,
  captionDisplayLines,
  resolveCaptionFont,
  resolveCaptionBackground,
  resolveCaptionColor,
  resolveCaptionBold,
  resolveCaptionItalic
} from './caption.js'
import { FONT_OPTIONS } from '../themes.js'

export {
  estimateListingTwips,
  measureListingTwips,
  trimTrailingEmptyLines,
  applyListingStyle,
  listingSideIndent,
  listingSideIndents,
  lineNumberGutterTwips
} from './lines.js'

/**
 * @param {string} hex
 */
export function hexToRtfRgb(hex) {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = Number.parseInt(full, 16)
  return {
    red: (n >> 16) & 255,
    green: (n >> 8) & 255,
    blue: n & 255
  }
}

function toSigned16(code) {
  return code <= 0x7fff ? code : code - 0x10000
}

/** @param {string} text */
export function escapeRtf(text) {
  let out = ''
  for (const ch of text) {
    const code = ch.codePointAt(0)
    if (ch === '\\') out += '\\\\'
    else if (ch === '{') out += '\\{'
    else if (ch === '}') out += '\\}'
    else if (ch === '\t') out += '\\tab '
    else if (code === 0xa0) out += '\\~'
    else if (code <= 0x7f) out += ch
    else if (code > 0xffff) {
      const h = Math.floor((code - 0x10000) / 0x400) + 0xd800
      const l = ((code - 0x10000) % 0x400) + 0xdc00
      out += `\\u${toSigned16(h)}?\\u${toSigned16(l)}?`
    } else {
      out += `\\u${toSigned16(code)}?`
    }
  }
  return out
}

/** @param {string[]} colors */
export function buildColorTable(colors) {
  const unique = []
  const map = new Map()
  for (const color of colors) {
    const key = color.toUpperCase()
    if (map.has(key)) continue
    map.set(key, unique.length + 1)
    unique.push(color)
  }

  const body = unique
    .map((hex) => {
      const { red, green, blue } = hexToRtfRgb(hex)
      return `\\red${red}\\green${green}\\blue${blue};`
    })
    .join('')

  return {
    table: `{\\colortbl;${body}}`,
    indexOf(hex) {
      return map.get(hex.toUpperCase()) || 1
    }
  }
}

function resolveFont(fontName) {
  const hit = FONT_OPTIONS.find((f) => f.id === fontName)
  return {
    name: hit?.id || fontName || 'Consolas',
    charset: hit?.rtfCharset ?? 0
  }
}

/**
 * Caption row borders: underline every row; box also gets top on first row.
 * @param {import('./frame.js').FrameStyle} frame
 * @param {number} ac
 * @param {boolean} isFirst
 */
function captionBorders(frame, ac, isFirst) {
  // \\brsp keeps text off the stroke. WPS often clips 说明栏 glyphs when
  // borders sit flush on Songti/Heiti with no line spacing or padding.
  const s = `\\brdrs\\brdrw40\\brdrcf${ac}\\brsp60`
  const under = `\\brdrb\\brdrs\\brdrw20\\brdrcf${ac}\\brsp40`
  if (frame === 'box') {
    const top = isFirst ? `\\brdrt${s}` : ''
    return `${top}\\brdrl${s}\\brdrr${s}${under}`
  }
  if (frame === 'rails') return `\\brdrl${s}\\brdrr${s}${under}`
  return `\\brdrl${s}${under}`
}

/**
 * Code-block borders for the single box paragraph (caption owns the top edge).
 * @param {import('./frame.js').FrameStyle} frame
 * @param {number} ac
 * @param {boolean} hasCaption
 */
/**
 * Per-line borders. Box + underlines uses one paragraph per line so each row
 * can have a rule; the last line keeps the outer bottom stroke.
 * @param {import('./frame.js').FrameStyle} frame
 * @param {number} ac
 * @param {number} index
 * @param {number} total
 * @param {boolean} hasCaption
 * @param {boolean} rowRules
 */
function codeLineBorders(frame, ac, index, total, hasCaption, rowRules) {
  const frameStroke = `\\brdrs\\brdrw40\\brdrcf${ac}`
  const under = rowRules ? `\\brdrb\\brdrs\\brdrw20\\brdrcf${ac}` : ''
  const side = frame === 'bar'
    ? `\\brdrl${frameStroke}`
    : `\\brdrl${frameStroke}\\brdrr${frameStroke}`
  const top = frame === 'box' && index === 0 && !hasCaption ? `\\brdrt${frameStroke}` : ''
  const bottom = frame === 'box' && index === total - 1
    ? `\\brdrb${frameStroke}`
    : under
  return `${top}${side}${bottom}`
}

function codeBlockBorders(frame, ac, hasCaption) {
  const s = `\\brdrs\\brdrw40\\brdrcf${ac}`
  if (frame === 'box') {
    const top = hasCaption ? '' : `\\brdrt${s}`
    return `${top}\\brdrl${s}\\brdrr${s}\\brdrb${s}`
  }
  if (frame === 'rails') return `\\brdrl${s}\\brdrr${s}`
  return `\\brdrl${s}`
}

/**
 * Paragraph prefix: indent/spacing BEFORE borders/fonts.
 * Putting \\noproof or borders before \\li made some Word builds drop margins / reject paste.
 * @param {{
 *  left: number,
 *  right: number,
 *  linePart: string,
 *  fontSizeHalfPoints: number,
 *  shade: string,
 *  fg: number,
 *  borders: string
 * }} p
 */
function paraHead({ left, right, linePart, fontSizeHalfPoints, shade, fg, borders, insetTab }) {
  return (
    `\\pard\\plain\\ql\\hyphpar0\\nowidctlpar` +
    `\\li${left}\\ri${right}\\sa0\\sb0${linePart}` +
    (insetTab || '') +
    `\\f0\\fs${fontSizeHalfPoints}${shade}\\cf${fg}${borders} `
  )
}

/**
 * @param {import('../themes.js').StyledRun[][]} lines
 * @param {{
 *  background: string,
 *  foreground: string,
 *  fontName?: string,
 *  fontSizePt?: number,
 *  lineNumbers?: boolean,
 *  lineNumberColor?: string,
 *  lineNumberSuffix?: string,
 *  accentLeft?: string,
 *  frameStyle?: import('./frame.js').FrameStyle,
 *  forceBold?: boolean,
 *  forceItalic?: boolean,
 *  sideMarginTwips?: number | null | { left?: number | null, right?: number | null },
 *  pageContentTwips?: number | null,
 *  codeInsetTwips?: number | null,
 *  noFill?: boolean,
 *  captionEnabled?: boolean,
 *  caption?: string,
 *  captionLines?: string[],
 *  captionFont?: string,
 *  captionBackground?: string,
 *  captionColor?: string,
 *  captionBold?: boolean,
 *  captionItalic?: boolean
 * }} options
 */
export function linesToRtf(lines, options) {
  const rows = applyListingStyle(lines, options)
  const font = resolveFont(options.fontName || 'Consolas')
  const capFont = resolveFont(resolveCaptionFont(options))
  const pt = options.fontSizePt || 10
  const fontSizeHalfPoints = Math.round(pt * 2)
  const capFs = Math.max(20, fontSizeHalfPoints + 2)
  const lineNumberColor = options.lineNumberColor || '#7A7A7A'
  const suffix = options.lineNumberSuffix ?? '.'
  const accent = options.accentLeft || '#007ACC'
  const frame = resolveFrameStyle(options.frameStyle)
  const noFill = !!options.noFill || options.background === 'none'
  const fillHex = noFill ? '#FFFFFF' : (options.background || '#F5F5F5')
  const capBgHex = resolveCaptionBackground(options)
  const capColorHex = resolveCaptionColor(options)
  const capBold = resolveCaptionBold(options)
  const capItalic = resolveCaptionItalic(options)
  const geo = resolveListingGeometry(
    options.sideMarginTwips,
    options.codeInsetTwips,
    options.pageContentTwips
  )
  const left = geo.left
  const right = geo.right
  const codeInset = geo.inset
  const insetLeft = codeInsetPrefix(options, codeInset)
  const insetRight = codeInsetSuffix(options, codeInset)
  // Word \\tx is absolute from the page content edge (same origin as \\li),
  // so the stop must include left indent + gutter + inset — not inset alone.
  const gutterTwips = options.lineNumbers
    ? Math.max(480, lineNumberGutterTwips(Math.max(rows.length, 1), options))
    : 0
  const useInsetTab = !!(options.lineNumbers && codeInset > 0)
  const insetTab = useInsetTab
    ? `\\tx${left + gutterTwips + codeInset} `
    : ''
  const linePart = pt >= 16
    ? '\\sl276\\slmult1 '
    : `\\sl${Math.max(240, Math.round(pt * 20 * 1.35))}\\slmult0 `

  const showCap = shouldShowCaption(options)
  const capLines = showCap ? captionDisplayLines(options) : []

  /** @type {string[]} */
  const colors = [options.foreground || '#000000', fillHex, lineNumberColor, accent, capBgHex, capColorHex]
  for (const row of rows) {
    for (const run of row) colors.push(run.color || options.foreground)
  }
  const { table, indexOf } = buildColorTable(colors)
  const fg = indexOf(options.foreground || '#000000')
  const ln = indexOf(lineNumberColor)
  const bg = indexOf(fillHex)
  const ac = indexOf(accent)
  const capBg = indexOf(capBgHex)
  const capCf = indexOf(capColorHex)

  const shade = noFill ? '' : `\\cbpat${bg}`
  const capShade = `\\cbpat${capBg}`
  const lnBold = options.forceBold ? '\\b' : '\\b0'
  const lnItalic = options.forceItalic ? '\\i' : '\\i0'
  const capB = capBold ? '\\b' : '\\b0'
  const capI = capItalic ? '\\i' : '\\i0'

  /** @param {import('../themes.js').StyledRun[]} row */
  function codeRuns(row) {
    if (!row.length) return `{\\noproof\\f0\\cf${fg}\\~}`
    let out = ''
    for (const run of row) {
      const cf = indexOf(run.color || options.foreground)
      const bold = run.bold ? '\\b' : '\\b0'
      const italic = run.italic ? '\\i' : '\\i0'
      out += `{\\noproof\\f0\\cf${cf}${bold}${italic} ${escapeRtf(run.text)}}`
    }
    return out
  }

  /** @param {import('../themes.js').StyledRun[]} row @param {number} i */
  function lineContent(row, i) {
    let content = ''
    // Line numbers stay flush to the left marker; inset is \\tab (exact) or spaces.
    if (options.lineNumbers) {
      content += `{\\noproof\\f0\\cf${ln}${lnBold}${lnItalic} ${escapeRtf(`${i + 1}${suffix}  `)}}`
      if (useInsetTab) content += '\\tab '
      else if (insetLeft) {
        content += `{\\noproof\\f0\\cf${fg}\\b0\\i0 ${escapeRtf(insetLeft)}}`
      }
    } else if (insetLeft) {
      content += `{\\noproof\\f0\\cf${fg}\\b0\\i0 ${escapeRtf(insetLeft)}}`
    }
    content += codeRuns(row)
    if (insetRight) {
      content += `{\\noproof\\f0\\cf${fg}\\b0\\i0 ${escapeRtf(insetRight)}}`
    }
    return content
  }

  // Caption needs its own \\sl: default single spacing + paragraph borders
  // crops descenders / CJK in WPS even when Word looks fine.
  const capLinePart = `\\sl${Math.max(276, Math.round(capFs * 14))}\\slmult0 `
  let captionPart = ''
  if (capLines.length && !options.rowRules) {
    captionPart = capLines.map((text, i) => {
      const borders = captionBorders(frame, ac, i === 0)
      return (
        `\\pard\\plain\\ql\\hyphpar0\\nowidctlpar` +
        `\\li${left}\\ri${right}\\sa40\\sb40${capLinePart}` +
        `\\f1\\fs${capFs}\\cf${capCf}${capB}${capI}${capShade}${borders} ` +
        `${escapeRtf(text)}\\par\n`
      )
    }).join('')
  }

  const rowRules = !!options.rowRules
  let body
  if (rowRules) {
    // Paragraph \\brdrb between lines breaks the side rails. A single-level
    // table matches DOCX: outer stroke on the row, thin rule between rows.
    const cellRight = Math.max(left + 2400, geo.page - right)
    const width = cellRight - left
    const F = `\\brdrs\\brdrw40\\brdrcf${ac} `
    const U = `\\brdrs\\brdrw20\\brdrcf${ac} `
    /** @type {{ caption: boolean, last: boolean, inner: string }[]} */
    const items = [
      ...capLines.map((text) => ({ caption: true, last: false, inner: escapeRtf(text) })),
      ...rows.map((row, i) => ({
        caption: false,
        last: i === rows.length - 1,
        inner: lineContent(row, i)
      }))
    ]
    body = items.map((item) => {
      let def = `\\trowd\\trgaph0\\trleft${left}\\trftsWidth3\\trwWidth${width}`
      if (frame === 'box') def += `\\trbrdrt${F}\\trbrdrl${F}\\trbrdrb${F}\\trbrdrr${F}`
      else if (frame === 'rails') def += `\\trbrdrl${F}\\trbrdrr${F}`
      else def += `\\trbrdrl${F}`
      def += `\\trbrdrh${U}\\clvertalc`
      if (frame === 'box') def += `\\clbrdrt${F}`
      def += `\\clbrdrl${F}`
      def += `\\clbrdrb${frame === 'box' && item.last ? F : U}`
      if (frame !== 'bar') def += `\\clbrdrr${F}`
      if (!noFill) def += `\\clcbpat${item.caption ? capBg : bg}`
      def += `\\cellx${cellRight}`
      const head = item.caption
        ? `\\pard\\intbl\\plain\\ql${capLinePart}\\f1\\fs${capFs}\\cf${capCf}${capB}${capI}${capShade} `
        : `\\pard\\intbl\\plain\\ql${linePart}\\f0\\fs${fontSizeHalfPoints}${shade}\\cf${fg} `
      return `${def}\n${head}${item.inner}\\cell\\row`
    }).join('\n')
  } else if (frame === 'box') {
    // One paragraph + \\line keeps a continuous box; per-line \\par box borders
    // have made Word reject the clipboard paste on some builds.
    const boxBorders = codeBlockBorders(frame, ac, !!capLines.length)
    const head = paraHead({
      left,
      right,
      linePart,
      fontSizeHalfPoints,
      shade,
      fg,
      borders: boxBorders,
      insetTab
    })
    const inner = rows.map((row, i) => lineContent(row, i)).join('\\line\n')
    body = `${head}${inner}\\par`
  } else {
    body = rows.map((row, i) => {
      const borders = codeLineBorders(frame, ac, i, rows.length, !!capLines.length, rowRules)
      const head = paraHead({
        left,
        right,
        linePart,
        fontSizeHalfPoints,
        shade,
        fg,
        borders,
        insetTab
      })
      return `${head}${lineContent(row, i)}\\par`
    }).join('\n')
  }

  return [
    '{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\uc1',
    `{\\fonttbl{\\f0\\fnil\\fcharset${font.charset} ${font.name};}{\\f1\\fnil\\fcharset${capFont.charset} ${capFont.name};}}`,
    table,
    '{\\*\\generator CodePaste;}',
    captionPart + body,
    '}'
  ].join('\n')
}
