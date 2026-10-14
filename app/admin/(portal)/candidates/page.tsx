import { prisma } from '@/lib/db'
import { requireAdminPage } from '@/lib/auth'
import { CandidatesTable } from '@/components/admin/candidates-table'
import { can } from '@/lib/rbac'
import { searchCandidates } from '@/lib/admin/search-candidates'
import { DataPortabilityBar } from '@/components/admin/data-portability-bar'
import { PageHeader } from '@/components/admin/ui'
import { admin } from '@/lib/admin/ui'
import Link from 'next/link'
import { VISA_LABELS } from '@/lib/visa'
import type { VisaType } from '@prisma/client'
import { isLawyerUser } from '@/lib/lawyer-access'
import { CandidatesBackupActions } from '@/components/admin/candidates-backup-actions'
import { CandidateFoldersActions } from '@/components/admin/candidate-folders-actions'

export const dynamic = 'force-dynamic'

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireAdminPage('candidates:read')
  const lawyerMode = isLawyerUser(user)
  const params = await searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) query.set(key, value)
  }
  const openCreate = query.get('create') === '1' && !lawyerMode
  const denied = query.get('denied') === '1'
  const [data, staff, visaCounts] = await Promise.all([
    searchCandidates(user, query),
    prisma.adminUser.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, fullName: true, role: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.case.groupBy({
      by: ['visaType'],
      where: lawyerMode
        ? { lifecycle: 'ACTIVE', assignedAttorneyId: user.id, candidate: { lifecycle: 'ACTIVE' } }
        : { lifecycle: 'ACTIVE', candidate: { lifecycle: 'ACTIVE' } },
      _count: { _all: true },
    }),
  ])

  const visaChipCounts = visaCounts
    .map((row) => ({
      visaType: row.visaType as VisaType,
      label: VISA_LABELS[row.visaType as VisaType] ?? row.visaType,
      count: row._count._all,
    }))
    .sort((a, b) => b.count - a.count)

  return (
    <div className="space-y-5">
      <PageHeader
        title={lawyerMode ? 'My Candidates' : 'Candidates'}
        description={
          lawyerMode
            ? 'Candidates assigned to you — filter by visa type or search by name / ID'
            : 'Manage candidates and case progress'
        }
        breadcrumb={[
          { label: lawyerMode ? 'Lawyer' : 'Admin', href: lawyerMode ? '/admin/candidates' : '/admin' },
          { label: lawyerMode ? 'My Candidates' : 'Candidates' },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!lawyerMode && can(user.role, 'documents:read') && (
              <CandidateFoldersActions canUpload={can(user.role, 'candidates:write') && can(user.role, 'documents:write')} />
            )}
            {!lawyerMode && user.role === 'SUPER_ADMIN' && <CandidatesBackupActions />}
            {can(user.role, 'candidates:write') ? (
              <Link href="/admin/candidates?create=1" className={admin.btnPrimary}>
                + Add Candidate
              </Link>
            ) : null}
          </div>
        }
      />
      {denied && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Access denied — that candidate is not assigned to you.
        </p>
      )}
      {!lawyerMode && <DataPortabilityBar />}
      <CandidatesTable
        items={data.items}
        total={data.total}
        page={data.page}
        pageSize={data.pageSize}
        staff={staff}
        canCreate={can(user.role, 'candidates:write')}
        canDelete={can(user.role, 'candidates:archive')}
        openCreate={openCreate}
        visaCounts={visaChipCounts}
        lawyerMode={lawyerMode}
      />
    </div>
  )
}
