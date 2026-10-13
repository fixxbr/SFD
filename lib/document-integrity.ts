import { prisma } from '@/lib/db'
import { documentHasContent } from '@/lib/documents-checklist'

export type DocumentIntegrityIssue = {
  code:
    | 'METADATA_WITHOUT_STORAGE'
    | 'STORAGE_WITHOUT_METADATA'
    | 'ZERO_BYTE_DOCUMENT'
    | 'CASE_CANDIDATE_MISMATCH'
    | 'ORPHAN_EVIDENCE_POINTER'
  severity: 'error' | 'warning'
  documentId?: string
  storageKey?: string
  candidateId?: string
  caseId?: string
  detail: string
}

/**
 * Read-only integrity scan for documents that may be “uploaded” but invisible
 * or unlinkable. Does not mutate data.
 */
export async function diagnoseDocumentIntegrity(input?: {
  candidateId?: string
  caseId?: string
  limit?: number
}): Promise<{
  scannedDocuments: number
  scannedStoredObjects: number
  issues: DocumentIntegrityIssue[]
}> {
  const limit = input?.limit ?? 5000
  const documents = await prisma.caseDocument.findMany({
    where: {
      ...(input?.candidateId ? { candidateId: input.candidateId } : {}),
      ...(input?.caseId ? { caseId: input.caseId } : {}),
      status: { not: 'ARCHIVED' },
    },
    take: limit,
    select: {
      id: true,
      candidateId: true,
      caseId: true,
      storageKey: true,
      storageProvider: true,
      fileSizeBytes: true,
      originalFilename: true,
      displayName: true,
      evidenceEntryId: true,
      questionKey: true,
    },
  })

  const storageKeys = [...new Set(documents.map((d) => d.storageKey).filter(Boolean))]
  const stored = storageKeys.length
    ? await prisma.storedObject.findMany({
        where: { key: { in: storageKeys } },
        select: { key: true, byteSize: true },
      })
    : []
  const storedByKey = new Map(stored.map((row) => [row.key, row]))

  const issues: DocumentIntegrityIssue[] = []

  for (const doc of documents) {
    if (!documentHasContent(doc)) {
      issues.push({
        code: 'ZERO_BYTE_DOCUMENT',
        severity: 'warning',
        documentId: doc.id,
        candidateId: doc.candidateId,
        caseId: doc.caseId,
        storageKey: doc.storageKey,
        detail: `Document ${doc.id} (${doc.originalFilename}) has no usable payload.`,
      })
    }
    if (doc.storageProvider === 'neon_pg' || !doc.storageProvider) {
      if (!storedByKey.has(doc.storageKey)) {
        issues.push({
          code: 'METADATA_WITHOUT_STORAGE',
          severity: 'error',
          documentId: doc.id,
          candidateId: doc.candidateId,
          caseId: doc.caseId,
          storageKey: doc.storageKey,
          detail: `CaseDocument ${doc.id} points at missing stored_objects key ${doc.storageKey}.`,
        })
      }
    }
  }

  // Case ↔ candidate ownership mismatches (batch, not N+1).
  const caseIds = [...new Set(documents.map((d) => d.caseId))]
  const cases = caseIds.length
    ? await prisma.case.findMany({
        where: { id: { in: caseIds } },
        select: { id: true, candidateId: true },
      })
    : []
  const caseOwner = new Map(cases.map((c) => [c.id, c.candidateId]))
  for (const doc of documents) {
    const owner = caseOwner.get(doc.caseId)
    if (owner && owner !== doc.candidateId) {
      issues.push({
        code: 'CASE_CANDIDATE_MISMATCH',
        severity: 'error',
        documentId: doc.id,
        candidateId: doc.candidateId,
        caseId: doc.caseId,
        detail: `Document ${doc.id} candidateId does not match case owner.`,
      })
    }
  }

  for (const doc of documents) {
    if (doc.evidenceEntryId) {
      const entry = await prisma.evidenceEntry.findUnique({
        where: { id: doc.evidenceEntryId },
        select: { id: true, candidateId: true, caseId: true },
      })
      if (!entry) {
        issues.push({
          code: 'ORPHAN_EVIDENCE_POINTER',
          severity: 'warning',
          documentId: doc.id,
          candidateId: doc.candidateId,
          caseId: doc.caseId,
          detail: `Document ${doc.id} references missing evidence entry ${doc.evidenceEntryId}.`,
        })
      } else if (entry.candidateId !== doc.candidateId || entry.caseId !== doc.caseId) {
        issues.push({
          code: 'CASE_CANDIDATE_MISMATCH',
          severity: 'error',
          documentId: doc.id,
          candidateId: doc.candidateId,
          caseId: doc.caseId,
          detail: `Document ${doc.id} evidence entry belongs to a different candidate/case.`,
        })
      }
    }
  }

  // Storage blobs with no CaseDocument (ambiguous — report only, do not auto-attach).
  const orphanBlobs = await prisma.storedObject.findMany({
    where: input?.candidateId
      ? { key: { contains: input.candidateId } }
      : undefined,
    take: Math.min(limit, 2000),
    select: { key: true, byteSize: true },
  })
  const docKeySet = new Set(documents.map((d) => d.storageKey))
  // Also check whether any CaseDocument references these keys globally.
  const referenced = orphanBlobs.length
    ? await prisma.caseDocument.findMany({
        where: { storageKey: { in: orphanBlobs.map((b) => b.key) } },
        select: { storageKey: true },
      })
    : []
  const referencedSet = new Set(referenced.map((r) => r.storageKey))
  for (const blob of orphanBlobs) {
    if (docKeySet.has(blob.key) || referencedSet.has(blob.key)) continue
    issues.push({
      code: 'STORAGE_WITHOUT_METADATA',
      severity: 'warning',
      storageKey: blob.key,
      detail: `stored_objects row ${blob.key} has no CaseDocument metadata (manual review required).`,
    })
  }

  return {
    scannedDocuments: documents.length,
    scannedStoredObjects: stored.length + orphanBlobs.length,
    issues,
  }
}

/**
 * Safe repair: only restores CaseDocument ↔ evidenceEntry ownership when the
 * evidence entry still exists and IDs already match candidate/case.
 * Never invents ownership for storage-only blobs.
 */
export async function repairUnambiguousDocumentLinks(input?: {
  candidateId?: string
  caseId?: string
  dryRun?: boolean
}) {
  const dryRun = input?.dryRun !== false
  const diagnosis = await diagnoseDocumentIntegrity(input)
  const actionable = diagnosis.issues.filter((i) => i.code === 'ORPHAN_EVIDENCE_POINTER')
  const repairs: Array<{ documentId: string; action: string }> = []

  for (const issue of actionable) {
    if (!issue.documentId) continue
    // Clear dangling evidence pointer so the file reappears in the flat Documents checklist.
    if (!dryRun) {
      await prisma.caseDocument.update({
        where: { id: issue.documentId },
        data: { evidenceEntryId: null },
      })
    }
    repairs.push({
      documentId: issue.documentId,
      action: dryRun
        ? 'Would clear dangling evidenceEntryId so the file shows under Documents'
        : 'Cleared dangling evidenceEntryId',
    })
  }

  return {
    dryRun,
    diagnosis,
    repairs,
    ambiguousStorageOnly: diagnosis.issues.filter((i) => i.code === 'STORAGE_WITHOUT_METADATA').length,
  }
}
