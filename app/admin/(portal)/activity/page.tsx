import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatDateTime } from '@/lib/format'
import { PageHeader } from '@/components/admin/ui'
import { EmptyState, SectionCard } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function ActivityPage() {
  await requireAdminPage('activity:read')
  const items = await prisma.caseActivity.findMany({
    orderBy: { createdAt: 'desc' },
    take: 150,
    include: { candidate: true, case: true },
  })
  return (
    <div className="space-y-5">
      <PageHeader
        title="Activity"
        description="Recent case and candidate activity across Afterstem"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Activity' }]}
      />
      <SectionCard title="Timeline">
        {items.length === 0 ? (
          <EmptyState title="No activity yet" />
        ) : (
          <ol className="space-y-2">
            {items.map((item) => (
              <li key={item.id} className="rounded-lg border border-[#F1F5F9] bg-[#F8FAFC] px-4 py-3 text-sm">
                <Link href={`/admin/candidates/${item.candidateId}?tab=activity`} className="font-medium hover:text-[#0F766E]">
                  {item.candidate.fullLegalName}
                </Link>
                <span className="text-[#64748B]">
                  {' '}
                  · {formatDateTime(item.createdAt)} — {item.message}
                </span>
              </li>
            ))}
          </ol>
        )}
      </SectionCard>
    </div>
  )
}
