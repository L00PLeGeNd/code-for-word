import {
  AlignmentType,
  BorderStyle,
  Document,
  LineRuleType,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  VerticalAlign
} from 'docx'
import {
  applyListingStyle,
  resolveListingGeometry,
  lineNumberGutterTwips
} from './lines.js'
import { cmToTwips } from '../themes.js'
import { resolveFrameStyle } from './frame.js'
import {
  shouldShowCaption,
  captionDisplayLines,
  resolveCaptionFont,
  resolveCaptionBackground,
  resolveCaptionColor,
  resolveCaptionBold,
  resolveCaptionItalic
} from './caption.js'

/**
 * docx TextRun colors must be 6-digit hex (no #). Accept #rgb / #rrggbb / rgb(...).
 * @param {string | null | undefined} raw
 * @param {string} [fallback]
 */
export function toDocxHexColor(raw, fallback = '000000') {
  const fb = String(fallback).replace('#', '').trim() || '000000'
  const s = String(raw ?? '').trim()
  if (!s) return fb.length === 6 ? fb.toUpperCase() : '000000'
  const hex = s.replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(hex)) return hex.toUpperCase()
  if (/^[0-9a-fA-F]{3}$/.test(hex)) {
    return `${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toUpperCase()
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i)
    || s.match(/^rgb\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/i)
  if (rgb) {
    const toByte = (v) => {
      const n = Number(v)
      if (!Number.isFinite(n)) return 0
      return Math.max(0, Math.min(255, Math.round(n <= 1 && String(v).includes('.') ? n * 255 : n)))
    }
    const r = toByte(rgb[1]).toString(16).padStart(2, '0')
    const g = toByte(rgb[2]).toString(16).padStart(2, '0')
    const b = toByte(rgb[3]).toString(16).padStart(2, '0')
    return `${r}${g}${b}`.toUpperCase()
  }
  return fb.length === 6 ? fb.toUpperCase() : '000000'
}

const NIL_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto', space: 0 }

/** DOCX page sizes (twips). Web download can set real page setup; RTF paste cannot. */
const PAPER_SIZES = {
  a4: { width: 11906, height: 16838 },
  letter: { width: 12240, height: 15840 },
  b5: { width: 10319, height: 14570 },
  '16k': { width: 10473, height: 14742 },
  a5: { width: 8391, height: 11906 },
  fit: { width: 11906, height: 16838 }
}

/**
 * Map UI 页边距 / 纸张 into real Word section page setup for DOCX download.
 * (Clipboard HTML/RTF cannot change page margins of an existing document.)
 * @param {{
 *  paperId?: string,
 *  sideMarginTwips?: number | null | { left?: number | null, right?: number | null },
 *  pageContentTwips?: number | null
 * }} options
 */
export function resolveDocxPageSetup(options) {
  const id = typeof options?.paperId === 'string' ? options.paperId : 'fit'
  const size = PAPER_SIZES[id] || PAPER_SIZES.a4
  const geo = resolveListingGeometry(
    options?.sideMarginTwips,
    options?.codeInsetTwips,
    options?.pageContentTwips
  )

  let left
  let right
  if (geo.left > 0 || geo.right > 0) {
    // Explicit UI 页边距 → real Word page margins (honor 0 on one side)
    left = Math.max(0, geo.left)
    right = Math.max(0, geo.right)
  } else if (Number.isFinite(options?.pageContentTwips) && options.pageContentTwips > 0) {
    // Paper chosen, margin "默认" → derive from paper's content width
    const pair = Math.max(0, size.width - options.pageContentTwips)
    left = right = Math.max(720, Math.floor(pair / 2))
  } else {
    // 适应纸张 + 默认：2cm (preview is flush; DOCX still needs printable margins)
    left = right = cmToTwips(2)
  }

  const maxPair = Math.max(0, size.width - 2400)
  if (left + right > maxPair && left + right > 0) {
    const scale = maxPair / (left + right)
    left = Math.floor(left * scale)
    right = Math.floor(right * scale)
  }

  return {
    size,
    margin: { top: 1440, bottom: 1440, left, right },
    contentWidth: Math.max(1200, size.width - left - right),
    codeInset: geo.inset,
    // Explicit 页边距 only. Derived "默认" stays 0 so the frame is not indented twice.
    frameIndent: { left: geo.left, right: geo.right }
  }
}

/** @param {string} accentHex */
function frameEdge(accentHex) {
  // space:0 is required — Word "border space" opens hairline gaps at row seams.
  return { style: BorderStyle.SINGLE, size: 24, color: accentHex, space: 0 }
}

/** Thinner underline between caption rows / caption→code. */
function underEdge(accentHex) {
  return { style: BorderStyle.SINGLE, size: 12, color: accentHex, space: 0 }
}

/**
 * Table-level borders: continuous outer stroke + insideH divider.
 * Avoids per-paragraph side borders that Word draws as broken rails.
 * @param {import('./frame.js').FrameStyle} frame
 * @param {string} accentHex
 * @param {boolean} rowRules draw a rule between every row; outer frame stays on the table
 */
function tableBorders(frame, accentHex, rowRules) {
  const f = frameEdge(accentHex)
  const insideH = rowRules ? underEdge(accentHex) : NIL_BORDER
  if (frame === 'box') {
    return {
      top: f,
      bottom: f,
      left: f,
      right: f,
      insideHorizontal: insideH,
      insideVertical: NIL_BORDER
    }
  }
  if (frame === 'rails') {
    return {
      top: NIL_BORDER,
      bottom: NIL_BORDER,
      left: f,
      right: f,
      insideHorizontal: insideH,
      insideVertical: NIL_BORDER
    }
  }
  return {
    top: NIL_BORDER,
    bottom: NIL_BORDER,
    left: f,
    right: NIL_BORDER,
    insideHorizontal: insideH,
    insideVertical: NIL_BORDER
  }
}

const CELL_NO_BORDERS = {
  top: NIL_BORDER,
  bottom: NIL_BORDER,
  left: NIL_BORDER,
  right: NIL_BORDER
}

// 导出给论文排版管线（paper-export.js）复用；原调用不变
export { NIL_BORDER, CELL_NO_BORDERS, tableBorders }

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
 *  paperId?: string,
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
export async function linesToDocxBlob(lines, options) {
  const rows = applyListingStyle(lines, options)
  const fontName = options.fontName || 'Consolas'
  const pt = options.fontSizePt || 9
  const fontSize = Math.round(pt * 2)
  const lnColor = toDocxHexColor(options.lineNumberColor || '#7A7A7A')
  const fg = toDocxHexColor(options.foreground, '000000')
  const noFill = !!options.noFill || options.background === 'none'
  const fill = noFill ? 'auto' : toDocxHexColor(options.background || '#F5F5F5', 'F5F5F5')
  const suffix = options.lineNumberSuffix ?? '.'
  const accentHex = toDocxHexColor(options.accentLeft || '#007ACC', '007ACC')
  const frame = resolveFrameStyle(options.frameStyle)
  const pageSetup = resolveDocxPageSetup(options)
  const codeInset = pageSetup.codeInset || 0
  const useExact = pt < 16
  const line = Math.max(240, Math.round(pt * 20 * 1.35))
  const spacing = useExact
    ? { before: 0, after: 0, line, lineRule: LineRuleType.EXACT }
    : { before: 0, after: 0, line: 276, lineRule: LineRuleType.AUTO }
  const shading = noFill ? undefined : { type: ShadingType.CLEAR, fill }

  const showCap = shouldShowCaption(options)
  const capLines = showCap ? captionDisplayLines(options) : []
  const capFont = resolveCaptionFont(options)
  const capFill = toDocxHexColor(resolveCaptionBackground(options), 'D9D9D9')
  const capColor = toDocxHexColor(resolveCaptionColor(options), '000000')
  const capBold = resolveCaptionBold(options)
  const capItalic = resolveCaptionItalic(options)
  const capSize = Math.max(20, fontSize + 2)
  const capShading = { type: ShadingType.CLEAR, fill: capFill }
  const capSpacing = { before: 0, after: 0, line: 276, lineRule: LineRuleType.AUTO }

  /** @param {import('../themes.js').StyledRun[]} row */
  function codeTextRuns(row) {
    /** @type {InstanceType<typeof TextRun>[]} */
    const runs = []
    if (!row.length) {
      runs.push(new TextRun({
        text: ' ',
        font: fontName,
        size: fontSize,
        color: fg,
        bold: !!options.forceBold,
        italics: !!options.forceItalic,
        noProof: true
      }))
    } else {
      for (const run of row) {
        runs.push(new TextRun({
          text: run.text,
          font: fontName,
          size: fontSize,
          color: toDocxHexColor(run.color || options.foreground, fg),
          bold: !!run.bold,
          italics: !!run.italic,
          noProof: true
        }))
      }
    }
    return runs
  }

  /** @type {InstanceType<typeof Paragraph>[]} */
  const captionParas = capLines.map((text) => new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: capSpacing,
    shading: capShading,
    children: [
      new TextRun({
        text,
        font: capFont,
        size: capSize,
        color: capColor,
        bold: capBold,
        italics: capItalic,
        noProof: true
      })
    ]
  }))

  const rowRules = !!options.rowRules
  const page = pageSetup
  // pgMar already equals 页边距, so a full-width table sits on both margin edges
  // ("顶着左右两边"). Paste keeps the frame inside the text column via \li/\ri.
  // Pull the frame in by that same amount, and shorten it on the right.
  const pullLeft = Math.max(0, page.frameIndent?.left || 0)
  const pullRight = Math.max(0, page.frameIndent?.right || 0)
  const frameWidth = Math.max(2400, page.contentWidth - pullLeft - pullRight)
  const workRows = rows.length ? rows : [[]]
  const zeroMargin = { top: 0, bottom: 0, left: 0, right: 0 }
  // One fixed table. Nested tables overflow the cell; Word/WPS then drop
  // both pgMar and cell padding, so 页边距 and 代码边距 look ignored.
  // Code inset is a real paragraph indent (w:ind) — the ruler shows it.
  const gutterW = options.lineNumbers
    ? Math.min(
      Math.max(480, lineNumberGutterTwips(workRows.length, options)),
      Math.floor(frameWidth * 0.28)
    )
    : 0
  const codeColW = Math.max(600, frameWidth - gutterW)
  const colWidths = options.lineNumbers ? [gutterW, codeColW] : [frameWidth]
  const codeIndent = codeInset > 0 ? { left: codeInset, right: codeInset } : undefined
  const cellShade = noFill ? undefined : { type: ShadingType.CLEAR, fill }

  /**
   * @param {(InstanceType<typeof Paragraph>)[]} children
   * @param {number} width
   * @param {number} [span]
   * @param {typeof CELL_NO_BORDERS | null} [borders]
   */
  function frameCell(children, width, span, borders) {
    return new TableCell({
      borders: borders || CELL_NO_BORDERS,
      width: { size: width, type: WidthType.DXA },
      margins: zeroMargin,
      shading: cellShade,
      columnSpan: span || undefined,
      verticalAlign: VerticalAlign.CENTER,
      children
    })
  }

  /** @param {import('../themes.js').StyledRun[]} row */
  function codeParagraph(row) {
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing,
      shading,
      indent: codeIndent,
      children: codeTextRuns(row)
    })
  }

  const captionRule = (!rowRules && capLines.length)
    ? {
      ...CELL_NO_BORDERS,
      bottom: underEdge(accentHex)
    }
    : null

  /** @type {InstanceType<typeof TableRow>[]} */
  const tableRows = []
  for (const p of captionParas) {
    tableRows.push(new TableRow({
      children: [frameCell([p], frameWidth, options.lineNumbers ? 2 : undefined, captionRule)]
    }))
  }
  workRows.forEach((row, i) => {
    if (!options.lineNumbers) {
      tableRows.push(new TableRow({
        children: [frameCell([codeParagraph(row)], frameWidth)]
      }))
      return
    }
    tableRows.push(new TableRow({
      children: [
        frameCell([
          new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing,
            shading,
            children: [
              new TextRun({
                text: `${i + 1}${suffix}  `,
                font: fontName,
                size: fontSize,
                color: lnColor,
                bold: !!options.forceBold,
                italics: !!options.forceItalic,
                noProof: true
              })
            ]
          })
        ], gutterW),
        frameCell([codeParagraph(row)], codeColW)
      ]
    }))
  })

  const listingTable = new Table({
    width: { size: colWidths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: colWidths,
    indent: pullLeft > 0 ? { size: pullLeft, type: WidthType.DXA } : undefined,
    layout: TableLayoutType.FIXED,
    rows: tableRows,
    borders: tableBorders(frame, accentHex, rowRules)
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: page.size,
          margin: page.margin
        }
      },
      children: [listingTable]
    }]
  })

  return Packer.toBlob(doc)
}
