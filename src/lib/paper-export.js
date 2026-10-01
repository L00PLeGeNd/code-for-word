/**
 * 论文排版导出：PaperPara[] → RTF 剪贴板 / Word HTML / DOCX。
 * 复用现有纯函数（escapeRtf、buildColorTable、escapeHtml、linesToWordHtml、
 * docx 表格边框），代码模式导出器保持原样不动。
 */

import { escapeRtf, buildColorTable } from './rtf.js'
import { escapeHtml, linesToWordHtml } from './word-html.js'
import { findSourceLineForSnippet, sourceLineBaseForCode } from './preview-nav.js'
import { resolveFrameStyle, rtfParaBorders } from './frame.js'
import { tableBorders, resolveDocxPageSetup } from './docx.js'
import { FONT_OPTIONS } from '../themes.js'
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
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType
} from 'docx'

/**
 * @typedef {import('./paper-format.js').PaperPara} PaperPara
 * @typedef {import('./paper-format.js').PaperRun} PaperRun
 */

const DEFAULT_CODE_BG = '#F5F5F5'

/** @param {string} fontName */
function resolveFont(fontName) {
  const hit = FONT_OPTIONS.find((f) => f.id === fontName)
  return { name: hit?.id || fontName || '宋体', charset: hit?.rtfCharset ?? 0 }
}

/** CSS 字体栈：中文字体补英文名与通用族，保证浏览器预览可用。
 * @param {string} fontName */
function cssFontStack(fontName) {
  const cjkPairs = {
    宋体: "'宋体','SimSun',serif",
    黑体: "'黑体','SimHei',sans-serif",
    楷体: "'楷体','KaiTi',serif",
    仿宋: "'仿宋','FangSong',serif",
    微软雅黑: "'微软雅黑','Microsoft YaHei',sans-serif",
    等线: "'等线','DengXian',sans-serif"
  }
  return cjkPairs[fontName] || `'${fontName}',serif`
}

/** 把连续的 code 段落按 groupId 分组。
 * @param {PaperPara[]} paras */
export function groupCodeParas(paras) {
  /** @type {{ groupId: string, caption: PaperPara | null, lines: PaperRun[][] }[]} */
  const groups = []
  let cur = null
  for (const p of paras) {
    if (p.kind === 'codeCaption' && p.groupId) {
      if (!cur || cur.groupId !== p.groupId) {
        cur = { groupId: p.groupId, caption: null, lines: [] }
        groups.push(cur)
      }
      cur.caption = p
      continue
    }
    if (p.kind === 'code' && p.groupId) {
      if (!cur || cur.groupId !== p.groupId) {
        cur = { groupId: p.groupId, caption: null, lines: [] }
        groups.push(cur)
      }
      cur.lines.push(p.runs)
      continue
    }
    cur = null
  }
  return groups
}

// ————————————————— RTF —————————————————

/**
 * @param {PaperPara[]} paras
 * @param {{
 *  foreground?: string,
 *  codeBackground?: string,
 *  codeNoFill?: boolean,
 *  accentLeft?: string,
 *  lineNumbers?: boolean,
 *  lineNumberColor?: string,
 *  lineNumberSuffix?: string,
 *  frameStyle?: string,
 *  paperId?: string,
 *  sideMarginTwips?: number | null
 * }} [options]
 */
