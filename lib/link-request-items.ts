/** Stable keys for profile / web link requests inside a document request package. */

export type LinkInputKind = 'url' | 'urls'

/** Rejected link input (bad URL, file instead of URL, missing link). Always a 400. */
export class LinkValidationError extends Error {
  status = 400
}

export type ProfileLinkOption = {
  key: string
  label: string
  category: string
  instructions: string
  inputKind: LinkInputKind
}

export const PROFILE_LINK_CATEGORY = 'Profile & links'

export const PROFILE_LINK_OPTIONS: ProfileLinkOption[] = [
  {
    key: 'github_url',
    label: 'GitHub profile URL',
    category: PROFILE_LINK_CATEGORY,
    instructions: 'Paste the full URL to your GitHub profile (https://github.com/…)',
    inputKind: 'url',
  },
  {
    key: 'linkedin_url',
    label: 'LinkedIn profile URL',
    category: PROFILE_LINK_CATEGORY,
    instructions: 'Paste the full URL to your LinkedIn profile (https://linkedin.com/in/…)',
    inputKind: 'url',
  },
  {
    key: 'other_links',
    label: 'Other links to share',
    category: PROFILE_LINK_CATEGORY,
    instructions: 'Add any other relevant links (portfolio, publications, press, personal site). One URL per line.',
    inputKind: 'urls',
  },
]

export function isLinkRequestKey(key: string): boolean {
  if (PROFILE_LINK_OPTIONS.some((o) => o.key === key)) return true
  return key.startsWith('link_')
}

export function resolveLinkInputKind(
  key: string,
  explicit?: string | null,
): LinkInputKind | 'file' {
  if (explicit === 'url' || explicit === 'urls' || explicit === 'file') return explicit
  const known = PROFILE_LINK_OPTIONS.find((o) => o.key === key)
  if (known) return known.inputKind
  if (key.startsWith('link_')) return 'url'
  return 'file'
}

export function normalizeSubmittedUrls(raw: string | string[]): string[] {
  const parts = Array.isArray(raw) ? raw : raw.split(/[\n,]+/)
  const urls: string[] = []
  for (const part of parts) {
    const value = part.trim()
    if (!value) continue
    urls.push(value)
  }
  return [...new Set(urls)]
}

/** File extensions that must never be accepted as a link (they are uploads, not URLs). */
const FILE_LIKE_SUFFIXES = new Set([
  'pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'txt', 'rtf', 'odt',
  'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'zip',
])

export const LINK_ONLY_ERROR =
  'This looks like a file name, not a link. Upload files in the Documents section; this field accepts web links (https://…) only.'

/** True for values such as "resume.pdf" or "C:\\scan.jpg" that are files, not URLs. */
export function looksLikeFileName(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^[a-z]:[\\/]/i.test(trimmed) || trimmed.includes('\\')) return true
  if (/^(file|blob|data):/i.test(trimmed)) return true
  if (/^https?:\/\//i.test(trimmed)) return false
  const host = trimmed.split(/[/?#]/)[0] ?? ''
  const suffix = host.split('.').pop()?.toLowerCase() ?? ''
  return host.includes('.') && FILE_LIKE_SUFFIXES.has(suffix)
}

export function validateHttpUrl(value: string): { ok: true; href: string } | { ok: false; error: string } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, error: 'A URL is required.' }
  if (looksLikeFileName(trimmed)) return { ok: false, error: LINK_ONLY_ERROR }
  if (/\s/.test(trimmed)) return { ok: false, error: 'A URL cannot contain spaces. Enter one link per line.' }
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  if (hasScheme && !/^https?:\/\//i.test(trimmed)) {
    return { ok: false, error: 'Only http:// and https:// links are allowed.' }
  }
  let parsed: URL
  try {
    parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
  } catch {
    return { ok: false, error: 'Enter a valid URL (including https://).' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http:// and https:// links are allowed.' }
  }
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'Links cannot include a username or password.' }
  }
  const tld = parsed.hostname.split('.').pop() ?? ''
  if (!parsed.hostname.includes('.') || !/^[a-z]{2,63}$/i.test(tld)) {
    return { ok: false, error: 'Enter a complete URL with a domain name.' }
  }
  if (FILE_LIKE_SUFFIXES.has(tld.toLowerCase())) return { ok: false, error: LINK_ONLY_ERROR }
  return { ok: true, href: parsed.toString() }
}

export function slugLinkKey(label: string) {
  const slug =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 40) || 'link'
  return `link_${slug}_${Date.now().toString(36).slice(-6)}`
}
