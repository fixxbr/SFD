import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatDateTime } from '@/lib/format'
import { PageHeader, EmptyState, SectionCard } from '@/components/admin/ui'
import { admin } from '@/lib/admin/ui'

export const dynamic = 'force-dynamic'

export default async function CommunicationsPage() {
  await requireAdminPage('communications:read')
  const items = await prisma.communication.findMany({
    orderBy: { sentAt: 'desc' },
    take: 100,
    include: {
      candidate: { select: { id: true, fullLegalName: true, candidateNumber: true } },
      sentBy: { select: { fullName: true } },
    },
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Communications"
        description="Email and communication logs across candidates"
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Communications' }]}
        actions={
          <Link href="/admin/settings/templates" className={admin.btnSecondary}>
            Email Templates
          </Link>
        }
      />
      <SectionCard title="Recent emails">
        {items.length === 0 ? (
          <EmptyState title="No emails sent yet" description="Welcome, document, and payment emails will appear here." />
        ) : (
          <div className={admin.tableWrap + ' border-0 shadow-none'}>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                <tr>
                  {['Date', 'Candidate', 'Template', 'Recipient', 'Subject', 'Status', 'Sent by'].map((h) => (
                    <th key={h} className={admin.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC]/70">
                    <td className={`${admin.td} whitespace-nowrap text-xs text-[#64748B]`}>{formatDateTime(item.sentAt)}</td>
                    <td className={admin.td}>
                      <Link href={`/admin/candidates/${item.candidateId}?tab=emails`} className="font-medium hover:text-[#0F766E]">
                        {item.candidate.fullLegalName}
                      </Link>
                      <p className="font-mono text-[11px] text-[#94A3B8]">{item.candidate.candidateNumber}</p>
                    </td>
                    <td className={admin.td}>{item.templateType || item.type}</td>
                    <td className={admin.td}>{item.recipient}</td>
                    <td className={admin.td}>{item.subject}</td>
                    <td className={admin.td}>{item.status}</td>
                    <td className={admin.td}>{item.sentBy?.fullName ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}
