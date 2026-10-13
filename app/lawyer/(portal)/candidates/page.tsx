import Link from 'next/link'
import { requireLawyerPage } from '@/lib/auth'
import { searchCandidates } from '@/lib/admin/search-candidates'
import { PageHeader, EmptyState } from '@/components/admin/ui'
import { formatVisa } from '@/lib/visa'
import { CASE_STATUS_LABELS } from '@/lib/visa'

export const dynamic = 'force-dynamic'

export default async function LawyerCandidatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireLawyerPage()
  const params = await searchParams
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value) query.set(key, value)
  }
  const denied = query.get('denied') === '1'
  const data = await searchCandidates(user, query)

  return (
    <div className="space-y-5">
      <PageHeader
        title="My Candidates"
        description="Only candidates explicitly assigned to you"
        breadcrumb={[{ label: 'Lawyer', href: '/lawyer/candidates' }, { label: 'My Candidates' }]}
      />

      {denied && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          You do not have access to that candidate.
        </p>
      )}

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={query.get('q') || ''}
          placeholder="Search name or candidate ID"
          className="min-w-[220px] flex-1 rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-lg bg-[#0C2340] px-4 py-2 text-sm font-medium text-white">
          Search
        </button>
      </form>

      {data.items.length === 0 ? (
        <EmptyState
          title="No candidates have been assigned to you yet."
          description="When an admin assigns a candidate to you, they will appear here."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {data.items.map((row) => {
            const docCount = row.documents?.uploaded ?? 0
            return (
              <li key={row.id}>
                <Link
                  href={`/lawyer/candidates/${row.id}`}
                  className="block rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm transition hover:border-[#0C2340]/30 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0C2340]"
                >
                  <p className="text-base font-semibold text-[#0C2340]">{row.fullLegalName}</p>
                  <p className="mt-1 text-xs text-[#64748B]">{row.candidateNumber}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[#334155]">
                    <span className="rounded-full bg-[#F1F5F9] px-2.5 py-0.5 text-xs font-medium">
                      {row.visaType ? formatVisa(row.visaType) : '—'}
                    </span>
                    <span className="text-xs text-[#64748B]">
                      {CASE_STATUS_LABELS[row.caseStatus as keyof typeof CASE_STATUS_LABELS] ||
                        String(row.caseStatus || '').replaceAll('_', ' ') ||
                        '—'}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-medium text-[#0F766E]">
                    {docCount} Document{docCount === 1 ? '' : 's'}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
