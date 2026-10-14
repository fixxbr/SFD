import { createCaseLink } from '@/lib/case-links'
import { normalizeSubmittedUrls, validateHttpUrl } from '@/lib/link-request-items'
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
  const normalized = normalizeSubmittedUrls(input.rawUrls)
  if (!normalized.length) throw new Error('Enter at least one URL.')

  const validated: string[] = []
  for (const value of normalized) {
    const check = validateHttpUrl(value)
    if (!check.ok) throw new Error(check.error)
    validated.push(check.href)
  }
  // Every link item takes as many URLs as the candidate needs; each is saved on its own and
  // added to what is already on file (nothing is replaced).
  // One link row per URL so each link can be opened, edited and removed on its own.
  const documents = []
  for (const [index, href] of validated.entries()) {
    documents.push(
      await createCaseLink({
        candidateId: input.candidateId,
        caseId: input.caseId,
        url: href,
        label: validated.length === 1 ? input.label : `${input.label} (${index + 1})`,
        questionKey: input.questionKey,
        category: input.category || 'Profile & links',
        note: input.description?.trim() || null,
        uploadedByType: 'CANDIDATE',
        clientIdempotencyKey: input.clientIdempotencyKey
          ? validated.length === 1
            ? input.clientIdempotencyKey
            : `${input.clientIdempotencyKey}:${index}`
          : null,
        visaTypeCode: input.visaTypeCode ?? null,
        onDuplicate: 'reuse',
      }),
    )
  }
  const document = documents[0]

  if (input.documentRequestId && input.documentRequestItemId) {
    await prisma.documentRequestItem.update({
      where: { id: input.documentRequestItemId },
      data: { status: 'UPLOADED' },
    })
    await prisma.caseDocument.updateMany({
      where: { id: { in: documents.map((doc) => doc.id) } },
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

  return { document, documents, urls: validated }
}