export function paperToRtf(paras, options = {}) {
  const fgHex = options.foreground || '#000000'
  const frame = resolveFrameStyle(options.frameStyle)
  const accent = options.accentLeft || '#007ACC'
  const codeBg = options.codeNoFill ? '#FFFFFF' : (options.codeBackground || DEFAULT_CODE_BG)
  const lineNumbers = !!options.lineNumbers
  const lnColor = options.lineNumberColor || '#7A7A7A'
  const suffix = options.lineNumberSuffix ?? '.'
  const showFill = !options.codeNoFill

  // 字体表：按段落/行内字体收集
  const fontNames = []
  for (const p of paras) {
    for (const n of [p.fontName, ...p.runs.map((r) => r.fontName).filter(Boolean)]) {
      if (n && !fontNames.includes(n)) fontNames.push(n)
    }
  }
  if (!fontNames.length) fontNames.push('宋体')
  const fontList = fontNames.map((n) => resolveFont(n))
  const fontIndex = new Map(fontNames.map((n, i) => [n, i]))

  // 颜色表
  const colors = [fgHex, accent, codeBg, lnColor]
  for (const p of paras) {
    for (const r of p.runs) {
      if (r.color) colors.push(r.color)
    }
  }
  const { table, indexOf } = buildColorTable(colors)
  const fg = indexOf(fgHex)
  const ac = indexOf(accent)
  const bg = indexOf(codeBg)
  const ln = indexOf(lnColor)

  /**
   * @param {PaperPara} p
   * @param {string} borders
   * @param {string} extraShade
   */
  const paraHead = (p, borders = '', extraShade = '') => {
    const align = p.align === 'center' ? '\\qc' : p.align === 'justify' ? '\\qj' : p.align === 'right' ? '\\qr' : '\\ql'
    const linePart = p.lineMultiple != null
      ? `\\sl${Math.round(240 * p.lineMultiple)}\\slmult1`
      : `\\sl${Math.max(240, Math.round(p.fontSizePt * 20 * 1.35))}\\slmult0`
    const fiVal = p.firstLineTwips !== 0 ? p.firstLineTwips : 0
    const fIdx = fontIndex.get(p.fontName) ?? 0
    return (
      `\\pard\\plain${align}\\hyphpar0\\nowidctlpar` +
      `\\li${p.leftIndentTwips || 0}\\ri0\\fi${fiVal}\\sb${p.beforeTwips}\\sa${p.afterTwips}${linePart}` +
      `\\f${fIdx}\\fs${Math.round(p.fontSizePt * 2)}\\cf${fg}${extraShade}${borders} `
    )
  }

  /** @param {PaperRun[]} runs */
  const runText = (runs) => runs.map((r) => {
    const cf = indexOf(r.color || fgHex)
    const bold = r.bold ? '\\b' : '\\b0'
    const italic = r.italic ? '\\i' : '\\i0'
    const underline = r.underline ? '\\ul' : '\\ulnone'
    const strike = r.strike ? '\\strike' : '\\strike0'
    const fOverride = r.fontName && fontIndex.has(r.fontName) ? `\\f${fontIndex.get(r.fontName)}` : ''
    return `{\\noproof${fOverride}\\cf${cf}${bold}${italic}${underline}${strike} ${escapeRtf(r.text)}}`
  }).join('')

  /** @type {string[]} */
  const out = []

  let i = 0
  while (i < paras.length) {
    const p = paras[i]

    if (p.kind === 'table') {
      out.push(rtfTable(p, indexOf))
      i += 1
      continue
    }

    if (p.kind === 'code' && p.groupId) {
      // 收集同组代码段（含前置题注已在上方输出）
      const groupId = p.groupId
      /** @type {PaperPara[]} */
      const group = []
      while (i < paras.length && paras[i].kind === 'code' && paras[i].groupId === groupId) {
        group.push(paras[i])
        i += 1
      }
      const total = group.length
      if (frame === 'box') {
        // 单段 + \line：连续边框（与代码模式一致，避免 Word 拒绝粘贴）
        const head = paraHead(group[0], rtfParaBorders('box', ac, 0, 0) || boxBorders(ac), showFill ? `\\cbpat${bg}` : '')
        const inner = group.map((row, idx) => {
          const lnRun = lineNumbers
            ? `{\\noproof\\f${fontIndex.get(row.fontName) ?? 0}\\cf${ln}\\b0\\i0 ${escapeRtf(`${idx + 1}${suffix}  `)}}`
            : ''
          return `${lnRun}${runText(row.runs)}`
        }).join('\\line\n')
        out.push(`${head}${inner}\\par`)
      } else {
        group.forEach((row, idx) => {
          const borders = rtfParaBorders(frame, ac, idx, total, false)
          const head = paraHead(row, borders, showFill ? `\\cbpat${bg}` : '')
          const lnRun = lineNumbers
            ? `{\\noproof\\f${fontIndex.get(row.fontName) ?? 0}\\cf${ln}\\b0\\i0 ${escapeRtf(`${idx + 1}${suffix}  `)}}`
            : ''
          out.push(`${head}${lnRun}${runText(row.runs)}\\par`)
        })
      }
      continue
    }

    out.push(`${paraHead(p)}${runText(p.runs)}\\par`)
    i += 1
  }

  const fontTable = fontList
    .map((f, idx) => `{\\f${idx}\\fnil\\fcharset${f.charset} ${f.name};}`)
    .join('')

  return [
    '{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat\\uc1',
    `{\\fonttbl${fontTable}}`,
    table,
    '{\\*\\generator CodePastePaper;}',
    out.join('\n'),
    '}'
  ].join('\n')
}

