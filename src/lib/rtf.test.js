import { describe, expect, it } from 'vitest'
import { hexToRtfRgb, buildColorTable, escapeRtf, linesToRtf } from './rtf.js'

describe('RTF exporter', () => {
  it('converts hex colors to RTF rgb components', () => {
    expect(hexToRtfRgb('#569CD6')).toEqual({ red: 86, green: 156, blue: 214 })
    expect(hexToRtfRgb('d69d85')).toEqual({ red: 214, green: 157, blue: 133 })
  })

  it('escapes RTF special characters', () => {
    expect(escapeRtf('a\\b{c}d')).toBe('a\\\\b\\{c\\}d')
  })

  it('escapes Chinese as signed \\u so Word keeps CJK', () => {
    // 负 U+8D1F → signed -29409; 债/率 stay positive BMP
    expect(escapeRtf('负债率')).toBe('\\u-29409?\\u20538?\\u29575?')
    expect(escapeRtf('用户ID')).toBe('\\u29992?\\u25143?ID')
  })

  it('builds a color table with autofg as index 1', () => {
    const { table, indexOf } = buildColorTable(['#1E1E1E', '#569CD6', '#1E1E1E'])
    expect(table).toContain('\\red30\\green30\\blue30')
    expect(table).toContain('\\red86\\green156\\blue214')
    expect(indexOf('#1E1E1E')).toBe(1)
    expect(indexOf('#569CD6')).toBe(2)
  })

  it('renders highlighted lines as Word-openable RTF', () => {
    const rtf = linesToRtf(
      [
        [
          { text: 'def ', color: '#569CD6' },
          { text: 'fib', color: '#DCDCAA' },
          { text: '():', color: '#D4D4D4' }
        ],
        [{ text: '    return 1', color: '#D4D4D4' }]
      ],
      {
        background: '#1E1E1E',
        foreground: '#D4D4D4',
        fontName: 'Consolas',
        fontSizePt: 10.5,
        lineNumbers: true,
        lineNumberSuffix: '.'
      }
    )

    expect(rtf.startsWith('{\\rtf1')).toBe(true)
    expect(rtf).toContain('Consolas')
    expect(rtf).toContain('\\cf')
    expect(rtf).toContain('def ')
    expect(rtf).toContain('\\par')
    // indented paragraphs — not a Word table
    expect(rtf).not.toContain('\\trowd')
    expect(rtf).not.toContain('\\cell')
    expect(rtf).toContain('\\brdrl')
    expect(rtf).toContain('\\cbpat')
    expect(rtf).not.toContain('\\chcbpat')
    expect(rtf).toContain('\\ql')
    expect(rtf).toMatch(/\\li\d+/)
    expect(rtf).toMatch(/\\f0\\cf\d+\\b0\\i0 1\.  /)
    // every line including the last must end with \\par (Word keeps last-line shading)
    expect(rtf.replace(/\}\s*$/, '')).toMatch(/\\par\s*$/)
  })

  it('keeps \\par on the final line so shading is not dropped', () => {
    const rtf = linesToRtf(
      [
        [{ text: 'a', color: '#000000' }],
        [{ text: 'last-line', color: '#000000' }]
      ],
      { background: '#F5F5F5', foreground: '#000000', lineNumbers: false, fontSizePt: 18 }
    )
    const parts = rtf.split('\\par')
    expect(parts.length).toBeGreaterThanOrEqual(3) // two lines + trailing after last
    expect(rtf).toContain('last-line')
    expect(rtf).toContain('\\cbpat')
  })

  it('does not keep a trailing empty line that would paste as an extra return', () => {
    const rtf = linesToRtf(
      [
        [{ text: 'print(1)', color: '#000000' }],
        []
      ],
      { background: '#F5F5F5', foreground: '#000000', lineNumbers: false, fontSizePt: 18 }
    )
    expect(rtf.match(/print\(1\)/g)?.length).toBe(1)
    expect(rtf).not.toContain('\\trowd')
  })

  it('keeps Chinese only as \\u escapes in the RTF body', () => {
    const rtf = linesToRtf(
      [[{ text: 'mask = df["负债率"]', color: '#000000' }]],
      { background: '#FFFFFF', foreground: '#000000', lineNumbers: false }
    )
    expect(rtf).not.toMatch(/负债率/)
    expect(rtf).toContain('\\u-29409?')
  })

  it('emits Word-recognizable bold while keeping highlight colors', () => {
    const rtf = linesToRtf(
      [[{ text: 'x', color: '#AF00DB' }]],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        forceBold: true,
        lineNumbers: false
      }
    )
    expect(rtf).toMatch(/\\f0\\cf\d+\\b\\i0 /)
    expect(rtf).toContain('\\red175\\green0\\blue219')
  })

  it('does not squeeze long lines when 字号 is large', () => {
    const long = 'df_fyh.loc[mask, ["用户ID", "负债率"]].sort_values("负债率", ascending=False)'
    const rtf = linesToRtf(
      [[{ text: long, color: '#000000' }]],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        fontSizePt: 18,
        lineNumbers: true,
        lineNumberColor: '#237893',
        accentLeft: '#007ACC',
        pageContentTwips: 9000
      }
    )
    expect(rtf).toMatch(/\\li0\\ri0/)
    expect(rtf).toContain('\\slmult1')
  })

  it('keeps custom side margins on a wide code block', () => {
    const long = 'df_fyh.loc[mask, ["用户ID", "负债率"]].sort_values("负债率", ascending=False)'
    const rtf = linesToRtf(
      [
        [{ text: 'x = 1', color: '#000000' }],
        [{ text: long, color: '#000000' }]
      ],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        fontSizePt: 18,
        lineNumbers: true,
        sideMarginTwips: 1134,
        pageContentTwips: 9000
      }
    )
    expect(rtf).toMatch(/\\li1134\\ri1134/)
    expect(rtf.replace(/\}\s*$/, '')).toMatch(/\\par\s*$/)
  })

  it('默认边距 is zero even on 适应纸张', () => {
    const rtf = linesToRtf(
      [[{ text: 'print(1)', color: '#000000' }]],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        fontSizePt: 9,
        lineNumbers: false,
        pageContentTwips: null
      }
    )
    expect(rtf).toMatch(/\\li0\\ri0/)
  })

  it('applies asymmetric Word-style left/right indents', () => {
    const rtf = linesToRtf(
      [[{ text: 'x', color: '#000000' }]],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        fontSizePt: 9,
        lineNumbers: false,
        sideMarginTwips: { left: 567, right: 1134 },
        pageContentTwips: 9000
      }
    )
    expect(rtf).toMatch(/\\li567\\ri1134/)
  })

  it('omits paragraph shading when noFill / 无底色', () => {
    const rtf = linesToRtf(
      [[{ text: 'x', color: '#000000' }]],
      {
        background: 'none',
        noFill: true,
        foreground: '#000000',
        fontSizePt: 9,
        lineNumbers: false
      }
    )
    expect(rtf).not.toContain('\\cbpat')
    expect(rtf).toContain('\\brdrl')
  })

  it('emits paragraphs only (never a Word table)', () => {
    const rtf = linesToRtf(
      [[{ text: 'x', color: '#000000' }]],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        lineNumbers: true,
        accentLeft: '#007ACC'
      }
    )
    expect(rtf).not.toContain('\\trowd')
    expect(rtf).not.toContain('\\cell')
    expect(rtf).toContain('\\brdrl')
  })

  it('rails frame adds left and right borders', () => {
    const rtf = linesToRtf(
      [[{ text: 'x', color: '#000000' }], [{ text: 'y', color: '#000000' }]],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        lineNumbers: true,
        frameStyle: 'rails',
        accentLeft: '#007ACC'
      }
    )
    expect(rtf).toMatch(/\\brdrl\\brdrs\\brdrw40\\brdrcf\d+\\brdrr\\brdrs/)
    expect(rtf).not.toContain('\\brdrt')
  })

  it('box frame is one paragraph with four borders and soft line breaks', () => {
    const rtf = linesToRtf(
      [
        [{ text: 'a', color: '#000000' }],
        [{ text: 'b', color: '#000000' }],
        [{ text: 'c', color: '#000000' }]
      ],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        lineNumbers: false,
        frameStyle: 'box',
        accentLeft: '#C00000'
      }
    )
    // no table — Word "保留原格式" tears nested cells apart
    expect(rtf).not.toContain('\\trowd')
    expect(rtf).toMatch(/\\brdrt\\brdrs\\brdrw40\\brdrcf\d+/)
    expect(rtf).toMatch(/\\brdrb\\brdrs\\brdrw40\\brdrcf\d+/)
    expect(rtf).toMatch(/\\brdrl\\brdrs\\brdrw40\\brdrcf\d+/)
    expect(rtf).toMatch(/\\brdrr\\brdrs\\brdrw40\\brdrcf\d+/)
    expect((rtf.match(/\\line/g) || []).length).toBe(2)
    expect((rtf.match(/\\pard\\plain/g) || []).length).toBe(1)
    expect((rtf.match(/\\cbpat/g) || []).length).toBe(1)
  })

  it('row underlines are table rules inside a continuous outer frame', () => {
    const rtf = linesToRtf(
      [
        [{ text: 'a', color: '#000000' }],
        [{ text: 'b', color: '#000000' }],
        [{ text: 'c', color: '#000000' }]
      ],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        lineNumbers: false,
        frameStyle: 'box',
        accentLeft: '#C00000',
        rowRules: true
      }
    )
    expect(rtf).toContain('\\trowd')
    expect(rtf).toMatch(/\\trbrdrl\\brdrs\\brdrw40/)
    expect(rtf).toMatch(/\\trbrdrr\\brdrs\\brdrw40/)
    expect(rtf).toMatch(/\\trbrdrt\\brdrs\\brdrw40/)
    expect(rtf).toMatch(/\\trbrdrb\\brdrs\\brdrw40/)
    expect(rtf).toMatch(/\\trbrdrh\\brdrs\\brdrw20/)
    expect((rtf.match(/\\cell\\row/g) || []).length).toBe(3)
  })

  it('puts \\li/\\ri before borders so Word keeps side margins on paste', () => {
    const rtf = linesToRtf(
      [[{ text: 'x', color: '#000000' }]],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        frameStyle: 'bar',
        accentLeft: '#007ACC',
        sideMarginTwips: { left: 1134, right: 1134 },
        pageContentTwips: 9026
      }
    )
    const para = rtf.match(/\\pard\\plain[\s\S]*?\\par/)?.[0] || ''
    expect(para.indexOf('\\li1134')).toBeGreaterThan(-1)
    expect(para.indexOf('\\li1134')).toBeLessThan(para.indexOf('\\brdrl'))
    expect(para).not.toMatch(/\\noproof\\li/)
  })

  it('emits in-box caption rows with fill, font, and underlines (no line numbers)', () => {
    const rtf = linesToRtf(
      [[{ text: 'x', color: '#000000' }]],
      {
        background: '#FFFFFF',
        foreground: '#000000',
        lineNumbers: true,
        frameStyle: 'box',
        captionEnabled: true,
        captionLines: ['附录 4', '代码 4'],
        captionFont: '宋体',
        captionBackground: '#D9D9D9',
        captionColor: '#C00000',
        captionBold: true,
        captionItalic: true,
        forceItalic: true,
        accentLeft: '#007ACC'
      }
    )
    expect(rtf).toContain('\\f1\\fs')
    expect(rtf).toContain('宋体')
    expect(rtf).toMatch(/\\red217\\green217\\blue217/) // #D9D9D9
    expect(rtf).toMatch(/\\red192\\green0\\blue0/) // caption color
    expect(rtf).toMatch(/\\f1\\fs\d+\\cf\d+\\b\\i/)
    expect(rtf).toContain('\\i ')
    // WPS-safe caption metrics: explicit line spacing + border padding
    expect(rtf).toMatch(/\\sa40\\sb40\\sl\d+\\slmult0/)
    expect(rtf).toMatch(/\\brdrb\\brdrs\\brdrw20\\brdrcf\d+\\brsp40/)
    expect((rtf.match(/\\brdrb\\brdrs\\brdrw20\\brdrcf\d+/g) || []).length).toBeGreaterThanOrEqual(2)
    // caption paras before code; line number "1." appears only in code (f0), after captions
    const firstCap = rtf.indexOf('\\f1\\fs')
    const firstCodeLn = rtf.indexOf('1.  ')
    expect(firstCap).toBeGreaterThan(-1)
    expect(firstCodeLn).toBeGreaterThan(firstCap)
    expect(rtf).not.toContain('\\trowd')
  })

  it('applies code inset via absolute \\tx (includes \\li); gutter stays flush', () => {
    const rtf = linesToRtf(
      [[{ text: 'abc', color: '#000000' }]],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        fontSizePt: 9,
        lineNumbers: true,
        codeInsetTwips: 567, // 1 cm per side
        pageContentTwips: 9000,
        sideMarginTwips: { left: 1134, right: 1134 }
      }
    )
    const ln = rtf.indexOf('1.  ')
    const code = rtf.indexOf('abc')
    expect(ln).toBeGreaterThan(-1)
    expect(code).toBeGreaterThan(ln)
    // Word \\tx is from page margin — must be li + gutter + inset (> li alone)
    expect(rtf).toMatch(/\\li1134\\ri1134/)
    const tx = Number(rtf.match(/\\tx(\d+)/)?.[1] || 0)
    expect(tx).toBeGreaterThan(1134 + 567)
    expect(rtf.slice(ln, code)).toContain('\\tab')
    // right pad after code (spaces)
    expect(rtf.slice(code)).toMatch(/abc\}.*\\i0 +\}/)
  })

  it('uses the same marker color for bar and line numbers', () => {
    const rtf = linesToRtf(
      [[{ text: 'x', color: '#000000' }]],
      {
        background: '#F5F5F5',
        foreground: '#000000',
        fontSizePt: 9,
        lineNumbers: true,
        accentLeft: '#C00000',
        lineNumberColor: '#C00000'
      }
    )
    // color table should only need one red entry reused by \\brdrcf and \\cf for ln
    const reds = rtf.match(/\\red192\\green0\\blue0/g) || []
    expect(reds.length).toBe(1)
    expect(rtf).toMatch(/\\brdrcf\d+/)
  })
})
