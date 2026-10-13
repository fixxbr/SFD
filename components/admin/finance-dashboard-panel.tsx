import { loadManualFinanceDashboard } from '@/lib/finance-dashboard'
import { formatCents } from '@/lib/manual-finance'
import { formatVisa } from '@/lib/visa'
import Link from 'next/link'

function BarChart({
  items,
  valueKey,
  labelKey,
}: {
  items: Array<Record<string, string | number>>
  valueKey: string
  labelKey: string
}) {
  const max = Math.max(1, ...items.map((i) => Number(i[valueKey] || 0)))
  return (
    <ul className="space-y-2">
      {items.length === 0 && <li className="text-sm text-[#5B6B7C]">No data yet.</li>}
      {items.map((item) => {
        const value = Number(item[valueKey] || 0)
        const pct = Math.round((value / max) * 100)
        return (
          <li key={String(item[labelKey])}>
            <div className="mb-1 flex justify-between text-xs text-[#5B6B7C]">
              <span>{String(item[labelKey])}</span>
              <span className="font-medium text-[#0C2340]">{formatCents(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded bg-[#EEF1F4]">
              <div className="h-full rounded bg-[#0F766E]" style={{ width: `${pct}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export async function FinanceDashboardPanel() {
  const data = await loadManualFinanceDashboard('30d')
  const cards: Array<[string, number]> = [
    ['Total Quoted Value', data.cards.totalQuoted],
    ['Total Received', data.cards.totalReceived],
    ['Outstanding Balance', data.cards.outstandingBalance],
    ['Due This Week', data.cards.dueThisWeek],
    ['Overdue Amount', data.cards.overdueAmount],
    ['Paid in Full', data.cards.paidInFullCount],
    ['With Outstanding Balance', data.cards.outstandingCandidateCount],
    ['Received This Month', data.cards.paidThisMonth],
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5B6B7C]">Finance</h2>
          <p className="mt-1 text-sm text-[#5B6B7C]">Manual receivables from Neon payment receipts.</p>
        </div>
        <a href="/api/admin/finance?export=csv" className="rounded border border-[#D7DEE6] px-3 py-1.5 text-xs hover:bg-white">
          Export CSV
        </a>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => {
          const isCount = label === 'Paid in Full' || label === 'With Outstanding Balance'
          return (
            <div key={label} className="rounded-lg border border-[#D7DEE6] bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-[#5B6B7C]">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{isCount ? value : formatCents(value)}</p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-[#D7DEE6] bg-white p-5">
          <h3 className="text-sm font-semibold text-[#0C2340]">Payments received (30 days)</h3>
          <div className="mt-4">
            <BarChart items={data.collectionsSeries.map((r) => ({ label: r.date.slice(5), cents: r.cents }))} valueKey="cents" labelKey="label" />
          </div>
        </section>
        <section className="rounded-lg border border-[#D7DEE6] bg-white p-5">
          <h3 className="text-sm font-semibold text-[#0C2340]">Quoted vs received by month</h3>
          <ul className="mt-4 space-y-3">
            {data.quotedVsReceived.length === 0 && <li className="text-sm text-[#5B6B7C]">No data yet.</li>}
            {data.quotedVsReceived.map((row) => (
              <li key={row.month} className="text-sm">
                <p className="font-medium text-[#0C2340]">{row.month}</p>
                <p className="text-xs text-[#5B6B7C]">
                  Quoted {formatCents(row.quoted)} · Received {formatCents(row.received)}
                </p>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-[#D7DEE6] bg-white p-5">
          <h3 className="text-sm font-semibold text-[#0C2340]">Outstanding aging</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex justify-between"><span>Current</span><strong>{formatCents(data.aging.current)}</strong></li>
            <li className="flex justify-between"><span>1–30 days overdue</span><strong>{formatCents(data.aging.d1_30)}</strong></li>
            <li className="flex justify-between"><span>31–60</span><strong>{formatCents(data.aging.d31_60)}</strong></li>
            <li className="flex justify-between"><span>61–90</span><strong>{formatCents(data.aging.d61_90)}</strong></li>
            <li className="flex justify-between"><span>90+</span><strong>{formatCents(data.aging.d90p)}</strong></li>
          </ul>
        </section>
        <section className="rounded-lg border border-[#D7DEE6] bg-white p-5">
          <h3 className="text-sm font-semibold text-[#0C2340]">By visa type</h3>
          <ul className="mt-4 space-y-2 text-sm">
            {data.byVisa.map((row) => (
              <li key={row.visa} className="border-b border-[#EEF1F4] pb-2">
                <p className="font-medium">{formatVisa(row.visa)} · {row.cases} cases</p>
                <p className="text-xs text-[#5B6B7C]">
                  Quoted {formatCents(row.quoted)} · Received {formatCents(row.received)} · Outstanding {formatCents(row.outstanding)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-[#D7DEE6] bg-white p-5">
        <h3 className="text-sm font-semibold text-[#0C2340]">Needs financial attention</h3>
        <ul className="mt-4 space-y-3">
          {data.attention.length === 0 && <li className="text-sm text-[#5B6B7C]">Nothing waiting right now.</li>}
          {data.attention.map((item) => (
            <li key={`${item.candidateId}-${item.kind}-${item.detail}`} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <div>
                <Link href={item.href} className="font-medium hover:text-[#0F766E]">
                  {item.candidateNumber} · {item.name}
                </Link>
                <p className="text-xs text-[#5B6B7C]">
                  {item.kind}: {item.detail} · {formatCents(item.amountCents)}
                </p>
              </div>
              <Link href={item.href} className="rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7]">
                Open
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
