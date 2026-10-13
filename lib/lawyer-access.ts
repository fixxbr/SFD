import type { Prisma } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { AuthError } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { isLawyerUser } from '@/lib/is-lawyer'
import { can } from '@/lib/rbac'

export { isLawyerUser }
export { canLawyerAccessCandidate } from '@/lib/assign-lawyer'

/** Prisma filter: only candidates assigned to this lawyer. */
export function lawyerAssignedCandidateWhere(lawyerUserId: string): Prisma.CandidateWhereInput {
  return {
    cases: {
      some: {
        lifecycle: 'ACTIVE',
        assignedAttorneyId: lawyerUserId,
      },
    },
  }
}

export function lawyerAssignedCaseWhere(lawyerUserId: string): Prisma.CaseWhereInput {
  return {
    lifecycle: 'ACTIVE',
    assignedAttorneyId: lawyerUserId,
  }
}

/** Non-lawyer staff: any candidate. Lawyer: only if assigned on an active case. */
export async function canViewCandidate(user: AuthUser, candidateId: string): Promise<boolean> {
  if (!isLawyerUser(user)) return can(user.role, 'candidates:read')
  const assigned = await prisma.case.findFirst({
    where: {
      candidateId,
      lifecycle: 'ACTIVE',
      assignedAttorneyId: user.id,
    },
    select: { id: true },
  })
  return Boolean(assigned)
}

export async function canCommentOnDocument(user: AuthUser, documentId: string): Promise<boolean> {
  if (!can(user.role, 'notes:write') && !can(user.role, 'documents:review')) return false
  try {
    await assertCanAccessDocument(user, documentId)
    return true
  } catch {
    return false
  }
}

/** Throws 403 if a Lawyer tries to access a candidate they are not assigned to. */
export async function assertCanAccessCandidate(
  user: AuthUser,
  candidateId: string,
): Promise<void> {
  if (!isLawyerUser(user)) return

  const assigned = await prisma.case.findFirst({
    where: {
      candidateId,
      lifecycle: 'ACTIVE',
      assignedAttorneyId: user.id,
    },
    select: { id: true },
  })
  if (!assigned) {
    throw new AuthError('Access denied — this candidate is not assigned to you.', 403)
  }
}

export async function assertCanAccessCase(user: AuthUser, caseId: string): Promise<void> {
  if (!isLawyerUser(user)) return

  const assigned = await prisma.case.findFirst({
    where: {
      id: caseId,
      lifecycle: 'ACTIVE',
      assignedAttorneyId: user.id,
    },
    select: { id: true },
  })
  if (!assigned) {
    throw new AuthError('Access denied — this case is not assigned to you.', 403)
  }
}

export async function assertCanAccessDocument(user: AuthUser, documentId: string): Promise<{
  candidateId: string
  caseId: string
}> {
  const document = await prisma.caseDocument.findUnique({
    where: { id: documentId },
    select: { id: true, candidateId: true, caseId: true },
  })
  if (!document) throw new AuthError('Document not found', 404)
  await assertCanAccessCandidate(user, document.candidateId)
  return { candidateId: document.candidateId, caseId: document.caseId }
}

/** Strip payment / finance fields from candidate payloads for lawyers. */
export function stripFinanceForLawyer<T extends Record<string, unknown>>(payload: T): T {
  const clone = structuredClone(payload) as Record<string, unknown>
  delete clone.payments
  delete clone.paymentReceipts
  delete clone.paymentScheduleItems
  delete clone.financialEngagement
  delete clone.quotedAmountCents
  delete clone.currency
  if (Array.isArray(clone.cases)) {
    clone.cases = clone.cases.map((c) => {
      if (!c || typeof c !== 'object') return c
      const row = { ...(c as Record<string, unknown>) }
      delete row.payments
      delete row.paymentReceipts
      delete row.paymentScheduleItems
      delete row.financialEngagement
      delete row.quotedAmountCents
      delete row.currency
      return row
    })
  }
  return clone as T
}

export async function lawyerWorkloadStats(lawyerUserId: string) {
  const assignedCases = await prisma.case.findMany({
    where: lawyerAssignedCaseWhere(lawyerUserId),
    select: {
      id: true,
      status: true,
      documents: {
        where: { isCurrentVersion: true },
        select: { status: true },
      },
    },
  })
  const assignedCandidates = assignedCases.length
  const activeCases = assignedCases.filter((c) => !['CLOSED', 'DENIED', 'APPROVED'].includes(c.status)).length
  const awaitingReview = assignedCases.reduce(
    (n, c) => n + c.documents.filter((d) => d.status === 'UNDER_REVIEW' || d.status === 'UPLOADED').length,
    0,
  )
  return { assignedCandidates, activeCases, documentsAwaitingReview: awaitingReview }
}
