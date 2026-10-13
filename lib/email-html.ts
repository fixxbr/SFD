/**
 * MASTER Afterstem email design system.
 * Visual foundation taken from the production document-request + finance templates:
 * logo 230px, 640px card, 22px radius, teal pill, Georgia headlines, navy CTA.
 * Do not replace this with a generic layout.
 */
import { BRAND_NAME, CLIENT_FROM_EMAIL, BRAND_DOMAIN } from '@/lib/brand'

export const EMAIL_LOGO_URL = 'https://www.afterstem.ai/afterstem-full.png'
export const EMAIL_SITE_URL = `https://www.${BRAND_DOMAIN}`
export const EMAIL_FROM_NAME = `${BRAND_NAME} Team`
export const EMAIL_SUPPORT = CLIENT_FROM_EMAIL

export type EmailInfoRow = { label: string; value: string }

export function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

/** Shared logo header — identical to existing document/finance emails. */
export function emailLogoHeader() {
  return `<tr><td align="center" style="padding:30px 30px 16px;">
<a href="${EMAIL_SITE_URL}/" target="_blank">
<img src="${EMAIL_LOGO_URL}" alt="${BRAND_NAME}" width="230" style="display:block;width:230px;max-width:76%;height:auto;border:0;margin:0 auto;">
</a>
</td></tr>`
}

export function emailBadgeHeadline(badge: string, headline: string) {
  return `<tr><td style="padding:8px 42px 0;text-align:center;">
<div style="display:inline-block;background:#e8f8f7;color:#177d80;font-size:11px;line-height:16px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;padding:8px 12px;border-radius:999px;">${escapeHtml(badge)}</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:35px;line-height:43px;font-weight:700;color:#0d2d52;margin:18px auto 12px;">${escapeHtml(headline)}</div>
</td></tr>`
}

export function emailGreeting(clientName: string, introHtml: string) {
  return `<tr><td style="padding:18px 42px 8px;">
<div style="font-size:17px;line-height:27px;color:#17324d;">Hi <strong>${escapeHtml(clientName)}</strong>,</div>
<div style="font-size:15px;line-height:26px;color:#5e7486;margin-top:12px;">${introHtml}</div>
</td></tr>`
}

export function emailInfoCard(rows: EmailInfoRow[]) {
  if (!rows.length) return ''
  const body = rows
    .map((row, i) => {
      const pad = i === 0 ? 'padding-bottom:6px;' : 'padding-top:6px;'
      return `<tr>
<td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#7b8d9a;${pad}">${escapeHtml(row.label)}</td>
<td align="right" style="font-size:14px;font-weight:700;color:#0d2d52;${pad}">${escapeHtml(row.value)}</td>
</tr>`
    })
    .join('')
  return `<tr><td style="padding:18px 42px 8px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7fafc;border:1px solid #e1e9ee;border-radius:14px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${body}</table>
</td></tr></table></td></tr>`
}

export function emailAmountCard(label: string, amount: string, meta?: string) {
  return `<tr><td style="padding:18px 42px 8px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#0d2d52;border-radius:14px;">
<tr><td style="padding:22px 24px;text-align:center;">
<div style="font-size:11px;letter-spacing:1.4px;text-transform:uppercase;font-weight:700;color:#5EEAD4;">${escapeHtml(label)}</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:44px;font-weight:700;color:#ffffff;margin-top:8px;">${escapeHtml(amount)}</div>
${meta ? `<div style="font-size:13px;line-height:20px;color:#b7c6d4;margin-top:8px;">${escapeHtml(meta)}</div>` : ''}
</td></tr></table></td></tr>`
}

export function emailSection(title: string, subtitle: string, bodyHtml: string) {
  return `<tr><td style="padding:26px 42px 8px;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:33px;font-weight:700;color:#0d2d52;">${escapeHtml(title)}</div>
${subtitle ? `<div style="font-size:14px;line-height:22px;color:#718493;margin-top:7px;">${escapeHtml(subtitle)}</div>` : ''}
</td></tr>
<tr><td style="padding:14px 42px 24px;">
<div style="font-size:14px;line-height:26px;color:#3f596c;">${bodyHtml}</div>
</td></tr>`
}

export function emailCTA(label: string, href: string, note?: string) {
  return `<tr><td style="padding:18px 42px 30px;text-align:center;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
<tr><td bgcolor="#0d2d52" style="border-radius:10px;">
<a href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:15px 26px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;border-radius:10px;">${escapeHtml(label)} →</a>
</td></tr>
</table>
${note ? `<div style="font-size:11px;line-height:18px;color:#8a9aa6;margin-top:12px;">${escapeHtml(note)}</div>` : ''}
</td></tr>`
}

export function emailSupportCallout(text: string) {
  return `<tr><td style="padding:0 42px 30px;">
<div style="border-left:4px solid #62c6c7;background:#f1fafa;border-radius:10px;padding:16px 18px;">
<div style="font-size:13px;line-height:21px;color:#5f7587;">${text}</div>
</div>
</td></tr>`
}

