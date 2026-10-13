import { BRAND_NAME, CLIENT_FROM_EMAIL } from '@/lib/brand'
import { prisma } from '@/lib/db'
import { afterstemEmailHtml, textToEmailHtml } from '@/lib/email-html'
import { renderCatalogEmail } from '@/lib/email/catalog-html'
import type { EmailTemplateKey } from '@/lib/email-templates'

export type CommunicationType =
  | 'O1_PROCESS_STARTED'
  | 'DOCUMENTATION_REQUEST'
  | 'PAYMENT_REQUEST'
  | 'PAYMENT_CONFIRMATION'
  | 'PRE_FILING_COMPLETE'
  | 'CASE_FILED'
  | 'APPROVAL'
  | 'FINAL_PAYMENT_REQUEST'
  | 'PAID_IN_FULL'
  | 'ONBOARDING_INVITE'
  | 'WELCOME'
  | 'MISSING_DOCUMENT_REMINDER'
  | 'GENERIC'

export async function logEmail(input: {
  candidateId: string
  caseId?: string | null
  type: CommunicationType | string
  recipient: string
  subject: string
  sentById?: string | null
  metadata?: Record<string, unknown>
  status?: string
  templateType?: string | null
  bodySnapshot?: string | null
  candidateNumber?: string | null
}) {
  return prisma.communication.create({
    data: {
      candidateId: input.candidateId,
      caseId: input.caseId ?? null,
      candidateNumber: input.candidateNumber ?? null,
      type: input.type,
      templateType: input.templateType ?? null,
      bodySnapshot: input.bodySnapshot ?? null,
      recipient: input.recipient,
      subject: input.subject,
      status: input.status ?? 'LOGGED',
      sentById: input.sentById ?? null,
      metadata: (input.metadata ?? undefined) as never,
    },
  })
}

export async function sendClientEmail(input: {
  candidateId: string
  caseId?: string | null
  type: CommunicationType | string
  to: string
  subject: string
  text: string
  html?: string
  sentById?: string | null
  metadata?: Record<string, unknown>
  templateType?: string | null
  candidateNumber?: string | null
  ctaLabel?: string
  ctaHref?: string
  greeting?: string
  eyebrow?: string
  infoRows?: Array<{ label: string; value: string }>
  preheader?: string
  useCatalogHtml?: boolean
  catalog?: {
    fullLegalName: string
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
  }
}) {
  const subject = input.subject.replace(/[Aa]fter[Ss][Tt][Ee][Mm]|Afterstem/g, BRAND_NAME)
  const from = process.env.EMAIL_FROM || CLIENT_FROM_EMAIL
  let status = 'LOGGED'

  let html = input.html
  if (!html && input.useCatalogHtml !== false && input.catalog && input.templateType) {
    try {
      const rendered = renderCatalogEmail({
        templateKey: input.templateType as EmailTemplateKey,
        fullLegalName: input.catalog.fullLegalName,
        candidateNumber: input.candidateNumber,
        email: input.to,
        visaType: input.catalog.visaType,
        caseNumber: input.catalog.caseNumber,
        quotedCents: input.catalog.quotedCents,
        paymentCents: input.catalog.paymentCents,
        paymentNumber: input.catalog.paymentNumber,
        currency: input.catalog.currency,
        paymentLink: input.catalog.paymentLink,
        documentLink: input.catalog.documentLink,
        personalNote: input.catalog.personalNote,
        missingDocumentLabels: input.catalog.missingDocumentLabels,
        subjectOverride: subject,
        textOverride: input.text,
      })
      html = rendered.html
    } catch (error) {
      console.error('[email] catalog render failed, falling back', error)
    }
  }
  if (!html) {
    html = afterstemEmailHtml({
      headline: subject,
      bodyHtml: textToEmailHtml(input.text),
      ctaLabel: input.ctaLabel,
      ctaHref: input.ctaHref,
      greeting: input.greeting,
      eyebrow: input.eyebrow,
      infoRows: input.infoRows,
      preheader: input.preheader ?? subject,
      clientName: input.catalog?.fullLegalName,
    })
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${BRAND_NAME} Team <${from}>`,
          to: [input.to],
          reply_to: from,
          subject,
          text: input.text,
          html,
        }),
      })
      status = res.ok ? 'SENT' : 'FAILED'
      if (!res.ok) {
        const detail = await res.text().catch(() => '')
        console.error('[email] Resend failed', res.status, detail.slice(0, 300))
      }
    } catch (error) {
      status = 'FAILED'
      console.error('[email] Resend error', error)
    }
  }

  return logEmail({
    candidateId: input.candidateId,
    caseId: input.caseId,
    type: input.type,
    recipient: input.to,
    subject,
    sentById: input.sentById,
    metadata: { ...input.metadata, preview: input.text.slice(0, 500) },
    status,
    templateType: input.templateType,
    bodySnapshot: input.text,
    candidateNumber: input.candidateNumber,
  })
}

export function paymentEmailCopy(installment: number, paid: boolean) {
  if (paid) {
    if (installment === 3) {
      return {
        type: 'PRE_FILING_COMPLETE' as const,
        subject: `${BRAND_NAME} — 75% pre-filing complete`,
        text: `We received Payment ${installment}. Your pre-filing payments are now complete. The ${BRAND_NAME} team will continue preparing your case.`,
      }
    }
    if (installment === 4) {
      return {
        type: 'PAID_IN_FULL' as const,
        subject: `${BRAND_NAME} — paid in full`,
        text: `We received your final payment. Thank you. Your ${BRAND_NAME} engagement is paid in full.`,
      }
    }
    return {
      type: 'PAYMENT_CONFIRMATION' as const,
      subject: `${BRAND_NAME} — Payment ${installment} confirmation`,
      text: `We received Payment ${installment}. Thank you for remaining current with your ${BRAND_NAME} engagement.`,
    }
  }
  if (installment === 4) {
    return {
      type: 'FINAL_PAYMENT_REQUEST' as const,
      subject: `${BRAND_NAME} — final payment request`,
      text: `Your petition was approved. Payment 4, the remaining 25% of the engagement, is now due.`,
    }
  }
  return {
    type: 'PAYMENT_REQUEST' as const,
    subject: `${BRAND_NAME} — Payment ${installment} request`,
    text: `Please complete Payment ${installment} for your ${BRAND_NAME} engagement using the secure link provided by our team.`,
  }
}
