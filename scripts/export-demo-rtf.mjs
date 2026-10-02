/**
 * Export sample listing RTF for real-Word demo screenshots.
 * Usage: node scripts/export-demo-rtf.mjs [outPath]
 */
import { writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import hljs from 'highlight.js/lib/core'
import python from 'highlight.js/lib/languages/python'
import { codeToStyledLines } from '../src/lib/tokenize.js'
import { linesToRtf } from '../src/lib/rtf.js'

hljs.registerLanguage('python', python)

const SAMPLE = `def binary_search(arr, target):
    """Classic binary search on a sorted list. Returns index or -1."""
    lo, hi = 0, len(arr) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if arr[mid] == target:
            return mid
        if arr[mid] < target:
            lo = mid + 1
        else:
            hi = mid - 1
    return -1


if __name__ == "__main__":
    nums = [1, 3, 4, 7, 9, 11]
    print(binary_search(nums, 7))   # 3
    print(binary_search(nums, 4))   # -1
`

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = path.resolve(process.argv[2] || path.join(__dirname, '..', 'docs', '_demo-frames', 'demo-paste.rtf'))

const { lines } = codeToStyledLines(SAMPLE, 'python', 'vscode-light', hljs)
const rtf = linesToRtf(lines, {
  fontName: 'Consolas',
  fontSizePt: 9,
  background: '#F5F5F5',
  accentLeft: '#007ACC',
  frameStyle: 'box',
  lineNumbers: true,
  rowRules: true,
  sideMarginTwips: 1440,
  codeInsetTwips: 340
})

await mkdir(path.dirname(out), { recursive: true })
await writeFile(out, rtf, 'utf8')
console.log(`wrote ${out} (${rtf.length} chars)`)