export function emailSignOff(closingHtml?: string) {
  return `<tr><td style="padding:0 42px 30px;">
<div style="font-size:15px;line-height:25px;color:#607589;">
${closingHtml ?? 'If you have any questions, simply reply to this email.'}<br><br>
Best regards,<br><br>
<strong style="color:#0d2d52;">${EMAIL_FROM_NAME}</strong><br>
<a href="mailto:${EMAIL_SUPPORT}" style="color:#177d80;text-decoration:none;">${EMAIL_SUPPORT}</a><br>
<a href="${EMAIL_SITE_URL}/" style="color:#177d80;text-decoration:none;">${BRAND_DOMAIN}</a>
</div>
</td></tr>`
}

export function emailLegalFooter() {
  const year = new Date().getFullYear()
  return `<tr><td style="background:#f8fafc;padding:24px 38px;text-align:center;border-top:1px solid #e6edf2;">
<div style="font-size:11px;line-height:18px;color:#94a3af;">${BRAND_NAME} is a technology and consulting platform, not a law firm. Legal advice and immigration legal services are provided by licensed immigration attorneys where applicable.</div>
<div style="font-size:11px;line-height:18px;color:#a6b2bc;margin-top:9px;">© ${year} ${BRAND_NAME}. All rights reserved.</div>
</td></tr>`
}

/**
 * Master Afterstem email layout — same visual system as document + finance templates.
 */
export function afterstemEmailLayout(input: {
  title: string
  badge: string
  headline: string
  clientName: string
  introHtml: string
  infoRows?: EmailInfoRow[]
  amountCard?: { label: string; amount: string; meta?: string }
  sectionHtml?: string
  ctaLabel?: string
  ctaHref?: string
  ctaNote?: string
  supportHtml?: string
  closingHtml?: string
  preheader?: string
}) {
  const preheader = input.preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(input.preheader)}</div>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(input.title)} | ${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:#edf3f6;font-family:Arial,Helvetica,sans-serif;color:#17324d;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
${preheader}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf3f6;">
<tr><td align="center" style="padding:34px 14px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 12px 36px rgba(13,45,82,.10);">
${emailLogoHeader()}
${emailBadgeHeadline(input.badge, input.headline)}
${emailGreeting(input.clientName, input.introHtml)}
${emailInfoCard(input.infoRows ?? [])}
${input.amountCard ? emailAmountCard(input.amountCard.label, input.amountCard.amount, input.amountCard.meta) : ''}
${input.sectionHtml ?? ''}
${input.ctaHref && input.ctaLabel ? emailCTA(input.ctaLabel, input.ctaHref, input.ctaNote) : ''}
${input.supportHtml ? emailSupportCallout(input.supportHtml) : ''}
${emailSignOff(input.closingHtml)}
${emailLegalFooter()}
</table>
</td></tr>
</table>
</body>
</html>`
}

/** Backward-compatible wrapper used by sendClientEmail / settings preview. */
export function afterstemEmailHtml(input: {
  headline: string
  bodyHtml: string
  greeting?: string
  eyebrow?: string
  infoRows?: EmailInfoRow[]
  ctaLabel?: string
  ctaHref?: string
  supportNote?: string
  preheader?: string
  clientName?: string
}) {
  const name =
    input.clientName ||
    (input.greeting?.replace(/^Hi\s+/i, '').replace(/,$/, '').trim() || 'there')
  return afterstemEmailLayout({
    title: input.headline,
    badge: input.eyebrow || 'Afterstem',
    headline: input.headline,
    clientName: name,
    introHtml: input.bodyHtml,
    infoRows: input.infoRows,
    ctaLabel: input.ctaLabel,
    ctaHref: input.ctaHref,
    supportHtml: input.supportNote,
    preheader: input.preheader,
  })
}

export function textToEmailHtml(text: string) {
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim()
      if (trimmed === '') return '<br/>'
      const withBold = escapeHtml(line).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      return `<p style="margin:0 0 10px;font-size:15px;line-height:25px;color:#5e7486;">${withBold}</p>`
    })
    .join('')
}

/** Professional plain-text body for Gmail compose (not HTML). */
export function toProfessionalPlainText(input: {
  clientName: string
  paragraphs: string[]
  rows?: EmailInfoRow[]
  ctaLabel?: string
  ctaHref?: string
}) {
  const lines: string[] = [`Hello ${input.clientName},`, '']
  for (const p of input.paragraphs) {
    const chunk = p.trim()
    if (!chunk) continue
    // Preserve intentional line breaks inside a paragraph (lists).
    for (const line of chunk.split('\n')) {
      lines.push(line.trimEnd())
    }
    lines.push('')
  }
  if (input.rows?.length) {
    for (const row of input.rows) {
      lines.push(`${row.label}:`)
      lines.push(row.value)
      lines.push('')
    }
  }
  if (input.ctaHref) {
    lines.push(`${input.ctaLabel || 'Continue'}:`)
    lines.push(input.ctaHref)
    lines.push('')
  }
  lines.push(
    'If you have any questions, please reply to this email.',
    '',
    'Best regards,',
    EMAIL_FROM_NAME,
    `${BRAND_NAME}`,
    EMAIL_SUPPORT,
  )
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
