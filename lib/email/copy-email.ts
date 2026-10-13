/**
 * Clipboard helpers for Afterstem admin "Copy Email".
 * Copies branded HTML (logo + layout) + plain-text fallback for Gmail paste.
 */

import { EMAIL_LOGO_URL, EMAIL_SITE_URL, EMAIL_SUPPORT, escapeHtml as escapeHtmlShared } from '@/lib/email-html'
import { BRAND_NAME, BRAND_DOMAIN } from '@/lib/brand'
import { hasBrokenPlaceholders, normalizeGmailBody } from '@/lib/email/gmail-prepare'

export type CopyEmailMode = 'full' | 'body' | 'subject'

export type CopyEmailInput = {
  to?: string
  subject: string
  body: string
  /** Branded Afterstem HTML template (preferred for rich paste). */
  htmlBody?: string | null
  mode?: CopyEmailMode
}

export type CopyEmailResult =
  | { ok: true; plain: string; html: string; mode: CopyEmailMode }
  | { ok: false; error: string }

function escapeHtml(value: string) {
  return escapeHtmlShared(value)
}

function looksLikeHtml(value: string) {
  return /<[a-z][\s\S]*>/i.test(value)
}

/** Convert plain-text email body into simple paste-safe HTML (lists, links, paragraphs). */
export function plainTextToClipboardHtml(plain: string): string {
  const normalized = normalizeGmailBody(plain)
  const blocks = normalized.split(/\n\n+/)
  const parts: string[] = []

  for (const block of blocks) {
    const lines = block.split('\n').map((l) => l.trimEnd())
    const isList = lines.every((l) => !l.trim() || /^([•\-*]|\d+\.)\s+/.test(l.trim()))
    if (isList && lines.some((l) => l.trim())) {
      parts.push('<ul style="margin:0 0 14px;padding-left:22px;">')
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        const item = trimmed.replace(/^([•\-*]|\d+\.)\s+/, '')
        parts.push(`<li style="margin:0 0 6px;line-height:1.55;color:#3f596c;">${linkifyHtml(escapeHtml(item))}</li>`)
      }
      parts.push('</ul>')
      continue
    }

    if (lines.length === 2 && lines[0].endsWith(':') && !lines[1].endsWith(':')) {
      parts.push(
        `<p style="margin:0 0 4px;font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#7b8d9a;">${escapeHtml(lines[0])}</p>`,
        `<p style="margin:0 0 14px;font-size:14px;font-weight:700;color:#0d2d52;line-height:1.5;">${linkifyHtml(escapeHtml(lines[1]))}</p>`,
      )
      continue
    }

    const htmlLines = lines
      .map((line) => (line.trim() ? linkifyHtml(escapeHtml(line)) : '<br/>'))
      .join('<br/>')
    parts.push(`<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#5e7486;">${htmlLines}</p>`)
  }

  return parts.join('')
}

function linkifyHtml(escaped: string): string {
  return escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#177d80;text-decoration:underline;" target="_blank">$1</a>',
  )
}

/**
 * Wrap message HTML in the Afterstem branded card (logo, navy accents) for Gmail paste.
 */
export function wrapInBrandedClipboardLayout(innerHtml: string): string {
  const year = new Date().getFullYear()
  return `<div style="margin:0;padding:0;background:#edf3f6;font-family:Arial,Helvetica,sans-serif;color:#17324d;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf3f6;border-collapse:collapse;">
<tr><td align="center" style="padding:28px 12px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:22px;overflow:hidden;border-collapse:collapse;box-shadow:0 12px 36px rgba(13,45,82,.10);">
<tr><td align="center" style="padding:30px 30px 16px;">
<a href="${EMAIL_SITE_URL}/" target="_blank" rel="noopener noreferrer">
<img src="${EMAIL_LOGO_URL}" alt="${BRAND_NAME}" width="230" style="display:block;width:230px;max-width:76%;height:auto;border:0;margin:0 auto;">
</a>
</td></tr>
<tr><td style="padding:8px 42px 28px;">
${innerHtml}
</td></tr>
<tr><td style="background:#f8fafc;padding:20px 38px;text-align:center;border-top:1px solid #e6edf2;">
<div style="font-size:11px;line-height:18px;color:#94a3af;">${BRAND_NAME} · <a href="mailto:${EMAIL_SUPPORT}" style="color:#177d80;text-decoration:none;">${EMAIL_SUPPORT}</a> · <a href="${EMAIL_SITE_URL}/" style="color:#177d80;text-decoration:none;">${BRAND_DOMAIN}</a></div>
<div style="font-size:11px;line-height:18px;color:#a6b2bc;margin-top:8px;">© ${year} ${BRAND_NAME}</div>
</td></tr>
</table>
</td></tr>
</table>
</div>`
}

/**
 * Extract a Gmail-friendly HTML fragment from a full email document.
 * Keeps logo, tables, CTAs, and inline styles; drops document chrome that confuses paste.
 */
