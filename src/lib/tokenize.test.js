import { describe, expect, it } from 'vitest'
import { htmlToStyledLines, codeToStyledLines, looksLikeSql } from './tokenize.js'
import { getTheme } from '../themes.js'

describe('tokenize', () => {
  it('maps highlight.js spans onto VS Code Dark+ colors', () => {
    const html = '<span class="hljs-keyword">def</span> <span class="hljs-title function_">fib</span>()'
    const lines = htmlToStyledLines(html, getTheme('vscode-dark'))
    expect(lines).toHaveLength(1)
    expect(lines[0][0]).toMatchObject({ text: 'def', color: '#569CD6' })
    expect(lines[0][1].text).toBe(' ')
    expect(lines[0][2]).toMatchObject({ text: 'fib', color: '#DCDCAA' })
  })

  it('keeps hard newlines as separate rows', () => {
    const html = '<span class="hljs-keyword">a</span>\n<span class="hljs-keyword">b</span>'
    const lines = htmlToStyledLines(html, getTheme('vscode-light'))
    expect(lines).toHaveLength(2)
    expect(lines[0][0].text).toBe('a')
    expect(lines[1][0].text).toBe('b')
  })
})

describe('looksLikeSql / auto SQL', () => {
  it('recognizes common SQL shapes', () => {
    expect(looksLikeSql('SELECT id, name FROM users WHERE active = 1')).toBe(true)
    expect(looksLikeSql('INSERT INTO t (a) VALUES (1)')).toBe(true)
    expect(looksLikeSql('CREATE TABLE users (id INT PRIMARY KEY)')).toBe(true)
    expect(looksLikeSql('def foo():\n  return 1')).toBe(false)
  })

  it('forces sql when Auto would otherwise mis-detect', () => {
    const calls = []
    const hljs = {
      highlight(source, opts) {
        calls.push(['highlight', opts.language])
        return { value: `<span class="hljs-keyword">SELECT</span> 1`, language: opts.language }
      },
      highlightAuto() {
        calls.push(['auto'])
        return { value: 'SELECT 1', language: 'csharp' }
      }
    }
    const { language } = codeToStyledLines(
      'SELECT id FROM users WHERE id > 0',
      'auto',
      'vscode-light',
      hljs
    )
    expect(language).toBe('sql')
    expect(calls[0]).toEqual(['highlight', 'sql'])
    expect(calls.some((c) => c[0] === 'auto')).toBe(false)
  })
})
