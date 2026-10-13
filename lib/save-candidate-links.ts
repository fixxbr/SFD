import { uploadCaseDocument } from '@/lib/documents'
import {
  normalizeSubmittedUrls,
  resolveLinkInputKind,
  validateHttpUrl,
} from '@/lib/link-request-items'
import { prisma } from '@/lib/db'

export async function saveCandidateLinkSubmission(input: {
  candidateId: string
  caseId: string
  questionKey: string
  label: string
  category?: string | null
  rawUrls: string | string[]
  description?: string | null
  documentRequestId?: string | null
  documentRequestItemId?: string | null
  visaTypeCode?: string | null
  append?: boolean
  clientIdempotencyKey?: string | null
}) {
  const kind = resolveLinkInputKind(input.questionKey)
  const normalized = normalizeSubmittedUrls(input.rawUrls)
  if (!normalized.length) throw new Error('Enter at least one URL.')

  const validated: string[] = []
  for (const value of normalized) {
    const check = validateHttpUrl(value)
    if (!check.ok) throw new Error(check.error)
    validated.push(check.href)
  }
  if (kind === 'url' && validated.length > 1) {
    throw new Error('Please submit a single URL for this item.')
  }

  const bodyText = validated.join('\n')
  const buffer = Buffer.from(bodyText, 'utf8')
  const displayName = validated.length === 1 ? validated[0] : `${validated.length} links`
  const filename =
    validated.length === 1
      ? `${input.questionKey || 'link'}.url.txt`
      : `${input.questionKey || 'links'}.txt`

  const document = await uploadCaseDocument({
    candidateId: input.candidateId,
    caseId: input.caseId,
    questionKey: input.questionKey,
    category: input.category || 'Profile & links',
    documentType: input.questionKey,
    file: {
      buffer,
      mimeType: 'text/plain',
      filename,
      size: buffer.byteLength,
    },
    uploadedByType: 'CANDIDATE',
    displayName,
    description: input.description?.trim() || `Submitted link${validated.length > 1 ? 's' : ''}: ${validated.join(', ')}`,
    append: true,
    clientIdempotencyKey: input.clientIdempotencyKey,
  })

  if (input.documentRequestId && input.documentRequestItemId) {
    await prisma.documentRequestItem.update({
      where: { id: input.documentRequestItemId },
      data: { status: 'UPLOADED' },
    })
    await prisma.caseDocument.update({
      where: { id: document.id },
      data: {
        documentRequestId: input.documentRequestId,
        documentRequestItemId: input.documentRequestItemId,
        visaTypeCode: input.visaTypeCode ?? undefined,
      },
    })

    const remaining = await prisma.documentRequestItem.count({
      where: {
        documentRequestId: input.documentRequestId,
        status: { in: ['REQUESTED', 'NEEDS_REPLACEMENT', 'NEEDS_ADDITIONAL_DOCUMENTS'] },
      },
    })
    const anyUploaded = await prisma.documentRequestItem.count({
      where: {
        documentRequestId: input.documentRequestId,
        status: {
          in: ['UPLOADED', 'SUBMITTED', 'ACCEPTED', 'NEEDS_ADDITIONAL_DOCUMENTS', 'PARTIALLY_UPLOADED'],
        },
      },
    })
    await prisma.documentRequest.update({
      where: { id: input.documentRequestId },
      data: {
        status: remaining === 0 ? 'SUBMITTED' : anyUploaded > 0 ? 'PARTIALLY_SUBMITTED' : 'OPENED',
        completedAt: remaining === 0 ? new Date() : undefined,
      },
    })
  }

  return { document, urls: validated }
}
