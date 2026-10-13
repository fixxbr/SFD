import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth'
import { loadDashboard } from '@/lib/admin/dashboard'
import { formatDateTime } from '@/lib/format'
import { CASE_STATUS_LABELS, formatVisa } from '@/lib/visa'
import { can } from '@/lib/rbac'
import { formatCents } from '@/lib/payments'
import { FinanceDashboardPanel } from '@/components/admin/finance-dashboard-panel'
import { EmptyState, PageHeader, SectionCard, StatCard } from '@/components/admin/ui'
import { admin } from '@/lib/admin/ui'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

export default async function AdminHomePage() {
  const user = await requireAdminPage('dashboard:read')
  const data = await loadDashboard(user)
  const canWriteCandidates = can(user.role, 'candidates:write')
  const canPayments = can(user.role, 'payments:read')
  const canAssign = can(user.role, 'cases:write')

  const [unassignedLawyers, activeCases] = await Promise.all([
    prisma.case.count({
      where: { lifecycle: 'ACTIVE', assignedAttorneyId: null, candidate: { lifecycle: 'ACTIVE' } },
    }),
    prisma.case.count({ where: { lifecycle: 'ACTIVE', candidate: { lifecycle: 'ACTIVE' } } }),
  ])

  const pipeline = [
    { label: 'Onboarding', value: data.stats.onboardingPending + data.stats.onboardingSubmitted, href: '/admin/candidates?caseStatus=ONBOARDING_IN_PROGRESS' },
    { label: 'Evidence', value: data.stats.evidenceBuilding, href: '/admin/candidates?caseStatus=EVIDENCE_BUILDING' },
    { label: 'Attorney review', value: data.stats.attorneyReview, href: '/admin/candidates?caseStatus=ATTORNEY_REVIEW' },
    { label: 'Ready to file', value: data.stats.readyToFile, href: '/admin/candidates?caseStatus=READY_TO_FILE' },
    { label: 'Filed', value: data.stats.filed, href: '/admin/candidates?caseStatus=FILED' },
    { label: 'Approved', value: data.stats.approved, href: '/admin/candidates?caseStatus=APPROVED' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="System status at a glance"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Dashboard' }]}
        actions={
          canWriteCandidates ? (
            <Link href="/admin/candidates?create=1" className={admin.btnPrimary}>
              + Add Candidate
            </Link>
          ) : null
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Candidates"
          value={data.stats.totalCandidates}
          detail={`${data.stats.newCandidates} new in 14 days`}
          href="/admin/candidates"
        />
        <StatCard
          label="Active Cases"
          value={activeCases}
          detail={`${data.stats.attorneyReview} in attorney review`}
          href="/admin/cases"
          tone="info"
        />
        <StatCard
          label="Documents Awaiting Review"
          value={data.stats.documentsPending}
          detail="Uploaded or under review"
          href="/admin/documents"
          tone={data.stats.documentsPending > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label="Outstanding Payments"
          value={canPayments ? formatCents(data.stats.outstandingPre + data.stats.outstandingPost) : '—'}
          detail={
            canPayments
              ? `${data.stats.outstandingPayments} items need attention`
              : 'No payment access'
          }
          href={canPayments ? '/admin/payments' : undefined}
          tone={canPayments && data.stats.outstandingPayments > 0 ? 'danger' : 'default'}
        />
      </div>

      <SectionCard title="Quick Actions">
        <div className="flex flex-wrap gap-2">
          {canWriteCandidates && (
            <Link href="/admin/candidates?create=1" className={admin.btnPrimary}>
              + Add Candidate
            </Link>
          )}
          {canWriteCandidates && (
            <Link href="/admin/candidates" className={admin.btnSecondary}>
              Request Documents
            </Link>
          )}
          {canAssign && (
            <Link href="/admin/candidates" className={admin.btnSecondary}>
              Assign Lawyer
            </Link>
          )}
          {canPayments && can(user.role, 'payments:write') && (
            <Link href="/admin/payments" className={admin.btnSecondary}>
              Record Payment
            </Link>
          )}
        </div>
      </SectionCard>

      <details className="group rounded-xl border border-[#E2E8F0] bg-white open:shadow-sm">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#0C2340] marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between">
            Candidate Pipeline
            <span className="text-xs font-normal text-[#94A3B8] group-open:hidden">Show stages</span>
            <span className="hidden text-xs font-normal text-[#94A3B8] group-open:inline">Hide</span>
          </span>
        </summary>
        <div className="border-t border-[#F1F5F9] px-4 py-3">
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {pipeline.map((stage) => (
              <Link
                key={stage.label}
                href={stage.href}
                className="rounded-lg border border-[#EEF1F4] bg-[#F8FAFC] px-3 py-3 text-center transition hover:border-[#0F766E]/35"
              >
                <p className="text-lg font-semibold tabular-nums text-[#0C2340]">{stage.value}</p>
                <p className="mt-0.5 text-[11px] font-medium text-[#64748B]">{stage.label}</p>
              </Link>
            ))}
          </div>
        </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          title="Needs Attention"
          action={
            <Link href="/admin/candidates" className="text-xs font-medium text-[#0F766E] hover:underline">
              View candidates
            </Link>
          }
        >
          <ul className="mb-3 space-y-1.5 text-sm text-[#475569]">
            <li className="flex justify-between gap-2">
              <span>Documents awaiting review</span>
              <strong>{data.stats.documentsPending}</strong>
            </li>
            <li className="flex justify-between gap-2">
              <span>Pending lawyer assignment</span>
              <strong>{unassignedLawyers}</strong>
            </li>
            <li className="flex justify-between gap-2">
              <span>Payment items outstanding</span>
              <strong>{canPayments ? data.stats.outstandingPayments : '—'}</strong>
            </li>
          </ul>
          {data.attentionCases.length === 0 ? (
            <EmptyState title="All caught up" description="Cases needing attention will appear here." />
          ) : (
            <ul className="divide-y divide-[#F1F5F9] border-t border-[#F1F5F9]">
              {data.attentionCases.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link href={`/admin/candidates/${item.candidate.id}`} className="font-medium text-[#0C2340] hover:text-[#0F766E]">
                    {item.candidate.fullLegalName}
                  </Link>
                  <span className="shrink-0 text-xs text-[#64748B]">
                    {formatVisa(item.visaType)} · {CASE_STATUS_LABELS[item.status] ?? item.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Recent Activity"
          action={
            <Link href="/admin/activity" className="text-xs font-medium text-[#0F766E] hover:underline">
              Activity log
            </Link>
          }
        >
          {data.recentActivity.length === 0 ? (
            <EmptyState title="No recent activity" />
          ) : (
            <ul className="space-y-3">
              {data.recentActivity.map((item) => (
                <li key={item.id} className="text-sm">
                  <Link href={`/admin/candidates/${item.candidate.id}`} className="font-medium text-[#0C2340] hover:text-[#0F766E]">
                    {item.candidate.fullLegalName}
                  </Link>
                  <p className="text-[#64748B]">{item.message}</p>
                  <p className="text-[11px] text-[#94A3B8]">{formatDateTime(item.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <details className="group rounded-xl border border-[#E2E8F0] bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#0C2340] [&::-webkit-details-marker]:hidden">
          More: documents & payments
        </summary>
        <div className="grid gap-4 border-t border-[#F1F5F9] p-4 lg:grid-cols-2">
          <SectionCard title="Document Overview">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Pending review" value={data.stats.documentsPending} href="/admin/candidates" tone="warning" />
              <StatCard label="Recent uploads" value={data.recentUploads.length} href="/admin/candidates" />
            </div>
            <ul className="mt-4 divide-y divide-[#F1F5F9]">
              {data.recentUploads.slice(0, 5).map((doc) => (
                <li key={doc.id} className="flex justify-between gap-2 py-2 text-sm">
                  <Link href={`/admin/candidates/${doc.candidate.id}?tab=documents`} className="truncate hover:text-[#0F766E]">
                    {doc.candidate.fullLegalName}
                  </Link>
                  <span className="shrink-0 text-xs text-[#94A3B8]">{formatDateTime(doc.uploadedAt)}</span>
                </li>
              ))}
              {data.recentUploads.length === 0 && <li className="py-2 text-sm text-[#64748B]">No recent uploads.</li>}
            </ul>
          </SectionCard>

          <SectionCard title="Payment Overview">
            {canPayments ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <StatCard label="Quoted (active)" value={formatCents(data.stats.totalQuoted)} />
                  <StatCard label="Collected" value={formatCents(data.stats.totalCollected)} tone="success" />
                  <StatCard label="Due / links" value={data.stats.paymentsDue} href="/admin/candidates" tone="warning" />
                  <StatCard label="Paid this month" value={data.stats.paidThisMonth} href="/admin/candidates" />
                </div>
                {data.recentPayments.length > 0 && (
                  <ul className="mt-4 divide-y divide-[#F1F5F9]">
                    {data.recentPayments.slice(0, 5).map((p) => (
                      <li key={p.id} className="flex justify-between gap-2 py-2 text-sm">
                        <Link href={`/admin/candidates/${p.candidate.id}?tab=payments`} className="hover:text-[#0F766E]">
                          {p.candidate.fullLegalName}
                        </Link>
                        <span className="text-xs text-[#64748B]">
                          {formatCents(p.amountCents)} · {p.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <EmptyState title="Payment metrics hidden" description="Your role does not include payment access." />
            )}
          </SectionCard>
        </div>
      </details>

      {canPayments && (
        <details className="rounded-xl border border-[#E2E8F0] bg-white">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-[#0C2340] [&::-webkit-details-marker]:hidden">
            Finance dashboard
          </summary>
          <div className="border-t border-[#F1F5F9] p-4">
            <FinanceDashboardPanel />
          </div>
        </details>
      )}
    </div>
  )
}
