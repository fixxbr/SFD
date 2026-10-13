import type { DocumentStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { ActivityType, logActivity } from '@/lib/activity'
import { questionByKey } from '@/lib/onboarding-catalog'
import { buildStorageKey, putPrivateObjectTx, signedGetUrl, localSignedFileUrl, isS3Provider, validateUpload, usingCloudStorage } from '@/lib/storage'
import { nextDocumentVersion } from '@/lib/documents-version'
import { resolveAllowedMimeType } from '@/lib/upload-validation'
import { sanitizeFilename } from '@/lib/normalize'

/** MIME type stored on link rows. Links are never validated or counted as document files. */
export const LINK_MIME_TYPE = 'text/uri-list'
export { buildChecklist } from '@/lib/documents-checklist'

/** Unique key so a second file on the same education/employment record does not replace the first. */
export function evidenceAttachmentQuestionKey(baseKey: string, evidenceEntryId: string, nonce = Date.now().toString(36)) {
  const base = baseKey.trim()
  const entry = evidenceEntryId.trim()
  const stamp = nonce.trim()
  if (!base || !entry || !stamp) throw new Error('Evidence attachment key requires a record and nonce.')
  return `${base}__${entry}__${stamp}`
}

export async function uploadCaseDocument(input: {
  candidateId: string
  caseId: string
  onboardingSubmissionId?: string | null
  questionKey: string
  category?: string
  documentType?: string
  file: { buffer: Buffer; mimeType: string; filename: string; size: number }
  uploadedByType: 'CANDIDATE' | 'ADMIN' | 'LAWYER' | 'SYSTEM'
  uploadedById?: string | null
  adminNote?: string | null
  /** Required explanation of what this specific file is. */
  description: string
  actorMessage?: string
  /**
   * Always append by default so every document slot can hold multiple files.
   * Set false only when intentionally replacing via replaceDocumentId.
   */
  append?: boolean
  evidenceEntryId?: string | null
  displayName?: string | null
  /** Replace only this specific file (append siblings stay). */
  replaceDocumentId?: string | null
  /** Stable client key for safe retries after a lost response. */
  clientIdempotencyKey?: string | null
  /**
   * Internal: save a validated http(s) link instead of an uploaded file.
   * Only lib/case-links.ts sets this; upload routes never do.
   */
  externalUrl?: string | null
}) {
  const { validateDocumentDescription } = await import('@/lib/document-description')
  const descCheck = validateDocumentDescription(input.description)
  if (!descCheck.ok) throw new Error(descCheck.error)

  const idempotencyKey = input.clientIdempotencyKey?.trim() || null
  if (idempotencyKey) {
    const existing = await prisma.caseDocument.findFirst({
      where: {
        caseId: input.caseId,
        clientIdempotencyKey: idempotencyKey,
        status: { not: 'ARCHIVED' },
      },
    })
    if (existing) return existing
  }

  const mapped = questionByKey(input.questionKey)
  const category = input.category ?? mapped?.category.id ?? 'additional'
  const documentType = input.documentType ?? mapped?.question.documentType ?? input.questionKey
  const externalUrl = input.externalUrl?.trim() || null
  const safeName = externalUrl
    ? sanitizeFilename(input.file.filename)
    : validateUpload({
        mimeType: input.file.mimeType,
        size: input.file.size,
        filename: input.file.filename,
      })
  const mimeType = externalUrl
    ? LINK_MIME_TYPE
    : resolveAllowedMimeType({ mimeType: input.file.mimeType, filename: input.file.filename }) ||
      input.file.mimeType

  const replaceId = input.replaceDocumentId || null
  // Multiple attachments are always allowed — never replace siblings unless replacing one file id.
  const append = replaceId ? true : input.append !== false

  let current = null as Awaited<ReturnType<typeof prisma.caseDocument.findFirst>>
  if (replaceId) {
    current = await prisma.caseDocument.findUnique({ where: { id: replaceId } })
  } else if (!append) {
    current = await prisma.caseDocument.findFirst({
      where: {
        caseId: input.caseId,
        questionKey: input.questionKey,
        isCurrentVersion: true,
        evidenceEntryId: null,
      },
      orderBy: { version: 'desc' },
    })
  }

  const versionBase = append
    ? await prisma.caseDocument.count({
        where: {
          caseId: input.caseId,
          ...(input.evidenceEntryId
            ? { evidenceEntryId: input.evidenceEntryId }
            : { questionKey: input.questionKey }),
        },
      })
    : current?.version
  const nextVersion = nextDocumentVersion(versionBase ?? undefined)
  const owner = await prisma.candidate.findUnique({
    where: { id: input.candidateId },
    select: { candidateNumber: true },
  })
  const key = buildStorageKey({
    candidateId: input.candidateId,
    caseId: input.caseId,
    category,
    documentType,
    filename: safeName,
  })

  // Entry attachments use a unique question key so checklist/version logic never collapses them.
  // Plain checklist append keeps the same questionKey so the slot still shows “on file”.
  const questionKey =
    input.evidenceEntryId && append
      ? evidenceAttachmentQuestionKey(input.questionKey, input.evidenceEntryId)
      : input.questionKey

  // Neon BYTEA + CaseDocument metadata in one transaction — no half-created uploads.
  const created = await prisma.$transaction(async (tx) => {
    const stored = await putPrivateObjectTx(tx, {
      key,
      body: input.file.buffer,
      mimeType,
    })
    if (current && (!append || replaceId)) {
      await tx.caseDocument.update({
        where: { id: current.id },
        data: {
          isCurrentVersion: false,
          status: current.status === 'ACCEPTED' || current.status === 'UNDER_REVIEW' ? current.status : 'ARCHIVED',
        },
      })
    }
    const row = await tx.caseDocument.create({
      data: {
        candidateId: input.candidateId,
        caseId: input.caseId,
        onboardingSubmissionId: input.onboardingSubmissionId ?? null,
        evidenceEntryId: input.evidenceEntryId ?? null,
        category,
        documentType,
        questionKey,
        originalFilename: input.file.filename,
        displayName: input.displayName?.trim() || null,
        description: descCheck.description,
        externalUrl,
        storageProvider: stored.provider,
        storageKey: stored.key,
        mimeType,
        fileSizeBytes: input.file.size,
        status: 'UPLOADED',
        version: nextVersion,
        isCurrentVersion: true,
        uploadedByType: input.uploadedByType,
        uploadedById: input.uploadedById ?? null,
        adminNote: input.adminNote ?? null,
        clientIdempotencyKey: idempotencyKey,
        candidateNumber: owner?.candidateNumber,
      },
    })
    // Same-transaction proof the blob and metadata are linked before we report success.
    const linked = await tx.storedObject.findUnique({
      where: { key: stored.key },
      select: { key: true, byteSize: true },
    })
    if (!linked || linked.byteSize <= 0) {
      throw new Error('Upload failed because storage could not finalize the file. Please try again.')
    }
    return row
  })

  await logActivity({
    candidateId: input.candidateId,
    caseId: input.caseId,
    type: ActivityType.DOCUMENT_UPLOADED,
    message:
      input.actorMessage ??
      `${mapped?.question.label ?? documentType}${append ? ' file' : ` version ${nextVersion}`} uploaded`,
    actorType: input.uploadedByType === 'LAWYER' ? 'ADMIN' : input.uploadedByType,
    actorId: input.uploadedById,
    metadata: {
      documentId: created.id,
      questionKey,
      version: nextVersion,
      evidenceEntryId: input.evidenceEntryId ?? null,
      append,
      description: descCheck.description,
    },
  })

  return created
}

export async function reviewDocument(input: {
  documentId: string
  reviewerId: string
  status: Extract<DocumentStatus, 'ACCEPTED' | 'REJECTED' | 'NEEDS_REPLACEMENT' | 'NOT_APPLICABLE' | 'UNDER_REVIEW'>
  adminNote?: string | null
}) {
  const document = await prisma.caseDocument.findUnique({ where: { id: input.documentId } })
  if (!document) throw new Error('Document not found')

  const updated = await prisma.caseDocument.update({
    where: { id: input.documentId },
    data: {
      status: input.status,
      adminNote: input.adminNote ?? document.adminNote,
      reviewedAt: new Date(),
      reviewedById: input.reviewerId,
    },
  })

  // Keep document request checklist items in sync with review decisions.
  if (input.status === 'ACCEPTED' || input.status === 'NEEDS_REPLACEMENT') {
    const itemStatus = input.status === 'ACCEPTED' ? 'ACCEPTED' : 'NEEDS_REPLACEMENT'
    const keyMatchers: Array<{ documentKey: string }> = []
    if (document.questionKey) keyMatchers.push({ documentKey: document.questionKey })
    if (document.documentType && document.documentType !== document.questionKey) {
      keyMatchers.push({ documentKey: document.documentType })
    }
    await prisma.documentRequestItem.updateMany({
      where: {
        caseId: document.caseId,
        status: { in: ['REQUESTED', 'UPLOADED'] },
        OR: [
          ...(document.documentRequestItemId ? [{ id: document.documentRequestItemId }] : []),
          ...keyMatchers,
        ],
      },
      data: { status: itemStatus },
    })
  }

  const typeMap = {
    ACCEPTED: ActivityType.DOCUMENT_ACCEPTED,
    REJECTED: ActivityType.DOCUMENT_REJECTED,
    NEEDS_REPLACEMENT: ActivityType.REPLACEMENT_REQUESTED,
    NOT_APPLICABLE: ActivityType.DOCUMENT_ACCEPTED,
    UNDER_REVIEW: ActivityType.DOCUMENT_UPLOADED,
  } as const

  await logActivity({
    candidateId: document.candidateId,
    caseId: document.caseId,
    type: typeMap[input.status],
    message: `${document.documentType} marked ${input.status.replaceAll('_', ' ').toLowerCase()}`,
    actorType: 'ADMIN',
    actorId: input.reviewerId,
    metadata: { documentId: document.id, status: input.status },
  })

  return updated
}

/**
 * Soft-remove an active document version from the checklist.
 * Keeps the file and history for audit; marks ARCHIVED and clears current flag.
 */
export async function archiveCaseDocument(input: {
  documentId: string
  actorId: string
  reason?: string | null
}) {
  const document = await prisma.caseDocument.findUnique({ where: { id: input.documentId } })
  if (!document) throw new Error('Document not found')

  const updated = await prisma.caseDocument.update({
    where: { id: document.id },
    data: {
      isCurrentVersion: false,
      status: 'ARCHIVED',
      adminNote: input.reason
        ? `${document.adminNote ? `${document.adminNote}\n` : ''}Removed: ${input.reason}`
        : document.adminNote,
      reviewedAt: new Date(),
      reviewedById: input.actorId,
    },
  })

  await prisma.documentRequestItem.updateMany({
    where: {
      caseId: document.caseId,
      status: { in: ['UPLOADED', 'ACCEPTED'] },
      OR: [
        ...(document.documentRequestItemId ? [{ id: document.documentRequestItemId }] : []),
        { documentKey: document.questionKey },
        { documentKey: document.documentType },
      ],
    },
    data: { status: 'REQUESTED' },
  })

  await logActivity({
    candidateId: document.candidateId,
    caseId: document.caseId,
    type: ActivityType.DOCUMENT_REJECTED,
    message: `${document.documentType} removed from active checklist (v${document.version} retained in history)`,
    actorType: 'ADMIN',
    actorId: input.actorId,
    metadata: { documentId: document.id, reason: input.reason ?? null },
  })

  return updated
}

export async function documentAccessUrl(
  documentId: string,
  disposition: 'inline' | 'attachment',
) {
  const document = await prisma.caseDocument.findUnique({ where: { id: documentId } })
  if (!document) throw new Error('Document not found')
  // Neon / Blobs / local stream through same-origin signed /api/files.
  // Only legacy S3 objects use direct signed URLs.
  if (isS3Provider(document.storageProvider) && usingCloudStorage()) {
    return signedGetUrl(document.storageKey, document.originalFilename, disposition)
  }
  // Relative same-origin URL so previews stay on www (or whatever host the admin uses).
  return localSignedFileUrl(documentId, disposition, '')
}

export function summarizeDocuments(documents: { isCurrentVersion: boolean; status: DocumentStatus }[]) {
  const current = documents.filter((d) => d.isCurrentVersion)
  return {
    uploaded: current.length,
    accepted: current.filter((d) => d.status === 'ACCEPTED').length,
    underReview: current.filter((d) => d.status === 'UNDER_REVIEW' || d.status === 'UPLOADED').length,
    needsReplacement: current.filter((d) => d.status === 'NEEDS_REPLACEMENT').length,
  }
}