/** box 边框（rtfParaBorders 对 box 返回空串，这里显式给出） */
function boxBorders(ac) {
  const s = `\\brdrs\\brdrw40\\brdrcf${ac}`
  return `\\brdrt${s}\\brdrl${s}\\brdrr${s}\\brdrb${s}`
}

// ————————————————— 表格（markdown 管道表 → Word 表格）—————————————————

const TABLE_TOTAL_TWIPS = 9360 // A4 内容宽近似值（剪贴板 RTF 无页面设置）

/** @param {PaperPara} p @param {(hex: string) => number} indexOfColor */
function rtfTable(p, indexOfColor) {
  const cols = Math.max(p.header?.length || 0, ...(p.rows || []).map((r) => r.length), 1)
  const colW = Math.floor(TABLE_TOTAL_TWIPS / cols)
  const cellx = Array.from({ length: cols }, (_, i) => `\\cellx${colW * (i + 1)}`).join('')
  const borderAll = ('\\clbrdrt\\brdrs\\brdrw10\\clbrdrb\\brdrs\\brdrw10\\clbrdrl\\brdrs\\brdrw10\\clbrdrr\\brdrs\\brdrw10').repeat(cols)
  const fs = Math.round(p.fontSizePt * 2)
  const fg = indexOfColor('#000000')

  const headerRow = p.header?.length
    ? `\\trowd\\trgaph60\\trleft0${borderAll}${cellx}${p.header.map((c) => `{\\intbl\\b\\f0\\fs${fs}\\cf${fg} ${escapeRtf(c ?? '')}\\cell}`).join('')}\\row`
    : ''
  const bodyRows = (p.rows || []).map((r) => `\\trowd\\trgaph60\\trleft0${borderAll}${cellx}${r.map((c) => `{\\intbl\\f0\\fs${fs}\\cf${fg}\\b0 ${escapeRtf(c ?? '')}\\cell}`).join('')}\\row`)
  return [headerRow, ...bodyRows].filter(Boolean).join('\n')
}

/** @param {PaperPara} p @param {boolean} preview */
function tableHtml(p, preview) {
  const border = 'border:1px solid #666;'
  const th = (p.header || []).map((c) =>
    `<th style="${border}padding:3pt 6pt;background:#EEF1F4;font-family:${cssFontStack(p.fontName)};font-size:${p.fontSizePt}pt;text-align:left;">${escapeHtml(c ?? '')}</th>`).join('')
  const trs = (p.rows || []).map((r) =>
    `<tr>${r.map((c) => `<td style="${border}padding:3pt 6pt;font-family:${cssFontStack(p.fontName)};font-size:${p.fontSizePt}pt;">${escapeHtml(c ?? '')}</td>`).join('')}</tr>`).join('')
  const head = th ? `<tr>${th}</tr>` : ''
  const style = preview
    ? 'border-collapse:collapse;margin:6pt 0;width:100%;table-layout:fixed;'
    : 'border-collapse:collapse;margin:6pt 0;width:100%;table-layout:fixed;mso-table-lspace:0pt;mso-table-rspace:0pt;'
  return `<table class="paper-table" style="${style}">${head}${trs}</table>`
}

