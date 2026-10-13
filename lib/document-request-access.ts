import { prisma } from '@/lib/db'
import { documentKeyLookupKeys, isAdditionalEvidenceKey, isKnownDocumentKey } from '@/lib/document-keys'
import { isLinkRequestKey, PROFILE_LINK_OPTIONS } from '@/lib/link-request-items'

const OPEN_REQUEST_STATUSES = [
  'READY',
  'SENT',
  'OPENED',
  'PARTIALLY_SUBMITTED',
  'SUBMITTED',
] as const

export type OpenDocumentRequestRow = {
  id: string
  requestNumber: string
  requestType: string
  requestedItems: unknown
  visaTypeCode: string | null
  expiresAt: Date | null
  openedAt: Date | null
  status: string
  cancelledAt?: Date | null
}

/** Whether a document request may still receive candidate uploads. */
export function isDocumentRequestOpen(request: {
  status?: string | null
  cancelledAt?: Date | null
  expiresAt?: Date | null
} | null | undefined): boolean {
  if (!request) return false
  if (request.cancelledAt) return false
  if (request.status === 'CANCELLED') return false
  if (request.expiresAt && request.expiresAt.getTime() < Date.now()) return false
  if (request.status && !OPEN_REQUEST_STATUSES.includes(request.status as (typeof OPEN_REQUEST_STATUSES)[number])) {
    // Unknown future statuses: allow only if not cancelled/expired above.
    return request.status !== 'DRAFT'
  }
  return true
}

/** Latest non-cancelled, non-expired document request for a case (candidate upload portal). */
export async function findLatestOpenDocumentRequest(caseId: string) {
  const now = new Date()
  return prisma.documentRequest.findFirst({
    where: {
      caseId,
      cancelledAt: null,
      status: { in: [...OPEN_REQUEST_STATUSES] },
      // NULL expiresAt = never expires; past expiresAt is closed.
      NOT: { expiresAt: { lte: now } },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      requestNumber: true,
      requestType: true,
      requestedItems: true,
      visaTypeCode: true,
      expiresAt: true,
      openedAt: true,
      status: true,
      cancelledAt: true,
    },
  })
}

/**
 * Candidate ID + email verify historically created sessions without a documentRequestId,
 * so the UI could still show slots from a magic-link landing while POST rejected them.
 * Bind (or re-bind) the session to the latest open request for the case.
 *
 * Also rebinds when the session still points at a cancelled / expired package — that
 * mismatch produced “Unknown document type” / “not part of this request” while the UI
 * still listed the old slots.
 */
export async function ensureSessionDocumentRequest(session: {
  id: string
  caseId: string
  documentRequestId: string | null
  documentRequest?: {
    id: string
    status?: string | null
    cancelledAt?: Date | null
    expiresAt?: Date | null
  } | null
}) {
  const bound = session.documentRequest
  if (session.documentRequestId && bound && isDocumentRequestOpen(bound)) {
    return session.documentRequestId
  }

  // Bound id without a usable relation (cancelled, expired, or deleted) — rebind.
  const latest = await findLatestOpenDocumentRequest(session.caseId)
  if (!latest) {
    // Clear stale binding so membership checks do not pretend a cancelled package is active.
    if (session.documentRequestId) {
      await prisma.candidateSubmissionSession.update({
        where: { id: session.id },
        data: { documentRequestId: null, purpose: 'DOCUMENT_UPLOAD' },
      })
    }
    return null
  }

  if (session.documentRequestId !== latest.id) {
    await prisma.candidateSubmissionSession.update({
      where: { id: session.id },
      data: {
        documentRequestId: latest.id,
        purpose: `DOCUMENT_REQUEST:${latest.requestNumber}`,
      },
    })
  }
  return latest.id
}

export type RequestMembership = {
  documentRequestId: string | null
  dbItem: {
    id: string
    documentKey: string
    documentName: string
    category: string
    instructions: string | null
  } | null
  fromJson: { key: string; label?: string; category?: string; instructions?: string | null; inputKind?: string } | null
}

function parseRequestedItems(raw: unknown) {
  if (!Array.isArray(raw) || raw.length === 0) return null
  return raw as Array<{
    key: string
    label?: string
    category?: string
    instructions?: string | null
    inputKind?: string
    source?: string
  }>
}

