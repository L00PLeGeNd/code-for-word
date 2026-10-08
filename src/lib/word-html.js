/** Clean Word paste HTML — single-column table for borders (Word strips div borders). */

import {
  applyListingStyle,
  measureListingTwips,
  PAGE_CONTENT_TWIPS,
  resolveListingGeometry,
  codeInsetPrefix,
  codeInsetSuffix
} from './lines.js'
import {
  resolveFrameStyle,
  cssFrameBorders,
  cssBorderStyle,
  cssStackedRowBorders
} from './frame.js'
import {
  shouldShowCaption,
  captionDisplayLines,
  resolveCaptionLines,
  resolveCaptionFont,
  resolveCaptionBackground,
  resolveCaptionColor,
  resolveCaptionBold,
  resolveCaptionItalic,
  normalizeCaption
} from './caption.js'

/**
 * @param {string} text
 */
export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Keep CF_HTML builder for tests / native hosts only.
 * Never put this string into browser text/html clipboard — Word will paste the headers.
 * @param {string} fragmentHtml
 */
export function buildCfHtml(fragmentHtml) {
  const startFragMark = '<!--StartFragment-->'
  const endFragMark = '<!--EndFragment-->'
  const header =
    'Version:0.9\r\n' +
    'StartHTML:0000000000\r\n' +
    'EndHTML:0000000000\r\n' +
    'StartFragment:0000000000\r\n' +
    'EndFragment:0000000000\r\n'
  const body =
    '<!DOCTYPE html>\r\n<html>\r\n<head><meta charset="utf-8"></head>\r\n<body>\r\n' +
    startFragMark +
    fragmentHtml +
    endFragMark +
    '\r\n</body>\r\n</html>'

  const encoder = new TextEncoder()
  const headerBytes = encoder.encode(header).length
  const beforeFrag = encoder.encode(header + body.slice(0, body.indexOf(startFragMark))).length
  const beforeEndFrag = encoder.encode(header + body.slice(0, body.indexOf(endFragMark))).length
  const endHtml = encoder.encode(header + body).length
  const pad = (n) => String(n).padStart(10, '0')

  return (
    'Version:0.9\r\n' +
    `StartHTML:${pad(headerBytes)}\r\n` +
    `EndHTML:${pad(endHtml)}\r\n` +
    `StartFragment:${pad(beforeFrag)}\r\n` +
    `EndFragment:${pad(beforeEndFrag)}\r\n` +
    body
  )
}

/**
 * @param {import('../themes.js').StyledRun} run
 * @param {string} fallback
 */
function runToSpan(run, fallback) {
  const color = run.color || fallback
  const weight = run.bold ? 'font-weight:bold;' : 'font-weight:normal;'
  const italic = run.italic ? 'font-style:italic;' : ''
  return `<span style="color:${color};${weight}${italic}">${escapeHtml(run.text)}</span>`
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
 *  preview?: boolean,
 *  sourceLineBase?: number,
 *  captionEnabled?: boolean,
 *  caption?: string,
 *  captionLines?: string[],
 *  captionPlaceholder?: string,
 *  captionFont?: string,
 *  captionBackground?: string,
 *  captionColor?: string,
 *  captionBold?: boolean,
 *  captionItalic?: boolean
 * }} options
 */
