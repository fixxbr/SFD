/**
 * Branded HTML renderers for admin catalog templates (Welcome, reminders, payments, etc.).
 * Uses the master Afterstem layout from email-html.ts — same look as document/finance emails.
 */
import { BRAND_NAME } from '@/lib/brand'
import {
  afterstemEmailLayout,
  escapeHtml,
  textToEmailHtml,
  toProfessionalPlainText,
  type EmailInfoRow,
} from '@/lib/email-html'
import {
  EMAIL_TEMPLATES,
  mergeTemplate,
  buildMergeVars,
  templateByKey,
  type EmailTemplateKey,
  type MergeVars,
} from '@/lib/email-templates'
import { formatVisa } from '@/lib/visa'

export type CatalogRenderInput = {
  templateKey: EmailTemplateKey | string
  fullLegalName: string
  candidateNumber?: string | null
  email: string
  visaType?: string | null
  caseNumber?: string | null
  quotedCents?: number | null
  paymentCents?: number | null
  paymentNumber?: number | null
  currency?: string | null
  paymentLink?: string | null
  documentLink?: string | null
  personalNote?: string | null
  missingDocumentLabels?: string[]
  subjectOverride?: string
  textOverride?: string
}

function firstName(full: string) {
  return full.trim().split(/\s+/)[0] || full
}

/** Strip greeting + sign-off so layout can add them once (avoids duplicate Hi / Team footer). */
export function stripCatalogChrome(text: string) {
  let t = text.trim()
  t = t.replace(/^Hi\s+[^\n,]+\s*,?\s*/i, '')
  t = t.replace(/\n*—\s*Afterstem Team[\s\S]*$/i, '')
  t = t.replace(/\n*clients@afterstem\.ai\s*$/im, '')
  return t.trim()
}

export function hasUnresolvedMergeTokens(value: string) {
  return /\{\{[A-Za-z0-9 _-]+\}\}/.test(value)
}

function badgeFor(key: string) {
  if (key === 'WELCOME') return 'Welcome'
  if (key === 'DOCUMENTS_RECEIVED') return 'Documents Received'
  if (key.includes('DOCUMENT') || key === 'MISSING_DOCUMENT_REMINDER') return 'Document Request'
  if (key === 'AGREED_AMOUNT' || key === 'PAYMENT_SCHEDULE') return 'Payment'
  if (key.includes('PAYMENT') || key.includes('FILING') || key === 'PRE_FILING_COMPLETE') return 'Payment'
  if (key === 'CASE_UPDATE') return 'Case Update'
  return 'Afterstem'
}

function headlineFor(key: string, vars: MergeVars) {
  if (key === 'WELCOME') return `Welcome to ${BRAND_NAME}`
  if (key === 'MISSING_DOCUMENT_REMINDER') return 'Documents Still Needed'
  if (key === 'DOCUMENTS_RECEIVED') return 'Documents Received'
  if (key === 'DOCUMENTATION_REQUEST') return `Complete Your ${vars.visaType || 'Case'} Documentation`
  if (key === 'AGREED_AMOUNT') return 'Agreed Engagement Amount'
  if (key === 'PAYMENT_SCHEDULE') return 'Your Payment Schedule'
  if (key === 'PAYMENT_OVERDUE') return 'Payment Past Due'
  if (key === 'PAYMENT_REQUEST' || key.endsWith('_DUE')) return 'Payment Request'
  if (key.includes('CONFIRMATION') || key === 'PAYMENT_RECEIVED') return 'Payment Received'
  if (key === 'PAYMENT_REMINDER') return 'Payment Reminder'
  if (key === 'CASE_UPDATE') return 'Update on Your Case'
  if (key === 'O1_PROCESS_STARTED') return 'Your Journey Has Started'
  return templateByKey(key).label
}

function defaultInfoRows(input: CatalogRenderInput, vars: MergeVars): EmailInfoRow[] {
  const rows: EmailInfoRow[] = []
  if (vars.candidateId) rows.push({ label: 'Candidate ID', value: vars.candidateId })
  if (vars.visaType) rows.push({ label: 'Visa Type', value: vars.visaType })
  if (vars.caseNumber) rows.push({ label: 'Case Number', value: vars.caseNumber })
  if (vars.quotedAmount && vars.quotedAmount !== '$0.00') {
    rows.push({ label: 'Agreed Amount', value: vars.quotedAmount })
  }
  if (vars.paymentAmount && vars.paymentAmount !== '$0.00' && String(input.templateKey).includes('PAYMENT')) {
    rows.push({ label: 'Amount Due', value: vars.paymentAmount })
  }
  if (vars.paymentNumber) rows.push({ label: 'Payment Stage', value: vars.paymentNumber })
  return rows
}

