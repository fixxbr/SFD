/**
 * Central Gmail compose preparation for Afterstem admin.
 * Gmail compose URLs cannot attach files or inject HTML — use clean plain text.
 * Opening Gmail must never be logged as SENT.
 */

import { gmailComposeUrl as buildComposeUrl } from '@/lib/email-templates'

export type GmailPrepareInput = {
  to: string
  subject: string
  body: string
}

export type GmailPrepareResult =
  | { ok: true; url: string; to: string; subject: string; body: string }
  | { ok: false; error: string }

const PENDING_MARKERS = [
  '[payment link pending]',
  '[document link pending]',
  '{{',
  '}}',
  '/documents/r/preview',
]

/** Preserve readable paragraphs and bullet lists for Gmail compose. */
export function normalizeGmailBody(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function hasBrokenPlaceholders(text: string): boolean {
  if (/\{\{[A-Za-z0-9 _-]+\}\}/.test(text)) return true
  const lower = text.toLowerCase()
  return PENDING_MARKERS.some((m) => lower.includes(m.toLowerCase()))
}

export function prepareGmailCompose(input: GmailPrepareInput): GmailPrepareResult {
  const to = String(input.to || '').trim()
  const subject = String(input.subject || '').trim()
  const body = normalizeGmailBody(String(input.body || ''))

  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    return { ok: false, error: 'Candidate email is missing or invalid. Please add an email address before opening Gmail.' }
  }
  if (!subject) {
    return { ok: false, error: 'Email subject is required.' }
  }
  if (!body) {
    return { ok: false, error: 'Email body is empty.' }
  }
  if (hasBrokenPlaceholders(subject) || hasBrokenPlaceholders(body)) {
    return {
      ok: false,
      error: 'Email still has unresolved placeholders or a preview-only link. Fix those before opening Gmail.',
    }
  }

  const url = buildComposeUrl(to, subject, body)
  // Gmail compose URLs have practical length limits in some browsers.
  if (url.length > 7000) {
    return {
      ok: false,
      error: 'Email body is too long for Gmail compose URL. Shorten the message, then try again.',
    }
  }

  return { ok: true, url, to, subject, body }
}

/** Browser helper — opens Gmail compose in a new tab after validation. */
export function openPreparedGmail(input: GmailPrepareInput): GmailPrepareResult {
  const prepared = prepareGmailCompose(input)
  if (!prepared.ok) return prepared
  if (typeof window !== 'undefined') {
    window.open(prepared.url, '_blank', 'noopener,noreferrer')
  }
  return prepared
}

/**
 * Build a professional plain-text Gmail body from structured parts.
 * Prefer this over HTML-derived text when composing document/payment emails.
 */
export function buildStructuredGmailBody(parts: {
  greetingName: string
  paragraphs?: string[]
  bulletList?: string[]
  bulletIntro?: string
  rows?: Array<{ label: string; value: string }>
  ctaLabel?: string
  ctaHref?: string
  closing?: string
}): string {
  const lines: string[] = [`Hello ${parts.greetingName},`, '']
  for (const p of parts.paragraphs ?? []) {
    if (!p.trim()) continue
    lines.push(p.trim(), '')
  }
  if (parts.bulletList?.length) {
    if (parts.bulletIntro) lines.push(parts.bulletIntro.trim(), '')
    for (const item of parts.bulletList) lines.push(`• ${item}`)
    lines.push('')
  }
  for (const row of parts.rows ?? []) {
    lines.push(`${row.label}:`, row.value, '')
  }
  if (parts.ctaHref) {
    const label = (parts.ctaLabel || 'Continue').replace(/:$/, '')
    lines.push(`${label}:`, parts.ctaHref, '')
  }
  lines.push(
    parts.closing || 'If you have any questions, please reply to this email.',
    '',
    'Best regards,',
    'Afterstem Team',
    'clients@afterstem.ai',
  )
  return normalizeGmailBody(lines.join('\n'))
}

export { buildComposeUrl as gmailComposeUrl }
