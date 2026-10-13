/**
 * Lawyer assignment is a security-sensitive access change.
 * Source of truth: Case.assignedAttorneyId (checked on every lawyer request).
 * LawyerAssignment rows are audit history only.
 */
import type { AuthUser } from '@/lib/auth'
import { AuthError } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ActivityType, logActivity } from '@/lib/activity'
import { isLawyerRole } from '@/lib/staff-options'

export class AssignLawyerError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'AssignLawyerError'
    this.status = status
  }
}

/** Validate a user may be assigned as lawyer on a case. */
export async function assertAssignableLawyer(lawyerId: string) {
  const lawyer = await prisma.adminUser.findUnique({
    where: { id: lawyerId },
    select: { id: true, fullName: true, role: true, status: true },
  })
  if (!lawyer) throw new AssignLawyerError('Selected lawyer was not found.', 404)
  if (lawyer.status !== 'ACTIVE') {
    throw new AssignLawyerError('Selected lawyer account is not active.')
  }
  if (!isLawyerRole(lawyer.role)) {
    throw new AssignLawyerError('Only active Lawyer accounts can be assigned to a case.')
  }
  return lawyer
}

export type AssignCaseLawyerResult = {
  changed: boolean
  caseId: string
  candidateId: string
  previousLawyerId: string | null
  previousLawyerName: string | null
  nextLawyerId: string | null
  nextLawyerName: string | null
  message: string
}

/**
 * Atomically set / clear Case.assignedAttorneyId and write audit activity.
 * Access for lawyers is derived only from the live assignedAttorneyId field.
 */
export async function assignCaseLawyer(input: {
  caseId: string
  lawyerId: string | null
  actor: AuthUser
  note?: string | null
}): Promise<AssignCaseLawyerResult> {
  const current = await prisma.case.findUnique({
    where: { id: input.caseId },
    select: {
      id: true,
      candidateId: true,
      assignedAttorneyId: true,
      assignedAttorney: { select: { id: true, fullName: true } },
      candidate: { select: { fullLegalName: true } },
    },
  })
  if (!current) throw new AssignLawyerError('Case not found.', 404)

  const previousLawyerId = current.assignedAttorneyId
  const previousLawyerName = current.assignedAttorney?.fullName ?? null
  const nextId = input.lawyerId?.trim() || null

  if (nextId === previousLawyerId) {
    return {
      changed: false,
      caseId: current.id,
      candidateId: current.candidateId,
      previousLawyerId,
      previousLawyerName,
      nextLawyerId: nextId,
      nextLawyerName: previousLawyerName,
      message: nextId
        ? 'This lawyer is already assigned to this candidate.'
        : 'This case already has no assigned lawyer.',
    }
  }

  let nextLawyerName: string | null = null
  if (nextId) {
    const lawyer = await assertAssignableLawyer(nextId)
    nextLawyerName = lawyer.fullName
  }

  let activityMessage: string
  if (nextId && previousLawyerId) {
    activityMessage = `Lawyer reassigned from ${previousLawyerName || 'previous lawyer'} to ${nextLawyerName} by ${input.actor.fullName}.`
  } else if (nextId) {
    activityMessage = `${nextLawyerName} assigned by ${input.actor.fullName}.`
  } else {
    activityMessage = `${previousLawyerName || 'Lawyer'} was unassigned from this case by ${input.actor.fullName}.`
  }

  await prisma.$transaction(async (tx) => {
    await tx.case.update({
      where: { id: current.id },
      data: nextId
        ? { assignedAttorney: { connect: { id: nextId } } }
        : { assignedAttorney: { disconnect: true } },
    })

    if (nextId) {
      await tx.lawyerAssignment.create({
        data: {
          caseId: current.id,
          lawyerId: nextId,
          assignedById: input.actor.id,
          note: input.note?.trim() || (previousLawyerId ? 'REASSIGN' : 'ASSIGN'),
        },
      })
    }

    await tx.caseActivity.create({
      data: {
        candidateId: current.candidateId,
        caseId: current.id,
        type: ActivityType.LAWYER_ASSIGNED,
        message: activityMessage,
        actorType: 'ADMIN',
        actorId: input.actor.id,
        metadata: {
          previousLawyerId,
          previousLawyerName,
          nextLawyerId: nextId,
          nextLawyerName,
          action: nextId ? (previousLawyerId ? 'REASSIGN' : 'ASSIGN') : 'UNASSIGN',
        } as never,
      },
    })
  })

  return {
    changed: true,
    caseId: current.id,
    candidateId: current.candidateId,
    previousLawyerId,
    previousLawyerName,
    nextLawyerId: nextId,
    nextLawyerName,
    message: activityMessage,
  }
}

/** Alias used by authorization docs / call sites. */
export async function canLawyerAccessCandidate(
  authenticatedUserId: string,
  candidateId: string,
): Promise<boolean> {
  const assigned = await prisma.case.findFirst({
    where: {
      candidateId,
      lifecycle: 'ACTIVE',
      assignedAttorneyId: authenticatedUserId,
    },
    select: { id: true },
  })
  return Boolean(assigned)
}