export function renderCatalogEmail(input: CatalogRenderInput): {
  subject: string
  text: string
  html: string
  plainTextForGmail: string
  templateKey: string
  version: string
} {
  const key = String(input.templateKey || 'CUSTOM')
  const tmpl = templateByKey(key)
  const vars = buildMergeVars({
    fullLegalName: input.fullLegalName,
    candidateNumber: input.candidateNumber ?? undefined,
    email: input.email,
    visaLabel: input.visaType ? formatVisa(input.visaType) : '',
    caseNumber: input.caseNumber ?? '',
    quotedCents: input.quotedCents ?? 0,
    paymentCents: input.paymentCents ?? undefined,
    paymentNumber: input.paymentNumber ?? undefined,
    currency: input.currency ?? undefined,
    paymentLink: input.paymentLink ?? undefined,
    documentLink: input.documentLink ?? undefined,
  })

  let text = input.textOverride?.trim() || mergeTemplate(tmpl.body, vars)
  if (key === 'MISSING_DOCUMENT_REMINDER' && input.missingDocumentLabels?.length && !input.textOverride) {
    const list = input.missingDocumentLabels.map((l) => `- ${l}`).join('\n')
    text = text.replace(
      'Please upload the outstanding items using your secure',
      `Outstanding items:\n${list}\n\nPlease upload the outstanding items using your secure`,
    )
  }
  if (input.personalNote?.trim()) {
    text = `${text.trim()}\n\n${input.personalNote.trim()}`
  }

  const subject = input.subjectOverride?.trim() || mergeTemplate(tmpl.subject, vars)
  const infoRows = defaultInfoRows(input, vars)

  const amountCard =
    (key.includes('PAYMENT') || key.includes('DUE') || key === 'PAYMENT_REQUEST') &&
    vars.paymentAmount &&
    vars.paymentAmount !== '$0.00'
      ? {
          label: key.includes('CONFIRMATION') || key.includes('RECEIVED') ? 'Amount Received' : 'Amount Due',
          amount: vars.paymentAmount,
          meta: vars.paymentNumber ? `Payment ${vars.paymentNumber}` : undefined,
        }
      : undefined

  let sectionHtml = ''
  if (key === 'MISSING_DOCUMENT_REMINDER' && input.missingDocumentLabels?.length) {
    const list = input.missingDocumentLabels
      .map(
        (l) =>
          `<div style="padding:8px 0;border-bottom:1px solid #e6edf2;font-size:14px;color:#0d2d52;">☐ ${escapeHtml(l)}</div>`,
      )
      .join('')
    sectionHtml = `<tr><td style="padding:18px 42px 8px;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:30px;font-weight:700;color:#0d2d52;margin-bottom:10px;">Still Needed</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7fafc;border:1px solid #e1e9ee;border-radius:14px;">
<tr><td style="padding:12px 18px;">${list}</td></tr></table>
</td></tr>`
  }

  const ctaVar = tmpl.ctaVar
  const ctaHref =
    ctaVar === 'paymentLink'
      ? input.paymentLink || undefined
      : ctaVar === 'documentLink'
        ? input.documentLink || undefined
        : undefined
  const ctaLabel = tmpl.ctaLabel

  const introBody = stripCatalogChrome(text)
  const introHtml = textToEmailHtml(introBody)

  const html = afterstemEmailLayout({
    title: subject,
    badge: badgeFor(key),
    headline: headlineFor(key, vars),
    clientName: firstName(input.fullLegalName),
    introHtml,
    infoRows,
    amountCard,
    sectionHtml: sectionHtml || undefined,
    ctaLabel: ctaHref ? ctaLabel : undefined,
    ctaHref,
    ctaNote: ctaHref && vars.candidateId ? `Secure link associated with Candidate ID ${vars.candidateId}.` : undefined,
    supportHtml:
      'Please use your secure Afterstem link so files and payments are recorded under the correct candidate profile.',
    preheader: subject,
  })

  const plainTextForGmail = toProfessionalPlainText({
    clientName: firstName(input.fullLegalName),
    paragraphs: introBody
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean)
      .flatMap((block) => {
        // Keep bullet / numbered lists as separate lines inside one paragraph block.
        if (/^[-•*]|\d+\.\s/m.test(block)) {
          return [block]
        }
        // Soft-wrap single newlines inside prose paragraphs to spaces.
        return [block.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim()]
      })
      .filter(Boolean),
    rows: infoRows,
    ctaLabel,
    ctaHref,
  })

  return {
    subject,
    text,
    html,
    plainTextForGmail,
    templateKey: key,
    version: `${key.toLowerCase()}_v1`,
  }
}

export function catalogTemplateOptions() {
  return EMAIL_TEMPLATES.map((t) => ({ key: t.key, label: t.label }))
}
