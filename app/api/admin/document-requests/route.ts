import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin, publicAppUrlFromRequest } from '@/lib/http'
import {
  createDocumentRequestPackage,
  resendDocumentRequest,
  regenerateDocumentRequestLink,
  buildDocumentRequestEmailCopy,
  type DocRequestType,
  type RequestBuilderItem,
} from '@/lib/document-requests'
import { getActiveVisaTemplate, caseVisaToCode } from '@/lib/visa-templates'
import { resolveCandidateUploadUrl } from '@/lib/candidate-upload-url'
import { additionalDocumentKey } from '@/lib/document-requirement-status'
import { reconcileRequestItemsForCandidate } from '@/lib/sync-request-status'
import { prisma } from '@/lib/db'

export async function GET(request: Request) {
  try {
    await requirePermission('communications:read')
    const url = new URL(request.url)
    const caseId = url.searchParams.get('caseId')
    if (!caseId) return jsonError('caseId is required.')
    const publicBaseUrl = publicAppUrlFromRequest(request)

    const caseRow = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        candidate: { select: { id: true, fullLegalName: true, candidateNumber: true, email: true } },
        documents: {
          where: { isCurrentVersion: true },
          select: { questionKey: true, status: true, originalFilename: true, uploadedAt: true, version: true },
        },
        customDocumentDefs: { select: { key: true, label: true, category: true } },
      },
    })
    if (!caseRow) return jsonError('Case not found', 404)
    await reconcileRequestItemsForCandidate(caseRow.candidate.id)

    const visaCode = caseVisaToCode(caseRow.visaType)
    const template = await getActiveVisaTemplate(visaCode)
    const recent = await prisma.documentRequest.findMany({
      where: { caseId },
      orderBy: { sentAt: 'desc' },
      take: 30,
      include: {
        sentBy: { select: { fullName: true } },
        items: { orderBy: { sortOrder: 'asc' } },
      },
    })

    return NextResponse.json({
      candidate: caseRow.candidate,
      visaType: caseRow.visaType,
      visaCode,
      template,
      documents: caseRow.documents,
      customDocumentDefs: caseRow.customDocumentDefs,
      recent: recent.map((r) => ({
        ...r,
        secureUrl: resolveCandidateUploadUrl(r.secureUrl, publicBaseUrl) ?? r.secureUrl,
      })),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const publicBaseUrl = publicAppUrlFromRequest(request)
    const body = (await request.json()) as {
      action?: string
      caseId?: string
      documentRequestId?: string
      documentKey?: string
      requestType?: DocRequestType
      items?: RequestBuilderItem[]
      documentName?: string
      documentNote?: string
      category?: string
      heading?: string
      introMessage?: string
      subject?: string
      previewOnly?: boolean
      sendEmail?: boolean
      required?: boolean
      isReplacement?: boolean
    }

    if (body.action === 'add-custom-requirement') {
      const user = await requirePermission('documents:write')
      const caseId = String(body.caseId || '')
      const documentName = String(body.documentName || '').trim()
      const category = String(body.category || 'Additional Evidence').trim() || 'Additional Evidence'
      if (!caseId || !documentName) return jsonError('caseId and documentName are required.')
      const caseRow = await prisma.case.findUnique({ where: { id: caseId } })
      if (!caseRow) return jsonError('Case not found', 404)
      const key =
        String(body.documentKey || '').trim() ||
        `custom_${documentName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}_${Date.now()}`
      const def = await prisma.customDocumentDef.upsert({
        where: { caseId_key: { caseId, key } },
        update: {
          label: documentName,
          instructions: typeof body.documentNote === 'string' ? body.documentNote : null,
          category,
        },
        create: {
          candidateId: caseRow.candidateId,
          caseId,
          key,
          label: documentName,
          instructions: typeof body.documentNote === 'string' ? body.documentNote : null,
          category,
          createdById: user.id,
        },
      })
      await prisma.caseActivity.create({
        data: {
          candidateId: caseRow.candidateId,
          caseId,
          type: 'DOCUMENT_REQUIREMENT_ADDED',
          message: `Document requirement added: ${documentName}`,
          actorType: 'ADMIN',
          actorId: user.id,
          metadata: { key, required: body.required !== false },
        },
      })
      return NextResponse.json({ def })
    }

    if (body.action === 'request-additional') {
      const user = await requirePermission('documents:write')
      const caseId = String(body.caseId || '')
      const parentKey = String(body.documentKey || '').trim()
      const note = String(body.documentNote || body.documentName || '').trim()
      if (!caseId || !parentKey || !note) {
        return jsonError('caseId, documentKey, and a description of the additional file are required.')
      }
      const requestRow = await prisma.documentRequest.findFirst({
        where: { caseId, cancelledAt: null },
        orderBy: { sentAt: 'desc' },
        include: { items: { where: { documentKey: parentKey }, take: 1 } },
      })
      if (!requestRow) {
        return jsonError('Send a document request before asking for additional documentation.', 404)
      }
      const parent = requestRow.items[0]
      const documentKey = additionalDocumentKey(parentKey)
      const item = await prisma.documentRequestItem.create({
        data: {
          documentRequestId: requestRow.id,
          candidateId: requestRow.candidateId,
          caseId,
          category: parent?.category || 'additional',
          documentKey,
          documentName: note,
          instructions: parent
            ? `Additional documentation for ${parent.documentName}. ${note}`
            : note,
          required: false,
          allowsMultipleFiles: true,
          status: 'REQUESTED',
          sortOrder: 9000,
        },
      })
      await prisma.documentRequest.update({
        where: { id: requestRow.id },
        data: { status: 'PARTIALLY_SUBMITTED', completedAt: null },
      })
      await prisma.caseActivity.create({
        data: {
          candidateId: requestRow.candidateId,
          caseId,
          type: 'DOCUMENT_REQUIREMENT_ADDED',
          message: `Additional documentation requested: ${note}`,
          actorType: 'ADMIN',
          actorId: user.id,
          metadata: { documentKey, parentKey, documentRequestItemId: item.id },
        },
      })
      return NextResponse.json({ item })
    }

    if (body.action === 'remove-custom-requirement') {
      const user = await requirePermission('documents:write')
      const caseId = String(body.caseId || '')
      const key = String(body.documentKey || '').trim()
      if (!caseId || !key) return jsonError('caseId and documentKey are required.')
      const existing = await prisma.customDocumentDef.findUnique({ where: { caseId_key: { caseId, key } } })
      if (!existing) return jsonError('Requirement not found', 404)
      await prisma.customDocumentDef.delete({ where: { caseId_key: { caseId, key } } })
      await prisma.caseActivity.create({
        data: {
          candidateId: existing.candidateId,
          caseId,
          type: 'DOCUMENT_REQUIREMENT_REMOVED',
          message: `Document requirement removed: ${existing.label}`,
          actorType: 'ADMIN',
          actorId: user.id,
          metadata: { key },
        },
      })
      return NextResponse.json({ ok: true })
    }

    const user = await requirePermission('communications:write')

    if (body.action === 'resend' && body.documentRequestId) {
      const result = await resendDocumentRequest({
        documentRequestId: body.documentRequestId,
        sentById: user.id,
      })
      return NextResponse.json(result)
    }

    if (body.action === 'email-copy' && body.documentRequestId) {
      const result = await buildDocumentRequestEmailCopy(body.documentRequestId, publicBaseUrl)
      return NextResponse.json(result)
    }

    if (body.action === 'cancel' && body.documentRequestId) {
      const updated = await prisma.documentRequest.update({
        where: { id: body.documentRequestId },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      })
      return NextResponse.json({ documentRequest: updated })
    }

    if (body.action === 'regenerate' && body.documentRequestId) {
      const result = await regenerateDocumentRequestLink({
        documentRequestId: body.documentRequestId,
        createdById: user.id,
        publicBaseUrl,
      })
      return NextResponse.json(result)
    }

    if (!body.caseId) return jsonError('caseId is required.')
    if (!body.requestType) return jsonError('requestType is required.')
    if (!body.items?.length && !body.previewOnly) return jsonError('Select at least one document.')

    const result = await createDocumentRequestPackage({
      caseId: body.caseId,
      createdById: user.id,
      requestType: body.requestType,
      items: body.items ?? [],
      documentName: body.documentName,
      documentNote: body.documentNote,
      heading: body.heading,
      introMessage: body.introMessage,
      subject: body.subject,
      previewOnly: Boolean(body.previewOnly),
      sendEmail: body.sendEmail !== false && !body.previewOnly,
      isReplacement: Boolean(body.isReplacement),
      publicBaseUrl,
    })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof Error && /select at least|not found|no secure/i.test(error.message)) {
      return jsonError(error.message)
    }
    return handleApiError(error)
  }
}
