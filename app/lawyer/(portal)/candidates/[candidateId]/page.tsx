import { Suspense } from 'react'
import { notFound, redirect } from 'next/navigation'
import { AuthError, requireLawyerPage } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { CandidateProfile } from '@/components/admin/candidate-profile'
import { resolveCandidateTab } from '@/lib/candidate-profile-tabs'
import { assertCanAccessCandidate } from '@/lib/lawyer-access'
import { reconcileRequestItemsForCandidate } from '@/lib/sync-request-status'
import { resolveVisaTemplate } from '@/lib/visa-templates'

export const dynamic = 'force-dynamic'

export default async function LawyerCandidatePage({
  params,
  searchParams,
}: {
  params: Promise<{ candidateId: string }>
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const user = await requireLawyerPage()
  const { candidateId } = await params
  const sp = await searchParams
  const tabParam = Array.isArray(sp.tab) ? sp.tab[0] : sp.tab
  const initialTab = resolveCandidateTab(tabParam ?? null, '', true)

  try {
    await assertCanAccessCandidate(user, candidateId)
    await reconcileRequestItemsForCandidate(candidateId)
  } catch (error) {
    if (error instanceof AuthError && error.status === 403) {
      redirect('/lawyer/candidates?denied=1')
    }
    throw error
  }

  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      assessments: { orderBy: { submittedAt: 'desc' } },
      cases: {
        where: { lifecycle: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        include: {
          assignedCaseManager: { select: { id: true, fullName: true, email: true } },
          assignedAttorney: { select: { id: true, fullName: true, email: true } },
          referredByAdmin: { select: { id: true, fullName: true } },
          payments: false,
          financialEngagement: false,
          paymentReceipts: false,
          paymentScheduleItems: false,
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
          activities: false,
          communications: false,
          statusHistory: { orderBy: { createdAt: 'desc' } },
        },
      },
      activities: false,
      communications: false,
    },
  })

  if (!candidate) notFound()
  if (candidate.lifecycle === 'ARCHIVED') notFound()

  const currentCase = candidate.cases[0] ?? null
  const limited = !can(user.role, 'candidates:full_profile')
  // Same visa document list the Request Documents center uses, so lists and counts match.
  const visaTemplate = currentCase ? await resolveVisaTemplate(currentCase.visaType) : null

  return (
    <Suspense fallback={<div className="p-4 text-sm text-[#5B6B7C]">Loading candidate…</div>}>
      <CandidateProfile
        limited={limited}
        lawyerMode
        userRole={user.role}
        staff={[{ id: user.id, fullName: user.fullName, role: user.role }]}
        adminName={user.fullName}
        paymentStatus="—"
        initialTab={initialTab}
        templateItems={visaTemplate?.items ?? []}
        candidate={JSON.parse(JSON.stringify(candidate))}
        currentCase={currentCase ? JSON.parse(JSON.stringify(currentCase)) : null}
      />
    </Suspense>
  )
}
