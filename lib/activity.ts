import { prisma } from '@/lib/db'

export const ActivityType = {
  CANDIDATE_CREATED: 'CANDIDATE_CREATED',
  ASSESSMENT_SUBMITTED: 'ASSESSMENT_SUBMITTED',
  CASE_CREATED: 'CASE_CREATED',
  ONBOARDING_EMAIL_SENT: 'ONBOARDING_EMAIL_SENT',
  ONBOARDING_OPENED: 'ONBOARDING_OPENED',
  DRAFT_SAVED: 'DRAFT_SAVED',
  ONBOARDING_SUBMITTED: 'ONBOARDING_SUBMITTED',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_ACCEPTED: 'DOCUMENT_ACCEPTED',
  DOCUMENT_REJECTED: 'DOCUMENT_REJECTED',
  REPLACEMENT_REQUESTED: 'REPLACEMENT_REQUESTED',
  CASE_MANAGER_ASSIGNED: 'CASE_MANAGER_ASSIGNED',
  ATTORNEY_ASSIGNED: 'ATTORNEY_ASSIGNED',
  PAYMENT_REQUESTED: 'PAYMENT_REQUESTED',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  CASE_STATUS_CHANGED: 'CASE_STATUS_CHANGED',
  FILED: 'FILED',
  APPROVED: 'APPROVED',
  NOTE_ADDED: 'NOTE_ADDED',
  DOCUMENT_COMMENT_ADDED: 'DOCUMENT_COMMENT_ADDED',
  PROFILE_UPDATED: 'PROFILE_UPDATED',
  QUOTE_CREATED: 'QUOTE_CREATED',
  QUOTE_UPDATED: 'QUOTE_UPDATED',
  PAYMENT_PLAN_CREATED: 'PAYMENT_PLAN_CREATED',
  PAYMENT_GENERATED: 'PAYMENT_GENERATED',
  PAYMENT_EMAIL_SENT: 'PAYMENT_EMAIL_SENT',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_REFUNDED: 'PAYMENT_REFUNDED',
  PRE_FILING_PAYMENT_COMPLETE: 'PRE_FILING_PAYMENT_COMPLETE',
  PAID_IN_FULL: 'PAID_IN_FULL',
  EMAIL_CHANGED: 'EMAIL_CHANGED',
  FILING_PAYMENT_OVERRIDE: 'FILING_PAYMENT_OVERRIDE',
  ACCESS_LINK_CREATED: 'ACCESS_LINK_CREATED',
  EMAIL_SENT: 'EMAIL_SENT',
  DOCUMENT_REQUEST_SENT: 'DOCUMENT_REQUEST_SENT',
  LAWYER_ASSIGNED: 'LAWYER_ASSIGNED',
  CASE_HEALTH_UPDATED: 'CASE_HEALTH_UPDATED',
} as const

export async function logActivity(input: {
  candidateId: string
  caseId?: string | null
  type: string
  message: string
  actorType: 'CANDIDATE' | 'ADMIN' | 'SYSTEM'
  actorId?: string | null
  metadata?: Record<string, unknown>
}) {
  return prisma.caseActivity.create({
    data: {
      candidateId: input.candidateId,
      caseId: input.caseId ?? null,
      type: input.type,
      message: input.message,
      actorType: input.actorType,
      actorId: input.actorId ?? null,
      metadata: (input.metadata ?? undefined) as never,
    },
  })
}

export async function audit(input: {
  actorId?: string | null
  action: string
  entityType: string
  entityId?: string | null
  metadata?: Record<string, unknown>
  ipAddress?: string | null
}) {
  return prisma.adminAuditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: (input.metadata ?? undefined) as never,
      ipAddress: input.ipAddress ?? null,
    },
  })
}
