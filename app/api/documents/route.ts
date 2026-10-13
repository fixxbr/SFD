import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { resolveSubmissionSession, DOC_SESSION_COOKIE } from '@/lib/submission-session'
import { formatVisa } from '@/lib/visa'
import { uploadCaseDocument } from '@/lib/documents'
import { groupItemsForPortal, type RequestedDocItem } from '@/lib/document-request-items'
import { sanitizeEvidenceMetadata } from '@/lib/evidence-section-meta'
import { prisma } from '@/lib/db'
import { resolveAllowedMimeType, validateCandidateUploadFile } from '@/lib/upload-validation'
import { isLinkRequestKey, normalizeSubmittedUrls, resolveLinkInputKind } from '@/lib/link-request-items'
import { saveCandidateLinkSubmission } from '@/lib/save-candidate-links'
import { markMatchingRequestItemsUploaded, reconcileRequestItemsForCandidate } from '@/lib/sync-request-status'
import {
  assertCandidateLinkAllowed,
  assertCandidateSlotAllowed,
  ensureSessionDocumentRequest,
  findLatestOpenDocumentRequest,
  parseRequestedItems,
} from '@/lib/document-request-access'
import {
  isAdditionalEvidenceKey,
  OTHER_SUPPORTING_DOCUMENT_KEY,
  resolveDocumentCategory,
  resolveDocumentType,
} from '@/lib/document-keys'
import { correlationFromRequest, logDocumentWorkflow } from '@/lib/request-correlation'

function inputKindForKey(key: string, requestItems: RequestedDocItem[] | null) {
  const fromJson = requestItems?.find((i) => i.key === key)
  return resolveLinkInputKind(key, fromJson?.inputKind)
}

/** Portal always offers a catch-all file slot for uncategorized supporting evidence. */
function ensureOtherSupportingSlot(items: RequestedDocItem[]): RequestedDocItem[] {
  const hasCatchAll = items.some((item) => isAdditionalEvidenceKey(item.key))
  if (hasCatchAll) return items
  return [
    ...items,
    {
      key: OTHER_SUPPORTING_DOCUMENT_KEY,
      label: 'Other supporting document',
      category: 'additional',
      instructions:
        'Upload any supporting document that does not fit another category. Add a clear description for each file.',
      source: 'catalog',
      inputKind: 'file',
    },
  ]
}

function mapPrevious(docs: Array<{
  id: string
  questionKey: string
  documentType: string
  originalFilename: string
  displayName?: string | null
  description?: string | null
  mimeType: string
  fileSizeBytes: number
  version: number
  status: string
  isCurrentVersion: boolean
  uploadedAt: Date
}>) {
  return docs.map((d) => ({
    id: d.id,
    questionKey: d.questionKey,
    documentType: d.documentType,
    originalFilename: d.displayName || d.originalFilename,
    description: d.description ?? null,
    mimeType: d.mimeType,
    fileSizeBytes: d.fileSizeBytes,
    version: d.version,
    status: d.status,
    isCurrentVersion: d.isCurrentVersion,
    uploadedAt: d.uploadedAt.toISOString(),
  }))
}

function mapUploadedDocument(document: {
  id: string
  questionKey: string
  originalFilename: string
  displayName?: string | null
  version: number
  uploadedAt: Date
  fileSizeBytes: number
}) {
  return {
    id: document.id,
    questionKey: document.questionKey,
    originalFilename: document.displayName || document.originalFilename,
    version: document.version,
    uploadedAt: document.uploadedAt,
    fileSizeBytes: document.fileSizeBytes,
  }
}

async function refreshDocumentRequest(session: Awaited<ReturnType<typeof resolveSubmissionSession>>) {
  if (!session) return null
  const boundRequestId = await ensureSessionDocumentRequest(session)
  if (!boundRequestId) return null
  if (session.documentRequest?.id === boundRequestId) return session.documentRequest
  const latest = await findLatestOpenDocumentRequest(session.caseId)
  if (latest?.id === boundRequestId) return latest
  return prisma.documentRequest.findUnique({
    where: { id: boundRequestId },
    select: {
      id: true,
      requestNumber: true,
      requestType: true,
      requestedItems: true,
      visaTypeCode: true,
      expiresAt: true,
      openedAt: true,
      status: true,
    },
  })
}

