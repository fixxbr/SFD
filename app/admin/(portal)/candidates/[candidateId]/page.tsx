import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { CandidateProfile } from '@/components/admin/candidate-profile'
import { resolveCandidateTab } from '@/lib/candidate-profile-tabs'
import { overallPaymentStatus } from '@/lib/payments'
import { assertCanAccessCandidate, isLawyerUser } from '@/lib/lawyer-access'
import { reconcileRequestItemsForCandidate } from '@/lib/sync-request-status'
import { resolveVisaTemplate } from '@/lib/visa-templates'
import { AuthError } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export default async function CandidateProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ candidateId: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const user = await requireAdminPage('candidates:read')
  const { candidateId } = await params
  const sp = await searchParams
  const lawyerMode = isLawyerUser(user)
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab
  const initialTab = resolveCandidateTab(tabParam ?? null, '', lawyerMode)

  try {
    await assertCanAccessCandidate(user, candidateId)
  } catch (error) {
    if (error instanceof AuthError && error.status === 403) {
      redirect('/admin/candidates?denied=1')
    }
    throw error
  }

  const includeArchived = can(user.role, 'candidates:view_archived')
  await reconcileRequestItemsForCandidate(candidateId)

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      assessments: { orderBy: { submittedAt: 'desc' } },
      cases: {
        where: includeArchived ? undefined : { lifecycle: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: {
          assignedCaseManager: { select: { id: true, fullName: true, email: true } },
          assignedAttorney: { select: { id: true, fullName: true, email: true } },
          referredByAdmin: { select: { id: true, fullName: true } },
          payments: lawyerMode
            ? false
            : {
                orderBy: { installmentNumber: 'asc' },
                include: { confirmedBy: { select: { fullName: true } } },
              },
          financialEngagement: lawyerMode ? false : true,
          paymentReceipts: lawyerMode
            ? false
            : {
                where: { status: 'ACTIVE' },
                orderBy: { receivedDate: 'desc' },
                take: 20,
                include: { confirmedBy: { select: { fullName: true } } },
              },
          paymentScheduleItems: lawyerMode
            ? false
            : {
                where: { schedule: { status: 'ACTIVE' } },
                orderBy: { sequenceNumber: 'asc' },
                include: {
                  receipts: { where: { status: 'ACTIVE' }, select: { amountCents: true } },
                },
              },
          customDocumentDefs: { select: { key: true, label: true, category: true } },
          documentRequests: {
            where: { cancelledAt: null },
            orderBy: { sentAt: 'desc' },
            include: { items: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
          },
          documents: {
            orderBy: [{ uploadedAt: 'desc' }, { version: 'desc' }],
            include: { evidenceEntry: { select: { id: true, section: true, title: true, subtitle: true } } },
          },
          onboardingSubmissions: { orderBy: { updatedAt: 'desc' } },
          onboardingInvites: {
            where: { revokedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: { id: true, createdAt: true, expiresAt: true, usedAt: true },
          },
          notes: {
            where: { archivedAt: null },
            orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
            include: { author: { select: { fullName: true, role: true } } },
          },
          activities: lawyerMode ? false : { orderBy: { createdAt: 'desc' }, take: 150 },
          communications: lawyerMode
            ? false
            : {
                orderBy: { sentAt: 'desc' },
                include: { sentBy: { select: { fullName: true } } },
              },
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      },
      activities: lawyerMode ? false : { orderBy: { createdAt: 'desc' }, take: 150 },
      communications: lawyerMode
        ? false
        : {
            orderBy: { sentAt: 'desc' },
            take: 150,
            include: { sentBy: { select: { fullName: true } } },
          },
    },
  })

  if (!candidate) notFound()
  if (candidate.lifecycle === 'ARCHIVED' && !includeArchived) notFound()

  const staff = await prisma.adminUser.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, fullName: true, role: true },
    orderBy: { fullName: 'asc' },
  })

  const currentCase = candidate.cases[0] ?? null
  const limited = !can(user.role, 'candidates:full_profile')
  // Same visa document list the Request Documents center uses, so lists and counts match.
  const visaTemplate = currentCase ? await resolveVisaTemplate(currentCase.visaType) : null

  return (
    <Suspense fallback={<div className="p-4 text-sm text-[#5B6B7C]">Loading profile…</div>}>
      <CandidateProfile
        limited={limited}
        lawyerMode={lawyerMode}
        userRole={user.role}
        staff={staff}
        adminName={user.fullName}
        paymentStatus={lawyerMode ? '—' : overallPaymentStatus(currentCase?.payments ?? [])}
        initialTab={initialTab}
        templateItems={visaTemplate?.items ?? []}
        candidate={JSON.parse(JSON.stringify(candidate))}
        currentCase={currentCase ? JSON.parse(JSON.stringify(currentCase)) : null}
      />
    </Suspense>
  )
}