// ————————————————— Word HTML（预览 / 粘贴）—————————————————

/**
 * @param {PaperPara[]} paras
 * @param {{
 *  preview?: boolean,
 *  sourceText?: string,
 *  codeBackground?: string,
 *  codeNoFill?: boolean,
 *  accentLeft?: string,
 *  lineNumbers?: boolean,
 *  frameStyle?: string,
 *  paperId?: string,
 *  sideMarginTwips?: number | null
 * }} [options]
 */
export function paperToWordHtml(paras, options = {}) {
  const preview = !!options.preview
  const sourceText = typeof options.sourceText === 'string' ? options.sourceText : ''
  const codeGroups = groupCodeParas(paras)
  const groupById = new Map(codeGroups.map((g) => [g.groupId, g]))
  const seenGroups = new Set()

  /** @type {string[]} */
  const parts = []

  const codeOptionsFor = (p, codePlain) => ({
    background: options.codeNoFill ? 'none' : (options.codeBackground || DEFAULT_CODE_BG),
    noFill: !!options.codeNoFill,
    foreground: '#000000',
    fontName: p.fontName,
    fontSizePt: p.fontSizePt,
    lineNumbers: !!options.lineNumbers,
    lineNumberSuffix: '.',
    lineNumberColor: '#7A7A7A',
    accentLeft: options.accentLeft || '#007ACC',
    frameStyle: options.frameStyle || 'bar',
    sideMarginTwips: options.sideMarginTwips ?? null,
    pageContentTwips: null,
    preview,
    sourceLineBase: preview && sourceText ? sourceLineBaseForCode(sourceText, codePlain) : 0
  })

  for (const p of paras) {
    if (p.kind === 'table') {
      parts.push(tableHtml(p, preview))
      continue
    }
    if (p.kind === 'code' && p.groupId) {
      if (seenGroups.has(p.groupId)) continue
      seenGroups.add(p.groupId)
      const group = groupById.get(p.groupId)
      if (!group || !group.lines.length) continue
      if (group.caption) parts.push(captionHtml(group.caption, preview))
      const codeLines = group.lines.map((runs) => runs.map((r) => ({
        text: r.text,
        color: r.color || '#000000',
        bold: !!r.bold,
        italic: !!r.italic
      })))
      const codePlain = group.lines.map((runs) => runs.map((r) => r.text).join('')).join('\n')
      parts.push(linesToWordHtml(codeLines, codeOptionsFor(p, codePlain)))
      continue
    }
    if (p.kind === 'codeCaption') continue
    parts.push(textParaHtml(p, preview, sourceText))
  }

  const wrapClass = preview ? 'paper-doc preview-page' : 'paper-doc'
  return `<div class="${wrapClass}" style="display:block;">${parts.join('\n')}</div>`
}

/** @param {PaperPara} p @param {boolean} preview @param {string} [sourceText] */
function textParaHtml(p, preview, sourceText = '') {
  const align = p.align === 'center' ? 'center' : p.align === 'justify' ? 'justify' : p.align === 'right' ? 'right' : 'left'
  const indent = p.firstLineTwips !== 0 ? `text-indent:${(p.firstLineTwips / 20).toFixed(1)}pt;` : ''
  const padLeft = p.leftIndentTwips > 0 ? `padding-left:${(p.leftIndentTwips / 20).toFixed(1)}pt;` : ''
  const before = p.beforeTwips > 0 ? `margin-top:${(p.beforeTwips / 20).toFixed(1)}pt;` : 'margin-top:0;'
  const after = p.afterTwips > 0 ? `margin-bottom:${(p.afterTwips / 20).toFixed(1)}pt;` : 'margin-bottom:0;'
  const lh = p.lineMultiple != null ? `line-height:${p.lineMultiple};` : ''
  const runs = p.runs.map((r) => {
    const color = r.color && r.color !== '#000000' ? `color:${r.color};` : ''
    const weight = r.bold ? 'font-weight:bold;' : ''
    const italic = r.italic ? 'font-style:italic;' : ''
    const deco = [r.underline ? 'underline' : '', r.strike ? 'line-through' : '']
      .filter(Boolean).join(' ')
    const decoration = deco ? `text-decoration:${deco};` : ''
    const font = r.fontName ? `font-family:'${r.fontName}',monospace;` : ''
    return `<span style="${color}${weight}${italic}${decoration}${font}">${escapeHtml(r.text)}</span>`
  }).join('')
  const msoRule = preview ? '' : 'mso-line-height-rule:"multiple";'
  const plain = p.runs.map((r) => r.text).join('')
  const srcLine = preview && sourceText ? findSourceLineForSnippet(sourceText, plain) : 0
  const srcAttr = srcLine > 0 ? ` data-src-line="${srcLine}"` : ''
  return (
    `<p class="paper-p paper-${p.kind}"${srcAttr} style="` +
    `margin:0;${before}${after}${padLeft}${indent}text-align:${align};` +
    `font-family:${cssFontStack(p.fontName)};font-size:${p.fontSizePt}pt;${lh}${msoRule}` +
    `">${runs}</p>`
  )
}