async function syncRequestCompletion(documentRequestId: string, openedAt: Date | null | undefined) {
  const remaining = await prisma.documentRequestItem.count({
    where: {
      documentRequestId,
      status: { in: ['REQUESTED', 'NEEDS_REPLACEMENT', 'NEEDS_ADDITIONAL_DOCUMENTS'] },
    },
  })
  const anyUploaded = await prisma.documentRequestItem.count({
    where: {
      documentRequestId,
      status: {
        in: ['UPLOADED', 'SUBMITTED', 'ACCEPTED', 'NEEDS_ADDITIONAL_DOCUMENTS', 'PARTIALLY_UPLOADED'],
      },
    },
  })
  await prisma.documentRequest.update({
    where: { id: documentRequestId },
    data: {
      openedAt: openedAt ?? new Date(),
      status: remaining === 0 ? 'SUBMITTED' : anyUploaded > 0 ? 'PARTIALLY_SUBMITTED' : 'OPENED',
      completedAt: remaining === 0 ? new Date() : undefined,
    },
  })
}

export async function GET() {
  try {
    const jar = await cookies()
    const session = await resolveSubmissionSession(jar.get(DOC_SESSION_COOKIE)?.value)
    if (!session) return jsonError('Please verify your Candidate ID and email to continue.', 401)

    await reconcileRequestItemsForCandidate(session.candidateId)

    const documentRequest = await refreshDocumentRequest(session)
    const documentRequestId = documentRequest?.id ?? null

    if (documentRequestId && !documentRequest?.openedAt) {
      await prisma.documentRequest.update({
        where: { id: documentRequestId },
        data: { openedAt: new Date(), status: 'OPENED' },
      })
    }

    const previousDocuments = mapPrevious(session.case.documents.filter((d) => !d.evidenceEntryId))
    const evidenceEntries = await prisma.evidenceEntry.findMany({
      where: { caseId: session.caseId },
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
      include: {
        documents: {
          where: { status: { not: 'ARCHIVED' } },
          orderBy: { uploadedAt: 'desc' },
          select: {
            id: true,
            originalFilename: true,
            displayName: true,
            description: true,
            mimeType: true,
            uploadedAt: true,
            fileSizeBytes: true,
            status: true,
          },
        },
      },
    })

    const docsForSlots = session.case.documents.filter((d) => d.isCurrentVersion && !d.evidenceEntryId)
    const filesByKey = new Map<string, typeof docsForSlots>()
    for (const d of docsForSlots) {
      const list = filesByKey.get(d.questionKey) ?? []
      list.push(d)
      filesByKey.set(d.questionKey, list)
    }
    const currentByKey = new Map(docsForSlots.map((d) => [d.questionKey, d]))
    const requestItemsMeta: RequestedDocItem[] | null = parseRequestedItems(documentRequest?.requestedItems)?.map(
      (item) => ({
        key: item.key,
        label: item.label ?? item.key,
        category: item.category ?? 'additional',
        instructions: item.instructions ?? null,
        source: (item.source ?? 'custom') as RequestedDocItem['source'],
        inputKind: item.inputKind as RequestedDocItem['inputKind'],
      }),
    ) ?? null

    function slotPayload(q: {
      key: string
      label: string
      instructions?: string | null
      help?: string | null
      inputKind?: 'file' | 'url' | 'urls'
      requestStatus?: string | null
    }) {
      const files = (filesByKey.get(q.key) ?? []).map((d) => ({
        id: d.id,
        originalFilename: d.displayName || d.originalFilename,
        description: d.description ?? null,
        version: d.version,
        uploadedAt: d.uploadedAt.toISOString(),
        fileSizeBytes: d.fileSizeBytes,
        status: d.status,
      }))
      const current = currentByKey.get(q.key)
      const inputKind = q.inputKind ?? inputKindForKey(q.key, requestItemsMeta)
      return {
        key: q.key,
        label: q.label,
        help: q.instructions ?? q.help ?? null,
        inputKind,
        requestStatus: q.requestStatus ?? null,
        files,
        current: current
          ? {
              id: current.id,
              originalFilename: current.displayName || current.originalFilename,
              description: current.description ?? null,
              version: current.version,
              uploadedAt: current.uploadedAt.toISOString(),
              fileSizeBytes: current.fileSizeBytes,
            }
          : null,
      }
    }

    let categories: Array<{
      id: string
      title: string
      questions: ReturnType<typeof slotPayload>[]
    }>

    const dbItems = documentRequestId
      ? await prisma.documentRequestItem.findMany({
          where: { documentRequestId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        })
      : []

    if (dbItems.length > 0) {
      const asRequested: RequestedDocItem[] = ensureOtherSupportingSlot(
        dbItems.map((i) => {
          const meta = requestItemsMeta?.find((m) => m.key === i.documentKey)
          return {
            key: i.documentKey,
            label: i.documentName,
            category: i.category,
            instructions: i.instructions,
            source: (meta?.source ?? (i.templateItemId ? 'catalog' : 'custom')) as RequestedDocItem['source'],
            inputKind: (meta?.inputKind ?? resolveLinkInputKind(i.documentKey)) as RequestedDocItem['inputKind'],
            requestStatus: i.status,
          }
        }),
      )
      const grouped = groupItemsForPortal(asRequested)
      categories = grouped.map((cat) => ({
        id: cat.id,
        title: cat.title,
        questions: cat.questions.map((q) => slotPayload(q)),
      }))
    } else if (requestItemsMeta) {
      const grouped = groupItemsForPortal(ensureOtherSupportingSlot(requestItemsMeta))
      categories = grouped.map((cat) => ({
        id: cat.id,
        title: cat.title,
        questions: cat.questions.map((q) => slotPayload(q)),
      }))
    } else {
      const grouped = groupItemsForPortal(ensureOtherSupportingSlot([]))
      categories = grouped.map((cat) => ({
        id: cat.id,
        title: cat.title,
        questions: cat.questions.map((q) => slotPayload(q)),
      }))
    }

    return NextResponse.json({
      firstName: session.candidate.fullLegalName.split(' ')[0],
      candidateNumber: session.candidate.candidateNumber,
      visaLabel: formatVisa(session.case.visaType),
      caseNumber: session.case.caseNumber,
      requestNumber: documentRequest?.requestNumber ?? null,
      requestType: documentRequest?.requestType ?? null,
      documents: session.case.documents.filter((d) => d.isCurrentVersion),
      previousDocuments,
      evidenceEntries: evidenceEntries.map((e) => ({
        id: e.id,
        section: e.section,
        title: e.title,
        subtitle: e.subtitle,
        description: e.description,
        metadata: sanitizeEvidenceMetadata(e.metadata),
        documents: e.documents.map((d) => ({
          id: d.id,
          originalFilename: d.displayName || d.originalFilename,
          description: d.description ?? null,
          mimeType: d.mimeType ?? null,
          uploadedAt: d.uploadedAt.toISOString(),
          fileSizeBytes: d.fileSizeBytes,
          status: d.status,
        })),
      })),
      categories,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  const correlationId = correlationFromRequest(request)
  try {
    assertSameOrigin(request)
    const jar = await cookies()
    const session = await resolveSubmissionSession(jar.get(DOC_SESSION_COOKIE)?.value)
    if (!session) {
      return jsonError('Please verify your Candidate ID and email to continue.', 401, {
        code: 'SESSION_REQUIRED',
        correlationId,
      })
    }

    const documentRequestId = await ensureSessionDocumentRequest(session)
    logDocumentWorkflow(correlationId, 'upload.start', {
      caseId: session.caseId,
      candidateId: session.candidateId,
      documentRequestId,
    })

    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const body = (await request.json().catch(() => null)) as {
        questionKey?: string
        url?: string
        urls?: string | string[]
        clientItemId?: string
        clientIdempotencyKey?: string
      } | null
      const questionKey = String(body?.questionKey ?? '').trim()
      const clientItemId = String(body?.clientItemId ?? '').trim() || null
      const clientIdempotencyKey = String(body?.clientIdempotencyKey ?? '').trim() || null
      if (!questionKey) return jsonError('A link item is required.', 400, { code: 'MISSING_LINK_KEY', correlationId })

      const raw = body?.urls ?? body?.url ?? ''
      const normalized = normalizeSubmittedUrls(raw)
      if (!normalized.length) {
        return NextResponse.json({
          success: true,
          skipped: true,
          code: 'SKIPPED',
          clientItemId,
          questionKey,
          correlationId,
        })
      }

      const linkCheck = await assertCandidateLinkAllowed({
        caseId: session.caseId,
        documentRequestId,
        questionKey,
      })
      if (!linkCheck.ok) {
        logDocumentWorkflow(correlationId, 'link.rejected', {
          caseId: session.caseId,
          questionKey,
          code: linkCheck.code ?? 'LINK_REJECTED',
        })
        return jsonError(linkCheck.error, 400, { code: linkCheck.code, correlationId, clientItemId, questionKey })
      }

      const kind = resolveLinkInputKind(questionKey, linkCheck.membership.fromJson?.inputKind)
      const result = await saveCandidateLinkSubmission({
        candidateId: session.candidateId,
        caseId: session.caseId,
        questionKey,
        label: linkCheck.label,
        category: linkCheck.category,
        rawUrls: raw,
        documentRequestId: linkCheck.membership.documentRequestId,
        documentRequestItemId: linkCheck.membership.dbItem?.id,
        visaTypeCode: session.documentRequest?.visaTypeCode,
        append: kind === 'urls',
        clientIdempotencyKey,
      })

      logDocumentWorkflow(correlationId, 'link.saved', {
        caseId: session.caseId,
        documentId: result.document.id,
        questionKey,
      })
      return NextResponse.json({
        success: true,
        code: 'LINK_SAVED',
        clientItemId,
        questionKey,
        urls: result.urls,
        document: mapUploadedDocument(result.document),
        correlationId,
      })
    }

    const form = await request.formData()
    const evidenceEntryId = String(form.get('evidenceEntryId') ?? '') || null
    const questionKey = String(form.get('questionKey') ?? '').trim()
    const clientItemId = String(form.get('clientItemId') ?? '').trim() || null
    const clientIdempotencyKey = String(form.get('clientIdempotencyKey') ?? '').trim() || null
    const uploadId = String(form.get('uploadId') ?? '').trim()
    const chunkTotal = Number(form.get('chunkTotal') || 0)

    let filename = ''
    let mimeTypeRaw = ''
    let size = 0
    let buffer: Buffer

    if (uploadId) {
      const { assembleUploadChunks } = await import('@/lib/chunked-upload')
      buffer = await assembleUploadChunks(uploadId, chunkTotal)
      filename = String(form.get('filename') || 'upload.bin')
      mimeTypeRaw = String(form.get('mimeType') || '')
      size = Number(form.get('fileSize') || buffer.byteLength)
    } else {
      const { isUploadBlob, uploadFilename } = await import('@/lib/chunked-upload')
      const file = form.get('file')
      if (!isUploadBlob(file)) return jsonError('A file is required.', 400, { code: 'FILE_REQUIRED', correlationId, clientItemId })
      filename = uploadFilename(file)
      mimeTypeRaw = file.type || ''
      size = file.size
      buffer = Buffer.from(await file.arrayBuffer())
    }

    if (!questionKey && !evidenceEntryId) {
      return jsonError('File and document type are required.', 400, { code: 'MISSING_SLOT', correlationId, clientItemId })
    }

    let resolvedKey = questionKey
    let resolvedCategory: string | undefined
    let resolvedType: string | undefined

    if (evidenceEntryId) {
      const entry = await prisma.evidenceEntry.findFirst({
        where: { id: evidenceEntryId, caseId: session.caseId, candidateId: session.candidateId },
      })
      if (!entry) return jsonError('That record is not part of this upload session.', 404, { code: 'EVIDENCE_NOT_FOUND', correlationId })
      const { sectionMeta } = await import('@/lib/evidence-section-meta')
      const meta = sectionMeta(entry.section)
      resolvedKey = resolvedKey || meta.questionKeyPrefix
      resolvedCategory = meta.category
      resolvedType = meta.questionKeyPrefix
    } else if (isAdditionalEvidenceKey(resolvedKey)) {
      resolvedKey = resolvedKey || OTHER_SUPPORTING_DOCUMENT_KEY
    }

    if (!evidenceEntryId && isLinkRequestKey(resolvedKey)) {
      return jsonError('This item asks for a link. Paste the URL instead of uploading a file.', 400, {
        code: 'LINK_SLOT_FILE',
        correlationId,
        clientItemId,
        questionKey: resolvedKey,
      })
    }

    const slotCheck = await assertCandidateSlotAllowed({
      caseId: session.caseId,
      documentRequestId,
      questionKey: resolvedKey,
      evidenceEntryId,
    })
    if (!slotCheck.ok) {
      logDocumentWorkflow(correlationId, 'upload.rejected', {
        caseId: session.caseId,
        questionKey: resolvedKey,
        code: slotCheck.code ?? 'SLOT_REJECTED',
      })
      return jsonError(slotCheck.error, 400, {
        code: slotCheck.code,
        correlationId,
        clientItemId,
        questionKey: resolvedKey,
      })
    }

    const { membership, customDef } = slotCheck
    const dbItem = membership.dbItem
    const fromJson = membership.fromJson

    const check = validateCandidateUploadFile({
      filename,
      size,
      mimeType: mimeTypeRaw,
    })
    if (!check.ok) return jsonError(check.error, 400, { code: 'INVALID_FILE', correlationId, clientItemId })

    const { validateDocumentDescription } = await import('@/lib/document-description')
    const descCheck = validateDocumentDescription(form.get('description'))
    if (!descCheck.ok) return jsonError(descCheck.error, 400, { code: 'INVALID_DESCRIPTION', correlationId, clientItemId })

    const mimeType =
      resolveAllowedMimeType({ mimeType: mimeTypeRaw, filename }) || check.mimeType
    const document = await uploadCaseDocument({
      candidateId: session.candidateId,
      caseId: session.caseId,
      questionKey: resolvedKey,
      category: resolveDocumentCategory(
        resolvedKey,
        resolvedCategory ?? dbItem?.category ?? fromJson?.category ?? customDef?.category,
      ),
      documentType: resolveDocumentType(resolvedKey, resolvedType ?? customDef?.key),
      file: {
        buffer,
        mimeType,
        filename,
        size: buffer.byteLength,
      },
      uploadedByType: 'CANDIDATE',
      description: descCheck.description,
      append: true,
      evidenceEntryId,
      clientIdempotencyKey,
    })

    if (!evidenceEntryId) {
      await markMatchingRequestItemsUploaded({
        caseId: session.caseId,
        questionKey: resolvedKey,
        documentId: document.id,
        documentRequestId: membership.documentRequestId ?? documentRequestId,
        documentRequestItemId: dbItem?.id,
      })
      const visaTypeCode = session.documentRequest?.visaTypeCode
      if (visaTypeCode) {
        await prisma.caseDocument.update({
          where: { id: document.id },
          data: { visaTypeCode },
        })
      }
    }

    const activeRequestId = membership.documentRequestId ?? documentRequestId
    if (activeRequestId) {
      await syncRequestCompletion(activeRequestId, session.documentRequest?.openedAt)
    }

    logDocumentWorkflow(correlationId, 'upload.saved', {
      caseId: session.caseId,
      documentId: document.id,
      questionKey: resolvedKey,
      storedBytes: document.fileSizeBytes,
    })

    return NextResponse.json({
      success: true,
      code: 'UPLOADED',
      clientItemId,
      questionKey: resolvedKey,
      document: mapUploadedDocument(document),
      correlationId,
    })
  } catch (error) {
    logDocumentWorkflow(correlationId, 'upload.error', {
      message: error instanceof Error ? error.message.slice(0, 200) : 'unknown',
    })
    const response = handleApiError(error)
    try {
      const body = await response.clone().json()
      return NextResponse.json({ ...body, correlationId }, { status: response.status })
    } catch {
      return response
    }
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(DOC_SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  return response
}
