import { isLinkRequestKey } from '@/lib/link-request-items'
import { validateHttpUrl } from '@/lib/link-request-items'

export type DocumentLinkLike = {
  externalUrl?: string | null
  mimeType?: string | null
  originalFilename?: string | null
  displayName?: string | null
  questionKey?: string | null
  category?: string | null
  description?: string | null
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"']+/gi

/** True when this CaseDocument stores one or more external URLs as text. */
export function isExternalLinkDocument(doc: DocumentLinkLike): boolean {
  if (doc.externalUrl) return true
  const filename = (doc.originalFilename || '').toLowerCase()
  const mime = (doc.mimeType || '').toLowerCase()
  if (filename.endsWith('.url.txt') || filename.endsWith('.url')) return true
  if (doc.questionKey && isLinkRequestKey(doc.questionKey)) return true
  if (mime === 'text/plain' || mime === 'text/uri-list') {
    if ((doc.category || '').toLowerCase().includes('link')) return true
    if ((doc.displayName || '').startsWith('http')) return true
  }
  return false
}

/** Extract sanitized http(s) URLs from document metadata / stored text body. */
export function extractExternalUrls(input: {
  displayName?: string | null
  description?: string | null
  bodyText?: string | null
}): string[] {
  const chunks = [input.bodyText, input.displayName, input.description].filter(Boolean) as string[]
  const found: string[] = []
  for (const chunk of chunks) {
    for (const raw of chunk.split(/[\n,\s]+/)) {
      const check = validateHttpUrl(raw.trim())
      if (check.ok) found.push(check.href)
    }
    const matches = chunk.match(URL_IN_TEXT) || []
    for (const m of matches) {
      const check = validateHttpUrl(m.replace(/[),.;]+$/, ''))
      if (check.ok) found.push(check.href)
    }
  }
  return [...new Set(found)]
}

/** URLs for a link row: the saved externalUrl, else legacy URLs parsed from metadata. */
export function linkUrlsForDocument(doc: DocumentLinkLike): string[] {
  if (doc.externalUrl) {
    const check = validateHttpUrl(doc.externalUrl)
    return check.ok ? [check.href] : []
  }
  return extractExternalUrls({ displayName: doc.displayName, description: doc.description })
}

/** Short host + path for display (no protocol clutter). */
export function formatUrlForDisplay(href: string): string {
  try {
    const u = new URL(href)
    const path = `${u.pathname}${u.search}`.replace(/\/$/, '')
    return path && path !== '/' ? `${u.host}${path}` : u.host
  } catch {
    return href
  }
}
