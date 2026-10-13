import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import type { AuthUser } from '@/lib/auth'
import { expectedSplit } from '@/lib/payments'

export async function loadDashboard(user: AuthUser) {
  const since = new Date()
  since.setDate(since.getDate() - 14)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)

  const cases = await prisma.case.findMany({
    where: { lifecycle: 'ACTIVE' },
    include: { payments: true },
  })

  let totalQuoted = 0
  let totalCollected = 0
  let outstandingPre = 0
  let outstandingPost = 0
  for (const item of cases) {
    const quoted = item.quotedAmountCents ?? item.payments.reduce((s, p) => s + p.amountCents, 0)
    totalQuoted += quoted
    const { preFilingCents, postApprovalCents } = expectedSplit(quoted)
    const prePaid = item.payments
      .filter((p) => p.installmentNumber <= 3 && p.status === 'PAID')
      .reduce((s, p) => s + (p.paidAmountCents ?? p.amountCents), 0)
    const postPaid = item.payments
      .filter((p) => p.installmentNumber === 4 && p.status === 'PAID')
      .reduce((s, p) => s + (p.paidAmountCents ?? p.amountCents), 0)
    totalCollected += prePaid + postPaid
    outstandingPre += Math.max(0, preFilingCents - prePaid)
    outstandingPost += Math.max(0, postApprovalCents - postPaid)
  }

  const [
    totalCandidates,
    newCandidates,
    activeO1,
    onboardingPending,
    onboardingSubmitted,
    documentsPending,
    evidenceBuilding,
    attorneyReview,
    readyToFile,
    filed,
    approved,
    paymentLinksSent,
    paymentsDue,
    paidThisMonth,
    failedPayments,
    recentActivity,
    recentUploads,
    recentPayments,
    attentionCases,
  ] = await Promise.all([
    prisma.candidate.count({ where: { lifecycle: 'ACTIVE' } }),
    prisma.candidate.count({ where: { lifecycle: 'ACTIVE', createdAt: { gte: since } } }),
    prisma.case.count({
      where: { lifecycle: 'ACTIVE', visaType: { in: ['O_1A', 'O_1B'] }, status: { notIn: ['CLOSED', 'DENIED'] } },
    }),
    prisma.case.count({
      where: { lifecycle: 'ACTIVE', status: { in: ['ONBOARDING_NOT_SENT', 'ONBOARDING_SENT', 'ONBOARDING_IN_PROGRESS'] } },
    }),
    prisma.case.count({ where: { lifecycle: 'ACTIVE', status: 'ONBOARDING_SUBMITTED' } }),
    prisma.caseDocument.count({
      where: { isCurrentVersion: true, status: { in: ['UPLOADED', 'UNDER_REVIEW'] } },
    }),
    prisma.case.count({ where: { lifecycle: 'ACTIVE', status: 'EVIDENCE_BUILDING' } }),
    prisma.case.count({ where: { lifecycle: 'ACTIVE', status: 'ATTORNEY_REVIEW' } }),
    prisma.case.count({ where: { lifecycle: 'ACTIVE', status: 'READY_TO_FILE' } }),
    prisma.case.count({ where: { lifecycle: 'ACTIVE', status: { in: ['FILED', 'USCIS_REVIEW'] } } }),
    prisma.case.count({ where: { lifecycle: 'ACTIVE', status: 'APPROVED' } }),
    can(user.role, 'payments:read')
      ? prisma.payment.count({ where: { status: { in: ['PAYMENT_LINK_SENT', 'PAYMENT_LINK_GENERATED'] } } })
      : Promise.resolve(0),
    can(user.role, 'payments:read')
      ? prisma.payment.count({ where: { status: { in: ['READY', 'DRAFT', 'PAYMENT_LINK_GENERATED', 'PAYMENT_LINK_SENT'] } } })
      : Promise.resolve(0),
    can(user.role, 'payments:read')
      ? prisma.payment.count({ where: { status: 'PAID', paidAt: { gte: monthStart } } })
      : Promise.resolve(0),
    can(user.role, 'payments:read')
      ? prisma.payment.count({ where: { status: 'FAILED' } })
      : Promise.resolve(0),
    prisma.caseActivity.findMany({
      orderBy: { createdAt: 'desc' },
      take: 8,
      include: { candidate: { select: { fullLegalName: true, id: true } } },
    }),
    prisma.caseDocument.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: 6,
      include: { candidate: { select: { fullLegalName: true, id: true } } },
    }),
    can(user.role, 'payments:read')
      ? prisma.payment.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 6,
          include: { candidate: { select: { fullLegalName: true, id: true } } },
        })
      : Promise.resolve([]),
    prisma.case.findMany({
      where: {
        lifecycle: 'ACTIVE',
        status: {
          in: [
            'MORE_DOCUMENTS_REQUIRED',
            'RFE',
            'READY_TO_FILE',
            'ATTORNEY_REVIEW',
            'ONBOARDING_SUBMITTED',
          ],
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      include: { candidate: { select: { id: true, fullLegalName: true } } },
    }),
  ])

  return {
    stats: {
      totalCandidates,
      newCandidates,
      activeO1,
      onboardingPending,
      onboardingSubmitted,
      documentsPending,
      evidenceBuilding,
      attorneyReview,
      readyToFile,
      filed,
      approved,
      totalQuoted,
      totalCollected,
      outstandingPre,
      outstandingPost,
      paymentLinksSent,
      paymentsDue,
      paidThisMonth,
      failedPayments,
      outstandingPayments: paymentsDue,
    },
    recentActivity,
    recentUploads,
    recentPayments,
    attentionCases,
  }
}
