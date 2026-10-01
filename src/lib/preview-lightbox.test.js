import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import {
  canOpenPreviewLightbox,
  snapshotPreviewHtml,
  decorateLightboxHtml
} from './preview-lightbox.js'

function root(html) {
  return new JSDOM(`<!doctype html><body>${html}</body>`).window.document.body
}

describe('preview lightbox', () => {
  it('opens only when a preview sheet exists', () => {
    expect(canOpenPreviewLightbox(null)).toBe(false)
    expect(canOpenPreviewLightbox(root('<div class="preview-empty">…</div>'))).toBe(false)
    expect(canOpenPreviewLightbox(root('<div class="preview-sheet"><p>hi</p></div>'))).toBe(true)
  })

  it('snapshots the sheet outer HTML and marks it for lightbox sizing', () => {
    const snap = snapshotPreviewHtml(root('<div class="preview-sheet preview-paper"><span>x</span></div>'))
    expect(snap).toContain('preview-sheet')
    expect(snap).toContain('<span>x</span>')
    expect(decorateLightboxHtml(snap)).toContain('preview-sheet--lightbox')
    expect(decorateLightboxHtml('')).toBe('')
  })
})
