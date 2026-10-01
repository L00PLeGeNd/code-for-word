import { describe, expect, it } from 'vitest'
import { findAllMatches, nextMatchIndex } from './source-search.js'

describe('source-search', () => {
  it('finds all matches with 1-based line numbers', () => {
    const src = 'alpha\nbeta alpha\nALPHA'
    expect(findAllMatches(src, 'alpha')).toEqual([
      { start: 0, end: 5, line: 1 },
      { start: 11, end: 16, line: 2 },
      { start: 17, end: 22, line: 3 }
    ])
    expect(findAllMatches(src, 'alpha', { caseSensitive: true })).toEqual([
      { start: 0, end: 5, line: 1 },
      { start: 11, end: 16, line: 2 }
    ])
    expect(findAllMatches(src, '')).toEqual([])
    expect(findAllMatches(src, 'zzz')).toEqual([])
  })

  it('walks match indices circularly', () => {
    expect(nextMatchIndex(0, -1, 1)).toBe(-1)
    expect(nextMatchIndex(3, -1, 1)).toBe(0)
    expect(nextMatchIndex(3, 0, 1)).toBe(1)
    expect(nextMatchIndex(3, 2, 1)).toBe(0)
    expect(nextMatchIndex(3, -1, -1)).toBe(2)
    expect(nextMatchIndex(3, 0, -1)).toBe(2)
  })
})
