import { prisma } from '@/lib/db'
import { archiveCaseDocument, uploadCaseDocument } from '@/lib/documents'
import { isExternalLinkDocument } from '@/lib/document-links'
import { LinkValidationError, PROFILE_LINK_CATEGORY, slugLinkKey, validateHttpUrl } from '@/lib/link-request-items'

export { LinkValidationError }

/**
 * Links are stored as CaseDocument rows with `externalUrl` set so they share
 * history, audit and access rules with files, but they never go through file
 * validation and are never counted as documents.
 */

export function normalizeLinkUrl(raw: unknown): string {
  const check = validateHttpUrl(String(raw ?? ''))
  if (!check.ok) throw new LinkValidationError(check.error)
  return check.href
}

function linkLabel(label: unknown, href: string) {
  const text = String(label ?? '').trim().replace(/\s+/g, ' ')
  if (text.length > 200) throw new LinkValidationError('Link name must be 200 characters or fewer.')
  return text || href
}

export async function createCaseLink(input: {
  candidateId: string
  caseId: string
  url: string
  label?: string | null
  questionKey?: string | null
  category?: string | null
  note?: string | null
  uploadedByType: 'CANDIDATE' | 'ADMIN' | 'LAWYER' | 'SYSTEM'
  uploadedById?: string | null
  onboardingSubmissionId?: string | null
  clientIdempotencyKey?: string | null
  visaTypeCode?: string | null
  /** 'error' (staff adding a link) or 'reuse' (candidate re-submitting the same URL). */
  onDuplicate?: 'error' | 'reuse'
  /** Row being replaced by an edit — not a duplicate of itself. */
  replacingId?: string | null
}) {
  const href = normalizeLinkUrl(input.url)
  const label = linkLabel(input.label, href)
  const duplicate = await prisma.caseDocument.findFirst({
    where: {
      caseId: input.caseId,
      externalUrl: href,
      isCurrentVersion: true,
      status: { not: 'ARCHIVED' },
      ...(input.replacingId ? { id: { not: input.replacingId } } : {}),
    },
  })
  if (duplicate) {
    if (input.onDuplicate === 'reuse') return duplicate
    throw new LinkValidationError('This link is already saved for this candidate.')
  }
  const questionKey = input.questionKey?.trim() || slugLinkKey(label === href ? 'link' : label)
  const buffer = Buffer.from(href, 'utf8')
  const note = String(input.note ?? '').trim()
  const document = await uploadCaseDocument({
    candidateId: input.candidateId,
    caseId: input.caseId,
    onboardingSubmissionId: input.onboardingSubmissionId ?? null,
    questionKey,
    category: input.category?.trim() || PROFILE_LINK_CATEGORY,
    documentType: questionKey,
    file: { buffer, mimeType: 'text/uri-list', filename: `${questionKey}.url.txt`, size: buffer.byteLength },
    uploadedByType: input.uploadedByType,
    uploadedById: input.uploadedById ?? null,
    displayName: label,
    // Keep the stored note short: long URLs (tracking parameters) must not trip the 1000-char note limit.
    description: note || `Link: ${href.length > 200 ? `${href.slice(0, 197)}...` : href}`,
    actorMessage: `Link added: ${label}`,
    append: true,
    clientIdempotencyKey: input.clientIdempotencyKey ?? null,
    externalUrl: href,
  })
  if (input.visaTypeCode) {
    return prisma.caseDocument.update({ where: { id: document.id }, data: { visaTypeCode: input.visaTypeCode } })
  }
  return document
}

async function loadActiveLink(documentId: string) {
  const existing = await prisma.caseDocument.findUnique({ where: { id: documentId } })
  if (!existing || !existing.isCurrentVersion || existing.status === 'ARCHIVED') {
    throw new LinkValidationError('Link not found.')
  }
  if (!isExternalLinkDocument(existing)) {
    throw new LinkValidationError('This entry is a document file, not a link. Manage it in the Documents section.')
  }
  return existing
}

/** Editing keeps history: the old row is archived and a new current row is created. */
export async function updateCaseLink(input: {
  documentId: string
  url?: string | null
  label?: string | null
  actorId: string
  actorType: 'ADMIN' | 'LAWYER'
}) {
  const existing = await loadActiveLink(input.documentId)
  const previousUrl = existing.externalUrl || (existing.displayName?.startsWith('http') ? existing.displayName : '')
  const url = input.url ?? previousUrl
  if (!url) throw new LinkValidationError('A URL is required.')
  const href = normalizeLinkUrl(url)
  const previousLabel = existing.displayName && existing.displayName !== previousUrl ? existing.displayName : ''
  const label = input.label === undefined || input.label === null ? previousLabel : input.label
  const created = await createCaseLink({
    candidateId: existing.candidateId,
    caseId: existing.caseId,
    url: href,
    label,
    questionKey: existing.questionKey,
    category: existing.category,
    uploadedByType: input.actorType,
    uploadedById: input.actorId,
    visaTypeCode: existing.visaTypeCode,
    replacingId: existing.id,
  })
  if (existing.documentRequestId || existing.documentRequestItemId) {
    await prisma.caseDocument.update({
      where: { id: created.id },
      data: {
        documentRequestId: existing.documentRequestId,
        documentRequestItemId: existing.documentRequestItemId,
      },
    })
  }
  await prisma.caseDocument.update({
    where: { id: existing.id },
    data: { isCurrentVersion: false, status: 'ARCHIVED', reviewedAt: new Date(), reviewedById: input.actorId },
  })
  return created
}

export async function deleteCaseLink(input: { documentId: string; actorId: string | null }) {
  await loadActiveLink(input.documentId)
  return archiveCaseDocument({ documentId: input.documentId, actorId: input.actorId, reason: 'Link removed' })
}
