import { prisma } from '@/lib/db'
import { createAccessLink } from '@/lib/client-access'
import { allocateDocumentRequestNumber } from '@/lib/document-request-number'
import {
  categoryChecklistHtml,
  customListHtml,
  renderDocRequestHtml,
  docRequestPlainText,
  type DocRequestTemplateKey,
} from '@/lib/document-request-templates'
import { sendClientEmail } from '@/lib/email'
import { appUrl } from '@/lib/http'
import { resolveCandidateUploadUrl, getCandidateUploadUrl } from '@/lib/candidate-upload-url'
import { formatVisa } from '@/lib/visa'
import { ActivityType, logActivity } from '@/lib/activity'
import { caseVisaToCode, getActiveVisaTemplate } from '@/lib/visa-templates'
import { randomUUID } from 'crypto'
import type { VisaType } from '@prisma/client'

export type RequestBuilderItem = {
  key: string
  label: string
  category: string
  instructions?: string | null
  required?: boolean
  allowsMultipleFiles?: boolean
  templateItemId?: string | null
  source?: 'template' | 'custom' | 'link'
  /** file = upload slot (default); url = one link; urls = one or more links */
  inputKind?: 'file' | 'url' | 'urls'
}

export type DocRequestType = 'FULL' | 'SELECTED' | 'CUSTOM' | 'SINGLE'

function emailTemplateKey(type: DocRequestType): DocRequestTemplateKey {
  if (type === 'FULL') return 'FULL_O1'
  if (type === 'SINGLE') return 'SINGLE'
  return 'CUSTOM'
}

function defaultSubject(type: DocRequestType, visaLabel: string, candidateNumber: string, replacement = false) {
  if (replacement) return `Afterstem.ai | Updated Document Required – ${candidateNumber}`
  if (type === 'FULL') return `Afterstem.ai | ${visaLabel} Documentation Request – ${candidateNumber}`
  if (type === 'SINGLE') return `Afterstem.ai | Document Requested – ${candidateNumber}`
  return `Afterstem.ai | Additional Documents Required – ${candidateNumber}`
}

export function normalizeDocumentRequestSubject(subject: string): string {
  return subject.replace(/\blawfirm(?:\.ai)?\b/gi, 'Afterstem.ai')
}

