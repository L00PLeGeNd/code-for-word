import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { linesToDocxBlob } from './docx.js'

async function docXml(blob) {
  const buf = Buffer.from(await blob.arrayBuffer())
  const zip = await JSZip.loadAsync(buf)
  return zip.file('word/document.xml').async('string')
}

describe('DOCX exporter', () => {
  it('box+caption keeps a continuous outer frame; caption divider is not a rule on every code row', async () => {
    const blob = await linesToDocxBlob(
      [[{ text: 'def x():', color: '#0000FF' }], [{ text: '    pass', color: '#000000' }]],
      {
        background: '#FFFFFF',
        foreground: '#000000',
        captionEnabled: true,
        captionLines: ['代码示例'],
        accentLeft: '#C00000',
        frameStyle: 'box',
        lineNumbers: true,
        fontName: 'Times New Roman',
        fontSizePt: 10
      }
    )
    const xml = await docXml(blob)
    expect(xml).toContain('w:tbl')
    expect(xml).toContain('代码示例')
    expect(xml).toContain('def x():')
    expect(xml).toMatch(/w:tblBorders/)
    expect(xml).toMatch(/w:insideH[^>]*w:val="none"/)
    expect(xml).toMatch(/w:left[^>]*w:val="single"[^>]*w:sz="24"/)
    expect(xml).toMatch(/w:bottom[^>]*w:val="single"[^>]*w:sz="12"/)
  })

  it('row underlines use table insideH and keep the outer frame', async () => {
    const blob = await linesToDocxBlob(
      [[{ text: 'a', color: '#000000' }], [{ text: 'b', color: '#000000' }]],
      {
        background: '#FFFFFF',
        foreground: '#000000',
        frameStyle: 'box',
        accentLeft: '#C00000',
        rowRules: true,
        lineNumbers: false
      }
    )
    const xml = await docXml(blob)
    expect(xml).toMatch(/w:insideH[^>]*w:val="single"[^>]*w:sz="12"/)
    expect(xml).toMatch(/w:left[^>]*w:val="single"[^>]*w:sz="24"/)
    expect(xml).toMatch(/w:right[^>]*w:val="single"[^>]*w:sz="24"/)
    expect(xml).toMatch(/w:insideV[^>]*w:val="none"/)
  })

  it('insets the frame inside the page margins the same way paste does', async () => {
    const blob = await linesToDocxBlob(
      [[{ text: 'x', color: '#000000' }]],
      {
        background: '#FFFFFF',
        foreground: '#000000',
        sideMarginTwips: { left: 1134, right: 1134 },
        paperId: 'a4',
        pageContentTwips: 9026,
        frameStyle: 'box'
      }
    )
    const xml = await docXml(blob)
    expect(xml).toMatch(/w:pgMar[^>]*w:left="1134"/)
    expect(xml).toMatch(/w:pgMar[^>]*w:right="1134"/)
    expect(xml).toMatch(/w:pgSz[^>]*w:w="11906"/)
    // Frame is not the full text column: tblInd + shorter width.
    expect(xml).toMatch(/w:tblInd[^>]*w:w="1134"/)
    expect(xml).toMatch(/w:tblW[^>]*w:w="7370"/)
  })

  it('writes code inset as cell margins and honors paper + inset together', async () => {
    const blob = await linesToDocxBlob(
      [[{ text: 'hello', color: '#000000' }]],
      {
        background: '#FFFFFF',
        foreground: '#000000',
        sideMarginTwips: { left: 1134, right: 1134 },
        codeInsetTwips: 567,
        paperId: 'a4',
        pageContentTwips: 9026,
        frameStyle: 'box',
        lineNumbers: true,
        fontSizePt: 9
      }
    )
    const xml = await docXml(blob)
    expect(xml).toMatch(/w:pgMar[^>]*w:left="1134"/)
    expect(xml).toMatch(/w:pgSz[^>]*w:w="11906"/)
    // One table, fixed layout. Inset is paragraph indent, not a nested cell pad.
    expect((xml.match(/<w:tbl[\s>]/g) || []).length).toBe(1)
    expect(xml).toMatch(/w:tblLayout[^>]*w:type="fixed"/)
    expect(xml).toMatch(/w:ind[^>]*w:left="567"/)
    expect(xml).toMatch(/w:ind[^>]*w:right="567"/)
    expect(xml).toContain('hello')
    expect(xml).toContain('1.')
  })

  it('maps paperId a5 to real page size when margins are custom', async () => {
    const blob = await linesToDocxBlob(
      [[{ text: 'x', color: '#000000' }]],
      {
        background: '#FFFFFF',
        foreground: '#000000',
        sideMarginTwips: { left: 720, right: 720 },
        paperId: 'a5',
        pageContentTwips: 6950,
        frameStyle: 'bar'
      }
    )
    const xml = await docXml(blob)
    expect(xml).toMatch(/w:pgSz[^>]*w:w="8391"/)
    expect(xml).toMatch(/w:pgMar[^>]*w:left="720"/)
    expect(xml).toMatch(/w:pgMar[^>]*w:right="720"/)
  })

  it('emits hard paragraph breaks (no soft w:br) for multi-line code', async () => {
    const blob = await linesToDocxBlob(
      [
        [{ text: 'a', color: 'rgb(0 0 0 / 0.95)' }],
        [{ text: 'b', color: '#000000' }],
        [{ text: 'c', color: '#000000' }]
      ],
      {
        background: '#FFFFFF',
        foreground: '#000000',
        frameStyle: 'box',
        lineNumbers: false
      }
    )
    const xml = await docXml(blob)
    expect(xml).not.toMatch(/<w:br\b/)
    expect((xml.match(/<w:p[\s>]/g) || []).length).toBeGreaterThanOrEqual(3)
  })
})
