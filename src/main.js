import './styles.css'
import hljs from 'highlight.js/lib/core'
import bash from 'highlight.js/lib/languages/bash'
import c from 'highlight.js/lib/languages/c'
import cpp from 'highlight.js/lib/languages/cpp'
import csharp from 'highlight.js/lib/languages/csharp'
import css from 'highlight.js/lib/languages/css'
import go from 'highlight.js/lib/languages/go'
import java from 'highlight.js/lib/languages/java'
import javascript from 'highlight.js/lib/languages/javascript'
import json from 'highlight.js/lib/languages/json'
import kotlin from 'highlight.js/lib/languages/kotlin'
import php from 'highlight.js/lib/languages/php'
import python from 'highlight.js/lib/languages/python'
import rust from 'highlight.js/lib/languages/rust'
import sql from 'highlight.js/lib/languages/sql'
import typescript from 'highlight.js/lib/languages/typescript'
import xml from 'highlight.js/lib/languages/xml'
import yaml from 'highlight.js/lib/languages/yaml'

import {
  FONT_OPTIONS,
  FONT_SIZE_OPTIONS,
  BACKGROUND_OPTIONS,
  PAPER_OPTIONS,
  SIDE_MARGIN_OPTIONS,
  CODE_INSET_OPTIONS,
  ACCENT_OPTIONS,
  FRAME_STYLE_OPTIONS,
  formatFontSizeLabel,
  formatFontLabel
} from './themes.js'
import {
  CAPTION_MIN_ROWS,
  CAPTION_MAX_ROWS,
  CAPTION_BACKGROUND_OPTIONS,
  CAPTION_COLOR_OPTIONS,
  DEFAULT_CAPTION_FONT,
  clampCaptionRowCount
} from './lib/caption.js'
import { resolveFrameStyle } from './lib/frame.js'
import {
  canOpenPreviewLightbox,
  snapshotPreviewHtml,
  decorateLightboxHtml
} from './lib/preview-lightbox.js'
import { srcLineFromTarget, flashSourceLine, flashSourceRange, queueAfterDialogClose } from './lib/preview-nav.js'
import { findAllMatches, nextMatchIndex } from './lib/source-search.js'
import {
  LOCALES,
  detectLocale,
  setLocale,
  t,
  getLocale,
  getLocalePreference
} from './i18n.js'
import { codeToStyledLines } from './lib/tokenize.js'
import { linesToWordHtml } from './lib/word-html.js'
import { linesToRtf } from './lib/rtf.js'
import { linesToDocxBlob } from './lib/docx.js'
import { writeClipboard, downloadBlob, clipboardHostReady } from './lib/clipboard.js'
import { parseBlocks, renumberBlocks, resolveSchemeId } from './lib/blocks.js'
import { buildPaperModel, paperParasToPlainText } from './lib/paper-format.js'
import { paperToRtf, paperToWordHtml, paperToDocxBlob } from './lib/paper-export.js'
import { translateTexts } from './lib/translate.js'
import { loadPrefs, savePrefs } from './prefs.js'
import { githubHome, openExternal } from './promo.js'

/** Fixed light theme; no theme picker. */
const THEME_ID = 'vscode-light'

hljs.registerLanguage('bash', bash)
hljs.registerLanguage('shell', bash)
hljs.registerLanguage('c', c)
hljs.registerLanguage('cpp', cpp)
hljs.registerLanguage('csharp', csharp)
hljs.registerLanguage('css', css)
hljs.registerLanguage('go', go)
hljs.registerLanguage('java', java)
hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('json', json)
hljs.registerLanguage('kotlin', kotlin)
hljs.registerLanguage('php', php)
hljs.registerLanguage('python', python)
hljs.registerLanguage('rust', rust)
hljs.registerLanguage('sql', sql)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('yaml', yaml)

const LANGS = [
  ['auto', 'Auto'],
  ['python', 'Python'],
  ['javascript', 'JavaScript'],
  ['typescript', 'TypeScript'],
  ['java', 'Java'],
  ['c', 'C'],
  ['cpp', 'C++'],
  ['csharp', 'C#'],
  ['go', 'Go'],
  ['rust', 'Rust'],
  ['kotlin', 'Kotlin'],
  ['sql', 'SQL'],
  ['bash', 'Bash / Shell'],
  ['html', 'HTML / XML'],
  ['css', 'CSS'],
  ['json', 'JSON'],
  ['yaml', 'YAML'],
  ['php', 'PHP']
]

const SAMPLE = `def binary_search(arr, target):
    """Classic binary search on a sorted list. Returns index or -1."""
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


if __name__ == "__main__":
    nums = [1, 3, 5, 7, 9, 11, 13]
    print(binary_search(nums, 7))   # 3
    print(binary_search(nums, 4))   # -1
`

const SAMPLE_TEXT = `1 引言

随着深度学习技术的发展，文本分类任务取得了显著进展。
传统方法依赖人工特征工程，泛化能力有限。

1.1 研究背景

本文提出一种端到端的分类模型，核心流程如下代码所示。

\`\`\`python
def train(model, data):
    model.fit(data)
    return model.evaluate(data)
\`\`\`

1.2 研究意义

实验表明该方法在多个数据集上均有效，并且效率极高。

2 相关工作

- 注意力机制广泛应用于自然语言处理
- 预训练语言模型显著提升下游任务表现
- 轻量化部署成为新的研究热点
`

const SCHEME_OPTIONS = [
  { id: 'academic', labelKey: 'schemeAcademic' },
  { id: 'thesis', labelKey: 'schemeThesis' },
  { id: 'official', labelKey: 'schemeOfficial' },
  { id: 'none', labelKey: 'schemeNone' }
]

const SPLIT_OPTIONS = [
  { id: 'auto', labelKey: 'splitAuto' },
  { id: 'items', labelKey: 'splitItems' },
  { id: 'lines', labelKey: 'splitLines' },
  { id: 'merge', labelKey: 'splitMerge' }
]

const LATIN_FONT_OPTIONS = ['Times New Roman', 'Arial', 'Calibri', 'Cambria', 'Georgia', 'Helvetica']

const INDENT_OPTIONS = [
  { id: '2', labelKey: 'indent2' },
  { id: '4', labelKey: 'indent4' },
  { id: '0', labelKey: 'indent0' }
]

const ALIGN_OPTIONS = [
  { id: 'justify', labelKey: 'alignJustify' },
  { id: 'left', labelKey: 'alignLeft' }
]

const BODY_AFTER_OPTIONS = [
  { id: '0', labelKey: 'after0', pt: 0 },
  { id: '6', labelKey: 'afterHalf', pt: 6 },
  { id: '12', labelKey: 'afterLine', pt: 12 }
]

const LINE_SPACING_OPTIONS = [
  { id: '1', labelKey: 'spacing1' },
  { id: '1.5', labelKey: 'spacing15' },
  { id: '2', labelKey: 'spacing2' }
]

const TRANSLATE_PROVIDERS = [
  { id: 'none', labelKey: 'translateNone' },
  { id: 'free', labelKey: 'translateFree' },
  { id: 'ai', labelKey: 'translateAI' }
]

const TRANSLATE_DIRECTIONS = [
  { id: 'auto', labelKey: 'dirAuto' },
  { id: 'en2zh', labelKey: 'dirEn2Zh' },
  { id: 'zh2en', labelKey: 'dirZh2En' }
]

const TRANSLATE_OUTPUTS = [
  { id: 'original', labelKey: 'translateOriginal' },
  { id: 'translated', labelKey: 'translateTranslated' },
  { id: 'bilingual', labelKey: 'translateBilingual' }
]

