import { NextResponse } from 'next/server'
import { getOrCreateDraft, onboardingCatalogForCase, resolveInvite } from '@/lib/onboarding'
import { onboardingFileKeys } from '@/lib/onboarding-form'
import { resolveDocumentCategory, resolveDocumentType } from '@/lib/document-keys'
import { markMatchingRequestItemsUploaded } from '@/lib/sync-request-status'
import { jsonError, handleApiError, assertSameOrigin } from '@/lib/http'
import { archiveCaseDocument, uploadCaseDocument } from '@/lib/documents'
import { candidateCanReplaceFile } from '@/lib/candidate-file-rules'
import { prisma } from '@/lib/db'
import { resolveAllowedMimeType, validateCandidateUploadFile } from '@/lib/upload-validation'

type Ctx = { params: Promise<{ token: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const { token } = await ctx.params
    const invite = await resolveInvite(token)
    if (!invite) return jsonError('This onboarding link is invalid or has expired.', 404)

    const form = await request.formData()
    const questionKey = String(form.get('questionKey') ?? '')
    if (!questionKey) return jsonError('File and document type are required.')
    // Only upload slots that are on this case's own visa form.
    const fileKeys = onboardingFileKeys(await onboardingCatalogForCase(invite.case.visaType))
    if (!fileKeys.has(questionKey)) return jsonError('Unknown document type.')

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
      if (!isUploadBlob(file)) return jsonError('A file is required.')
      filename = uploadFilename(file)
      mimeTypeRaw = file.type || ''
      size = file.size
      buffer = Buffer.from(await file.arrayBuffer())
    }

    const check = validateCandidateUploadFile({
      filename,
      size,
      mimeType: mimeTypeRaw,
    })
    if (!check.ok) return jsonError(check.error)

    const { validateDocumentDescription } = await import('@/lib/document-description')
    const descCheck = validateDocumentDescription(form.get('description'))
    if (!descCheck.ok) return jsonError(descCheck.error)

    const draft = await getOrCreateDraft(invite.caseId, invite.candidateId)
    const mimeType =
      resolveAllowedMimeType({ mimeType: mimeTypeRaw, filename }) || check.mimeType
    const document = await uploadCaseDocument({
      candidateId: invite.candidateId,
      caseId: invite.caseId,
      onboardingSubmissionId: draft.id,
      questionKey,
      category: resolveDocumentCategory(questionKey),
      documentType: resolveDocumentType(questionKey),
      file: {
        buffer,
        mimeType,
        filename,
        size: buffer.byteLength,
      },
      uploadedByType: 'CANDIDATE',
      description: descCheck.description,
      append: true,
    })
    await prisma.caseDocument.update({ where: { id: document.id }, data: { visaTypeCode: String(invite.case.visaType) } })
    // Same as the document portal: a file for a requested item marks that item uploaded.
    await markMatchingRequestItemsUploaded({ caseId: invite.caseId, questionKey: document.questionKey, documentId: document.id })

    return NextResponse.json({
      document: {
        id: document.id,
        questionKey: document.questionKey,
        originalFilename: document.originalFilename,
        status: document.status,
        version: document.version,
        uploadedAt: document.uploadedAt,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Candidate removes one of their own files (or the old file of a replace).
 * Allowed before Submit; after Submit only for a file an admin or lawyer disapproved.
 */
export async function DELETE(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const { token } = await ctx.params
    const invite = await resolveInvite(token)
    if (!invite) return jsonError('This onboarding link is invalid or has expired.', 404)
    const documentId = new URL(request.url).searchParams.get('documentId') ?? ''
    if (!documentId) return jsonError('documentId is required.')
    const draft = await getOrCreateDraft(invite.caseId, invite.candidateId)
    const file = await prisma.caseDocument.findFirst({
      where: { id: documentId, caseId: invite.caseId, externalUrl: null, isCurrentVersion: true },
    })
    if (!file) return jsonError('File not found.', 404)
    if (!candidateCanReplaceFile(file, draft)) {
      return jsonError(
        'This file has been submitted and can no longer be changed. You can add more files at any time.',
        409,
      )
    }
    await archiveCaseDocument({ documentId: file.id, actorId: null, reason: 'Removed by candidate before review' })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
