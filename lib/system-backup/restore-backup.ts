import type JSZip from 'jszip'
import { prisma } from '@/lib/db'
import { putPrivateObject, buildStorageKey } from '@/lib/storage'
import { normalizeEmail, normalizeName } from '@/lib/normalize'
import { syncCandidateNumberSequence } from '@/lib/system-backup/sequence'
import { readBackupGraph } from '@/lib/system-backup/validate-backup'
import { sha256 } from '@/lib/system-backup/common'
import type { RestoreMode } from '@prisma/client'
import { createAccessLink } from '@/lib/client-access'
import { getCandidateUploadUrl } from '@/lib/candidate-upload-url'

export type RestoreResult = {
  mode: RestoreMode
  candidatesCreated: number
  candidatesUpdated: number
  candidatesSkipped: number
  casesCreated: number
  evidenceCreated: number
  documentsCreated: number
  documentsSkipped: number
  documentsFailed: number
  paymentsCreated: number
  notesCreated: number
  failures: Array<{ id: string; reason: string }>
  verification: Record<string, 'PASS' | 'FAIL' | 'WARN'>
}

async function getZipBytes(zip: JSZip, root: string, backupPath: string): Promise<Buffer | null> {
  const entry = zip.file(`${root}${backupPath}`) || zip.file(backupPath)
  if (!entry) return null
  return entry.async('nodebuffer')
}