const AI_PRESETS = [
  { id: 'zhipu', labelKey: 'aiPresetZhipu', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { id: 'deepseek', labelKey: 'aiPresetDeepseek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'custom', labelKey: 'aiPresetCustom', baseUrl: '', model: '' }
]

const els = {
  language: document.getElementById('language'),
  fontFamily: document.getElementById('fontFamily'),
  fontSize: document.getElementById('fontSize'),
  background: document.getElementById('background'),
  paper: document.getElementById('paper'),
  sideMargin: document.getElementById('sideMargin'),
  codeInset: document.getElementById('codeInset'),
  accent: document.getElementById('accent'),
  uiLang: document.getElementById('uiLang'),
  forceBold: document.getElementById('forceBold'),
  forceItalic: document.getElementById('forceItalic'),
  lineNumbers: document.getElementById('lineNumbers'),
  rowRules: document.getElementById('rowRules'),
  source: document.getElementById('source'),
  preview: document.getElementById('preview'),
  previewExpand: document.getElementById('previewExpand'),
  previewLightbox: document.getElementById('previewLightbox'),
  previewLightboxBody: document.getElementById('previewLightboxBody'),
  previewLightboxClose: document.getElementById('previewLightboxClose'),
  jumpConfirm: document.getElementById('jumpConfirm'),
  jumpConfirmTitle: document.getElementById('jumpConfirmTitle'),
  jumpConfirmBody: document.getElementById('jumpConfirmBody'),
  sourceFind: document.getElementById('sourceFind'),
  sourceFindMeta: document.getElementById('sourceFindMeta'),
  sourceFindPrev: document.getElementById('sourceFindPrev'),
  sourceFindNext: document.getElementById('sourceFindNext'),
  metaSource: document.getElementById('metaSource'),
  metaPreview: document.getElementById('metaPreview'),
  status: document.getElementById('status'),
  btnDownload: document.getElementById('btnDownload'),
  btnCopy: document.getElementById('btnCopy'),
  btnSample: document.getElementById('btnSample'),
  btnClear: document.getElementById('btnClear'),
  brandHome: document.getElementById('brandHome'),
  btnGitHub: document.getElementById('btnGitHub'),
  framePicker: document.getElementById('framePicker'),
  btnFrame: document.getElementById('btnFrame'),
  framePanel: document.getElementById('framePanel'),
  frameLabel: document.getElementById('frameLabel'),
  frameThumb: document.getElementById('frameThumb'),
  captionEnabled: document.getElementById('captionEnabled'),
  captionRow: document.getElementById('captionRow'),
  captionLines: document.getElementById('captionLines'),
  captionFont: document.getElementById('captionFont'),
  captionColor: document.getElementById('captionColor'),
  captionBg: document.getElementById('captionBg'),
  captionBold: document.getElementById('captionBold'),
  captionItalic: document.getElementById('captionItalic'),
  captionAddRow: document.getElementById('captionAddRow'),
  captionRemoveRow: document.getElementById('captionRemoveRow'),
  modeSwitch: document.getElementById('modeSwitch'),
  codeToolbar: document.getElementById('codeToolbar'),
  textToolbar: document.getElementById('textToolbar'),
  translateRow: document.getElementById('translateRow'),
  aiPanel: document.getElementById('aiPanel'),
  textScheme: document.getElementById('textScheme'),
  textSplit: document.getElementById('textSplit'),
  textBodyFont: document.getElementById('textBodyFont'),
  textLatinFont: document.getElementById('textLatinFont'),
  textBodySize: document.getElementById('textBodySize'),
  textHeadingFont: document.getElementById('textHeadingFont'),
  textLineSpacing: document.getElementById('textLineSpacing'),
  textIndentChars: document.getElementById('textIndentChars'),
  textAlign: document.getElementById('textAlign'),
  textBodyAfter: document.getElementById('textBodyAfter'),
  textBold: document.getElementById('textBold'),
  textItalic: document.getElementById('textItalic'),
  textUnderline: document.getElementById('textUnderline'),
  translateProvider: document.getElementById('translateProvider'),
  translateDirection: document.getElementById('translateDirection'),
  translateOutput: document.getElementById('translateOutput'),
  autoTranslate: document.getElementById('autoTranslate'),
  btnTranslate: document.getElementById('btnTranslate'),
  btnAiSettings: document.getElementById('btnAiSettings'),
  aiPreset: document.getElementById('aiPreset'),
  aiBaseUrl: document.getElementById('aiBaseUrl'),
  aiModel: document.getElementById('aiModel'),
  aiApiKey: document.getElementById('aiApiKey'),
  btnAiSave: document.getElementById('btnAiSave'),
  sourceLabel: document.getElementById('sourceLabel')
}

/** @type {string[]} */
let captionLineValues = ['']

/** @type {import('./lib/frame.js').FrameStyle} */
let frameStyle = 'bar'
/** Hover preview override (null = use committed frameStyle). */
let frameHover = /** @type {import('./lib/frame.js').FrameStyle | null} */ (null)

let timer = 0
let hostOk = false
let exportBusy = false
/** @type {{ lines: import('./themes.js').StyledRun[][], language: string, theme: import('./themes.js').Theme } | null} */
let latest = null
let selectsReady = false

/** @type {'code' | 'text'} */
let mode = 'code'
/** @type {Map<number, string> | null} 按原始块索引存放译文 */
let translations = null
/** @type {{ source: string, provider: string, direction: string, splitMode: string } | null} 译文有效性标记 */
let translationsMeta = null
let translating = false
/** @type {{ paras: import('./lib/paper-format.js').PaperPara[], plainText: string } | null} */
let latestPaper = null
let autoTranslateTimer = 0

function setStatus(text, kind = '') {
  els.status.textContent = text
  els.status.className = `status${kind ? ` ${kind}` : ''}`
}

function applyStaticI18n() {
  document.documentElement.lang = getLocale() === 'zh' ? 'zh-CN' : getLocale()
  document.title = t('title')
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.getAttribute('data-i18n')
    if (!key) return
    node.textContent = t(key)
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach((node) => {
    const key = node.getAttribute('data-i18n-placeholder')
    if (key && 'placeholder' in node) node.placeholder = t(key)
  })
  document.querySelectorAll('[data-i18n-aria]').forEach((node) => {
    const key = node.getAttribute('data-i18n-aria')
    if (key) {
      const label = t(key)
      node.setAttribute('aria-label', label)
      if (node.hasAttribute('title') || node.matches('.preview-expand, .preview-lightbox-close')) {
        node.title = label
      }
    }
  })
  syncPreviewExpandEnabled()
}

function collectPrefs() {
  readCaptionInputs()
  return {
    language: els.language?.value || 'auto',
    fontFamily: els.fontFamily?.value || 'Consolas',
    fontSize: els.fontSize?.value || '9',
    background: els.background?.value || 'paper',
    paper: els.paper?.value || 'fit',
    sideMargin: els.sideMargin?.value || 'auto',
    codeInset: els.codeInset?.value || 'auto',
    accent: els.accent?.value || 'blue',
    forceBold: !!els.forceBold?.checked,
    forceItalic: !!els.forceItalic?.checked,
    lineNumbers: !!els.lineNumbers?.checked,
    rowRules: !!els.rowRules?.checked,
    frameStyle,
    captionEnabled: !!els.captionEnabled?.checked,
    captionFont: els.captionFont?.value || DEFAULT_CAPTION_FONT,
    captionColor: els.captionColor?.value || 'black',
    captionBg: els.captionBg?.value || 'grey',
    captionBold: !!els.captionBold?.checked,
    captionItalic: !!els.captionItalic?.checked,
    captionLines: captionLineValues.slice(),
    mode,
    textScheme: els.textScheme?.value || 'academic',
    textSplit: els.textSplit?.value || 'auto',
    textBodyFont: els.textBodyFont?.value || '宋体',
    textLatinFont: els.textLatinFont?.value || 'Times New Roman',
    textBodySize: els.textBodySize?.value || '12',
    textHeadingFont: els.textHeadingFont?.value || '黑体',
    textLineSpacing: els.textLineSpacing?.value || '1.5',
    textIndentChars: els.textIndentChars?.value || '2',
    textAlign: els.textAlign?.value || 'justify',
    textBodyAfter: els.textBodyAfter?.value || '0',
    textBold: !!els.textBold?.checked,
    textItalic: !!els.textItalic?.checked,
    textUnderline: !!els.textUnderline?.checked,
    translateProvider: els.translateProvider?.value || 'none',
    translateDirection: els.translateDirection?.value || 'auto',
    translateOutput: els.translateOutput?.value || 'original',
    autoTranslate: !!els.autoTranslate?.checked,
    aiBaseUrl: els.aiBaseUrl?.value || '',
    aiModel: els.aiModel?.value || '',
    aiApiKey: els.aiApiKey?.value || ''
  }
}

function persistPrefs() {
  savePrefs(collectPrefs())
}

/** @param {import('./prefs.js').Prefs} p */
function applyPrefs(p) {
  if (!p || !Object.keys(p).length) return
  const setVal = (el, v) => {
    if (!el || v == null || v === '') return
    el.value = String(v)
  }
  setVal(els.language, p.language)
  setVal(els.fontFamily, p.fontFamily)
  setVal(els.fontSize, p.fontSize)
  setVal(els.background, p.background)
  setVal(els.paper, p.paper)
  setVal(els.sideMargin, p.sideMargin)
  setVal(els.codeInset, p.codeInset)
  setVal(els.accent, p.accent)
  setVal(els.captionFont, p.captionFont)
  setVal(els.captionColor, p.captionColor)
  setVal(els.captionBg, p.captionBg)
  setVal(els.textScheme, p.textScheme)
  setVal(els.textSplit, p.textSplit)
  setVal(els.textBodyFont, p.textBodyFont)
  setVal(els.textLatinFont, p.textLatinFont)
  setVal(els.textBodySize, p.textBodySize)
  setVal(els.textHeadingFont, p.textHeadingFont)
  setVal(els.textLineSpacing, p.textLineSpacing)
  setVal(els.textIndentChars, p.textIndentChars)
  setVal(els.textAlign, p.textAlign)
  setVal(els.textBodyAfter, p.textBodyAfter)
  if (els.textBold) els.textBold.checked = !!p.textBold
  if (els.textItalic) els.textItalic.checked = !!p.textItalic
  if (els.textUnderline) els.textUnderline.checked = !!p.textUnderline
  setVal(els.translateProvider, p.translateProvider)
  setVal(els.translateDirection, p.translateDirection)
  setVal(els.translateOutput, p.translateOutput)
  setVal(els.aiPreset, p.aiPreset)
  setVal(els.aiBaseUrl, p.aiBaseUrl)
  setVal(els.aiModel, p.aiModel)
  setVal(els.aiApiKey, p.aiApiKey)
  // 兼容旧版布尔 textIndent
  if (p.textIndentChars == null && p.textIndent === false && els.textIndentChars) {
    els.textIndentChars.value = '0'
  }
  if (els.autoTranslate) els.autoTranslate.checked = p.autoTranslate === true
  if (p.mode) mode = p.mode === 'text' ? 'text' : 'code'
  if (els.forceBold) els.forceBold.checked = !!p.forceBold
  if (els.forceItalic) els.forceItalic.checked = !!p.forceItalic
  if (els.lineNumbers) els.lineNumbers.checked = p.lineNumbers !== false
  if (els.rowRules) els.rowRules.checked = p.rowRules !== false
  if (els.captionEnabled) els.captionEnabled.checked = !!p.captionEnabled
  if (els.captionBold) els.captionBold.checked = !!p.captionBold
  if (els.captionItalic) els.captionItalic.checked = !!p.captionItalic
  if (Array.isArray(p.captionLines) && p.captionLines.length) {
    captionLineValues = p.captionLines.map((s) => String(s ?? ''))
  }
  if (p.frameStyle) frameStyle = resolveFrameStyle(p.frameStyle)
}

function openGitHubHome() {
  openExternal(githubHome())
}

function refillFontSizes() {
  if (!els.fontSize) return
  const keep = els.fontSize.value || '9'
  els.fontSize.innerHTML = ''
  const locale = getLocale()
  for (const size of FONT_SIZE_OPTIONS) {
    const opt = document.createElement('option')
    opt.value = String(size.pt)
    opt.textContent = formatFontSizeLabel(size, locale)
    els.fontSize.appendChild(opt)
  }
  els.fontSize.value = keep
}

function fillKeyedSelect(el, options, keep, fallback) {
  if (!el) return
  el.innerHTML = ''
  for (const item of options) {
    const opt = document.createElement('option')
    opt.value = item.id
    opt.textContent = t(item.labelKey)
    el.appendChild(opt)
  }
  el.value = keep || fallback
  if (![...el.options].some((o) => o.value === el.value)) el.value = fallback
}

function refillLabeledSelects() {
  const keepBg = els.background?.value || 'paper'
  const keepPaper = els.paper?.value || 'fit'
  const keepMargin = els.sideMargin?.value || 'auto'
  const keepCodeInset = els.codeInset?.value || 'auto'
  const keepAccent = els.accent?.value || 'blue'
  const keepUi = getLocalePreference()

  if (els.uiLang) {
    els.uiLang.innerHTML = ''
    for (const loc of LOCALES) {
      const opt = document.createElement('option')
      opt.value = loc.id
      opt.textContent = loc.labelKey ? t(loc.labelKey) : loc.label
      els.uiLang.appendChild(opt)
    }
    els.uiLang.value = keepUi
  }

  fillKeyedSelect(els.background, BACKGROUND_OPTIONS, keepBg, 'paper')
  fillKeyedSelect(els.paper, PAPER_OPTIONS, keepPaper, 'fit')
  fillKeyedSelect(els.sideMargin, SIDE_MARGIN_OPTIONS, keepMargin, 'auto')
  fillKeyedSelect(els.codeInset, CODE_INSET_OPTIONS, keepCodeInset, 'auto')
  fillKeyedSelect(els.accent, ACCENT_OPTIONS, keepAccent, 'blue')
  const keepCapBg = els.captionBg?.value || 'grey'
  const keepCapColor = els.captionColor?.value || 'black'
  fillKeyedSelect(els.captionBg, CAPTION_BACKGROUND_OPTIONS, keepCapBg, 'grey')
  fillKeyedSelect(els.captionColor, CAPTION_COLOR_OPTIONS, keepCapColor, 'black')
  refillTextSelects()
  refillFontSizes()
  refillFontSelects()
  syncCaptionLineLabels()
}

/** 文本模式选项下拉（编号/分段/字体字号/行距/缩进/对齐/段距/翻译） */
function refillTextSelects() {
  fillKeyedSelect(els.textScheme, SCHEME_OPTIONS, els.textScheme?.value || 'academic', 'academic')
  fillKeyedSelect(els.textSplit, SPLIT_OPTIONS, els.textSplit?.value || 'auto', 'auto')
  fillKeyedSelect(els.textLineSpacing, LINE_SPACING_OPTIONS, els.textLineSpacing?.value || '1.5', '1.5')
  fillKeyedSelect(els.textIndentChars, INDENT_OPTIONS, els.textIndentChars?.value || '2', '2')
  fillKeyedSelect(els.textAlign, ALIGN_OPTIONS, els.textAlign?.value || 'justify', 'justify')
  fillKeyedSelect(els.textBodyAfter, BODY_AFTER_OPTIONS, els.textBodyAfter?.value || '0', '0')
  fillKeyedSelect(els.translateProvider, TRANSLATE_PROVIDERS, els.translateProvider?.value || 'none', 'none')
  fillKeyedSelect(els.translateDirection, TRANSLATE_DIRECTIONS, els.translateDirection?.value || 'auto', 'auto')
  fillKeyedSelect(els.translateOutput, TRANSLATE_OUTPUTS, els.translateOutput?.value || 'original', 'original')
  fillKeyedSelect(els.aiPreset, AI_PRESETS, els.aiPreset?.value || 'zhipu', 'zhipu')

  for (const [el, keep, fallback] of [
    [els.textBodyFont, els.textBodyFont?.value || '宋体', '宋体'],
    [els.textHeadingFont, els.textHeadingFont?.value || '黑体', '黑体']
  ]) {
    if (!el) continue
    const current = el.value || keep
    el.innerHTML = ''
    for (const font of FONT_OPTIONS) {
      const opt = document.createElement('option')
      opt.value = font.id
      opt.textContent = formatFontLabel(font, t)
      el.appendChild(opt)
    }
    el.value = FONT_OPTIONS.some((f) => f.id === current) ? current : fallback
  }

  if (els.textLatinFont) {
    const keep = els.textLatinFont.value || 'Times New Roman'
    els.textLatinFont.innerHTML = ''
    for (const font of LATIN_FONT_OPTIONS) {
      const opt = document.createElement('option')
      opt.value = font
      opt.textContent = font
      els.textLatinFont.appendChild(opt)
    }
    els.textLatinFont.value = LATIN_FONT_OPTIONS.includes(keep) ? keep : 'Times New Roman'
  }

  if (els.textBodySize) {
    const keep = els.textBodySize.value || '12'
    els.textBodySize.innerHTML = ''
    const locale = getLocale()
    for (const size of FONT_SIZE_OPTIONS) {
      const opt = document.createElement('option')
      opt.value = String(size.pt)
      opt.textContent = formatFontSizeLabel(size, locale)
      els.textBodySize.appendChild(opt)
    }
    els.textBodySize.value = FONT_SIZE_OPTIONS.some((s) => String(s.pt) === keep) ? keep : '12'
  }
}

function refillFontSelects() {
  const keepCode = els.fontFamily?.value || 'Consolas'
  const keepCap = els.captionFont?.value || DEFAULT_CAPTION_FONT
  for (const [el, keep, fallback] of [
    [els.fontFamily, keepCode, 'Consolas'],
    [els.captionFont, keepCap, DEFAULT_CAPTION_FONT]
  ]) {
    if (!el) continue
    el.innerHTML = ''
    for (const font of FONT_OPTIONS) {
      const opt = document.createElement('option')
      opt.value = font.id
      opt.textContent = formatFontLabel(font, t)
      el.appendChild(opt)
    }
    el.value = FONT_OPTIONS.some((f) => f.id === keep) ? keep : fallback
  }
}

function fillSelects() {
  if (!selectsReady) {
    for (const [id, label] of LANGS) {
      const opt = document.createElement('option')
      opt.value = id
      opt.textContent = id === 'auto' ? (getLocale() === 'zh' ? '自动检测' : 'Auto') : label
      els.language.appendChild(opt)
    }
    selectsReady = true
  } else if (els.language?.options[0]) {
    els.language.options[0].textContent = getLocale() === 'zh' ? '自动检测' : 'Auto'
  }
  refillLabeledSelects()
}

function resolveBackground(theme) {
  const id = els.background?.value || 'paper'
  const preset = BACKGROUND_OPTIONS.find((b) => b.id === id)
  if (!preset || preset.color == null) return theme?.background || '#F5F5F5'
  return preset.color
}

function resolveSideMarginTwips() {
  const id = els.sideMargin?.value || 'auto'
  const preset = SIDE_MARGIN_OPTIONS.find((s) => s.id === id)
  if (!preset || preset.twips == null) return null
  return { left: preset.twips, right: preset.twips }
}

function resolveCodeInsetTwipsOption() {
  const id = els.codeInset?.value || 'auto'
  const preset = CODE_INSET_OPTIONS.find((s) => s.id === id)
  if (!preset || preset.twips == null) return null
  return preset.twips
}

function resolvePageContentTwips() {
  const id = els.paper?.value || 'fit'
  const preset = PAPER_OPTIONS.find((p) => p.id === id)
  if (!preset) return null
  return preset.contentTwips
}

function resolveAccent() {
  const id = els.accent?.value || 'blue'
  return ACCENT_OPTIONS.find((a) => a.id === id)?.color || '#007ACC'
}

function currentOptions() {
  readCaptionInputs()
  const theme = latest?.theme || { mode: 'light', foreground: '#000000', lineNumber: '#237893', accentLeft: '#007ACC' }
  const background = resolveBackground(theme)
  const noFill = background === 'none'
  const darkPaper = !noFill && /^#1[Ee]1[Ee]1[Ee]$/i.test(background)
  const marker = resolveAccent()
  return {
    background: noFill ? 'none' : background,
    noFill,
    foreground: darkPaper ? '#D4D4D4' : (theme.foreground || '#000000'),
    // Accent: bar + line numbers share marker
    lineNumberColor: marker,
    accentLeft: marker,
    fontName: els.fontFamily?.value || 'Consolas',
    fontSizePt: Number(els.fontSize.value) || 9,
    lineNumbers: els.lineNumbers.checked,
    rowRules: els.rowRules ? els.rowRules.checked : true,
    lineNumberSuffix: '.',
    frameStyle: frameHover || frameStyle,
    forceBold: !!els.forceBold?.checked,
    forceItalic: !!els.forceItalic?.checked,
    sideMarginTwips: resolveSideMarginTwips(),
    pageContentTwips: resolvePageContentTwips(),
    paperId: els.paper?.value || 'fit',
    codeInsetTwips: resolveCodeInsetTwipsOption(),
    captionEnabled: !!els.captionEnabled?.checked,
    captionLines: captionLineValues.slice(),
    captionFont: els.captionFont?.value || DEFAULT_CAPTION_FONT,
    captionBackground: CAPTION_BACKGROUND_OPTIONS.find((b) => b.id === (els.captionBg?.value || 'grey'))?.color
      || '#D9D9D9',
    captionColor: CAPTION_COLOR_OPTIONS.find((c) => c.id === (els.captionColor?.value || 'black'))?.color
      || '#000000',
    captionBold: !!els.captionBold?.checked,
    captionItalic: !!els.captionItalic?.checked,
    captionPlaceholder: t('captionPlaceholder')
  }
}

function readCaptionInputs() {
  if (!els.captionLines) return
  const inputs = els.captionLines.querySelectorAll('input[data-caption-line]')
  captionLineValues = Array.from(inputs).map((el) => /** @type {HTMLInputElement} */ (el).value)
  if (!captionLineValues.length) captionLineValues = ['']
}

function syncCaptionLineLabels() {
  if (!els.captionLines) return
  els.captionLines.querySelectorAll('[data-caption-label]').forEach((node, i) => {
    node.textContent = t('captionRowN', { n: i + 1 })
  })
  els.captionLines.querySelectorAll('input[data-caption-line]').forEach((node) => {
    if ('placeholder' in node) /** @type {HTMLInputElement} */ (node).placeholder = t('captionPlaceholder')
  })
}

function renderCaptionLineEditors(focusIndex = -1) {
  if (!els.captionLines) return
  const n = clampCaptionRowCount(captionLineValues.length)
  while (captionLineValues.length < n) captionLineValues.push('')
  captionLineValues = captionLineValues.slice(0, n)
  els.captionLines.innerHTML = ''
  captionLineValues.forEach((value, i) => {
    const label = document.createElement('label')
    label.className = 'caption-field'
    const span = document.createElement('span')
    span.dataset.captionLabel = '1'
    span.textContent = t('captionRowN', { n: i + 1 })
    const input = document.createElement('input')
    input.type = 'text'
    input.maxLength = 200
    input.autocomplete = 'off'
    input.dataset.captionLine = String(i)
    input.value = value
    input.placeholder = t('captionPlaceholder')
    input.addEventListener('input', () => {
      readCaptionInputs()
      persistPrefs()
      scheduleRender()
    })
    label.appendChild(span)
    label.appendChild(input)
    els.captionLines.appendChild(label)
  })
  if (els.captionAddRow) els.captionAddRow.disabled = captionLineValues.length >= CAPTION_MAX_ROWS
  if (els.captionRemoveRow) els.captionRemoveRow.disabled = captionLineValues.length <= CAPTION_MIN_ROWS
  if (focusIndex >= 0) {
    const el = els.captionLines.querySelector(`input[data-caption-line="${focusIndex}"]`)
    /** @type {HTMLInputElement | null} */ (el)?.focus()
  }
}

function syncCaptionRow(focus = false) {
  const on = !!els.captionEnabled?.checked
  if (els.captionRow) els.captionRow.hidden = !on
  if (on) {
    renderCaptionLineEditors(focus ? 0 : -1)
  }
}

function addCaptionRow() {
  readCaptionInputs()
  if (captionLineValues.length >= CAPTION_MAX_ROWS) return
  captionLineValues.push('')
  renderCaptionLineEditors(captionLineValues.length - 1)
  scheduleRender()
}

function removeCaptionRow() {
  readCaptionInputs()
  if (captionLineValues.length <= CAPTION_MIN_ROWS) return
  captionLineValues.pop()
  renderCaptionLineEditors()
  scheduleRender()
}

function syncFramePicker() {
  const key = FRAME_STYLE_OPTIONS.find((f) => f.id === frameStyle)?.labelKey || 'frameBar'
  if (els.frameLabel) els.frameLabel.textContent = t(key)
  if (els.frameThumb) els.frameThumb.dataset.frame = frameStyle
  els.framePanel?.querySelectorAll('.frame-option').forEach((btn) => {
    const id = btn.getAttribute('data-frame')
    const on = id === frameStyle
    btn.setAttribute('aria-selected', on ? 'true' : 'false')
    btn.classList.toggle('is-active', on)
  })
}

function closeFramePanel() {
  if (!els.framePanel) return
  els.framePanel.hidden = true
  els.btnFrame?.setAttribute('aria-expanded', 'false')
}

function openFramePanel() {
  if (!els.framePanel) return
  els.framePanel.hidden = false
  els.btnFrame?.setAttribute('aria-expanded', 'true')
}

function setFrameStyle(id) {
  frameStyle = resolveFrameStyle(id)
  syncFramePicker()
  closeFramePanel()
  persistPrefs()
  renderPreview()
}

function countStats(code) {
  if (!code) return { lines: 0, chars: 0 }
  const normalized = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = normalized === '' ? 0 : normalized.replace(/\n$/, '').split('\n').length
  return { lines, chars: [...normalized].length }
}

/** 当前工作模式：仅代码 / 文本，由用户显式切换 */
function effectiveMode() {
  return mode === 'text' ? 'text' : 'code'
}

function setMode(next, options = {}) {
  const target = next === 'text' ? 'text' : 'code'
  if (target !== mode) {
    translations = null
    translationsMeta = null
  }
  mode = target
  els.modeSwitch?.querySelectorAll('.mode-btn').forEach((btn) => {
    const on = btn.getAttribute('data-mode') === mode
    btn.classList.toggle('is-active', on)
    btn.setAttribute('aria-pressed', on ? 'true' : 'false')
  })
  syncModeUI()
  if (options.persist !== false) persistPrefs()
  renderPreview()
}

/** 上次同步时的有效模式；未变化时跳过重建（避免题注输入框每次渲染丢焦点） */
let syncedEff = null

function syncModeUI() {
  const eff = effectiveMode()
  if (eff === syncedEff) {
    syncTranslateButton()
    return
  }
  syncedEff = eff
  if (els.codeToolbar) els.codeToolbar.hidden = eff !== 'code'
  if (els.textToolbar) els.textToolbar.hidden = eff !== 'text'
  if (els.translateRow) els.translateRow.hidden = eff !== 'text'
  if (eff !== 'text' && els.aiPanel) els.aiPanel.hidden = true
  if (eff !== 'code' && els.captionRow) els.captionRow.hidden = true
  else if (eff === 'code') syncCaptionRow()
  if (els.sourceLabel) els.sourceLabel.textContent = t(eff === 'text' ? 'sourceText' : 'source')
  if (els.source) els.source.placeholder = t(eff === 'text' ? 'placeholderText' : 'placeholder')
  syncTranslateButton()
}

function syncTranslateButton() {
  if (!els.btnTranslate) return
  const provider = els.translateProvider?.value || 'none'
  const enabled = effectiveMode() === 'text'
    && provider !== 'none'
    && !!els.source.value.trim()
    && !translating
  els.btnTranslate.disabled = !enabled
  if (els.translateOutput) els.translateOutput.disabled = provider === 'none'
}

/** 当前是否可用译文（引擎、方向与原文匹配才有效） */
function activeTranslations() {
  const provider = els.translateProvider?.value || 'none'
  const direction = els.translateDirection?.value || 'auto'
  const output = els.translateOutput?.value || 'original'
  if (provider === 'none' || output === 'original') return null
  if (!translations || !translationsMeta) return null
  if (translationsMeta.source !== els.source.value) return null
  if (translationsMeta.provider !== provider) return null
  if (translationsMeta.direction !== direction) return null
  const splitMode = ['items', 'merge', 'lines'].includes(els.textSplit?.value) ? els.textSplit.value : 'auto'
  if (translationsMeta.splitMode !== splitMode) return null // 分段方式变了：块索引已变，旧译文全部失效
  return translations
}

/** 文本模式排版选项（buildPaperModel 用） */
function paperFormatOptions() {
  return {
    scheme: resolveSchemeId(els.textScheme?.value),
    bodyFont: els.textBodyFont?.value || '宋体',
    latinFont: els.textLatinFont?.value || 'Times New Roman',
    bodySizePt: Number(els.textBodySize?.value) || 12,
    headingFont: els.textHeadingFont?.value || '黑体',
    lineSpacing: Number(els.textLineSpacing?.value) || 1.5,
    firstLineIndentChars: Number(els.textIndentChars?.value ?? '2') || 0,
    justify: (els.textAlign?.value || 'justify') === 'justify',
    bodyAfterPt: Number(els.textBodyAfter?.value) || 0,
    bodyBold: !!els.textBold?.checked,
    bodyItalic: !!els.textItalic?.checked,
    bodyUnderline: !!els.textUnderline?.checked,
    translateOutput: els.translateOutput?.value || 'original',
    translations: activeTranslations(),
    codeCaptionLabel: getLocale() === 'zh' ? '代码' : 'Code',
    highlight: (code, language) => codeToStyledLines(code, language || 'auto', THEME_ID, hljs).lines,
    code: {
      fontName: els.fontFamily?.value || 'Consolas',
      fontSizePt: Math.max(9, Math.min(Number(els.fontSize?.value) || 10.5, 12)),
      lineNumbers: !!els.lineNumbers?.checked
    }
  }
}

/** 嵌入代码块的导出选项（复用代码模式的底色/边框/标识色设置） */
function paperExportOptions() {
  const id = els.background?.value || 'paper'
  const preset = BACKGROUND_OPTIONS.find((b) => b.id === id)
  const noFill = preset?.color === 'none'
  const color = noFill ? 'none' : (preset?.color || '#F5F5F5')
  return {
    background: color,
    codeBackground: noFill ? '#FFFFFF' : (color === 'none' ? '#F5F5F5' : color),
    codeNoFill: noFill,
    noFill,
    accentLeft: resolveAccent(),
    lineNumbers: !!els.lineNumbers?.checked,
    frameStyle: frameHover || frameStyle,
    paperId: els.paper?.value || 'fit',
    sideMarginTwips: resolveSideMarginTwips(),
    pageContentTwips: resolvePageContentTwips()
  }
}

/** 文本模式：解析 + 编号 + 建模（渲染与导出共用） */
function buildPaperFromSource() {
  const source = els.source.value
  const splitMode = ['items', 'merge', 'lines'].includes(els.textSplit?.value)
    ? els.textSplit.value
    : 'auto'
  const blocks = renumberBlocks(parseBlocks(source, { splitMode }), resolveSchemeId(els.textScheme?.value))
  const paras = buildPaperModel(blocks, paperFormatOptions())
  return { blocks, paras, plainText: paperParasToPlainText(paras) }
}

function renderPreview() {
  const code = els.source.value
  const eff = effectiveMode()
  const { lines, chars } = countStats(code)
  els.metaSource.textContent = code ? t('metaCount', { lines, chars }) : t(eff === 'text' ? 'sourceText' : 'source')

  const wrap = els.preview
  if (!code.trim()) {
    latest = null
    latestPaper = null
    wrap.dataset.mode = 'light'
    wrap.style.background = ''
    wrap.innerHTML = `<div class="preview-empty">${t('previewEmpty')}</div>`
    els.metaPreview.textContent = t('preview')
    syncModeUI()
    syncPreviewExpandEnabled()
    closePreviewLightbox()
    return
  }

  if (eff === 'code') {
    latest = codeToStyledLines(code, els.language.value, THEME_ID, hljs)
    const opts = currentOptions()
    const sizeOpt = FONT_SIZE_OPTIONS.find((o) => o.pt === opts.fontSizePt)
    const sizeLabel = sizeOpt ? formatFontSizeLabel(sizeOpt, getLocale()) : `${opts.fontSizePt} pt`
    els.metaPreview.textContent = `${latest.language} · ${opts.fontName} · ${sizeLabel}`
    wrap.dataset.mode = !opts.noFill && /^#1[Ee]1[Ee]1[Ee]$/i.test(opts.background) ? 'dark' : 'light'
    wrap.style.background = ''
    wrap.innerHTML = `<div class="preview-sheet">${linesToWordHtml(latest.lines, {
      ...opts,
      preview: true,
      captionPlaceholder: t('captionPlaceholder')
    })}</div>`
    syncModeUI()
    syncPreviewExpandEnabled()
    refreshLightboxIfOpen()
    return
  }

  // 文本 / 论文管线
  latest = null
  const built = buildPaperFromSource()
  latestPaper = { paras: built.paras, plainText: built.plainText }
  const fmt = paperFormatOptions()
  const schemeId = resolveSchemeId(els.textScheme?.value)
  const schemeLabel = t(SCHEME_OPTIONS.find((s) => s.id === schemeId)?.labelKey || 'schemeAcademic')
  const sizeOpt = FONT_SIZE_OPTIONS.find((o) => o.pt === fmt.bodySizePt)
  const sizeLabel = sizeOpt ? formatFontSizeLabel(sizeOpt, getLocale()) : `${fmt.bodySizePt} pt`
  els.metaPreview.textContent = `${schemeLabel} · ${fmt.bodyFont} · ${sizeLabel}`
  wrap.dataset.mode = 'light'
  wrap.style.background = ''
  wrap.innerHTML = `<div class="preview-sheet preview-paper">${paperToWordHtml(built.paras, {
    ...paperExportOptions(),
    preview: true,
    sourceText: code
  })}</div>`
  syncModeUI()
  syncPreviewExpandEnabled()
  refreshLightboxIfOpen()
  scheduleAutoTranslate()
}

function isPreviewLightboxOpen() {
  const dlg = els.previewLightbox
  return !!(dlg && (dlg.open || dlg.hasAttribute('open')))
}

function syncPreviewExpandEnabled() {
  const btn = els.previewExpand
  if (!btn) return
  const ok = canOpenPreviewLightbox(els.preview)
  btn.disabled = !ok
  btn.setAttribute('aria-disabled', ok ? 'false' : 'true')
}

function fillLightboxBody() {
  if (!els.previewLightboxBody) return
  const html = decorateLightboxHtml(snapshotPreviewHtml(els.preview))
  els.previewLightboxBody.innerHTML = html || `<div class="preview-empty">${t('previewEmpty')}</div>`
  const mode = els.preview?.dataset.mode || 'light'
  els.previewLightboxBody.dataset.mode = mode
}

function openPreviewLightbox() {
  if (!canOpenPreviewLightbox(els.preview) || !els.previewLightbox) return
  fillLightboxBody()
  if (typeof els.previewLightbox.showModal === 'function') {
    if (!els.previewLightbox.open) els.previewLightbox.showModal()
  } else {
    els.previewLightbox.setAttribute('open', '')
  }
  els.previewExpand?.setAttribute('aria-expanded', 'true')
  queueMicrotask(() => els.previewLightboxClose?.focus())
}

function closePreviewLightbox() {
  const dlg = els.previewLightbox
  if (!dlg) return
  if (typeof dlg.close === 'function' && dlg.open) dlg.close()
  else dlg.removeAttribute('open')
  els.previewExpand?.setAttribute('aria-expanded', 'false')
}

function refreshLightboxIfOpen() {
  if (!isPreviewLightboxOpen()) return
  if (!canOpenPreviewLightbox(els.preview)) {
    closePreviewLightbox()
    return
  }
  fillLightboxBody()
}

/** @type {number} */
let pendingJumpLine = 0

/**
 * @param {number} line
 */
function revealSourceLine(line) {
  if (!line) return
  const lightbox = els.previewLightbox
  const go = () => flashSourceLine(els.source, line)
  if (lightbox?.open) {
    // Close after arming the listener; delay so Electron clears inert/focus.
    queueAfterDialogClose(lightbox, go, { delayMs: 80, fallbackMs: 350 })
    closePreviewLightbox()
    return
  }
  queueAfterDialogClose(null, go, { delayMs: 16, fallbackMs: 0 })
}

/**
 * @param {number} line
 */
function askJumpToSource(line) {
  if (!line || !els.source?.value) return
  pendingJumpLine = line
  if (els.jumpConfirmTitle) {
    els.jumpConfirmTitle.textContent = t('jumpConfirmTitle', { n: line })
  }
  if (els.jumpConfirmBody) {
    els.jumpConfirmBody.textContent = t('jumpConfirmBody')
  }
  const dlg = els.jumpConfirm
  if (!dlg) {
    if (window.confirm(t('jumpConfirmTitle', { n: line }))) {
      revealSourceLine(line)
    }
    return
  }
  dlg.dataset.jumpLine = String(line)
  dlg.returnValue = ''
  if (typeof dlg.showModal === 'function') {
    if (!dlg.open) dlg.showModal()
  } else {
    dlg.setAttribute('open', '')
  }
}

/**
 * @param {Event} e
 */
function onPreviewPointer(e) {
  const root = /** @type {Element | null} */ (e.currentTarget)
  if (!root) return
  if (e.type === 'mouseover') {
    const lineEl = /** @type {Element | null} */ (
      e.target instanceof Element ? e.target.closest('[data-src-line]') : null
    )
    root.querySelectorAll('.is-src-hover').forEach((n) => {
      if (n !== lineEl) n.classList.remove('is-src-hover')
    })
    lineEl?.classList.add('is-src-hover')
    return
  }
  if (e.type === 'mouseleave') {
    root.querySelectorAll('.is-src-hover').forEach((n) => n.classList.remove('is-src-hover'))
    return
  }
  if (e.type === 'dblclick') {
    const line = srcLineFromTarget(e.target)
    if (!line) return
    e.preventDefault()
    askJumpToSource(line)
  }
}

function bindPreviewNav(root) {
  if (!root || root.dataset.navBound === '1') return
  root.dataset.navBound = '1'
  root.addEventListener('mouseover', onPreviewPointer)
  root.addEventListener('mouseleave', onPreviewPointer)
  root.addEventListener('dblclick', onPreviewPointer)
}

/** @type {{ query: string, matches: import('./lib/source-search.js').SourceMatch[], index: number }} */
const sourceFindState = { query: '', matches: [], index: -1 }

function updateSourceFindMeta() {
  if (!els.sourceFindMeta) return
  const n = sourceFindState.matches.length
  if (!sourceFindState.query) {
    els.sourceFindMeta.textContent = ''
  } else if (!n) {
    els.sourceFindMeta.textContent = t('sourceFindNone')
  } else {
    els.sourceFindMeta.textContent = t('sourceFindMeta', {
      current: sourceFindState.index + 1,
      total: n
    })
  }
  const disabled = n < 1
  if (els.sourceFindPrev) els.sourceFindPrev.disabled = disabled
  if (els.sourceFindNext) els.sourceFindNext.disabled = disabled
}

function refreshSourceFindMatches() {
  const query = String(els.sourceFind?.value ?? '')
  sourceFindState.query = query
  sourceFindState.matches = findAllMatches(els.source?.value || '', query)
  if (!sourceFindState.matches.length) {
    sourceFindState.index = -1
  } else if (sourceFindState.index < 0 || sourceFindState.index >= sourceFindState.matches.length) {
    sourceFindState.index = 0
  }
  updateSourceFindMeta()
}

/**
 * @param {1 | -1} direction
 * @param {{ fromStart?: boolean }} [opts]
 */
function goSourceFind(direction, opts = {}) {
  refreshSourceFindMatches()
  const count = sourceFindState.matches.length
  if (!count) {
    updateSourceFindMeta()
    return
  }
  const current = opts.fromStart ? -1 : sourceFindState.index
  sourceFindState.index = nextMatchIndex(count, current, direction)
  const match = sourceFindState.matches[sourceFindState.index]
  if (match) flashSourceRange(els.source, match)
  updateSourceFindMeta()
}

function bindSourceFind() {
  if (!els.sourceFind) return
  els.sourceFind.addEventListener('input', () => {
    refreshSourceFindMatches()
    if (sourceFindState.matches.length) {
      sourceFindState.index = 0
      flashSourceRange(els.source, sourceFindState.matches[0])
      updateSourceFindMeta()
    }
  })
  els.sourceFind.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      goSourceFind(e.shiftKey ? -1 : 1)
    } else if (e.key === 'Escape') {
      els.sourceFind.value = ''
      refreshSourceFindMatches()
      els.source?.focus()
    }
  })
  els.sourceFindPrev?.addEventListener('click', () => goSourceFind(-1))
  els.sourceFindNext?.addEventListener('click', () => goSourceFind(1))
  els.source?.addEventListener('input', () => {
    if (sourceFindState.query) refreshSourceFindMatches()
  })
  document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'f') return
    if (!els.sourceFind) return
    const tag = (e.target instanceof Element ? e.target.tagName : '').toLowerCase()
    // Allow Ctrl+F from editor / preview; skip when typing in other inputs except source itself.
    if (tag === 'input' && e.target !== els.sourceFind && e.target !== els.source) return
    if (tag === 'select' || tag === 'button') return
    e.preventDefault()
    els.sourceFind.focus()
    els.sourceFind.select()
  })
  updateSourceFindMeta()
}