export async function resolveRequestMembership(input: {
  caseId: string
  documentRequestId: string | null
  questionKey: string
}): Promise<RequestMembership> {
  const lookupKeys = documentKeyLookupKeys(input.questionKey)
  let documentRequestId = input.documentRequestId

  if (!documentRequestId) {
    const latest = await findLatestOpenDocumentRequest(input.caseId)
    documentRequestId = latest?.id ?? null
  }

  if (!documentRequestId) {
    return { documentRequestId: null, dbItem: null, fromJson: null }
  }

  const request = await prisma.documentRequest.findUnique({
    where: { id: documentRequestId },
    select: {
      id: true,
      caseId: true,
      requestedItems: true,
      status: true,
      cancelledAt: true,
      expiresAt: true,
    },
  })
  if (!request || request.caseId !== input.caseId || !isDocumentRequestOpen(request)) {
    // Stale session binding — try the latest open package once.
    if (input.documentRequestId) {
      const latest = await findLatestOpenDocumentRequest(input.caseId)
      if (latest && latest.id !== input.documentRequestId) {
        return resolveRequestMembership({
          caseId: input.caseId,
          documentRequestId: latest.id,
          questionKey: input.questionKey,
        })
      }
    }
    return { documentRequestId: null, dbItem: null, fromJson: null }
  }

  const dbItem = await prisma.documentRequestItem.findFirst({
    where: {
      documentRequestId: request.id,
      documentKey: { in: lookupKeys },
    },
    select: {
      id: true,
      documentKey: true,
      documentName: true,
      category: true,
      instructions: true,
    },
  })

  const items = parseRequestedItems(request.requestedItems)
  const fromJson =
    items?.find((item) => lookupKeys.includes(item.key)) ??
    null

  return { documentRequestId: request.id, dbItem, fromJson }
}

export async function caseHasCustomDocumentDef(caseId: string, questionKey: string) {
  const keys = documentKeyLookupKeys(questionKey)
  return prisma.customDocumentDef.findFirst({
    where: { caseId, key: { in: keys } },
    select: { id: true, key: true, label: true, category: true, instructions: true },
  })
}

/**
 * Whether a candidate may upload/save this slot for the active case/request.
 * Preserves request membership; also accepts known catalog/template/additional keys
 * and case-level custom defs so UI-offered slots are never rejected as unknown.
 */
export async function assertCandidateSlotAllowed(input: {
  caseId: string
  documentRequestId: string | null
  questionKey: string
  evidenceEntryId?: string | null
}): Promise<{
  ok: true
  membership: RequestMembership
  customDef: Awaited<ReturnType<typeof caseHasCustomDocumentDef>>
} | { ok: false; error: string; code?: string }> {
  if (input.evidenceEntryId) {
    return {
      ok: true,
      membership: { documentRequestId: input.documentRequestId, dbItem: null, fromJson: null },
      customDef: null,
    }
  }

  const membership = await resolveRequestMembership({
    caseId: input.caseId,
    documentRequestId: input.documentRequestId,
    questionKey: input.questionKey,
  })
  const customDef = await caseHasCustomDocumentDef(input.caseId, input.questionKey)
  const inRequest = Boolean(membership.dbItem || membership.fromJson)
  const additional = isAdditionalEvidenceKey(input.questionKey)

  if (inRequest || additional || customDef) {
    return { ok: true, membership, customDef }
  }

  // Active request exists but this key is not on it — keep membership checks.
  if (membership.documentRequestId) {
    return {
      ok: false,
      error: 'That document is not part of this request. Use “Other supporting document” or ask Afterstem for an updated link.',
      code: 'SLOT_NOT_IN_REQUEST',
    }
  }

  // No open request: only known catch-all / catalog keys that already have case defs.
  if (isKnownDocumentKey(input.questionKey)) {
    return {
      ok: false,
      error:
        'This upload link is not tied to an active document request. Open the secure link from your email, or ask Afterstem to send a new one.',
      code: 'NO_OPEN_REQUEST',
    }
  }

  return {
    ok: false,
    error: 'Unknown document type. Use “Other supporting document” for files that do not match a listed category.',
    code: 'UNKNOWN_DOCUMENT_TYPE',
  }
}

export async function assertCandidateLinkAllowed(input: {
  caseId: string
  documentRequestId: string | null
  questionKey: string
}): Promise<{
  ok: true
  membership: RequestMembership
  customDef: Awaited<ReturnType<typeof caseHasCustomDocumentDef>>
  label: string
  category: string
} | { ok: false; error: string; code?: string }> {
  if (!isLinkRequestKey(input.questionKey)) {
    return { ok: false, error: 'This item expects a file upload, not a URL.', code: 'EXPECTED_FILE' }
  }

  const membership = await resolveRequestMembership({
    caseId: input.caseId,
    documentRequestId: input.documentRequestId,
    questionKey: input.questionKey,
  })
  const customDef = await caseHasCustomDocumentDef(input.caseId, input.questionKey)
  const profile = PROFILE_LINK_OPTIONS.find((o) => o.key === input.questionKey)
  const inRequest = Boolean(membership.dbItem || membership.fromJson)

  if (!inRequest && !customDef) {
    return {
      ok: false,
      error:
        membership.documentRequestId
          ? 'That link is not part of this request. Ask Afterstem to include it, or leave the field blank.'
          : 'This upload link is not tied to an active document request. Open the secure link from your email.',
      code: membership.documentRequestId ? 'LINK_NOT_IN_REQUEST' : 'NO_OPEN_REQUEST',
    }
  }

  return {
    ok: true,
    membership,
    customDef,
    label:
      membership.dbItem?.documentName ||
      membership.fromJson?.label ||
      customDef?.label ||
      profile?.label ||
      input.questionKey,
    category:
      membership.dbItem?.category ||
      membership.fromJson?.category ||
      customDef?.category ||
      profile?.category ||
      'Profile & links',
  }
}

export { OPEN_REQUEST_STATUSES, parseRequestedItems }
