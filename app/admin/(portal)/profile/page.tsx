import { requireAdminPage } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { lawyerWorkloadStats, isLawyerUser } from '@/lib/lawyer-access'
import { formatRole } from '@/lib/role-labels'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatDateTime } from '@/lib/format'
import { LawyerProfileForm } from '@/components/admin/lawyer-profile-form'
import Link from 'next/link'
import { formatVisa, CASE_STATUS_LABELS } from '@/lib/visa'

export const dynamic = 'force-dynamic'

export default async function MyProfilePage() {
  const user = await requireAdminPage('candidates:read')
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

  const lawyerMode = isLawyerUser(user)
  const stats = lawyerMode ? await lawyerWorkloadStats(user.id) : null
  const assigned = lawyerMode
    ? await prisma.case.findMany({
        where: { lifecycle: 'ACTIVE', assignedAttorneyId: user.id },
        orderBy: { updatedAt: 'desc' },
        take: 12,
        include: {
          candidate: { select: { id: true, fullLegalName: true, candidateNumber: true } },
          documents: { where: { isCurrentVersion: true }, select: { status: true } },
        },
      })
    : []

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-[#0C2340]">My Profile</h1>
        <p className="mt-1 text-sm text-[#64748B]">
          {lawyerMode ? 'Your lawyer workspace account' : 'Your Afterstem account'}
        </p>
      </div>

      <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#0C2340] text-lg font-semibold text-white">
              {record.fullName
                .split(/\s+/)
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? '')
                .join('')}
            </div>
            <div>
              <p className="text-lg font-semibold text-[#0C2340]">{record.fullName}</p>
              <p className="text-sm text-[#64748B]">{record.email}</p>
              <div className="mt-1 flex flex-wrap gap-2">
                <StatusBadge status={formatRole(record.role)} />
                <StatusBadge status={record.status} />
              </div>
            </div>
          </div>
          {record.lastLoginAt && (
            <p className="text-xs text-[#94A3B8]">Last login {formatDateTime(record.lastLoginAt)}</p>
          )}
        </div>

        <div className="mt-5">
          <LawyerProfileForm fullName={record.fullName} email={record.email} />
        </div>
      </div>

      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Assigned Candidates</p>
            <p className="mt-1 text-2xl font-semibold text-[#0C2340]">{stats.assignedCandidates}</p>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Active Cases</p>
            <p className="mt-1 text-2xl font-semibold text-[#0C2340]">{stats.activeCases}</p>
          </div>
          <div className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Docs Awaiting Review</p>
            <p className="mt-1 text-2xl font-semibold text-[#0C2340]">{stats.documentsAwaitingReview}</p>
          </div>
        </div>
      )}

      {lawyerMode && (
        <div className="rounded-xl border border-[#E2E8F0] bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-[#0C2340]">Assigned Candidates</h2>
            <Link href="/admin/candidates" className="text-xs font-medium text-[#0F766E] hover:underline">
              View all
            </Link>
          </div>
          <ul className="divide-y divide-[#EEF1F4]">
            {assigned.map((c) => {
              const uploaded = c.documents.length
              const accepted = c.documents.filter((d) => d.status === 'ACCEPTED').length
              return (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                  <div>
                    <Link href={`/admin/candidates/${c.candidate.id}`} className="font-medium text-[#0C2340] hover:underline">
                      {c.candidate.fullLegalName}
                    </Link>
                    <p className="text-xs text-[#64748B]">
                      {c.candidate.candidateNumber} · {formatVisa(c.visaType)} · {accepted}/{uploaded} docs
                    </p>
                  </div>
                  <StatusBadge status={CASE_STATUS_LABELS[c.status] ?? c.status} />
                </li>
              )
            })}
            {assigned.length === 0 && (
              <li className="py-4 text-sm text-[#64748B]">No candidates assigned yet.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