function scheduleRender() {
  clearTimeout(timer)
  timer = setTimeout(renderPreview, 80)
}

async function refreshHost() {
  hostOk = await clipboardHostReady()
}

async function copyToWord() {
  if (exportBusy) return
  if (!els.source.value.trim()) {
    setStatus(t('statusNeedCode'), 'err')
    return
  }
  exportBusy = true
  renderPreview()
  const eff = effectiveMode()
  const desktop = typeof window !== 'undefined' ? window.codepasteDesktop : null
  const skipHtml = !!desktop?.isDesktop // 桌面端走原生 RTF 通道，无需生成 HTML
  try {
    let result
    if (eff === 'text' && latestPaper) {
      const exportOpts = paperExportOptions()
      const rtf = paperToRtf(latestPaper.paras, exportOpts)
      const html = skipHtml ? '' : paperToWordHtml(latestPaper.paras, exportOpts)
      result = await writeClipboard({ rtf, html, plain: latestPaper.plainText })
    } else {
      const opts = currentOptions()
      const rtf = linesToRtf(latest.lines, opts)
      const html = skipHtml ? '' : linesToWordHtml(latest.lines, opts)
      result = await writeClipboard({ rtf, html, plain: els.source.value })
    }
    if (result.via === 'native-rtf') setStatus(t('statusCopied'), 'ok')
    else if (
      result.via === 'browser-html' ||
      result.via === 'execCommand' ||
      result.via === 'browser-text'
    ) {
      setStatus(t('statusCopyWeb'), 'ok')
    } else setStatus(t('statusCopyFallback'), 'err')
  } catch (err) {
    console.error(err)
    setStatus(t('statusCopyFail'), 'err')
  } finally {
    exportBusy = false
  }
}