export async function createDocumentRequestPackage(input: {
  caseId: string
  createdById: string
  requestType: DocRequestType
  items: RequestBuilderItem[]
  documentName?: string
  documentNote?: string
  heading?: string
  introMessage?: string
  subject?: string
  sendEmail?: boolean
  previewOnly?: boolean
  status?: string
  isReplacement?: boolean
  /** Public site origin for candidate upload links (e.g. from the admin request). */
  publicBaseUrl?: string
}) {
  const record = await prisma.case.findUnique({
    where: { id: input.caseId },
    include: { candidate: true },
  })
  if (!record) throw new Error('Case not found')
  if (!input.items.length) throw new Error('Select at least one document to request.')

  const visaCode = caseVisaToCode(record.visaType)
  const visaLabel = formatVisa(record.visaType as VisaType)
  const firstName = record.candidate.fullLegalName.split(' ')[0] || record.candidate.fullLegalName
  const template = await getActiveVisaTemplate(visaCode)
  const tmplKey = emailTemplateKey(input.requestType)
  const subject = normalizeDocumentRequestSubject(
    input.subject?.trim() ||
      defaultSubject(input.requestType, visaLabel, record.candidate.candidateNumber, Boolean(input.isReplacement)),
  )

  const previewLink = `${(input.publicBaseUrl || appUrl()).replace(/\/$/, '')}/documents/r/preview`
  const html = renderDocRequestHtml(tmplKey, {
    clientName: firstName,
    candidateId: record.candidate.candidateNumber,
    visaType: visaLabel,
    documentRequestLink: previewLink,
    customDocumentListHtml: customListHtml(input.items.map((i) => i.label)),
    checklistHtml: categoryChecklistHtml(input.items.map((i) => i.category)),
    documentName: input.documentName || input.items[0]?.label,
    documentRequestNote:
      input.documentNote || input.items[0]?.instructions || 'Please upload this document using the secure link.',
  })

  if (input.previewOnly) {
    return {
      preview: true as const,
      subject,
      html,
      plainText: docRequestPlainText(tmplKey, {
        clientName: firstName,
        candidateId: record.candidate.candidateNumber,
        visaType: visaLabel,
        documentRequestLink: previewLink,
        documentName: input.documentName || input.items[0]?.label,
        documentRequestNote:
          input.documentNote || input.items[0]?.instructions || 'Please upload this document using the secure link.',
        documentLabels: input.items.map((i) => i.label),
      }),
      items: input.items,
    }
  }

  const access = await createAccessLink({
    candidateId: record.candidateId,
    caseId: record.id,
    purpose: 'DOCUMENT_UPLOAD',
    requiresEmailVerification: false,
  })
  const secureUrl = getCandidateUploadUrl(access.token, input.publicBaseUrl || appUrl())
  const requestNumber = await allocateDocumentRequestNumber()
  const finalHtml = html.replaceAll(previewLink, secureUrl)

  // Persist defs for every requested slot so candidate uploads resolve even if the
  // submission session temporarily lacks documentRequestId (e.g. email verify).
  for (const item of input.items) {
    await prisma.customDocumentDef.upsert({
      where: { caseId_key: { caseId: record.id, key: item.key } },
      update: {
        label: item.label,
        instructions: item.instructions || null,
        category: item.category,
      },
      create: {
        id: randomUUID(),
        candidateId: record.candidateId,
        caseId: record.id,
        key: item.key,
        label: item.label,
        instructions: item.instructions || null,
        category: item.category,
        createdById: input.createdById,
      },
    })
  }

  const plainText = docRequestPlainText(tmplKey, {
    clientName: firstName,
    candidateId: record.candidate.candidateNumber,
    visaType: visaLabel,
    documentRequestLink: secureUrl,
    documentName: input.documentName || input.items[0]?.label,
    documentRequestNote:
      input.documentNote || input.items[0]?.instructions || 'Please upload this document using the secure link.',
    documentLabels: input.items.map((i) => i.label),
  })

  const text = plainText

  const requestRow = await prisma.documentRequest.create({
    data: {
      requestNumber,
      candidateId: record.candidateId,
      caseId: record.id,
      accessLinkId: access.link.id,
      templateKey: tmplKey,
      requestType: input.requestType,
      visaTypeCode: visaCode,
      templateId: template?.id,
      templateVersion: template?.version,
      requestedCategories: [...new Set(input.items.map((i) => i.category))],
      requestedItems: input.items.map((i) => ({
        key: i.key,
        label: i.label,
        category: i.category,
        instructions: i.instructions ?? null,
        source: i.source ?? 'template',
        inputKind: i.inputKind ?? 'file',
      })) as never,
      documentName: input.documentName || (input.requestType === 'SINGLE' ? input.items[0]?.label : null),
      documentNote: input.documentNote || null,
      recipientEmail: record.candidate.email,
      subject,
      heading: input.heading || null,
      introMessage: input.introMessage || null,
      secureUrl,
      status: input.sendEmail === false ? input.status || 'READY' : 'SENT',
      sentById: input.createdById,
      expiresAt: access.link.expiresAt,
      items: {
        create: input.items.map((item, index) => ({
          id: randomUUID(),
          candidateId: record.candidateId,
          caseId: record.id,
          templateItemId: item.templateItemId || null,
          category: item.category,
          documentKey: item.key,
          documentName: item.label,
          instructions: item.instructions || null,
          required: Boolean(item.required),
          allowsMultipleFiles: true,
          status: 'REQUESTED',
          sortOrder: index * 10,
        })),
      },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })

  let email = null
  if (input.sendEmail !== false) {
    email = await sendClientEmail({
      candidateId: record.candidateId,
      caseId: record.id,
      type: 'DOCUMENTATION_REQUEST',
      templateType: tmplKey,
      to: record.candidate.email,
      subject,
      text,
      html: finalHtml,
      sentById: input.createdById,
      candidateNumber: record.candidate.candidateNumber,
      metadata: {
        documentRequestId: requestRow.id,
        requestNumber,
        requestType: input.requestType,
        itemCount: input.items.length,
      },
    })
    await logActivity({
      candidateId: record.candidateId,
      caseId: record.id,
      type: ActivityType.DOCUMENT_REQUEST_SENT,
      message: `${requestNumber} · ${input.requestType} document request sent`,
      actorType: 'ADMIN',
      actorId: input.createdById,
      metadata: { documentRequestId: requestRow.id, requestNumber, url: secureUrl },
    })
  } else {
    await logActivity({
      candidateId: record.candidateId,
      caseId: record.id,
      type: ActivityType.DOCUMENT_REQUEST_SENT,
      message: `${requestNumber} · document request prepared for Gmail`,
      actorType: 'ADMIN',
      actorId: input.createdById,
      metadata: { documentRequestId: requestRow.id, requestNumber, url: secureUrl, channel: 'gmail_compose' },
    })
  }

  return {
    preview: false as const,
    url: secureUrl,
    documentRequest: requestRow,
    items: input.items,
    email,
    subject,
    html: finalHtml,
    plainText,
  }
}

/** Rebuild email for an existing request without regenerating the upload token. */
export async function buildDocumentRequestEmailCopy(documentRequestId: string, publicBaseUrl?: string) {
  const req = await prisma.documentRequest.findUnique({
    where: { id: documentRequestId },
    include: {
      candidate: true,
      case: true,
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!req) throw new Error('Document request not found')
  const liveUrl = resolveCandidateUploadUrl(req.secureUrl, publicBaseUrl || appUrl())
  if (!liveUrl) throw new Error('Request has no secure URL')

  const visaLabel = formatVisa(req.case.visaType)
  const firstName = req.candidate.fullLegalName.split(' ')[0]
  const tmplKey = (req.templateKey as DocRequestTemplateKey) || 'CUSTOM'
  const subject = normalizeDocumentRequestSubject(
    req.subject || defaultSubject(req.requestType as DocRequestType, visaLabel, req.candidate.candidateNumber),
  )
  const html = renderDocRequestHtml(tmplKey, {
    clientName: firstName,
    candidateId: req.candidate.candidateNumber,
    visaType: visaLabel,
    documentRequestLink: liveUrl,
    customDocumentListHtml: customListHtml(req.items.map((i) => i.documentName)),
    checklistHtml: categoryChecklistHtml(req.items.map((i) => i.category)),
    documentName: req.documentName || req.items[0]?.documentName,
    documentRequestNote: req.documentNote || req.items[0]?.instructions || '',
  })
  const plainText = docRequestPlainText(tmplKey, {
    clientName: firstName,
    candidateId: req.candidate.candidateNumber,
    visaType: visaLabel,
    documentRequestLink: liveUrl,
    documentName: req.documentName || req.items[0]?.documentName,
    documentRequestNote: req.documentNote || req.items[0]?.instructions || '',
    documentLabels: req.items.map((i) => i.documentName),
  })

  return {
    url: liveUrl,
    subject,
    html,
    plainText,
    documentRequest: req,
    recipientEmail: req.recipientEmail || req.candidate.email,
  }
}

export async function resendDocumentRequest(input: {
  documentRequestId: string
  sentById: string
}) {
  const req = await prisma.documentRequest.findUnique({
    where: { id: input.documentRequestId },
    include: {
      candidate: true,
      case: true,
      items: { orderBy: { sortOrder: 'asc' } },
    },
  })
  if (!req) throw new Error('Document request not found')
  const liveUrl = resolveCandidateUploadUrl(req.secureUrl)
  if (!liveUrl) throw new Error('Request has no secure URL')

  const visaLabel = formatVisa(req.case.visaType)
  const firstName = req.candidate.fullLegalName.split(' ')[0]
  const tmplKey = (req.templateKey as DocRequestTemplateKey) || 'CUSTOM'
  const subject = normalizeDocumentRequestSubject(
    req.subject || defaultSubject(req.requestType as DocRequestType, visaLabel, req.candidate.candidateNumber),
  )
  const html = renderDocRequestHtml(tmplKey, {
    clientName: firstName,
    candidateId: req.candidate.candidateNumber,
    visaType: visaLabel,
    documentRequestLink: liveUrl,
    customDocumentListHtml: customListHtml(req.items.map((i) => i.documentName)),
    documentName: req.documentName || req.items[0]?.documentName,
    documentRequestNote: req.documentNote || req.items[0]?.instructions || '',
  })

  const email = await sendClientEmail({
    candidateId: req.candidateId,
    caseId: req.caseId,
    type: 'DOCUMENTATION_REQUEST',
    templateType: tmplKey,
    to: req.candidate.email,
    subject,
    text: `Hello ${firstName},\n\nPlease use your secure Afterstem document link:\n${liveUrl}\n\nBest regards,\nAfterstem Team`,
    html,
    sentById: input.sentById,
    candidateNumber: req.candidate.candidateNumber,
    metadata: { documentRequestId: req.id, resend: true },
  })

  await prisma.documentRequest.update({
    where: { id: req.id },
    data: { status: 'SENT', sentAt: new Date(), sentById: input.sentById },
  })

  return { email, url: liveUrl, documentRequest: req }
}

export async function regenerateDocumentRequestLink(input: {
  documentRequestId: string
  createdById: string
  publicBaseUrl?: string
}) {
  const req = await prisma.documentRequest.findUnique({
    where: { id: input.documentRequestId },
    include: { items: true },
  })
  if (!req) throw new Error('Document request not found')

  // Ensure every slot has a case-level def so legacy sessions / verify flows resolve membership.
  for (const item of req.items) {
    await prisma.customDocumentDef.upsert({
      where: { caseId_key: { caseId: req.caseId, key: item.documentKey } },
      update: {
        label: item.documentName,
        instructions: item.instructions || null,
        category: item.category,
      },
      create: {
        id: randomUUID(),
        candidateId: req.candidateId,
        caseId: req.caseId,
        key: item.documentKey,
        label: item.documentName,
        instructions: item.instructions || null,
        category: item.category,
        createdById: input.createdById,
      },
    })
  }

  const access = await createAccessLink({
    candidateId: req.candidateId,
    caseId: req.caseId,
    purpose: 'DOCUMENT_UPLOAD',
    requiresEmailVerification: false,
  })
  const secureUrl = getCandidateUploadUrl(access.token, input.publicBaseUrl || appUrl())
  const updated = await prisma.documentRequest.update({
    where: { id: req.id },
    data: {
      accessLinkId: access.link.id,
      secureUrl,
      expiresAt: access.link.expiresAt,
      status: req.status === 'CANCELLED' ? 'READY' : req.status,
      cancelledAt: null,
    },
  })
  return { url: secureUrl, documentRequest: updated }
}
