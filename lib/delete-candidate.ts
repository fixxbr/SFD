import { deleteObject, storageConfigured } from '@/lib/storage'
import { prisma } from '@/lib/db'
import { audit, logActivity, ActivityType } from '@/lib/activity'

/**
 * Soft-delete / archive a candidate and their active cases.
 * Preserves payments, documents, communications, and audit history.
 * Candidate numbers are never reused.
 */
export async function archiveCandidate(input: {
  candidateId: string
  actorId: string
  reason?: string | null
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: input.candidateId },
    select: {
      id: true,
      candidateNumber: true,
      fullLegalName: true,
      email: true,
      lifecycle: true,
    },
  })
  if (!candidate) return null
  if (candidate.lifecycle === 'ARCHIVED') return candidate

  await prisma.$transaction([
    prisma.candidate.update({
      where: { id: candidate.id },
      data: { lifecycle: 'ARCHIVED' },
    }),
    prisma.case.updateMany({
      where: { candidateId: candidate.id, lifecycle: 'ACTIVE' },
      data: { lifecycle: 'ARCHIVED' },
    }),
  ])

  await logActivity({
    candidateId: candidate.id,
    type: ActivityType.CASE_STATUS_CHANGED,
    message: `Candidate archived (${candidate.candidateNumber})`,
    actorType: 'ADMIN',
    actorId: input.actorId,
    metadata: { reason: input.reason ?? null },
  })
  await audit({
    actorId: input.actorId,
    action: 'CANDIDATE_ARCHIVED',
    entityType: 'candidate',
    entityId: candidate.id,
    metadata: {
      candidateNumber: candidate.candidateNumber,
      fullLegalName: candidate.fullLegalName,
      email: candidate.email,
      reason: input.reason ?? null,
    },
  })

  return candidate
}

export async function restoreCandidate(input: {
  candidateId: string
  actorId: string
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: input.candidateId },
    select: { id: true, candidateNumber: true, fullLegalName: true, lifecycle: true },
  })
  if (!candidate) return null

  await prisma.$transaction([
    prisma.candidate.update({
      where: { id: candidate.id },
      data: { lifecycle: 'ACTIVE' },
    }),
    prisma.case.updateMany({
      where: { candidateId: candidate.id, lifecycle: 'ARCHIVED' },
      data: { lifecycle: 'ACTIVE' },
    }),
  ])

  await logActivity({
    candidateId: candidate.id,
    type: ActivityType.CASE_STATUS_CHANGED,
    message: `Candidate restored (${candidate.candidateNumber})`,
    actorType: 'ADMIN',
    actorId: input.actorId,
  })
  await audit({
    actorId: input.actorId,
    action: 'CANDIDATE_RESTORED',
    entityType: 'candidate',
    entityId: candidate.id,
    metadata: { candidateNumber: candidate.candidateNumber },
  })

  return candidate
}

/**
 * Permanently remove a candidate and all Neon-linked data.
 * Also deletes private storage objects when configured.
 * Candidate numbers are never reused (sequence-only allocation).
 * Prefer archiveCandidate for normal admin deletes.
 */
export async function permanentlyDeleteCandidate(input: {
  candidateId: string
  actorId: string
}) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: input.candidateId },
    select: {
      id: true,
      candidateNumber: true,
      fullLegalName: true,
      email: true,
      documents: { select: { storageKey: true } },
    },
  })
  if (!candidate) return null

  if (storageConfigured()) {
    for (const doc of candidate.documents) {
      try {
        await deleteObject(doc.storageKey)
      } catch {
        // Continue deleting Neon rows even if a storage object is already gone.
      }
    }
  }

  await prisma.candidate.delete({ where: { id: candidate.id } })

  await audit({
    actorId: input.actorId,
    action: 'CANDIDATE_DELETED',
    entityType: 'candidate',
    entityId: candidate.id,
    metadata: {
      candidateNumber: candidate.candidateNumber,
      fullLegalName: candidate.fullLegalName,
      email: candidate.email,
    },
  })

  return candidate
}
