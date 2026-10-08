import { describe, expect, it } from 'vitest'
import {
  resolveFrameStyle,
  rtfParaBorders,
  cssFrameBorders,
  cssCaptionBorders,
  cssCodeBorders,
  cssOuterTableBorders,
  cssCaptionDivider,
  cssStackedRowBorders
} from './frame.js'

describe('frameStyle', () => {
  it('defaults unknown ids to bar', () => {
    expect(resolveFrameStyle(undefined)).toBe('bar')
    expect(resolveFrameStyle('nope')).toBe('bar')
    expect(resolveFrameStyle('rails')).toBe('rails')
    expect(resolveFrameStyle('box')).toBe('box')
  })

  it('bar is left border only', () => {
    const rtf = rtfParaBorders('bar', 4, 0, 3)
    expect(rtf).toContain('\\brdrl')
    expect(rtf).not.toContain('\\brdrr')
    expect(rtf).not.toContain('\\brdrt')
    expect(cssFrameBorders('bar', '#C00000').borderRight).toBeUndefined()
  })

  it('rails has left and right, no top/bottom', () => {
    const rtf = rtfParaBorders('rails', 4, 1, 3)
    expect(rtf).toMatch(/\\brdrl\\brdrs/)
    expect(rtf).toMatch(/\\brdrr\\brdrs/)
    expect(rtf).not.toContain('\\brdrt')
    expect(rtf).not.toContain('\\brdrb')
    const css = cssFrameBorders('rails', '#007ACC')
    expect(css.borderLeft).toContain('#007ACC')
    expect(css.borderRight).toContain('#007ACC')
  })

  it('box uses multi-line paragraph borders via css; rtfParaBorders empty for box lines', () => {
    expect(rtfParaBorders('box', 4, 0, 3)).toBe('')
    expect(rtfParaBorders('box', 4, 2, 3)).toBe('')
    expect(cssFrameBorders('box', '#007ACC').border).toContain('solid')
  })

  it('caption+code CSS borders keep continuous sides without outer wrapper', () => {
    const cap = cssCaptionBorders('box', '#007ACC', true)
    expect(cap.borderTop).toContain('#007ACC')
    expect(cap.borderBottom).toContain('1pt')
    expect(cap.borderLeft).toContain('#007ACC')
    const code = cssCodeBorders('box', '#007ACC', true)
    expect(code.borderTop).toBe('none')
    expect(code.borderBottom).toContain('#007ACC')
    expect(code.borderLeft).toContain('#007ACC')
    expect(cssCodeBorders('bar', '#007ACC', false).border).toBe('none')
  })

  it('outer table borders + caption divider avoid per-cell side seams', () => {
    const outer = cssOuterTableBorders('box', '#C00000')
    expect(outer.border).toContain('2.25pt solid #C00000')
    expect(cssOuterTableBorders('rails', '#007ACC').borderRight).toContain('#007ACC')
    expect(cssOuterTableBorders('bar', '#007ACC').borderRight).toBeUndefined()
    const div = cssCaptionDivider('#C00000')
    expect(div.border).toBe('none')
    expect(div.borderBottom).toBe('1pt solid #C00000')
    expect(div.borderLeft).toBeUndefined()
  })

  it('stacked caption/code rows put outer top and bottom on different cells', () => {
    const top = cssStackedRowBorders('box', '#007ACC', { top: true, divider: true })
    expect(top.borderTop).toBe('2.25pt solid #007ACC')
    expect(top.borderBottom).toBe('1pt solid #007ACC')
    expect(top.borderLeft).toBe('2.25pt solid #007ACC')
    const bottom = cssStackedRowBorders('box', '#007ACC', { bottom: true })
    expect(bottom.borderTop).toBe('none')
    expect(bottom.borderBottom).toBe('2.25pt solid #007ACC')
    expect(bottom.borderRight).toBe('2.25pt solid #007ACC')
  })
})
