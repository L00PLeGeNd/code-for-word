import { describe, expect, it } from 'vitest'
import { parseBlocks, renumberBlocks } from './blocks.js'
import { buildPaperModel } from './paper-format.js'
import { paperToRtf, paperToWordHtml, paperToDocxBlob, groupCodeParas } from './paper-export.js'
import { escapeRtf } from './rtf.js'

const stubHighlight = (code) => code.split('\n').map((l) => [{ text: l, color: '#000000' }])

function buildPaper(text, scheme = 'academic', options = {}) {
  const blocks = renumberBlocks(parseBlocks(text), scheme)
  return buildPaperModel(blocks, { scheme, highlight: stubHighlight, ...options })
}

describe('paperToRtf', () => {
  it('emits thesis paragraph controls', () => {
    const paras = buildPaper('1 引言\n\n正文内容，首行缩进两端对齐。')
    const rtf = paperToRtf(paras)
    expect(rtf.startsWith('{\\rtf1')).toBe(true)
    expect(rtf).toContain('宋体')
    expect(rtf).toContain('黑体')
    expect(rtf).toContain('\\qj') // 两端对齐
    expect(rtf).toContain('\\fi480') // 首行缩进 2 字符（12pt）
    expect(rtf).toContain('\\sl360\\slmult1') // 1.5 倍行距
    expect(rtf).toContain('\\sb480') // 一级标题段前 24pt
    expect(rtf).toContain('\\sa360') // 段后 18pt
    expect(rtf).toContain('\\par')
    expect(rtf.replace(/\}\s*$/, '')).toMatch(/\\par\s*$/)
  })

  it('emits code blocks with shading and left border', () => {
    const src = ['说明。', '', '```python', 'x = 1', '```'].join('\n')
    const paras = buildPaper(src)
    const rtf = paperToRtf(paras)
    expect(rtf).toContain('\\cbpat')
    expect(rtf).toContain('\\brdrl')
    expect(rtf).toContain('Consolas')
  })

  it('emits underline, strikethrough and hanging indent', () => {
    const paras = buildPaper('__下划线__ 与 ~~删除线~~')
    const rtf = paperToRtf(paras)
    expect(rtf).toContain('\\ul')
    expect(rtf).toContain('\\strike')

    const src = '[1] 张三. 某文献[J]. 学报, 2023.'
    const refParas = buildPaper(src)
    const refRtf = paperToRtf(refParas)
    expect(refRtf).toContain('\\li480')
    expect(refRtf).toContain('\\fi-480')
  })

  it('renders underline and caption centering in html', () => {
    const paras = buildPaper('重点__内容__文本')
    const html = paperToWordHtml(paras, { preview: true })
    expect(html).toContain('text-decoration:underline')

    const capParas = buildPaper('图 1 系统架构图')
    const capHtml = paperToWordHtml(capParas, { preview: true })
    expect(capHtml).toContain('paper-caption')
    expect(capHtml).toContain('text-align:center')
  })

  it('renders signoff right-aligned and markdown tables in all exporters', async () => {
    const src = ['说明。',
      '',
      '| 名称 | 数值 |',
      '| --- | --- |',
      '| 甲 | 1 |',
      '',
      '××大学', '2026年6月1日'].join('\n')
    const paras = buildPaper(src)

    const rtf = paperToRtf(paras)
    expect(rtf).toContain('\\qr') // 落款右对齐
    expect(rtf).toContain('\\trowd') // 表格行
    expect(rtf).toContain('\\cell') // 单元格
    expect(rtf).toContain(escapeRtf('名称')) // 中文单元格以 \u 转义存在

    const html = paperToWordHtml(paras, { preview: true })
    expect(html).toContain('text-align:right')
    expect(html).toContain('paper-table')
    expect(html).toContain('<th')

    const blob = await paperToDocxBlob(paras, { paperId: 'a4' })
    const arrayBuffer = await blob.arrayBuffer()
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(arrayBuffer)
    const xml = await zip.file('word/document.xml').async('string')
    expect(xml).toContain('w:val="right"')
    expect(xml).toContain('<w:tbl>')
    expect(xml).toContain('名称')
  })

  it('emits box frame with hard Enter per line (no soft \\line)', () => {
    const src = ['```python', 'x = 1', 'y = 2', '```'].join('\n')
    const paras = buildPaper(src)
    const rtf = paperToRtf(paras, { frameStyle: 'box' })
    expect(rtf).not.toContain('\\line')
    expect(rtf).toContain('\\trowd')
    expect((rtf.match(/\\cell\\row/g) || []).length).toBeGreaterThanOrEqual(2)
  })
})

describe('paperToWordHtml', () => {
  it('renders preview paragraphs with thesis styles', () => {
    const paras = buildPaper('1 引言\n\n正文内容。')
    const html = paperToWordHtml(paras, { preview: true })
    expect(html).toContain('paper-heading')
    expect(html).toContain('text-indent:24.0pt')
    expect(html).toContain('text-align:justify')
    expect(html).toContain('line-height:1.5')
    expect(html).toContain('黑体')
    expect(html).toContain('宋体')
  })

  it('renders embedded code via the existing listing renderer', () => {
    const src = ['说明。', '', '```python', 'x = 1', '```'].join('\n')
    const paras = buildPaper(src)
    const html = paperToWordHtml(paras, { preview: true })
    expect(html).toContain('代码 1')
    expect(html).toContain('listing-block')
    expect(html).toContain('x = 1')
  })

  it('paste branch produces paragraphs and tables', () => {
    const src = ['说明。', '', '```python', 'x = 1', '```'].join('\n')
    const paras = buildPaper(src)
    const html = paperToWordHtml(paras, {})
    expect(html).toContain('<p class="paper-p paper-body"')
    expect(html).toContain('<table class="listing-block"')
  })
})

describe('groupCodeParas', () => {
  it('groups code paragraphs with their caption', () => {
    const src = ['```js', 'a', 'b', '```', '', '文字', '', '```py', 'c', '```'].join('\n')
    const paras = buildPaper(src)
    const groups = groupCodeParas(paras)
    expect(groups).toHaveLength(2)
    expect(groups[0].lines).toHaveLength(2)
    expect(groups[0].caption.runs[0].text).toBe('代码 1')
    expect(groups[1].caption.runs[0].text).toBe('代码 2')
  })
})

describe('paperToDocxBlob', () => {
  it('produces a valid docx zip containing thesis paragraph properties', async () => {
    const paras = buildPaper('1 引言\n\n正文内容。')
    const blob = await paperToDocxBlob(paras, { paperId: 'a4' })
    expect(blob.size).toBeGreaterThan(1000)

    const arrayBuffer = await blob.arrayBuffer()
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(arrayBuffer)
    const xml = await zip.file('word/document.xml').async('string')
    expect(xml).toContain('w:val="both"') // 两端对齐
    expect(xml).toContain('w:firstLine="480"') // 首行缩进
    expect(xml).toContain('w:line="360"') // 1.5 倍行距
    expect(xml).toContain('宋体')
    expect(xml).toContain('黑体')
  })

  it('wraps code paragraphs in a bordered table', async () => {
    const src = ['说明。', '', '```python', 'x = 1', '```'].join('\n')
    const paras = buildPaper(src)
    const blob = await paperToDocxBlob(paras, { paperId: 'a4' })
    const arrayBuffer = await blob.arrayBuffer()
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(arrayBuffer)
    const xml = await zip.file('word/document.xml').async('string')
    expect(xml).toContain('<w:tbl>')
    expect(xml).toContain('x = 1')
  })
})