export function linesToWordHtml(lines, options) {
  const rows = applyListingStyle(lines, options)
  const fontName = options.fontName || 'Consolas'
  const fontSizePt = options.fontSizePt || 9
  const lnColor = options.lineNumberColor || '#7A7A7A'
  const suffix = options.lineNumberSuffix ?? '.'
  const accent = options.accentLeft || '#007ACC'
  const frame = resolveFrameStyle(options.frameStyle)
  const noFill = !!options.noFill || options.background === 'none'
  const bg = noFill ? 'transparent' : (options.background || '#F5F5F5')
  const lnWeight = options.forceBold ? 'font-weight:bold;' : ''
  const lnItalic = options.forceItalic ? 'font-style:italic;' : ''
  const block = measureListingTwips(rows, options)
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
  void block
  const preview = !!options.preview
  const showCap = shouldShowCaption(options)
  const fontStack = `${fontName},'Courier New',monospace`

  if (preview) {
    const lineHtml = rows.map((row, i) => {
      const code = row.length
        ? row.map((run) => runToSpan(run, options.foreground)).join('')
        : '&nbsp;'
      const ln = options.lineNumbers
        ? `<span style="color:${lnColor};${lnWeight}${lnItalic}">${i + 1}${suffix}&nbsp;&nbsp;</span>`
        : ''
      const gapL = escapeHtml(insetLeft)
      const gapR = escapeHtml(insetRight)
      return `${ln}${gapL}${code}${gapR}`
    })
    return buildPreviewHtml({
      lineHtml,
      showCap,
      options,
      frame,
      accent,
      bg,
      fontStack,
      fontSizePt,
      left,
      right
    })
  }

  // Paste path: do not use <pre>+nbsp — Word expands them and strips table-level borders.
  return buildPasteHtml({
    rows,
    showCap,
    options,
    frame,
    accent,
    bg,
    fontStack,
    fontSizePt,
    lnColor,
    lnWeight,
    lnItalic,
    suffix,
    left,
    right,
    codeInset
  })
}

/**
 * Browser preview — div frame (CSS borders work in Chromium).
 */
function buildPreviewHtml({
  lineHtml,
  showCap,
  options,
  frame,
  accent,
  bg,
  fontStack,
  fontSizePt,
  left,
  right
}) {
  const borderCss = cssBorderStyle(cssFrameBorders(frame, accent))
  const body = lineHtml
    .map((line, i) => {
      const last = i === lineHtml.length - 1
      const rule = options.rowRules && !(frame === 'box' && last)
        ? `border-bottom:0.75pt solid ${accent};`
        : ''
      const pad = options.rowRules ? 'padding:0 14pt 0 4pt;' : 'padding:0;'
      return (
        `<div class="listing-line" data-src-line="${(options.sourceLineBase || 0) + i + 1}" style="display:block;margin:0;${pad}` +
        `${rule}white-space:pre;font-family:${fontStack};font-size:${fontSizePt}pt;` +
        `line-height:1.35;text-align:left;">${line}</div>`
      )
    })
    .join('')

  let captionHtml = ''
  if (showCap) {
    const raw = resolveCaptionLines(options)
    const display = captionDisplayLines(options)
    const capFont = resolveCaptionFont(options)
    const capBg = resolveCaptionBackground(options)
    const capColor = resolveCaptionColor(options)
    const capBold = resolveCaptionBold(options)
    const capItalic = resolveCaptionItalic(options)
    const capFs = Math.max(10, fontSizePt + 1)
    const rowsHtml = display
      .map((text, i) => {
        const filled = !!normalizeCaption(raw[i] ?? text)
        const color = !filled ? '#8a93a0' : capColor
        const phClass = !filled ? ' is-placeholder' : ''
        const weight = capBold ? 'bold' : '400'
        const style = capItalic ? 'italic' : 'normal'
        return (
          `<div class="listing-caption-row${phClass}" style="` +
          `display:block;margin:0;padding:4pt 10pt;` +
          `border:none;border-bottom:1pt solid ${accent};` +
          `box-sizing:border-box;background:${capBg};` +
          `font-family:${capFont},'SimSun','Songti SC',serif;` +
          `font-size:${capFs}pt;font-weight:${weight};font-style:${style};line-height:1.45;` +
          `color:${color};text-align:left;">` +
          `${escapeHtml(text || '\u00a0')}</div>`
        )
      })
      .join('')
    captionHtml =
      `<div class="listing-caption" style="display:block;margin:0;padding:0;border:none;` +
      `box-sizing:border-box;">${rowsHtml}</div>`
  }

  const listing =
    `<div class="listing-block listing-inside" data-frame="${frame}" style="` +
    `display:block;box-sizing:border-box;width:100%;max-width:100%;` +
    borderCss +
    `background:${bg};padding:0;` +
    `font-family:${fontStack};font-size:${fontSizePt}pt;line-height:1.35;` +
    `color:${options.foreground};text-align:left;mso-no-proof:yes;overflow-x:auto;">` +
    `${captionHtml}` +
    `<div class="listing-code" style="display:block;margin:0;padding:${options.rowRules ? '2pt 0' : '6pt 14pt 6pt 4pt'};` +
    `border:none;box-sizing:border-box;background:${bg};` +
    `font-size:${fontSizePt}pt;line-height:1.35;">${body}</div></div>`

  const flush = left === 0 && right === 0
  const contentTwips = options.pageContentTwips == null ? PAGE_CONTENT_TWIPS : options.pageContentTwips
  const total = Math.max(contentTwips + left + right, 1)
  const padL = flush ? '12px' : `${((left / total) * 100).toFixed(2)}%`
  const padR = flush ? '12px' : `${((right / total) * 100).toFixed(2)}%`
  return (
    `<div class="listing-outer preview-page${flush ? ' is-flush' : ''}" style="` +
    `display:block;width:100%;box-sizing:border-box;text-align:left;` +
    `padding:12px ${padR} 12px ${padL};">${listing}</div>`
  )
}