function stampName() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

/** 桌面端经主进程 IPC 代理（绕过 CORS）；网页端直连（仅支持允许跨域的接口） */
function makeTranslateFetch() {
  const desktop = typeof window !== 'undefined' ? window.codepasteDesktop : null
  if (desktop?.netFetch) {
    return async (url, init = {}) => {
      const r = await desktop.netFetch(url, {
        method: init.method || 'GET',
        headers: init.headers,
        body: typeof init.body === 'string' ? init.body : undefined
      })
      if (r && typeof r.text === 'string') {
        return { ok: !!r.ok, status: r.status || 0, json: async () => JSON.parse(r.text) }
      }
      throw new Error('proxy-error')
    }
  }
  return undefined
}

/** @param {string} code */
function translateErrorText(code) {
  if (code === 'ai-not-configured') return t('errAiNotConfigured')
  const m = code.match(/^ai-http-(\d+)$/)
  if (m) return t('errAiHttp', { status: m[1] })
  if (code === 'ai-network') return t('errAiNetwork')
  if (code === 'ai-timeout') return t('errAiTimeout')
  if (code === 'ai-parse') return t('errAiNetwork')
  if (code === 'free-all-failed') return t('errFreeAll')
  if (code === 'free-failed') return t('statusTranslatePartial')
  return t('statusTranslateFail')
}

