import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { resolveAllowedMimeType, validateCandidateUploadFile } from '@/lib/upload-validation'
import { uploadCaseDocument } from '@/lib/documents'
import { markMatchingRequestItemsUploaded } from '@/lib/sync-request-status'
import { sectionMeta } from '@/lib/evidence-entries'
import { assertCanAccessCase, isLawyerUser } from '@/lib/lawyer-access'
import { isLinkRequestKey } from '@/lib/link-request-items'
import { resolveDocumentCategory, resolveDocumentType } from '@/lib/document-keys'

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('documents:write')
    const form = await request.formData()
    const candidateId = String(form.get('candidateId') ?? '')
    const caseId = String(form.get('caseId') ?? '')
    const questionKey = String(form.get('questionKey') ?? '')
    const adminNote = String(form.get('adminNote') ?? '')
    const category = String(form.get('category') ?? '')
    const documentType = String(form.get('documentType') ?? '')
    const evidenceEntryId = String(form.get('evidenceEntryId') ?? '') || null
    const displayName = String(form.get('displayName') ?? '') || null
    const replaceDocumentId = String(form.get('replaceDocumentId') ?? '') || null
    const append = form.get('append') === '1' || form.get('append') === 'true' || Boolean(evidenceEntryId)
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

    if (!candidateId || !caseId) return jsonError('Candidate and case are required.')
    if (!questionKey && !evidenceEntryId) return jsonError('Document type or evidence entry is required.')
    if (questionKey && isLinkRequestKey(questionKey)) {
      return jsonError('This item is a link. Add it in the Links section as a URL instead of uploading a file.')
    }

    const check = validateCandidateUploadFile({
      filename,
      size,
      mimeType: mimeTypeRaw,
    })
    if (!check.ok) return jsonError(check.error)

    const record = await prisma.case.findFirst({
      where: { id: caseId, candidateId },
      include: { onboardingSubmissions: { orderBy: { updatedAt: 'desc' }, take: 1 } },
    })
    if (!record) return jsonError('Case not found for this candidate.', 404)
    if (isLawyerUser(user)) await assertCanAccessCase(user, caseId)

    const lawyerUpload = isLawyerUser(user)

    let resolvedKey = questionKey
    let resolvedCategory = category
    let resolvedType = documentType
    if (evidenceEntryId) {
      const entry = await prisma.evidenceEntry.findFirst({
        where: { id: evidenceEntryId, caseId, candidateId },
      })
      if (!entry) return jsonError('Evidence entry not found.', 404)
      const meta = sectionMeta(entry.section)
      resolvedKey = resolvedKey || meta.questionKeyPrefix
      resolvedCategory = resolvedCategory || meta.category
      resolvedType = resolvedType || meta.questionKeyPrefix
    }

    const mimeType =
      resolveAllowedMimeType({ mimeType: mimeTypeRaw, filename }) || check.mimeType
    const { validateDocumentDescription } = await import('@/lib/document-description')
    const descCheck = validateDocumentDescription(form.get('description'))
    if (!descCheck.ok) return jsonError(descCheck.error)

    const created = await uploadCaseDocument({
      candidateId,
      caseId,
      onboardingSubmissionId: record.onboardingSubmissions[0]?.id,
      questionKey: resolvedKey,
      category: resolvedCategory || resolveDocumentCategory(resolvedKey),
      documentType: resolvedType || resolveDocumentType(resolvedKey),
      file: { buffer, mimeType, filename, size: buffer.byteLength },
      uploadedByType: lawyerUpload ? 'LAWYER' : 'ADMIN',
      uploadedById: user.id,
      adminNote: adminNote || null,
      description: descCheck.description,
      // Multiple attachments are always allowed for every document type.
      append: true,
      evidenceEntryId,
      displayName,
      replaceDocumentId,
    })
    await prisma.caseDocument.update({
      where: { id: created.id },
      data: { visaTypeCode: String(record.visaType) },
    })
    if (!evidenceEntryId) {
      await markMatchingRequestItemsUploaded({
        caseId,
        questionKey: created.questionKey,
        documentId: created.id,
      })
    }
    return NextResponse.json({
      success: true,
      document: created,
      files: [
        {
          id: created.id,
          name: created.displayName || created.originalFilename,
          mimeType: created.mimeType,
          size: created.fileSizeBytes,
        },
      ],
    })
  } catch (error) {
    console.error('Document upload failed', {
      endpoint: '/api/admin/documents',
      error: error instanceof Error ? error.message : 'unknown',
    })
    return handleApiError(error)
  }
}