/**
 * Clipboard HTML for Word.
 * Browser paste keeps cell borders far more reliably than table-level borders,
 * and expands &nbsp; inset pads — so we use one framed cell + pt padding.
 */
function buildPasteHtml({
  rows,
  showCap,
  options,
  frame,
  accent,
  bg,
  fontStack,
  fontSizePt,
  lnColor,
  lnWeight,
  lnItalic,
  suffix,
  left,
  right,
  codeInset
}) {
  const insetPt = codeInset > 0 ? (codeInset / 20).toFixed(1) : '0'
  const linePt = Math.max(12, Math.round(fontSizePt * 1.35 * 10) / 10)
  const textCss =
    `border:none;margin:0;padding:0;vertical-align:top;` +
    `font-family:${fontStack};font-size:${fontSizePt}pt;` +
    `line-height:${linePt}pt;mso-line-height-rule:exactly;mso-no-proof:yes;`

  /** @type {string[]} */
  const codeTrs = []
  rows.forEach((row, i) => {
    const code = row.length
      ? row.map((run) => runToSpan(run, options.foreground)).join('')
      : '&nbsp;'
    const ln = options.lineNumbers
      ? `<span style="color:${lnColor};${lnWeight}${lnItalic}">${i + 1}${suffix}&nbsp;&nbsp;</span>`
      : ''
    const last = i === rows.length - 1
    const rule = options.rowRules && !(frame === 'box' && last)
      ? `border-bottom:0.75pt solid ${accent};border-top:none;border-left:none;border-right:none;`
      : ''
    const gutter = options.lineNumbers
      ? `<td class="listing-gutter" nowrap="nowrap" style="${textCss}${rule}white-space:nowrap;">${ln}</td>`
      : ''
    const padL = codeInset > 0 ? `padding-left:${insetPt}pt;` : ''
    const padR = codeInset > 0 ? `padding-right:${insetPt}pt;` : ''
    codeTrs.push(
      `<tr>${gutter}` +
        `<td class="listing-text" style="${textCss}${rule}${padL}${padR}">${code}</td>` +
        `</tr>`
    )
  })
  if (!codeTrs.length) {
    codeTrs.push(`<tr><td class="listing-text" style="${textCss}">&nbsp;</td></tr>`)
  }

  const codeTable =
    `<table class="listing-code" cellspacing="0" cellpadding="0" border="0" width="100%" style="` +
    `border-collapse:collapse;border:none;width:100%;margin:0;">` +
    `${codeTrs.join('')}</table>`

  const codeWrap =
    `<div class="listing-code-wrap" style="` +
    `border:none;margin:0;padding:${options.rowRules ? '1pt 0' : '6pt 8pt 6pt 4pt'};background:${bg};">` +
    `${codeTable}</div>`

  // Paste cannot change the destination document's page setup. margin-left sticks
  // (→ tblInd); fixed paper widths fight the host page and often kill borders.
  const marginCss = left > 0 ? `margin-left:${(left / 20).toFixed(1)}pt;` : ''
  // Soft right inset: shrink from 100% when both sides are set (approx).
  let widthCss = 'width:100%;'
  if (left > 0 || right > 0) {
    const page = (Number.isFinite(options.pageContentTwips) && options.pageContentTwips > 0)
      ? options.pageContentTwips
      : PAGE_CONTENT_TWIPS
    const inner = Math.max(1200, page - left - right)
    const pct = Math.max(40, Math.min(100, (inner / page) * 100))
    widthCss = `width:${pct.toFixed(1)}%;`
  }

  const tableOpen =
    `<table class="listing-block" data-frame="${frame}" cellspacing="0" cellpadding="0" border="0" style="` +
    `border-collapse:collapse;border:none;${marginCss}${widthCss}` +
    `mso-table-lspace:0pt;mso-table-rspace:0pt;mso-cellspacing:0cm;">`

  // Caption + code in one mega-cell: Word often keeps the top stroke and drops
  // the bottom. Stack rows so top lives on the first caption and bottom on code.
  if (showCap) {
    const raw = resolveCaptionLines(options)
    const display = captionDisplayLines(options)
    const capFont = resolveCaptionFont(options)
    const capBg = resolveCaptionBackground(options)
    const capColor = resolveCaptionColor(options)
    const capBold = resolveCaptionBold(options)
    const capItalic = resolveCaptionItalic(options)
    const capFs = Math.max(10, fontSizePt + 1)
    /** @type {string[]} */
    const outerTrs = []
    let capIndex = 0
    display.forEach((text, i) => {
      const filled = !!normalizeCaption(raw[i] ?? text)
      if (!filled && !options.preview) return
      const weight = capBold ? 'bold' : '400'
      const style = capItalic ? 'italic' : 'normal'
      const isFirst = capIndex === 0
      capIndex += 1
      const borders = cssBorderStyle(cssStackedRowBorders(frame, accent, {
        top: isFirst,
        divider: true
      }))
      outerTrs.push(
        `<tr><td class="listing-caption-row" style="${borders}` +
          `padding:4pt 10pt;margin:0;background:${capBg};vertical-align:top;` +
          `font-family:${capFont},'SimSun','Songti SC',serif;` +
          `font-size:${capFs}pt;font-weight:${weight};font-style:${style};line-height:1.45;` +
          `color:${capColor};text-align:left;mso-line-height-rule:exactly;">` +
          `${escapeHtml(text || '\u00a0')}</td></tr>`
      )
    })
    const codeBorders = cssBorderStyle(cssStackedRowBorders(frame, accent, {
      bottom: frame === 'box'
    }))
    outerTrs.push(
      `<tr><td class="listing-frame" style="${codeBorders}` +
        `padding:0;margin:0;background:${bg};vertical-align:top;">${codeWrap}</td></tr>`
    )
    // No caption rows survived (all empty on paste) — fall through to single cell.
    if (capIndex > 0) {
      return (
        `<div class="listing-outer" style="display:block;text-align:left;">` +
        `${tableOpen}${outerTrs.join('')}</table></div>`
      )
    }
  }

  const frameCss = cssBorderStyle(cssFrameBorders(frame, accent))
  const table =
    `${tableOpen}` +
    `<tr><td class="listing-frame" style="${frameCss}` +
    `padding:0;margin:0;background:${bg};vertical-align:top;">` +
    `${codeWrap}</td></tr></table>`

  return (
    `<div class="listing-outer" style="display:block;text-align:left;">${table}</div>`
  )
}

/** @deprecated use linesToWordHtml — kept for API stability */
export function linesToGenericHtml(lines, options) {
  return linesToWordHtml(lines, options)
}

/** @deprecated zebra removed for journal look */
export function rowBackground(index, options) {
  return options.background
}