/** @param {PaperPara} p @param {boolean} preview */
function captionHtml(p, preview) {
  return (
    `<p class="paper-codecaption" style="margin:${(p.beforeTwips / 20).toFixed(1)}pt 0 ` +
    `${(p.afterTwips / 20).toFixed(1)}pt;text-align:center;` +
    `font-family:${cssFontStack(p.fontName)};font-size:${p.fontSizePt}pt;">` +
    `${escapeHtml(p.runs.map((r) => r.text).join(''))}</p>`
  )
}

// ————————————————— DOCX —————————————————

/**
 * @param {PaperPara[]} paras
 * @param {{
 *  paperId?: string,
 *  sideMarginTwips?: number | null,
 *  pageContentTwips?: number | null,
 *  codeBackground?: string,
 *  codeNoFill?: boolean,
 *  accentLeft?: string,
 *  lineNumbers?: boolean,
 *  frameStyle?: string
 * }} [options]
 */
export async function paperToDocxBlob(paras, options = {}) {
  const page = resolveDocxPageSetup(options)
  const accentHex = (options.accentLeft || '#007ACC').replace('#', '')
  const fill = options.codeNoFill ? 'auto' : (options.codeBackground || DEFAULT_CODE_BG).replace('#', '')
  const frame = resolveFrameStyle(options.frameStyle)

  const alignMap = {
    left: AlignmentType.LEFT,
    center: AlignmentType.CENTER,
    justify: AlignmentType.JUSTIFIED,
    right: AlignmentType.RIGHT
  }

  /** @param {PaperPara} p @param {string[]} [extraParents] */
  const textPara = (p) => new Paragraph({
    alignment: alignMap[p.align] || AlignmentType.LEFT,
    spacing: {
      before: p.beforeTwips,
      after: p.afterTwips,
      line: p.lineMultiple != null ? Math.round(240 * p.lineMultiple) : Math.max(240, Math.round(p.fontSizePt * 20 * 1.35)),
      lineRule: p.lineMultiple != null ? LineRuleType.AUTO : LineRuleType.EXACT
    },
    indent: p.firstLineTwips < 0
      ? { left: p.leftIndentTwips || 480, hanging: -p.firstLineTwips }
      : (p.firstLineTwips > 0 ? { firstLine: p.firstLineTwips } : undefined),
    children: p.runs.map((r) => new TextRun({
      text: r.text,
      font: r.fontName || p.fontName,
      size: Math.round(p.fontSizePt * 2),
      bold: !!r.bold,
      italics: !!r.italic,
      underline: r.underline ? { type: 'single' } : undefined,
      strike: !!r.strike,
      color: (r.color || '#000000').replace('#', ''),
      noProof: p.kind === 'code'
    }))
  })

  const codePara = (p, idx) => {
    /** @type {InstanceType<typeof TextRun>[]} */
    const runs = []
    if (options.lineNumbers) {
      runs.push(new TextRun({
        text: `${idx + 1}.  `,
        font: p.fontName,
        size: Math.round(p.fontSizePt * 2),
        color: '7A7A7A',
        noProof: true
      }))
    }
    for (const r of p.runs) {
      runs.push(new TextRun({
        text: r.text,
        font: r.fontName,
        size: Math.round(p.fontSizePt * 2),
        bold: !!r.bold,
        italics: !!r.italic,
        color: (r.color || '#000000').replace('#', ''),
        noProof: true
      }))
    }
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: {
        before: 0,
        after: p.afterTwips,
        line: Math.max(240, Math.round(p.fontSizePt * 20 * 1.35)),
        lineRule: LineRuleType.EXACT
      },
      shading: options.codeNoFill ? undefined : { type: ShadingType.CLEAR, fill },
      children: runs
    })
  }

  /** 表格：所有单元格单线边框、表头加粗底纹 */
  const tablePara = (p) => {
    const cols = Math.max(p.header?.length || 0, ...(p.rows || []).map((r) => r.length), 1)
    const colW = Math.floor(page.contentWidth / cols)
    const fs = Math.round(p.fontSizePt * 2)
    const edge = { style: BorderStyle.SINGLE, size: 4, color: '666666', space: 0 }
    const cellBorders = { top: edge, bottom: edge, left: edge, right: edge }
    const mkCell = (text, bold, shaded) => new TableCell({
      borders: cellBorders,
      width: { size: colW, type: WidthType.DXA },
      margins: { top: 40, bottom: 40, left: 80, right: 80 },
      shading: shaded ? { type: ShadingType.CLEAR, fill: 'EEF1F4' } : undefined,
      children: [new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 0, after: 0, line: 240, lineRule: LineRuleType.AUTO },
        children: [new TextRun({ text: text ?? '', font: p.fontName, size: fs, bold, noProof: false })]
      })]
    })
    const rows = []
    if (p.header?.length) {
      rows.push(new TableRow({ children: p.header.map((c) => mkCell(c, true, true)) }))
    }
    for (const r of p.rows || []) {
      rows.push(new TableRow({ children: r.map((c) => mkCell(c, false, false)) }))
    }
    return new Table({
      width: { size: page.contentWidth, type: WidthType.DXA },
      columnWidths: Array.from({ length: cols }, () => colW),
      rows
    })
  }

  /** @type {InstanceType<typeof Paragraph>[] | InstanceType<typeof Table>[]} */
  const children = []
  let i = 0
  while (i < paras.length) {
    const p = paras[i]
    if (p.kind === 'table') {
      children.push(tablePara(p))
      i += 1
      continue
    }
    if (p.kind === 'code' && p.groupId) {
      const groupId = p.groupId
      /** @type {PaperPara[]} */
      const group = []
      while (i < paras.length && paras[i].kind === 'code' && paras[i].groupId === groupId) {
        group.push(paras[i])
        i += 1
      }
      const codeParas = group.map((row, idx) => codePara(row, idx))
      const table = new Table({
        width: { size: page.contentWidth, type: WidthType.DXA },
        columnWidths: [page.contentWidth],
        rows: [new TableRow({
          children: [new TableCell({
            borders: {
              top: { style: 'none', size: 0, color: 'auto', space: 0 },
              bottom: { style: 'none', size: 0, color: 'auto', space: 0 },
              left: { style: 'none', size: 0, color: 'auto', space: 0 },
              right: { style: 'none', size: 0, color: 'auto', space: 0 }
            },
            width: { size: page.contentWidth, type: WidthType.DXA },
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            verticalAlign: VerticalAlign.CENTER,
            children: codeParas
          })]
        })],
        borders: tableBorders(frame, accentHex, false)
      })
      children.push(table)
      continue
    }
    children.push(textPara(p))
    i += 1
  }

  const doc = new Document({
    sections: [{
      properties: { page: { size: page.size, margin: page.margin } },
      children
    }]
  })
  return Packer.toBlob(doc)
}