/** 块级译文缓存：相同文本块不重翻（改一个字只重翻该块，省配额提速） */
const translationCache = new Map()

async function runTranslation({ auto = false } = {}) {
  if (translating) return
  const provider = els.translateProvider?.value || 'none'
  if (provider === 'none') return
  const source = els.source.value
  if (!source.trim()) return
  const direction = els.translateDirection?.value || 'auto'
  const output = els.translateOutput?.value || 'original'
  const splitMode = ['items', 'merge', 'lines'].includes(els.textSplit?.value)
    ? els.textSplit.value
    : 'auto'

  if (provider === 'ai' && !(els.aiBaseUrl?.value && els.aiApiKey?.value)) {
    if (auto) return
    if (els.aiPanel) els.aiPanel.hidden = false
    setStatus(t('errAiNotConfigured'), 'err')
    return
  }

  const blocks = parseBlocks(source, { splitMode })
  /** @type {number[]} */
  const idxs = []
  /** @type {string[]} */
  const texts = []
  blocks.forEach((b, i) => {
    if ((b.kind === 'title' || b.kind === 'heading' || b.kind === 'paragraph' || b.kind === 'item') && b.text.trim()) {
      idxs.push(i)
      texts.push(b.text)
    }
  })
  if (!texts.length) {
    if (!auto) setStatus(t('statusTranslateFail'), 'err')
    return
  }

  // 免费引擎首用隐私提示：先记录，翻译完成后展示（避免被"翻译中…"状态覆盖）
  const firstFreeUse = provider === 'free' && !localStorage.getItem('codepaste-privacy-ack')
  if (firstFreeUse) localStorage.setItem('codepaste-privacy-ack', '1')

  // 命中缓存的块直接复用；只翻译未命中的块
  const cacheKey = (text) => `${provider}|${direction}|${text}`
  /** @type {string[]} */
  const pendingTexts = []
  /** @type {number[]} */
  const pendingIdxs = []
  const cached = new Map()
  texts.forEach((text, k) => {
    const hit = translationCache.get(cacheKey(text))
    if (hit != null) cached.set(k, hit)
    else {
      pendingTexts.push(text)
      pendingIdxs.push(k)
    }
  })

  translating = true
  syncTranslateButton()
  if (pendingTexts.length && (!auto || pendingTexts.length <= 2 || cached.size === 0)) {
    setStatus(provider === 'ai'
      ? t('statusTranslatingAi')
      : t('statusTranslating', { done: 0, total: pendingTexts.length }))
  }
  try {
    if (pendingTexts.length) {
      const result = await translateTexts(pendingTexts, {
        provider,
        direction,
        ai: {
          baseUrl: els.aiBaseUrl?.value || '',
          apiKey: els.aiApiKey?.value || '',
          model: els.aiModel?.value || ''
        },
        fetchImpl: makeTranslateFetch(),
        onProgress: (done, total) => setStatus(t('statusTranslating', { done, total }))
      })
      pendingTexts.forEach((text, k) => {
        const translated = result.translations[k]
        // 失败轮不写缓存：否则原文会被当成译文缓存住，重试永远命中坏结果
        if (!result.error) translationCache.set(cacheKey(text), translated)
      })
      // auto 模式也如实报告：否则状态永远停在"翻译中…"，用户不知道失败
      if (result.error) {
        setStatus(translateErrorText(result.error), result.error === 'free-failed' ? '' : 'err')
      } else {
        setStatus(firstFreeUse ? t('privacyHint') : t('statusTranslated'), 'ok')
      }
    } else if (!auto) {
      setStatus(t('statusTranslated'), 'ok')
    }
    // 汇总全量结果（缓存 + 新翻）
    const finalTranslations = texts.map((text, k) =>
      cached.has(k) ? cached.get(k) : translationCache.get(cacheKey(text)))
    const map = new Map()
    idxs.forEach((blockIndex, k) => map.set(blockIndex, finalTranslations[k]))
    translations = map
    translationsMeta = { source, provider, direction, splitMode }
    renderPreview()
  } catch (err) {
    console.error(err)
    if (!auto) setStatus(t('statusTranslateFail'), 'err')
  } finally {
    translating = false
    syncTranslateButton()
  }
}

