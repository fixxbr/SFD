import { NextResponse } from 'next/server'
import { getOrCreateDraft, resolveInvite } from '@/lib/onboarding'
import { jsonError, handleApiError, assertSameOrigin } from '@/lib/http'
import { uploadCaseDocument } from '@/lib/documents'
import { questionByKey } from '@/lib/onboarding-catalog'
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
    const mapped = questionByKey(questionKey)
    if (!mapped || mapped.question.type !== 'file') return jsonError('Unknown document type.')

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
