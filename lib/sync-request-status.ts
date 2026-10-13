import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { filesForRequirement } from '@/lib/document-requirement-status'
import { documentKeyLookupKeys } from '@/lib/document-keys'

const OPEN_ITEM_STATUSES = ['REQUESTED', 'PENDING', 'MISSING', 'NEEDS_ADDITIONAL_DOCUMENTS']

/**
 * A matching current file means the request item is uploaded.
 * Appending another file to the same item must not flip it back to pending.
 */
export async function markMatchingRequestItemsUploaded(input: {
  caseId: string
  questionKey: string
  documentId: string
  documentRequestId?: string | null
  documentRequestItemId?: string | null
}) {
  if (!input.questionKey) return
  const lookupKeys = documentKeyLookupKeys(input.questionKey)
  const orMatches: Prisma.DocumentRequestItemWhereInput[] = [
    ...(input.documentRequestItemId ? [{ id: input.documentRequestItemId }] : []),
    { documentKey: { in: lookupKeys } },
  ]

  const items = await prisma.documentRequestItem.findMany({
    where: {
      caseId: input.caseId,
      documentRequest: { cancelledAt: null },
      OR: orMatches,
    },
  })
  const target =
    items.find((item) => item.id === input.documentRequestItemId) ??
    items.find((item) => lookupKeys.includes(item.documentKey)) ??
    items[0]
  const targetItems = input.documentRequestItemId
    ? items.filter((item) => item.id === input.documentRequestItemId)
    : items.filter((item) => lookupKeys.includes(item.documentKey)).slice(0, 1)
  for (const item of targetItems) {
    if (item.status === 'ACCEPTED' || item.status === 'UPLOADED' || item.status === 'SUBMITTED' || item.status === 'UNDER_REVIEW') continue
    await prisma.documentRequestItem.update({ where: { id: item.id }, data: { status: 'UPLOADED' } })
  }
  if (target) {
    await prisma.caseDocument.update({
      where: { id: input.documentId },
      data: {
        documentRequestId: input.documentRequestId ?? target.documentRequestId,
        documentRequestItemId: target.id,
      },
    })
  }
}

/** Repair older rows that have a file on disk but still say REQUESTED. */
export async function reconcileRequestItemsForCandidate(candidateId: string) {
  const items = await prisma.documentRequestItem.findMany({
    where: { candidateId, documentRequest: { cancelledAt: null } },
  })
  if (!items.length) return
  const documents = await prisma.caseDocument.findMany({
    where: {
      candidateId,
      isCurrentVersion: true,
      status: { not: 'ARCHIVED' },
      evidenceEntryId: null,
    },
    select: {
      id: true,
      questionKey: true,
      documentType: true,
      documentRequestItemId: true,
      status: true,
      isCurrentVersion: true,
    },
  })
  for (const item of items) {
    const matched = filesForRequirement(item, documents)
    if (!matched.length) continue
    if (!OPEN_ITEM_STATUSES.includes(item.status)) continue
    await prisma.documentRequestItem.update({
      where: { id: item.id },
      data: { status: 'UPLOADED' },
    })
  }
}