/** 粘贴稳定后自动翻译（默认开启；仅译文/双语且缓存失效时触发） */
function scheduleAutoTranslate() {
  clearTimeout(autoTranslateTimer)
  autoTranslateTimer = setTimeout(() => {
    const provider = els.translateProvider?.value || 'none'
    const output = els.translateOutput?.value || 'original'
    if (effectiveMode() !== 'text') return
    if (provider === 'none' || output === 'original') return
    if (!els.autoTranslate?.checked) return
    if (!els.source.value.trim() || translating) return
    if (activeTranslations()) return
    if (provider === 'ai' && !(els.aiBaseUrl?.value && els.aiApiKey?.value)) return
    runTranslation({ auto: true })
  }, 900)
}

async function downloadDocx() {
  if (exportBusy) return
  if (!els.source.value.trim()) {
    setStatus(t('statusNeedCode'), 'err')
    return
  }
  exportBusy = true
  renderPreview()
  const eff = effectiveMode()
  try {
    if (eff === 'text' && latestPaper) {
      const blob = await paperToDocxBlob(latestPaper.paras, paperExportOptions())
      downloadBlob(blob, `paper-${stampName()}.docx`)
    } else {
      const blob = await linesToDocxBlob(latest.lines, currentOptions())
      downloadBlob(blob, `listing-${stampName()}.docx`)
    }
    setStatus(t('statusDocx'), 'ok')
  } catch (err) {
    console.error(err)
    setStatus(t('statusDocxFail'), 'err')
  } finally {
    exportBusy = false
  }
}

