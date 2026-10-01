import { describe, expect, it } from 'vitest'
import {
  sourceLineRanges,
  srcLineFromTarget,
  focusSourceLine,
  flashSourceLine,
  flashSourceRange,
  findSourceLineForSnippet
} from './preview-nav.js'

describe('preview-nav', () => {
  it('splits source into 1-based line ranges for \\n and \\r\\n', () => {
    const a = sourceLineRanges('a\nb\nc')
    expect(a).toHaveLength(3)
    expect(a[0]).toEqual({ start: 0, end: 1, text: 'a' })
    expect(a[1]).toEqual({ start: 2, end: 3, text: 'b' })
    expect(a[2]).toEqual({ start: 4, end: 5, text: 'c' })

    const b = sourceLineRanges('x\r\ny')
    expect(b).toHaveLength(2)
    expect(b[0]).toEqual({ start: 0, end: 1, text: 'x' })
    expect(b[1]).toEqual({ start: 3, end: 4, text: 'y' })
  })

  it('reads data-src-line from the event target chain', () => {
    expect(srcLineFromTarget(null)).toBe(0)
    const row = {
      nodeType: 1,
      getAttribute: (k) => (k === 'data-src-line' ? '12' : null),
      closest(sel) {
        return sel === '[data-src-line]' ? this : null
      },
      parentElement: null
    }
    const leaf = {
      nodeType: 1,
      getAttribute: () => null,
      closest(sel) {
        return sel === '[data-src-line]' ? row : null
      },
      parentElement: row
    }
    expect(srcLineFromTarget(leaf)).toBe(12)
    expect(srcLineFromTarget(row)).toBe(12)
  })

  it('focuses a textarea on the requested line', () => {
    const calls = { focus: 0, sel: /** @type {[number, number] | null} */ (null), scroll: -1 }
    const ta = {
      value: 'one\ntwo\nthree',
      clientHeight: 200,
      focus() { calls.focus += 1 },
      setSelectionRange(a, b) { calls.sel = [a, b] },
      set scrollTop(v) { calls.scroll = v },
      get scrollTop() { return calls.scroll }
    }
    expect(focusSourceLine(/** @type {any} */ (ta), 2)).toBe(true)
    expect(calls.focus).toBe(1)
    expect(calls.sel).toEqual([4, 7])
    expect(calls.scroll).toBeGreaterThanOrEqual(0)
    expect(focusSourceLine(/** @type {any} */ (ta), 99)).toBe(false)
  })

  it('finds a snippet’s first source line', () => {
    const src = 'alpha\nbeta gamma\ndelta'
    expect(findSourceLineForSnippet(src, 'beta gamma')).toBe(2)
    expect(findSourceLineForSnippet(src, 'nope')).toBe(0)
  })

  it('flashes the textarea class after focusing a line', () => {
    const classes = new Set()
    const ta = {
      value: 'one\ntwo\nthree',
      clientHeight: 200,
      classList: {
        add(c) { classes.add(c) },
        remove(c) { classes.delete(c) }
      },
      offsetWidth: 1,
      focus() {},
      setSelectionRange() {},
      set scrollTop(_v) {},
      get scrollTop() { return 0 }
    }
    expect(flashSourceLine(/** @type {any} */ (ta), 2, { durationMs: 50 })).toBe(true)
    expect(classes.has('is-src-flash')).toBe(true)
    expect(flashSourceRange(/** @type {any} */ (ta), { start: 0, end: 3, line: 1 })).toBe(true)
  })
})