export function extractClipboardHtmlFragment(html: string): string {
  let fragment = sanitizeEmailHtml(html)

  const bodyMatch = fragment.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  if (bodyMatch) fragment = bodyMatch[1].trim()

  // Drop hidden preheaders — they show up as odd text when pasted.
  fragment = fragment.replace(
    /<div[^>]*display:\s*none[^>]*>[\s\S]*?<\/div>/gi,
    '',
  )

  // Absolute logo / asset URLs if any relative paths slipped in.
  fragment = fragment.replace(
    /src=(["'])\/(?!\/)([^"']+)\1/gi,
    `src=$1${EMAIL_SITE_URL}/$2$1`,
  )

  // Ensure the Afterstem logo is present when the fragment somehow lost it.
  if (!fragment.includes(EMAIL_LOGO_URL) && !/afterstem.*\.(png|svg|jpg)/i.test(fragment)) {
    return wrapInBrandedClipboardLayout(fragment)
  }

  return fragment
}

export function formatFullEmailPlain(input: { to?: string; subject: string; body: string }): string {
  const lines: string[] = []
  if (input.subject.trim()) {
    lines.push(`Subject: ${input.subject.trim()}`, '')
  }
  if (input.to?.trim()) {
    lines.push(`To: ${input.to.trim()}`, '')
  }
  lines.push(normalizeGmailBody(input.body))
  return lines.join('\n').trim()
}

/** Build the rich HTML that should land on the clipboard for Gmail paste. */
export function buildClipboardHtml(input: {
  body: string
  htmlBody?: string | null
}): string {
  const branded = String(input.htmlBody || '').trim()
  if (branded && looksLikeHtml(branded)) {
    return extractClipboardHtmlFragment(branded)
  }
  return wrapInBrandedClipboardLayout(plainTextToClipboardHtml(input.body))
}

export function prepareEmailForCopy(input: CopyEmailInput): CopyEmailResult {
  const mode = input.mode ?? 'full'
  const subject = String(input.subject || '').trim()
  const body = normalizeGmailBody(String(input.body || ''))
  const to = String(input.to || '').trim()

  if (mode === 'subject') {
    if (!subject) return { ok: false, error: 'Subject is empty.' }
    if (hasBrokenPlaceholders(subject)) {
      return { ok: false, error: 'Subject still has unresolved placeholders.' }
    }
    return { ok: true, plain: subject, html: escapeHtml(subject), mode }
  }

  if (!body) return { ok: false, error: 'Email body is empty.' }

  if (body.toLowerCase().includes('/documents/r/preview') || subject.toLowerCase().includes('/documents/r/preview')) {
    return { ok: false, error: 'Unable to generate candidate upload link. Please retry.' }
  }

  const htmlSource = String(input.htmlBody || '')
  if (
    hasBrokenPlaceholders(subject) ||
    hasBrokenPlaceholders(body) ||
    (htmlSource && hasBrokenPlaceholders(htmlSource))
  ) {
    return {
      ok: false,
      error: 'Email still has unresolved placeholders. Fix those before copying.',
    }
  }

  const plain =
    mode === 'body'
      ? body
      : formatFullEmailPlain({ to: to || undefined, subject, body })

  // Always prefer branded template HTML (logo + formatting) for rich paste.
  // Plain text carries Subject/To for full mode; HTML is the visual email for Gmail body paste.
  const html = sanitizeEmailHtml(buildClipboardHtml({ body, htmlBody: input.htmlBody }))

  if (!html.includes(EMAIL_LOGO_URL) && !/afterstem.*\.(png|svg|jpg)/i.test(html)) {
    // Final safety: never ship clipboard HTML without brand chrome.
    return {
      ok: true,
      plain,
      html: sanitizeEmailHtml(wrapInBrandedClipboardLayout(plainTextToClipboardHtml(body))),
      mode,
    }
  }

  return { ok: true, plain, html, mode }
}

export function sanitizeEmailHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/javascript:/gi, '')
}

function clipboardBlob(value: string, type: string) {
  return new Blob([value], { type })
}

export async function copyPreparedEmail(input: CopyEmailInput): Promise<CopyEmailResult & { method?: string }> {
  const prepared = prepareEmailForCopy(input)
  if (!prepared.ok) return prepared

  // Prefer rich clipboard (HTML + plain). Some browsers require Promise-wrapped Blobs.
  try {
    if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
      const htmlBlob = clipboardBlob(prepared.html, 'text/html')
      const plainBlob = clipboardBlob(prepared.plain, 'text/plain')
      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': htmlBlob,
            'text/plain': plainBlob,
          }),
        ])
        return { ...prepared, method: 'rich' }
      } catch {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': Promise.resolve(htmlBlob),
            'text/plain': Promise.resolve(plainBlob),
          }),
        ])
        return { ...prepared, method: 'rich' }
      }
    }
  } catch {
    // fall through
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(prepared.plain)
      return { ...prepared, method: 'plain' }
    }
  } catch {
    /* ignore */
  }

  return {
    ok: false,
    error: 'Unable to copy automatically. Select and copy the email manually.',
  }
}
