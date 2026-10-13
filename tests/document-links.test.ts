import { describe, expect, it } from 'vitest'
import {
  extractExternalUrls,
  formatUrlForDisplay,
  isExternalLinkDocument,
} from '@/lib/document-links'

describe('document link helpers', () => {
  it('detects .url.txt link documents', () => {
    expect(
      isExternalLinkDocument({
        mimeType: 'text/plain',
        originalFilename: 'linkedin_url.url.txt',
        questionKey: 'linkedin_url',
      }),
    ).toBe(true)
  })

  it('does not treat normal PDFs as links', () => {
    expect(
      isExternalLinkDocument({
        mimeType: 'application/pdf',
        originalFilename: 'passport.pdf',
        questionKey: 'passport',
      }),
    ).toBe(false)
  })

  it('extracts and sanitizes URLs from display metadata', () => {
    const urls = extractExternalUrls({
      displayName: 'https://linkedin.com/in/example',
      description: 'Submitted link: https://linkedin.com/in/example',
    })
    expect(urls.length).toBeGreaterThanOrEqual(1)
    expect(urls[0]).toMatch(/^https:\/\//)
  })

  it('formats URLs for display without protocol clutter', () => {
    expect(formatUrlForDisplay('https://linkedin.com/in/example/')).toBe('linkedin.com/in/example')
  })
})
