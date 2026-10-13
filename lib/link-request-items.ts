/** Stable keys for profile / web link requests inside a document request package. */

export type LinkInputKind = 'url' | 'urls'

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

export function validateHttpUrl(value: string): { ok: true; href: string } | { ok: false; error: string } {
  const trimmed = value.trim()
  if (!trimmed) return { ok: false, error: 'A URL is required.' }
  let parsed: URL
  try {
    parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`)
  } catch {
    return { ok: false, error: 'Enter a valid URL (including https://).' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only http:// and https:// links are allowed.' }
  }
  if (!parsed.hostname || !parsed.hostname.includes('.')) {
    return { ok: false, error: 'Enter a complete URL with a domain name.' }
  }
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
