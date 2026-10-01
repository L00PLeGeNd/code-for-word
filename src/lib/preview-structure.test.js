import { describe, expect, it } from 'vitest'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import { codeToStyledLines } from './tokenize.js'
import { linesToWordHtml } from './word-html.js'

hljs.registerLanguage('python', python)

const SAMPLE_ZH = `def binary_search(arr, target):
    """对已排序列表进行经典二分查找。返回索引或 -1。"""
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
`

describe('sample preview structure', () => {
  it('keeps one block line per source line in preview HTML', () => {
    const { lines } = codeToStyledLines(SAMPLE_ZH, 'python', 'light-plus', hljs)
    expect(lines.length).toBeGreaterThan(10)
    const html = linesToWordHtml(lines, {
      background: '#F5F5F5',
      foreground: '#000000',
      lineNumbers: true,
      preview: true,
      accentLeft: '#007ACC'
    })
    const lineBlocks = (html.match(/class="listing-line"/g) || []).length
    expect(lineBlocks).toBe(lines.length)
    expect(html).not.toContain('<pre')
    expect(html).toContain('data-src-line="1"')
    expect(html).toContain(`data-src-line="${lines.length}"`)
  })

  it('normalizes CR-only line endings before highlight', () => {
    const cr = SAMPLE_ZH.replace(/\n/g, '\r')
    const { lines } = codeToStyledLines(cr, 'python', 'light-plus', hljs)
    expect(lines.length).toBeGreaterThan(10)
  })
})
