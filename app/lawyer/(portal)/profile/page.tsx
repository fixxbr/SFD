import { requireLawyerPage } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { lawyerWorkloadStats } from '@/lib/lawyer-access'
import { formatRole } from '@/lib/role-labels'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatDateTime } from '@/lib/format'
import { LawyerProfileForm } from '@/components/admin/lawyer-profile-form'
import Link from 'next/link'
import { formatVisa, CASE_STATUS_LABELS } from '@/lib/visa'
import { PageHeader } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function LawyerProfilePage() {
  const user = await requireLawyerPage()
  const record = await prisma.adminUser.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
    },
  })
  if (!record) return null

  const stats = await lawyerWorkloadStats(user.id)
  const assigned = await prisma.case.findMany({
    where: { lifecycle: 'ACTIVE', assignedAttorneyId: user.id },
    orderBy: { updatedAt: 'desc' },
    take: 12,
    include: {
      candidate: { select: { id: true, fullLegalName: true, candidateNumber: true } },
      documents: { where: { isCurrentVersion: true }, select: { status: true } },
    },
  })

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Your lawyer account and assigned workload"
        breadcrumb={[{ label: 'Lawyer', href: '/lawyer/candidates' }, { label: 'My Profile' }]}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B]">Assigned candidates</p>
          <p className="mt-1 text-2xl font-semibold">{stats.assignedCandidates}</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B]">Active cases</p>
          <p className="mt-1 text-2xl font-semibold">{stats.activeCases}</p>
        </div>
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
          <p className="text-xs text-[#64748B]">Docs awaiting review</p>
          <p className="mt-1 text-2xl font-semibold">{stats.documentsAwaitingReview}</p>
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold text-[#0C2340]">{record.fullName}</p>
            <p className="text-sm text-[#64748B]">{record.email}</p>
            <p className="mt-2 text-xs uppercase tracking-wide text-[#94A3B8]">{formatRole(record.role)}</p>
          </div>
          <StatusBadge status={record.status} />
        </div>
        <p className="mt-3 text-xs text-[#94A3B8]">
          Last login: {record.lastLoginAt ? formatDateTime(record.lastLoginAt) : '—'} · Joined{' '}
          {formatDateTime(record.createdAt)}
        </p>
        <div className="mt-4">
          <LawyerProfileForm fullName={record.fullName} email={record.email} />
        </div>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <h2 className="text-sm font-semibold text-[#0C2340]">Recent assignments</h2>
        {assigned.length === 0 ? (
          <p className="mt-3 text-sm text-[#64748B]">No candidates have been assigned to you yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-[#F1F5F9]">
            {assigned.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div>
                  <Link
                    href={`/lawyer/candidates/${c.candidate.id}`}
                    className="font-medium text-[#0C2340] hover:underline"
                  >
                    {c.candidate.fullLegalName}
                  </Link>
                  <p className="text-xs text-[#94A3B8]">
                    {c.candidate.candidateNumber} · {formatVisa(c.visaType)} ·{' '}
                    {CASE_STATUS_LABELS[c.status] || c.status}
                  </p>
                </div>
                <span className="text-xs text-[#64748B]">
                  {c.documents.filter((d) => d.status === 'UPLOADED' || d.status === 'UNDER_REVIEW').length} to review
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
