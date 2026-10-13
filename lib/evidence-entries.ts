import type { EvidenceSection, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { audit, logActivity, ActivityType } from '@/lib/activity'
import { EVIDENCE_SECTIONS, sectionMeta } from '@/lib/evidence-section-meta'

export { EVIDENCE_SECTIONS, sectionMeta }

export async function listEvidenceEntries(caseId: string) {
  return prisma.evidenceEntry.findMany({
    where: { caseId },
    orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      documents: {
        where: { status: { not: 'ARCHIVED' } },
        orderBy: { uploadedAt: 'desc' },
      },
    },
  })
}

export async function createEvidenceEntry(input: {
  candidateId: string
  caseId: string
  section: EvidenceSection
  title: string
  subtitle?: string | null
  description?: string | null
  metadata?: Prisma.InputJsonValue
  actorId?: string
  actorType?: 'CANDIDATE' | 'ADMIN'
}) {
  const title = input.title.trim()
  if (!title) throw new Error('Title is required.')
  const count = await prisma.evidenceEntry.count({
    where: { caseId: input.caseId, section: input.section },
  })
  const entry = await prisma.evidenceEntry.create({
    data: {
      candidateId: input.candidateId,
      caseId: input.caseId,
      section: input.section,
      title,
      subtitle: input.subtitle?.trim() || null,
      description: input.description?.trim() || null,
      metadata: input.metadata ?? {},
      sortOrder: count,
    },
  })
  await logActivity({
    candidateId: input.candidateId,
    caseId: input.caseId,
    type: ActivityType.PROFILE_UPDATED,
    message: `${sectionMeta(input.section).label} entry added: ${title}`,
    actorType: input.actorType ?? 'ADMIN',
    actorId: input.actorId,
    metadata: { evidenceEntryId: entry.id, section: input.section },
  })
  return entry
}

export async function updateEvidenceEntry(input: {
  entryId: string
  title?: string
  subtitle?: string | null
  description?: string | null
  metadata?: Prisma.InputJsonValue
  actorId?: string
}) {
  const existing = await prisma.evidenceEntry.findUnique({ where: { id: input.entryId } })
  if (!existing) throw new Error('Entry not found')
  const updated = await prisma.evidenceEntry.update({
    where: { id: input.entryId },
    data: {
      title: input.title?.trim() ?? undefined,
      subtitle: input.subtitle === undefined ? undefined : input.subtitle?.trim() || null,
      description: input.description === undefined ? undefined : input.description?.trim() || null,
      metadata: input.metadata,
    },
  })
  if (input.actorId) {
    await audit({
      actorId: input.actorId,
      action: 'EVIDENCE_ENTRY_UPDATED',
      entityType: 'evidence_entry',
      entityId: updated.id,
      metadata: { section: updated.section },
    })
  }
  return updated
}

export async function deleteEvidenceEntry(input: { entryId: string; actorId?: string }) {
  const existing = await prisma.evidenceEntry.findUnique({
    where: { id: input.entryId },
    include: { documents: { select: { id: true } } },
  })
  if (!existing) throw new Error('Entry not found')
  // Soft-archive documents; keep storage. Detach then delete entry.
  await prisma.$transaction([
    prisma.caseDocument.updateMany({
      where: { evidenceEntryId: existing.id },
      data: { status: 'ARCHIVED', isCurrentVersion: false, evidenceEntryId: null },
    }),
    prisma.evidenceEntry.delete({ where: { id: existing.id } }),
  ])
  if (input.actorId) {
    await audit({
      actorId: input.actorId,
      action: 'EVIDENCE_ENTRY_DELETED',
      entityType: 'evidence_entry',
      entityId: existing.id,
      metadata: { section: existing.section, title: existing.title, documentCount: existing.documents.length },
    })
  }
  return existing
}