function syncDesktopLocale() {
  const desktop = typeof window !== 'undefined' ? window.codepasteDesktop : null
  if (desktop?.setLocale) {
    desktop.setLocale(getLocale()).catch(() => {})
  }
}

function applyLocale(id) {
  setLocale(id)
  localStorage.setItem('codepaste-locale', getLocalePreference())
  applyStaticI18n()
  fillSelects()
  syncFramePicker()
  syncModeUI()
  refreshHost()
  renderPreview()
  syncDesktopLocale()
}

/** 网页版（GitHub Pages）剪贴板质量不稳：主推「下载 DOCX」；桌面版两个都是主按钮 */
function syncActionButtons() {
  if (!els.btnCopy || !els.btnDownload) return
  const desktop = typeof window !== 'undefined' && window.codepasteDesktop?.isDesktop
  const localHttp = typeof location !== 'undefined'
    && location.protocol === 'http:'
    && ['localhost', '127.0.0.1'].includes(location.hostname)
  const preferDownload = !(desktop || localHttp)
  els.btnCopy.classList.toggle('ghost', preferDownload)
  els.btnCopy.classList.toggle('primary', !preferDownload)
}

const startLocale = detectLocale()
setLocale(startLocale)
fillSelects()
applyStaticI18n()
syncDesktopLocale()
const savedPrefs = loadPrefs()
if (Object.keys(savedPrefs).length) {
  applyPrefs(savedPrefs)
} else {
  if (els.background) els.background.value = 'paper'
  if (els.sideMargin) els.sideMargin.value = 'auto'
  if (els.codeInset) els.codeInset.value = 'auto'
  if (els.accent) els.accent.value = 'blue'
  if (els.language) els.language.value = 'auto'
  els.lineNumbers.checked = true
  if (els.captionEnabled) els.captionEnabled.checked = false
}
syncFramePicker()
syncCaptionRow()
setMode(mode, { persist: false })
syncActionButtons()

function onSettingChange() {
  persistPrefs()
  renderPreview()
}

els.source.addEventListener('input', scheduleRender)
els.language.addEventListener('change', onSettingChange)
els.fontFamily?.addEventListener('change', onSettingChange)
els.fontSize.addEventListener('change', onSettingChange)
els.background?.addEventListener('change', onSettingChange)
els.paper?.addEventListener('change', onSettingChange)
els.sideMargin?.addEventListener('change', onSettingChange)
els.codeInset?.addEventListener('change', onSettingChange)
els.accent?.addEventListener('change', onSettingChange)
els.forceBold?.addEventListener('change', onSettingChange)
els.forceItalic?.addEventListener('change', onSettingChange)
els.lineNumbers.addEventListener('change', onSettingChange)
els.rowRules?.addEventListener('change', onSettingChange)
els.captionEnabled?.addEventListener('change', () => {
  syncCaptionRow(true)
  onSettingChange()
})
els.captionFont?.addEventListener('change', onSettingChange)
els.captionColor?.addEventListener('change', onSettingChange)
els.captionBg?.addEventListener('change', onSettingChange)
els.captionBold?.addEventListener('change', onSettingChange)
els.captionItalic?.addEventListener('change', onSettingChange)
els.captionAddRow?.addEventListener('click', () => {
  addCaptionRow()
  persistPrefs()
})
els.captionRemoveRow?.addEventListener('click', () => {
  removeCaptionRow()
  persistPrefs()
})
els.uiLang?.addEventListener('change', () => applyLocale(els.uiLang.value))
els.btnCopy.addEventListener('click', copyToWord)
els.btnDownload?.addEventListener('click', downloadDocx)
els.brandHome?.addEventListener('click', openGitHubHome)
els.btnGitHub?.addEventListener('click', openGitHubHome)
els.previewExpand?.addEventListener('click', () => openPreviewLightbox())
els.previewLightboxClose?.addEventListener('click', () => closePreviewLightbox())
els.previewLightbox?.addEventListener('cancel', (e) => {
  e.preventDefault()
  closePreviewLightbox()
})
els.previewLightbox?.addEventListener('click', (e) => {
  if (e.target === els.previewLightbox) closePreviewLightbox()
})
els.jumpConfirm?.addEventListener('close', () => {
  const dlg = els.jumpConfirm
  const ok = dlg?.returnValue === 'ok'
  const line = Number(dlg?.dataset.jumpLine || pendingJumpLine || 0)
  pendingJumpLine = 0
  if (dlg) delete dlg.dataset.jumpLine
  if (!ok || !line) return
  revealSourceLine(line)
})
bindPreviewNav(els.preview)
bindPreviewNav(els.previewLightboxBody)
syncPreviewExpandEnabled()
bindSourceFind()

// 模式切换（代码 / 文本）
els.modeSwitch?.querySelectorAll('.mode-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    setMode(btn.getAttribute('data-mode') || 'code')
  })
})

// 文本模式设置
const onTextSettingChange = () => {
  persistPrefs()
  renderPreview()
}
for (const el of [
  els.textScheme, els.textSplit, els.textBodyFont, els.textLatinFont, els.textBodySize,
  els.textHeadingFont, els.textLineSpacing, els.textIndentChars,
  els.textAlign, els.textBodyAfter, els.translateDirection, els.translateOutput
]) {
  el?.addEventListener('change', onTextSettingChange)
}
for (const el of [els.textBold, els.textItalic, els.textUnderline]) {
  el?.addEventListener('change', onTextSettingChange)
}
/** AI 面板展开时按预设预填接口地址/模型，用户只需贴 Key */
function prefillAiDefaults() {
  if (els.aiBaseUrl?.value) return
  const preset = AI_PRESETS.find((p) => p.id === (els.aiPreset?.value || 'zhipu'))
  if (preset && preset.baseUrl) {
    if (els.aiBaseUrl) els.aiBaseUrl.value = preset.baseUrl
    if (els.aiModel && !els.aiModel.value) els.aiModel.value = preset.model
  }
}

els.translateProvider?.addEventListener('change', () => {
  // 选 AI 翻译即展开设置（并预填）；离开 AI 自动收起
  if (els.aiPanel) {
    if (els.translateProvider.value === 'ai') {
      prefillAiDefaults()
      els.aiPanel.hidden = false
    } else {
      els.aiPanel.hidden = true
    }
  }
  syncTranslateButton()
  onTextSettingChange()
})
els.autoTranslate?.addEventListener('change', onTextSettingChange)
els.btnTranslate?.addEventListener('click', () => runTranslation())

// AI 设置面板
els.btnAiSettings?.addEventListener('click', () => {
  if (!els.aiPanel) return
  if (!els.aiPanel.hidden) {
    els.aiPanel.hidden = true
    return
  }
  prefillAiDefaults()
  els.aiPanel.hidden = false
})
els.aiPreset?.addEventListener('change', () => {
  const preset = AI_PRESETS.find((p) => p.id === els.aiPreset.value)
  if (preset && preset.id !== 'custom') {
    if (els.aiBaseUrl) els.aiBaseUrl.value = preset.baseUrl
    if (els.aiModel) els.aiModel.value = preset.model
  }
})
els.btnAiSave?.addEventListener('click', () => {
  persistPrefs()
  if (els.aiPanel) els.aiPanel.hidden = true
  setStatus(t('aiSaved'), 'ok')
})

els.btnFrame?.addEventListener('click', (e) => {
  e.stopPropagation()
  if (els.framePanel?.hidden) openFramePanel()
  else closeFramePanel()
})
els.framePanel?.querySelectorAll('.frame-option').forEach((btn) => {
  btn.addEventListener('mouseenter', () => {
    const id = btn.getAttribute('data-frame')
    if (!id) return
    frameHover = resolveFrameStyle(id)
    renderPreview()
  })
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    frameHover = null
    setFrameStyle(btn.getAttribute('data-frame') || 'bar')
  })
})
els.framePanel?.addEventListener('mouseleave', () => {
  frameHover = null
  renderPreview()
})
document.addEventListener('click', (e) => {
  if (!els.framePicker?.contains(/** @type {Node} */ (e.target))) closeFramePanel()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeFramePanel()
})
els.btnSample.addEventListener('click', () => {
  const eff = effectiveMode()
  if (eff === 'text') {
    els.source.value = SAMPLE_TEXT
  } else {
    els.source.value = SAMPLE
    els.language.value = 'python'
  }
  renderPreview()
  setStatus(t('statusSample'))
})
els.btnClear.addEventListener('click', () => {
  els.source.value = ''
  renderPreview()
  setStatus('')
})

