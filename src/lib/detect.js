/**
 * Paste-content kind detection: code / text / mixed.
 * Pure heuristics only (no highlight.js) so the result is deterministic and testable.
 * Key signals: fenced ``` blocks, CJK ratio, code-symbol density, indentation,
 * statement keywords, sentence-final punctuation.
 */

const CJK_RE = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u3040-\u30ff]/
const CJK_PUNCT_END_RE = /[。．！？；，、：”』」）》]/
const CODE_SYMBOL_RE = /[{}()[\];=<>+\-*/%!&|^~?:\\@#$`'"_]/g
const KEYWORD_RE =
  /\b(def|class|return|import|from|as|function|const|let|var|public|private|static|void|new|async|await|try|catch|throw|if|else|elif|for|while|switch|case|break|continue|print|package|using|namespace|struct|enum|interface|impl|fn|func|select|insert|update|delete|where|elif|end|do|then|echo|export|require|module|type|yield|pass|self|this|null|nil|true|false|None|True|False)\b/
const FENCE_RE = /^\s{0,3}(```|~~~)\s*(\S*)\s*$/
// Case-sensitive line-start keywords: prose sentences capitalize ("From …"), code does not.
const CODE_START_RE =
  /^\s*(import|from|def|class|function|const|let|var|return|print|package|using|namespace|public|private|protected|static|final|export|require|module|select|insert|update|delete|create|alter|drop|with|echo|fn|func|async|type|struct|enum|interface|end|elif|pass|throw|new)\b/

/** @param {string} text */
function countCjk(text) {
  let n = 0
  for (const ch of text) {
    if (CJK_RE.test(ch)) n += 1
  }
  return n
}

/** @param {string} text */
function countMatches(text, re) {
  const m = text.match(re)
  return m ? m.length : 0
}

/**
 * One line's vote: 'code' | 'text' | '' (abstain).
 * 加权评分制：代码信号（花括号、行尾分号、括号+运算符、符号密度）与
 * 散文信号（中文占比、中英文标点、多词英文）各自累计，高者胜、平局弃权。
 * 不用"单一结构即判"——学术散文里括号/年份引用无处不在（BERT (…)、
 * et al. (2019)、(p < 0.01)），也不搞"中文即文本"——带中文注释的代码
 * 会被误伤。评分制两头兼顾。
 * @param {string} line
 * @returns {'code'|'text'|''}
 */
export function lineVote(line) {
  const trimmed = line.trim()
  if (!trimmed) return ''
  const nonspace = [...trimmed.replace(/\s/g, '')].length
  if (!nonspace) return ''

  // 前置规则：文献条目/markdown 表格行不投票；markdown 标题/链接是文本
  if (/^\s*\[\d{1,3}\]\s/.test(line)) return 'text'
  if (/^\s*\|.*\|\s*$/.test(line)) return ''
  if (/^\s{0,3}#{1,6}\s+\S/.test(line)) return 'text'
  if (/\[[^\]\n]*\]\([^)\n]+\)/.test(trimmed)) return 'text'

  const cjk = countCjk(trimmed)
  const symbols = countMatches(trimmed, CODE_SYMBOL_RE)
  const symbolRatio = symbols / nonspace
  const cjkRatio = cjk / nonspace
  const letters = countMatches(trimmed, /[A-Za-z]/g)
  const lettersRatio = letters / nonspace
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length
  const indent = line.match(/^\s+/)?.[0].replace(/\t/g, '    ').length ?? 0

  // —— 硬规则（无歧义，直接判定）——
  if (/^\s*(\/\/|\/\*|<!--|;;)/.test(line)) return 'code'
  if (/^\s*#!\//.test(line)) return 'code' // shebang
  if (/^\s#{1,3}\s/.test(line) && !/[\u3400-\u9fff]/.test(trimmed)) return 'code' // # 注释（markdown 标题已前置返回 text）
  if (CODE_START_RE.test(line)) return 'code' // import/def/class/const/return… 行首
  if (/^\s*(<\/?[a-zA-Z][\w-]*|<!DOCTYPE)/.test(line)) return 'code'
  if (CJK_PUNCT_END_RE.test(trimmed)) return 'text' // 中文句读收尾

  // —— 加权评分：高者胜、平局弃权 ——
  let codeScore = 0
  let textScore = 0

  if (/[{}]/.test(trimmed)) codeScore += 2 // 花括号是最强代码信号
  if (/;\s*$/.test(trimmed)) codeScore += 2
  if (/[{}()[\]]/.test(trimmed) && /[=<>!+\-*/%&|]/.test(trimmed)) codeScore += 1
  if (KEYWORD_RE.test(trimmed) && symbols >= 2) codeScore += 1
  if (symbolRatio >= 0.2) codeScore += 2
  else if (symbolRatio >= 0.1) codeScore += 1
  if (indent >= 4 && symbolRatio >= 0.04) codeScore += 1

  if (cjkRatio > 0.2) textScore += 2
  if (cjkRatio > 0.5) textScore += 1
  if (/[。．！？；，、：]/.test(trimmed)) textScore += 2
  if (/[.!?]\s*$/.test(trimmed)) textScore += 1
  if (wordCount >= 5 && lettersRatio >= 0.5 && symbolRatio < 0.12) textScore += 2 // 多词英文散文
  if (/,\s/.test(trimmed)) textScore += 1 // 逗号+空格是散文节奏

  if (codeScore > textScore) return 'code'
  if (textScore > codeScore) return 'text'
  return ''
}

/**
 * @typedef {object} FenceRegion
 * @property {number} start line index (inclusive, fence line)
 * @property {number} end line index (exclusive, line after closing fence or EOF)
 * @property {string} language info string after ``` (may be '')
 * @property {boolean} closed whether an explicit closing fence was found
 */

/**
 * Locate ``` / ~~~ fenced regions.
 * @param {string[]} lines
 * @returns {FenceRegion[]}
 */
export function findFences(lines) {
  /** @type {FenceRegion[]} */
  const fences = []
  let i = 0
  while (i < lines.length) {
    const open = lines[i].match(FENCE_RE)
    if (open) {
      let j = i + 1
      let closed = false
      while (j < lines.length) {
        if (FENCE_RE.test(lines[j])) {
          closed = true
          j += 1
          break
        }
        j += 1
      }
      fences.push({ start: i, end: j, language: open[2] || '', closed })
      i = j
    } else {
      i += 1
    }
  }
  return fences
}

/**
 * @param {string} text
 * @param {{ autoDetect?: (code: string) => { language?: string, relevance?: number } | null }} [signal]
 *   可选 highlight.js 自动检测信号：结构识别不受中文注释/字符串干扰，
 *   相关度足够高时作为"代码"的加权依据。
 * @returns {{ kind: 'code'|'text'|'mixed', codeVotes: number, textVotes: number, fenceCount: number }}
 */
export function detectKind(text, signal) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  const fences = findFences(lines)

  let codeVotes = 0
  let textVotes = 0
  lines.forEach((line) => {
    const v = lineVote(line)
    if (v === 'code') codeVotes += 1
    else if (v === 'text') textVotes += 1
  })

  if (fences.length) {
    const total = lines.length
    const inFence = fences.reduce((n, f) => n + (f.end - f.start), 0)
    const outside = total - inFence
    const outsideText = lines
      .filter((_, i) => !fences.some((f) => i >= f.start && i < f.end))
      .filter((l) => l.trim()).length
    if (outsideText === 0 || outside <= 1) return { kind: 'code', codeVotes, textVotes, fenceCount: fences.length }
    return { kind: 'mixed', codeVotes, textVotes, fenceCount: fences.length }
  }

  if (codeVotes + textVotes === 0) {
    return { kind: 'text', codeVotes, textVotes, fenceCount: 0 }
  }
  let kind = 'text'
  const codeShare = codeVotes / (codeVotes + textVotes)
  if (codeShare >= 0.6) kind = 'code'

  // hljs 结构信号兜底：短片段或中文注释/字符串密集的代码投票接近时，交给语法识别。
  // 门槛要高——hljs 对 markdown/散文也会给出低相关度的语言猜测（如 csharp relevance 8）
  if (kind !== 'code' && signal?.autoDetect) {
    try {
      const r = signal.autoDetect(normalized)
      if (r && r.language && r.language !== 'plaintext' && (r.relevance ?? 0) >= 15 && codeShare >= 0.5) {
        kind = 'code'
      }
    } catch {
      /* ignore */
    }
  }
  return { kind, codeVotes, textVotes, fenceCount: 0 }
}

/**
 * 自动模式的保守判定（硬护栏）：宁可把散文留在代码模式，也绝不让代码进入文本管线。
 * 规则：
 *  - 存在围栏代码块 → 代码
 *  - 存在任何一条代码票（codeVotes ≥ 1）→ 代码
 *  - hljs 高置信识别出语言（relevance ≥ 15）→ 代码
 *  - 其余（零代码票且文本证据 ≥ 2 票）→ 文本
 * @param {string} text
 * @param {{ autoDetect?: (code: string) => { language?: string, relevance?: number } | null }} [signal]
 * @returns {'code' | 'text'}
 */
export function detectMode(text, signal) {
  const normalized = String(text ?? '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized.split('\n')
  if (findFences(lines).length) return 'code'

  let codeVotes = 0
  let textVotes = 0
  lines.forEach((line) => {
    const v = lineVote(line)
    if (v === 'code') codeVotes += 1
    else if (v === 'text') textVotes += 1
  })
  if (codeVotes > 0) return 'code'
  if (signal?.autoDetect) {
    try {
      const r = signal.autoDetect(normalized)
      if (r && r.language && r.language !== 'plaintext' && (r.relevance ?? 0) >= 15) return 'code'
    } catch {
      /* ignore */
    }
  }
  return textVotes >= 2 ? 'text' : 'code'
}