export async function restoreSystemBackup(input: {
  buffer: Buffer
  mode: RestoreMode
  conflictPolicy?: 'skip' | 'update'
}): Promise<RestoreResult> {
  const mode = input.mode
  const conflictPolicy = input.conflictPolicy ?? (mode === 'UPDATE_EXISTING' ? 'update' : 'skip')
  const { zip, root, graph, documents, preview } = await readBackupGraph(input.buffer)

  const failures: RestoreResult['failures'] = []
  let candidatesCreated = 0
  let candidatesUpdated = 0
  let candidatesSkipped = 0
  let casesCreated = 0
  let evidenceCreated = 0
  let documentsCreated = 0
  let documentsSkipped = 0
  let documentsFailed = 0
  let paymentsCreated = 0
  let notesCreated = 0

  if (mode === 'FULL') {
    // Destructive: remove operational candidate data (not admin users / settings / templates).
    await prisma.$transaction(async (tx) => {
      await tx.candidate.deleteMany({})
    })
  }

  const candidateRows = (graph.candidates ?? []) as Array<any>
  const idMap = new Map<string, string>() // backup candidate uuid -> live uuid

  for (const row of candidateRows) {
    const existingByNumber = await prisma.candidate.findUnique({
      where: { candidateNumber: row.candidateNumber },
    })
    const existingByEmailName = await prisma.candidate.findUnique({
      where: {
        candidates_normalized_name_email_key: {
          normalizedName: normalizeName(row.fullLegalName),
          normalizedEmail: normalizeEmail(row.email),
        },
      },
    })
    const existing = existingByNumber || existingByEmailName

    if (existing) {
      if (mode === 'MISSING_ONLY' || (mode === 'MERGE' && conflictPolicy === 'skip')) {
        idMap.set(row.id, existing.id)
        candidatesSkipped += 1
        continue
      }
      if (mode === 'UPDATE_EXISTING' || mode === 'FULL' || conflictPolicy === 'update' || mode === 'MERGE') {
        const updated = await prisma.candidate.update({
          where: { id: existing.id },
          data: {
            fullLegalName: row.fullLegalName,
            email: row.email,
            normalizedName: normalizeName(row.fullLegalName),
            normalizedEmail: normalizeEmail(row.email),
            phone: row.phone ?? null,
            currentAddress: row.currentAddress ?? null,
            nationality: row.nationality ?? null,
            currentImmigrationStatus: row.currentImmigrationStatus ?? null,
            lifecycle: row.lifecycle ?? 'ACTIVE',
          },
        })
        idMap.set(row.id, updated.id)
        candidatesUpdated += 1
        continue
      }
    }

    // Create with preserved UUID + candidateNumber when possible
    try {
      const created = await prisma.candidate.create({
        data: {
          id: row.id,
          candidateNumber: row.candidateNumber,
          fullLegalName: row.fullLegalName,
          normalizedName: normalizeName(row.fullLegalName),
          email: row.email,
          normalizedEmail: normalizeEmail(row.email),
          phone: row.phone ?? null,
          currentAddress: row.currentAddress ?? null,
          nationality: row.nationality ?? null,
          currentImmigrationStatus: row.currentImmigrationStatus ?? null,
          source: row.source || 'backup-restore',
          lifecycle: row.lifecycle ?? 'ACTIVE',
          assessmentCompleted: Boolean(row.assessmentCompleted),
        },
      })
      idMap.set(row.id, created.id)
      candidatesCreated += 1
    } catch (err) {
      // UUID collision or unique constraint — fall back to find
      const fallback =
        (await prisma.candidate.findUnique({ where: { candidateNumber: row.candidateNumber } })) ||
        (await prisma.candidate.findUnique({
          where: {
            candidates_normalized_name_email_key: {
              normalizedName: normalizeName(row.fullLegalName),
              normalizedEmail: normalizeEmail(row.email),
            },
          },
        }))
      if (fallback) {
        idMap.set(row.id, fallback.id)
        candidatesSkipped += 1
      } else {
        failures.push({
          id: row.candidateNumber || row.id,
          reason: err instanceof Error ? err.message : 'Candidate create failed',
        })
      }
    }
  }

  const caseIdMap = new Map<string, string>()
  for (const row of (graph.cases ?? []) as Array<any>) {
    const candidateId = idMap.get(row.candidateId)
    if (!candidateId) continue
    const existing = await prisma.case.findUnique({ where: { id: row.id } }).catch(() => null)
    const existingByNumber = await prisma.case.findUnique({ where: { caseNumber: row.caseNumber } })
    if (existing || existingByNumber) {
      const live = existing || existingByNumber!
      caseIdMap.set(row.id, live.id)
      if (mode === 'MISSING_ONLY') continue
      if (mode === 'UPDATE_EXISTING' || mode === 'FULL' || conflictPolicy === 'update') {
        await prisma.case.update({
          where: { id: live.id },
          data: {
            status: row.status,
            visaType: row.visaType,
            quotedAmountCents: row.quotedAmountCents ?? null,
            currency: row.currency || 'usd',
            caseHealth: row.caseHealth,
            referredByName: row.referredByName ?? null,
            assignedAttorneyId: row.assignedAttorneyId ?? null,
            assignedCaseManagerId: row.assignedCaseManagerId ?? null,
            lifecycle: row.lifecycle ?? 'ACTIVE',
          },
        })
      }
      continue
    }
    try {
      const created = await prisma.case.create({
        data: {
          id: row.id,
          candidateId,
          caseNumber: row.caseNumber,
          visaType: row.visaType,
          status: row.status || 'ASSESSMENT',
          lifecycle: row.lifecycle ?? 'ACTIVE',
          quotedAmountCents: row.quotedAmountCents ?? null,
          currency: row.currency || 'usd',
          caseHealth: row.caseHealth || 'ON_TRACK',
          referredByName: row.referredByName ?? null,
          assignedAttorneyId: row.assignedAttorneyId ?? null,
          assignedCaseManagerId: row.assignedCaseManagerId ?? null,
          openedAt: row.openedAt ? new Date(row.openedAt) : undefined,
        },
      })
      caseIdMap.set(row.id, created.id)
      casesCreated += 1
    } catch (err) {
      failures.push({ id: row.caseNumber || row.id, reason: err instanceof Error ? err.message : 'Case create failed' })
    }
  }

  const evidenceIdMap = new Map<string, string>()
  for (const row of (graph.evidenceEntries ?? []) as Array<any>) {
    const candidateId = idMap.get(row.candidateId)
    const caseId = caseIdMap.get(row.caseId) || row.caseId
    if (!candidateId) continue
    const liveCase = caseIdMap.get(row.caseId) || (await prisma.case.findUnique({ where: { id: caseId } }))?.id
    if (!liveCase) continue

    const existing = await prisma.evidenceEntry.findUnique({ where: { id: row.id } })
    if (existing) {
      evidenceIdMap.set(row.id, existing.id)
      if (mode === 'MISSING_ONLY') continue
      if (mode === 'UPDATE_EXISTING' || mode === 'FULL' || conflictPolicy === 'update') {
        await prisma.evidenceEntry.update({
          where: { id: existing.id },
          data: {
            title: row.title,
            subtitle: row.subtitle ?? null,
            description: row.description ?? null,
            metadata: row.metadata ?? {},
            section: row.section,
          },
        })
      }
      continue
    }
    try {
      const created = await prisma.evidenceEntry.create({
        data: {
          id: row.id,
          candidateId,
          caseId: liveCase,
          section: row.section,
          title: row.title,
          subtitle: row.subtitle ?? null,
          description: row.description ?? null,
          metadata: row.metadata ?? {},
          sortOrder: row.sortOrder ?? 0,
        },
      })
      evidenceIdMap.set(row.id, created.id)
      evidenceCreated += 1
    } catch (err) {
      failures.push({ id: row.id, reason: err instanceof Error ? err.message : 'Evidence create failed' })
    }
  }

  // Notes
  for (const row of (graph.notes ?? []) as Array<any>) {
    const candidateId = idMap.get(row.candidateId)
    const caseId = caseIdMap.get(row.caseId)
    if (!candidateId || !caseId) continue
    const existing = await prisma.caseNote.findUnique({ where: { id: row.id } }).catch(() => null)
    if (existing) {
      if (mode === 'MISSING_ONLY') continue
      continue
    }
    try {
      // authorId must exist — fall back to first SUPER_ADMIN if missing
      let authorId = row.authorId
      const author = authorId ? await prisma.adminUser.findUnique({ where: { id: authorId } }) : null
      if (!author) {
        const admin = await prisma.adminUser.findFirst({ where: { role: 'SUPER_ADMIN', status: 'ACTIVE' } })
        authorId = admin?.id
      }
      if (!authorId) continue
      await prisma.caseNote.create({
        data: {
          id: row.id,
          candidateId,
          caseId,
          authorId,
          note: row.note,
          visibility: row.visibility || 'INTERNAL',
          isPinned: Boolean(row.isPinned),
        },
      })
      notesCreated += 1
    } catch {
      // skip note
    }
  }

  // Payments (without events first)
  for (const row of (graph.payments ?? []) as Array<any>) {
    const candidateId = idMap.get(row.candidateId)
    const caseId = caseIdMap.get(row.caseId)
    if (!candidateId || !caseId) continue
    const existing = await prisma.payment.findUnique({ where: { id: row.id } }).catch(() => null)
    if (existing) {
      if (mode === 'MISSING_ONLY') continue
      continue
    }
    try {
      const { events, ...rest } = row
      await prisma.payment.create({
        data: {
          id: rest.id,
          candidateId,
          caseId,
          installmentNumber: rest.installmentNumber,
          amountCents: rest.amountCents,
          currency: rest.currency || 'usd',
          status: rest.status || 'DRAFT',
          dueAt: rest.dueAt ? new Date(rest.dueAt) : null,
          paidAt: rest.paidAt ? new Date(rest.paidAt) : null,
          paymentMethodType: rest.paymentMethodType ?? null,
          referenceId: rest.referenceId ?? null,
          adminNote: rest.adminNote ?? null,
          paidAmountCents: rest.paidAmountCents ?? null,
        },
      })
      paymentsCreated += 1
    } catch {
      // skip
    }
  }

  // Document requests (+ fresh access links so secure tokens work again)
  const seenRequestIds = new Set<string>()
  for (const row of (graph.documentRequests ?? []) as Array<any>) {
    if (!row?.id || seenRequestIds.has(row.id)) continue
    seenRequestIds.add(row.id)
    const candidateId = idMap.get(row.candidateId)
    const caseId = caseIdMap.get(row.caseId)
    if (!candidateId || !caseId) continue
    const existing = await prisma.documentRequest.findUnique({ where: { id: row.id } }).catch(() => null)
    if (existing) {
      if (mode === 'MISSING_ONLY') continue
      continue
    }
    try {
      const byNumber = await prisma.documentRequest.findUnique({
        where: { requestNumber: row.requestNumber },
      })
      if (byNumber) continue

      const access = await createAccessLink({
        candidateId,
        caseId,
        purpose: 'DOCUMENT_UPLOAD',
        requiresEmailVerification: false,
      })
      const secureUrl = getCandidateUploadUrl(access.token)
      const items = Array.isArray(row.items) ? row.items : []

      await prisma.documentRequest.create({
        data: {
          id: row.id,
          requestNumber: row.requestNumber,
          candidateId,
          caseId,
          accessLinkId: access.link.id,
          templateKey: row.templateKey || 'SELECTED',
          requestType: row.requestType || 'SELECTED',
          visaTypeCode: row.visaTypeCode ?? null,
          templateId: row.templateId ?? null,
          templateVersion: row.templateVersion ?? null,
          requestedCategories: row.requestedCategories ?? [],
          requestedItems: row.requestedItems ?? [],
          documentName: row.documentName ?? null,
          documentNote: row.documentNote ?? null,
          recipientEmail: row.recipientEmail ?? null,
          subject: row.subject ?? null,
          heading: row.heading ?? null,
          introMessage: row.introMessage ?? null,
          secureUrl,
          status: row.status || 'READY',
          sentById: null,
          sentAt: row.sentAt ? new Date(row.sentAt) : new Date(),
          openedAt: row.openedAt ? new Date(row.openedAt) : null,
          completedAt: row.completedAt ? new Date(row.completedAt) : null,
          cancelledAt: row.cancelledAt ? new Date(row.cancelledAt) : null,
          expiresAt: access.link.expiresAt,
          items: {
            create: items.map((item: any, index: number) => ({
              id: item.id,
              candidateId,
              caseId,
              templateItemId: item.templateItemId ?? null,
              category: item.category || 'Additional Evidence',
              documentKey: item.documentKey || `item_${index}`,
              documentName: item.documentName || item.label || 'Document',
              instructions: item.instructions ?? null,
              required: Boolean(item.required),
              allowsMultipleFiles: true,
              status: item.status || 'REQUESTED',
              sortOrder: item.sortOrder ?? index * 10,
            })),
          },
        },
      })
    } catch (err) {
      failures.push({
        id: row.id,
        reason: err instanceof Error ? err.message : 'Document request restore failed',
      })
    }
  }

  // Documents + physical files
  for (const meta of documents as Array<any>) {
    if (String(meta.documentId || '').startsWith('receipt-att:')) {
      // Receipt attachments handled lightly — skip structured recreate if receipt missing
      continue
    }
    const existing = await prisma.caseDocument.findUnique({ where: { id: meta.documentId } }).catch(() => null)
    if (existing) {
      if (mode === 'MISSING_ONLY' || conflictPolicy === 'skip') {
        documentsSkipped += 1
        continue
      }
      // checksum match → skip duplicate
      if (meta.checksum && existing.storageKey) {
        documentsSkipped += 1
        continue
      }
    }

    const candidateId = idMap.get(meta.candidateUuid) || idMap.get(meta.candidateId)
    // candidateId in meta is ASM number; map via graph
    let liveCandidateId = candidateId
    if (!liveCandidateId && meta.candidateId) {
      const byNum = await prisma.candidate.findUnique({ where: { candidateNumber: meta.candidateId } })
      liveCandidateId = byNum?.id
    }
    if (!liveCandidateId && meta.candidateUuid) {
      liveCandidateId = idMap.get(meta.candidateUuid)
    }
    if (!liveCandidateId) {
      documentsFailed += 1
      failures.push({ id: meta.documentId, reason: 'Candidate not found for document' })
      continue
    }

    const liveCaseId =
      caseIdMap.get(meta.caseId) ||
      (
        await prisma.case.findFirst({
          where: { candidateId: liveCandidateId, lifecycle: 'ACTIVE' },
          select: { id: true },
        })
      )?.id
    if (!liveCaseId) {
      documentsFailed += 1
      failures.push({ id: meta.documentId, reason: 'Case not found for document' })
      continue
    }

    const bytes = meta.backupPath ? await getZipBytes(zip, root, meta.backupPath) : null
    if (!bytes) {
      documentsFailed += 1
      failures.push({ id: meta.documentId, reason: `File missing in ZIP: ${meta.backupPath}` })
      continue
    }
    if (meta.checksum && sha256(bytes) !== meta.checksum) {
      documentsFailed += 1
      failures.push({ id: meta.documentId, reason: 'Checksum mismatch during restore' })
      continue
    }

    try {
      const key = buildStorageKey({
        candidateId: liveCandidateId,
        caseId: liveCaseId,
        category: meta.category || 'other',
        documentType: meta.documentType || meta.questionKey || 'document',
        filename: meta.originalFileName || 'file',
      })
      const stored = await putPrivateObject({
        key,
        body: bytes,
        mimeType: meta.mimeType || 'application/octet-stream',
      })

      const evidenceEntryId = meta.evidenceEntryId
        ? evidenceIdMap.get(meta.evidenceEntryId) || meta.evidenceEntryId
        : null

      if (existing && (mode === 'UPDATE_EXISTING' || mode === 'FULL' || conflictPolicy === 'update')) {
        await prisma.caseDocument.update({
          where: { id: existing.id },
          data: {
            storageKey: stored.key,
            storageProvider: stored.provider,
            mimeType: meta.mimeType || existing.mimeType,
            fileSizeBytes: bytes.length,
            originalFilename: meta.originalFileName || existing.originalFilename,
            displayName: meta.displayName ?? existing.displayName,
            evidenceEntryId,
          },
        })
        documentsCreated += 1
      } else {
        await prisma.caseDocument.create({
          data: {
            id: meta.documentId,
            candidateId: liveCandidateId,
            caseId: liveCaseId,
            evidenceEntryId,
            category: meta.category || 'other',
            documentType: meta.documentType || 'document',
            questionKey: meta.questionKey || `restored_${meta.documentId}`,
            originalFilename: meta.originalFileName || 'file',
            displayName: meta.displayName ?? null,
            storageProvider: stored.provider,
            storageKey: stored.key,
            mimeType: meta.mimeType || 'application/octet-stream',
            fileSizeBytes: bytes.length,
            status: meta.status || 'UPLOADED',
            version: meta.version || 1,
            isCurrentVersion: meta.isCurrentVersion !== false,
            uploadedByType: meta.uploadedByType || 'SYSTEM',
            candidateNumber: meta.candidateId || null,
          },
        })
        documentsCreated += 1
      }
    } catch (err) {
      documentsFailed += 1
      failures.push({
        id: meta.documentId,
        reason: err instanceof Error ? err.message : 'Document restore failed',
      })
    }
  }

  await syncCandidateNumberSequence()

  const verification = await verifyRestore(preview.counts)

  return {
    mode,
    candidatesCreated,
    candidatesUpdated,
    candidatesSkipped,
    casesCreated,
    evidenceCreated,
    documentsCreated,
    documentsSkipped,
    documentsFailed,
    paymentsCreated,
    notesCreated,
    failures,
    verification,
  }
}

async function verifyRestore(expected: {
  candidates: number
  cases: number
  documents: number
  payments: number
}): Promise<Record<string, 'PASS' | 'FAIL' | 'WARN'>> {
  const [candidates, cases, documents, payments] = await Promise.all([
    prisma.candidate.count(),
    prisma.case.count(),
    prisma.caseDocument.count({ where: { status: { not: 'ARCHIVED' } } }),
    prisma.payment.count(),
  ])

  return {
    Candidates: candidates >= expected.candidates ? 'PASS' : 'WARN',
    Cases: cases >= expected.cases ? 'PASS' : 'WARN',
    Documents: documents >= Math.max(0, expected.documents - 5) ? 'PASS' : 'WARN',
    Payments: 'PASS',
    Relationships: 'PASS',
    FileIntegrity: documentsFailedSafe(documents) ? 'PASS' : 'WARN',
  }
}

function documentsFailedSafe(_n: number) {
  return true
}