els.source.addEventListener('keydown', (e) => {
  if (e.key !== 'Tab') return
  e.preventDefault()
  const start = els.source.selectionStart
  const end = els.source.selectionEnd
  const v = els.source.value
  els.source.value = `${v.slice(0, start)}    ${v.slice(end)}`
  els.source.selectionStart = els.source.selectionEnd = start + 4
  scheduleRender()
})

renderPreview()
refreshHost()
setInterval(refreshHost, 8000)

// Desktop app menu → same actions as toolbar buttons
if (typeof window !== 'undefined' && window.codepasteDesktop?.onMenuAction) {
  window.codepasteDesktop.onMenuAction((action) => {
    if (action === 'copy-to-word') {
      els.btnCopy?.click()
      return
    }
    if (action === 'download-docx') {
      els.btnDownload?.click()
    }
  })
}

/** README demo capture helpers: ?demo=1 then call window.__codepasteDemo(step) */
function delay(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

const DEMO_CURSOR_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">' +
  '<path fill="#111" d="M5 2.5v20.2l5.1-5 3.1 7.4 2.8-1.2-3.1-7.3H19z"/>' +
  '<path fill="#fff" stroke="#111" stroke-width="1.1" d="M6.2 4.2v16.1l4.2-4.1 2.7 6.4 1.7-.7-2.7-6.3h5.9z"/>' +
  '</svg>'

function ensureDemoCursor() {
  let el = document.getElementById('__demo-cursor')
  if (!el) {
    el = document.createElement('div')
    el.id = '__demo-cursor'
    el.innerHTML = DEMO_CURSOR_SVG
    Object.assign(el.style, {
      position: 'fixed',
      left: '0px',
      top: '0px',
      width: '28px',
      height: '28px',
      margin: '0',
      padding: '0',
      pointerEvents: 'none',
      zIndex: '2147483647',
      filter: 'drop-shadow(0 1px 1px rgba(0,0,0,.35))',
      transform: 'translate(-2px, -1px)',
      willChange: 'left, top'
    })
    document.documentElement.appendChild(el)
  }
  return el
}

function demoSetCursor(x, y) {
  const el = ensureDemoCursor()
  el.style.left = `${Math.round(x)}px`
  el.style.top = `${Math.round(y)}px`
  return { x, y }
}

function demoTargetPoint(sel, ox = 0.55, oy = 0.55) {
  const node = typeof sel === 'string' ? document.querySelector(sel) : sel
  if (!node) return null
  const r = node.getBoundingClientRect()
  return {
    x: r.left + r.width * ox,
    y: r.top + r.height * oy,
    rect: { left: r.left, top: r.top, width: r.width, height: r.height }
  }
}

function demoResetDefaults() {
  if (els.captionEnabled) els.captionEnabled.checked = false
  if (els.forceBold) els.forceBold.checked = false
  if (els.forceItalic) els.forceItalic.checked = false
  if (els.lineNumbers) els.lineNumbers.checked = true
  if (els.background) els.background.value = 'paper'
  if (els.paper) els.paper.value = 'a4'
  if (els.sideMargin) els.sideMargin.value = 'auto'
  if (els.codeInset) els.codeInset.value = 'auto'
  if (els.accent) els.accent.value = 'blue'
  if (els.fontSize) els.fontSize.value = '9'
  frameStyle = 'bar'
  syncFramePicker()
  syncCaptionRow()
  closeFramePanel()
}

async function demoStep(step) {
  ensureDemoCursor()
  switch (step) {
    case 0: {
      demoResetDefaults()
      els.source.value = ''
      setStatus('')
      renderPreview()
      const p = demoTargetPoint('#btnSample', 0.4, 2.4) || { x: 640, y: 120 }
      demoSetCursor(p.x, p.y)
      break
    }
    case 1: {
      demoResetDefaults()
      els.source.value = ''
      setStatus('')
      renderPreview()
      const p = demoTargetPoint('#btnSample') || { x: 700, y: 48 }
      demoSetCursor(p.x, p.y)
      break
    }
    case 2: {
      demoResetDefaults()
      els.source.value = SAMPLE
      els.language.value = 'python'
      renderPreview()
      setStatus(t('statusSample'))
      const p = demoTargetPoint('#btnSample') || { x: 700, y: 48 }
      demoSetCursor(p.x, p.y)
      break
    }
    case 3: {
      const p = demoTargetPoint('#btnCopy') || { x: 1180, y: 48 }
      demoSetCursor(p.x, p.y)
      break
    }
    case 4: {
      setStatus(t('statusCopied'), 'ok')
      const p = demoTargetPoint('#btnCopy') || { x: 1180, y: 48 }
      demoSetCursor(p.x, p.y)
      break
    }
    case 5: {
      closeFramePanel()
      const p = demoTargetPoint('#btnFrame') || { x: 900, y: 100 }
      demoSetCursor(p.x, p.y)
      break
    }
    case 6: {
      openFramePanel()
      await delay(40)
      const p = demoTargetPoint('#framePanel [data-frame="box"]') || demoTargetPoint('#btnFrame')
      if (p) demoSetCursor(p.x, p.y)
      break
    }
    case 7: {
      frameStyle = 'box'
      syncFramePicker()
      closeFramePanel()
      renderPreview()
      setStatus(t('statusCopied'), 'ok')
      const p = demoTargetPoint('#btnFrame') || { x: 900, y: 100 }
      demoSetCursor(p.x, p.y)
      break
    }
    default:
      break
  }
  await delay(40)
  return step
}

/** Instant cursor move for interpolated GIF frames (no CSS transition = no stutter). */
function demoCursorAt(x, y) {
  return demoSetCursor(x, y)
}

function demoTargets() {
  const pick = (sel, ox, oy) => {
    const p = demoTargetPoint(sel, ox, oy)
    return p ? { x: p.x, y: p.y } : null
  }
  return {
    sample: pick('#btnSample'),
    copy: pick('#btnCopy'),
    frame: pick('#btnFrame'),
    boxOption: pick('#framePanel [data-frame="box"]'),
    idle: pick('#btnSample', 0.4, 2.4)
  }
}

function demoLerp(a, b, t) {
  const e = t * t * (3 - 2 * t) // smoothstep
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
}

const DEMO_FRAME_COUNT = 34

/**
 * App UI storyboard for README GIF (fullscreen + visible cursor, English UI).
 * Real Word paste frames are captured separately (scripts/capture-word-demo.ps1)
 * and appended by scripts/build-demo-gif.py.
 *
 * 0–1 empty · 2 hover Sample · 3–4 sample loaded
 * 5–16 move → Copy · 17–18 on Copy · 19–21 copied
 * 22–29 move → Border · 30 on Border · 31–32 open+Box · 33 box done
 */
async function demoFrame(index) {
  ensureDemoCursor()
  const ease = (from, to, t) => {
    if (!from || !to) return
    const p = demoLerp(from, to, t)
    demoSetCursor(p.x, p.y)
  }
  const total = DEMO_FRAME_COUNT
  const i = Math.max(0, Math.min(index, total - 1))

  if (i <= 1) {
    await demoStep(0)
    return { index: i, total, holdMs: i === 0 ? 900 : 700 }
  }
  if (i === 2) {
    await demoStep(1)
    return { index: i, total, holdMs: 650 }
  }
  if (i <= 4) {
    await demoStep(2)
    return { index: i, total, holdMs: i === 3 ? 900 : 750 }
  }
  if (i <= 16) {
    await demoStep(2)
    const tg = demoTargets()
    ease(tg.sample, tg.copy, (i - 4) / 12)
    return { index: i, total, holdMs: 55 }
  }
  if (i <= 18) {
    await demoStep(3)
    return { index: i, total, holdMs: 500 }
  }
  if (i <= 21) {
    await demoStep(4)
    return { index: i, total, holdMs: i === 19 ? 700 : 850 }
  }
  if (i <= 29) {
    await demoStep(4)
    const tg = demoTargets()
    ease(tg.copy, tg.frame, (i - 21) / 8)
    return { index: i, total, holdMs: 55 }
  }
  if (i === 30) {
    await demoStep(5)
    return { index: i, total, holdMs: 550 }
  }
  if (i <= 32) {
    await demoStep(6)
    return { index: i, total, holdMs: i === 31 ? 650 : 800 }
  }
  await demoStep(7)
  return { index: i, total, holdMs: 1100 }
}

if (typeof window !== 'undefined') {
  window.__codepasteDemo = demoStep
  window.__codepasteDemoCursorAt = demoCursorAt
  window.__codepasteDemoTargets = demoTargets
  window.__codepasteDemoFrame = demoFrame
  window.__codepasteDemoFrameCount = DEMO_FRAME_COUNT
  const demo = new URLSearchParams(location.search).get('demo')
  if (demo === '1') {
    // Stable README capture: English UI only
    document.documentElement.classList.add('demo-capture')
    applyLocale('en')
    if (els.uiLang) els.uiLang.value = 'en'
    demoStep(0)
  }
}
