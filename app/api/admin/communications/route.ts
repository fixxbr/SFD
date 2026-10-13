import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { sendClientEmail, type CommunicationType } from '@/lib/email'
import { renderCatalogEmail } from '@/lib/email/catalog-html'
import { prisma } from '@/lib/db'
import { ActivityType, logActivity } from '@/lib/activity'
import type { EmailTemplateKey } from '@/lib/email-templates'

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('communications:write')
    const body = (await request.json()) as {
      candidateId?: string
      caseId?: string
      type?: CommunicationType
      templateType?: string
      subject?: string
      text?: string
      to?: string
      personalNote?: string
      previewOnly?: boolean
      mode?: string
      openInGmail?: boolean
      copyMode?: string
      missingDocumentLabels?: string[]
      paymentLink?: string
      documentLink?: string
      paymentCents?: number
      paymentNumber?: number
    }
    if (!body.candidateId || !body.subject || !body.text || !body.to) {
      return jsonError('Recipient, subject, and message are required.')
    }

    const candidate = await prisma.candidate.findUnique({
      where: { id: body.candidateId },
      include: {
        cases: {
          where: body.caseId ? { id: body.caseId } : { lifecycle: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            payments: { orderBy: { installmentNumber: 'asc' } },
          },
        },
      },
    })
    if (!candidate) return jsonError('Candidate not found', 404)
    const currentCase = candidate.cases[0] ?? null
    const nextPayment = currentCase?.payments?.find((p) => p.status !== 'PAID')

    const catalogPayload = {
      fullLegalName: candidate.fullLegalName,
      visaType: currentCase?.visaType ?? null,
      caseNumber: currentCase?.caseNumber ?? null,
      quotedCents: currentCase?.quotedAmountCents ?? null,
      paymentCents: body.paymentCents ?? nextPayment?.amountCents ?? null,
      paymentNumber: body.paymentNumber ?? nextPayment?.installmentNumber ?? null,
      currency: currentCase?.currency ?? null,
      paymentLink: body.paymentLink ?? nextPayment?.paymentUrl ?? null,
      documentLink: body.documentLink ?? null,
      personalNote: body.personalNote ?? null,
      missingDocumentLabels: body.missingDocumentLabels,
    }

    const rendered = renderCatalogEmail({
      templateKey: (body.templateType || 'CUSTOM') as EmailTemplateKey,
      candidateNumber: candidate.candidateNumber,
      email: body.to,
      ...catalogPayload,
      subjectOverride: body.subject,
      textOverride: body.text,
    })

    // Validate unresolved merge tokens
    if (/\{\{[A-Za-z0-9 _-]+\}\}/.test(rendered.subject) || /\{\{[A-Za-z0-9 _-]+\}\}/.test(rendered.text)) {
      return jsonError('Cannot send — unresolved template variables remain. Please edit the subject/message.', 400)
    }

    if (body.previewOnly) {
      return NextResponse.json({
        preview: {
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          plainTextForGmail: rendered.plainTextForGmail,
          templateKey: rendered.templateKey,
          version: rendered.version,
        },
      })
    }

    // Gmail compose: prepare + log without sending via Resend.
    if (body.mode === 'gmail' || body.openInGmail) {
      const { prepareGmailCompose } = await import('@/lib/email/gmail-prepare')
      const prepared = prepareGmailCompose({
        to: body.to,
        subject: body.subject,
        body: rendered.plainTextForGmail || body.text,
      })
      if (!prepared.ok) return jsonError(prepared.error, 400)

      const log = await prisma.communication.create({
        data: {
          candidateId: body.candidateId,
          caseId: body.caseId ?? currentCase?.id,
          candidateNumber: candidate.candidateNumber,
          type: body.type ?? body.templateType ?? 'GENERIC',
          templateType: body.templateType ?? body.type ?? 'GENERIC',
          recipient: body.to,
          subject: body.subject,
          bodySnapshot: prepared.body,
          status: 'OPENED_IN_GMAIL',
          sentById: user.id,
          sentAt: new Date(),
          metadata: {
            channel: 'gmail_compose',
            version: rendered.version,
            note: 'Gmail compose opened — not confirmed sent',
          },
        },
      })

      await logActivity({
        candidateId: body.candidateId,
        caseId: body.caseId ?? currentCase?.id,
        type: ActivityType.EMAIL_SENT,
        message: `Email opened in Gmail (not confirmed sent): ${body.subject}`,
        actorType: 'ADMIN',
        actorId: user.id,
        metadata: {
          templateType: body.templateType,
          communicationId: log.id,
          status: 'OPENED_IN_GMAIL',
          channel: 'gmail_compose',
        },
      })

      return NextResponse.json({
        communication: log,
        gmailUrl: prepared.url,
        preview: {
          subject: rendered.subject,
          html: rendered.html,
          plainTextForGmail: prepared.body,
          version: rendered.version,
        },
      })
    }

    // Copy Email: log as COPIED — never SENT. Client already copied exact edited content.
    if (body.mode === 'copied') {
      const snapshot = String(body.text || '')
      if (!snapshot.trim()) return jsonError('Email body is required to log a copy.', 400)
      if (snapshot.toLowerCase().includes('/documents/r/preview')) {
        return jsonError('Unable to generate candidate upload link. Please retry.', 400)
      }

      const log = await prisma.communication.create({
        data: {
          candidateId: body.candidateId,
          caseId: body.caseId ?? currentCase?.id,
          candidateNumber: candidate.candidateNumber,
          type: body.type ?? body.templateType ?? 'GENERIC',
          templateType: body.templateType ?? body.type ?? 'GENERIC',
          recipient: body.to,
          subject: body.subject,
          bodySnapshot: snapshot,
          status: 'COPIED',
          sentById: user.id,
          sentAt: new Date(),
          metadata: {
            channel: 'clipboard',
            copyMode: body.copyMode || 'full',
            version: rendered.version,
            note: 'Copied to clipboard — not confirmed sent',
          },
        },
      })

      await logActivity({
        candidateId: body.candidateId,
        caseId: body.caseId ?? currentCase?.id,
        type: ActivityType.EMAIL_SENT,
        message: `Email copied to clipboard (not confirmed sent): ${body.subject}`,
        actorType: 'ADMIN',
        actorId: user.id,
        metadata: {
          templateType: body.templateType,
          communicationId: log.id,
          status: 'COPIED',
          channel: 'clipboard',
        },
      })

      return NextResponse.json({ communication: log, status: 'COPIED' })
    }

    // Manual confirmation after copy/Gmail.
    if (body.mode === 'mark-sent') {
      const log = await prisma.communication.create({
        data: {
          candidateId: body.candidateId,
          caseId: body.caseId ?? currentCase?.id,
          candidateNumber: candidate.candidateNumber,
          type: body.type ?? body.templateType ?? 'GENERIC',
          templateType: body.templateType ?? body.type ?? 'GENERIC',
          recipient: body.to,
          subject: body.subject,
          bodySnapshot: body.text,
          status: 'SENT_MANUAL',
          sentById: user.id,
          sentAt: new Date(),
          metadata: {
            channel: 'manual_confirm',
            note: 'Admin confirmed email was sent manually',
          },
        },
      })

      await logActivity({
        candidateId: body.candidateId,
        caseId: body.caseId ?? currentCase?.id,
        type: ActivityType.EMAIL_SENT,
        message: `Email marked sent manually: ${body.subject}`,
        actorType: 'ADMIN',
        actorId: user.id,
        metadata: {
          templateType: body.templateType,
          communicationId: log.id,
          status: 'SENT_MANUAL',
        },
      })

      return NextResponse.json({ communication: log, status: 'SENT_MANUAL' })
    }

    const log = await sendClientEmail({
      candidateId: body.candidateId,
      caseId: body.caseId ?? currentCase?.id,
      type: body.type ?? body.templateType ?? 'GENERIC',
      templateType: body.templateType ?? body.type ?? 'GENERIC',
      to: body.to,
      subject: body.subject,
      text: body.text,
      html: rendered.html,
      sentById: user.id,
      candidateNumber: candidate.candidateNumber,
      catalog: catalogPayload,
      metadata: { version: rendered.version },
    })

    if (log.status === 'FAILED') {
      return jsonError('Email could not be sent. Communication was logged as failed — please retry.', 502)
    }

    await logActivity({
      candidateId: body.candidateId,
      caseId: body.caseId ?? currentCase?.id,
      type: ActivityType.EMAIL_SENT,
      message: `Email sent: ${body.subject}`,
      actorType: 'ADMIN',
      actorId: user.id,
      metadata: {
        templateType: body.templateType,
        communicationId: log.id,
        status: log.status,
        version: rendered.version,
      },
    })

    return NextResponse.json({
      communication: log,
      preview: {
        subject: rendered.subject,
        html: rendered.html,
        plainTextForGmail: rendered.plainTextForGmail,
        version: rendered.version,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
