import { prisma } from '@/lib/db'
import { calculateFinanceTotals, computeItemStatus, daysBetween, startOfDay } from '@/lib/manual-finance'

export type FinanceDashboardRange = '7d' | '30d' | '90d' | '180d' | '365d'

function rangeStart(range: FinanceDashboardRange) {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : range === '180d' ? 180 : 365
  const d = new Date()
  d.setDate(d.getDate() - days)
  d.setHours(0, 0, 0, 0)
  return d
}

export async function loadManualFinanceDashboard(range: FinanceDashboardRange = '30d') {
  const since = rangeStart(range)
  const monthStart = new Date()
  monthStart.setDate(1)
  monthStart.setHours(0, 0, 0, 0)
  const today = startOfDay(new Date())
  const weekEnd = new Date(today)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const [engagements, receipts, scheduleItems, cases] = await Promise.all([
    prisma.financialEngagement.findMany({
      include: {
        case: { select: { visaType: true, lifecycle: true, assignedAttorneyId: true, referredByName: true, referredByAdminId: true } },
        candidate: { select: { id: true, candidateNumber: true, fullLegalName: true } },
      },
    }),
    prisma.paymentReceipt.findMany({
      where: { status: 'ACTIVE' },
      include: {
        candidate: { select: { id: true, candidateNumber: true, fullLegalName: true } },
        case: { select: { visaType: true } },
        scheduleItem: { select: { countsTowardEngagement: true } },
      },
      orderBy: { receivedDate: 'asc' },
    }),
    prisma.paymentScheduleItem.findMany({
      where: { schedule: { status: 'ACTIVE' }, status: { notIn: ['CANCELLED', 'WAIVED'] } },
      include: {
        candidate: { select: { id: true, candidateNumber: true, fullLegalName: true } },
        receipts: { where: { status: 'ACTIVE' }, select: { amountCents: true } },
      },
    }),
    prisma.case.findMany({
      where: { lifecycle: 'ACTIVE' },
      select: {
        id: true,
        visaType: true,
        status: true,
        assignedAttorneyId: true,
        referredByName: true,
        referredByAdmin: { select: { fullName: true } },
        quotedAmountCents: true,
      },
    }),
  ])

  const activeEngagements = engagements.filter((e) => e.case.lifecycle === 'ACTIVE')
  const totalQuoted = activeEngagements.reduce((s, e) => s + e.quotedAmountCents, 0)

  const engagementReceipts = receipts.filter((r) => r.scheduleItem?.countsTowardEngagement !== false)
  const totalReceived = engagementReceipts.reduce((s, r) => s + r.amountCents, 0)
  const outstandingBalance = Math.max(0, totalQuoted - totalReceived)

  const paidThisMonth = engagementReceipts
    .filter((r) => r.receivedDate >= monthStart)
    .reduce((s, r) => s + r.amountCents, 0)

  let dueThisWeek = 0
  let overdueAmount = 0
  let paidInFullCount = 0
  let outstandingCandidateCount = 0
  const attention: Array<{
    candidateId: string
    candidateNumber: string
    name: string
    kind: string
    detail: string
    amountCents: number
    href: string
  }> = []

  for (const eng of activeEngagements) {
    const received = engagementReceipts
      .filter((r) => r.caseId === eng.caseId)
      .reduce((s, r) => s + r.amountCents, 0)
    const calc = calculateFinanceTotals({
      quotedCents: eng.quotedAmountCents,
      engagementReceiptsCents: received,
      scheduledReceiptsCents: received,
      additionalReceiptsCents: 0,
    })
    if (calc.paidInFull) paidInFullCount += 1
    else if (eng.quotedAmountCents > 0) outstandingCandidateCount += 1
    if (eng.quoteStatus === 'DRAFT' && eng.quotedAmountCents > 0) {
      attention.push({
        candidateId: eng.candidate.id,
        candidateNumber: eng.candidate.candidateNumber,
        name: eng.candidate.fullLegalName,
        kind: 'Quote not sent',
        detail: 'Quote created but not sent',
        amountCents: eng.quotedAmountCents,
        href: `/admin/candidates/${eng.candidate.id}#financial`,
      })
    }
  }

  for (const item of scheduleItems) {
    const received = item.receipts.reduce((s, r) => s + r.amountCents, 0)
    const status = computeItemStatus({
      scheduledCents: item.scheduledAmountCents,
      receivedCents: received,
      dueDate: item.dueDate,
      dueCondition: item.dueCondition,
      now: today,
    })
    const remaining = Math.max(0, item.scheduledAmountCents - received)
    if (remaining <= 0) continue
    if (item.dueDate) {
      const due = startOfDay(item.dueDate)
      if (due >= today && due <= weekEnd) dueThisWeek += remaining
      if (status === 'OVERDUE') {
        overdueAmount += remaining
        const days = daysBetween(item.dueDate, today)
        attention.push({
          candidateId: item.candidate.id,
          candidateNumber: item.candidate.candidateNumber,
          name: item.candidate.fullLegalName,
          kind: 'Overdue',
          detail: `${item.label} overdue ${days} day${days === 1 ? '' : 's'}`,
          amountCents: remaining,
          href: `/admin/candidates/${item.candidate.id}#financial`,
        })
      } else if (daysBetween(today, due) === 1 || daysBetween(today, due) === 0) {
        attention.push({
          candidateId: item.candidate.id,
          candidateNumber: item.candidate.candidateNumber,
          name: item.candidate.fullLegalName,
          kind: 'Due soon',
          detail: `${item.label} due ${due.toLocaleDateString()}`,
          amountCents: remaining,
          href: `/admin/candidates/${item.candidate.id}#financial`,
        })
      }
    }
  }

  // Collections over time (by day bucket)
  const collectionsMap = new Map<string, number>()
  for (const r of engagementReceipts.filter((x) => x.receivedDate >= since)) {
    const key = r.receivedDate.toISOString().slice(0, 10)
    collectionsMap.set(key, (collectionsMap.get(key) || 0) + r.amountCents)
  }
  const collectionsSeries = [...collectionsMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cents]) => ({ date, cents }))

  // Quoted vs received by month
  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
  const quotedByMonth = new Map<string, number>()
  for (const e of activeEngagements) {
    const key = monthKey(e.quotedAt || e.createdAt)
    quotedByMonth.set(key, (quotedByMonth.get(key) || 0) + e.quotedAmountCents)
  }
  const receivedByMonth = new Map<string, number>()
  for (const r of engagementReceipts) {
    const key = monthKey(r.receivedDate)
    receivedByMonth.set(key, (receivedByMonth.get(key) || 0) + r.amountCents)
  }
  const months = [...new Set([...quotedByMonth.keys(), ...receivedByMonth.keys()])].sort()
  const quotedVsReceived = months.map((m) => ({
    month: m,
    quoted: quotedByMonth.get(m) || 0,
    received: receivedByMonth.get(m) || 0,
  }))

  // Aging buckets for overdue
  const aging = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90p: 0 }
  for (const item of scheduleItems) {
    const received = item.receipts.reduce((s, r) => s + r.amountCents, 0)
    const remaining = Math.max(0, item.scheduledAmountCents - received)
    if (remaining <= 0) continue
    if (!item.dueDate) {
      aging.current += remaining
      continue
    }
    const days = daysBetween(item.dueDate, today)
    if (days <= 0) aging.current += remaining
    else if (days <= 30) aging.d1_30 += remaining
    else if (days <= 60) aging.d31_60 += remaining
    else if (days <= 90) aging.d61_90 += remaining
    else aging.d90p += remaining
  }

  // By visa
  const byVisa = new Map<string, { quoted: number; received: number; cases: number }>()
  for (const c of cases) {
    const key = c.visaType
    const row = byVisa.get(key) || { quoted: 0, received: 0, cases: 0 }
    row.cases += 1
    byVisa.set(key, row)
  }
  for (const e of activeEngagements) {
    const key = e.case.visaType
    const row = byVisa.get(key) || { quoted: 0, received: 0, cases: 0 }
    row.quoted += e.quotedAmountCents
    byVisa.set(key, row)
  }
  for (const r of engagementReceipts) {
    const key = r.case.visaType
    const row = byVisa.get(key) || { quoted: 0, received: 0, cases: 0 }
    row.received += r.amountCents
    byVisa.set(key, row)
  }

  return {
    cards: {
      totalQuoted,
      totalReceived,
      outstandingBalance,
      dueThisWeek,
      overdueAmount,
      paidInFullCount,
      outstandingCandidateCount,
      paidThisMonth,
    },
    collectionsSeries,
    quotedVsReceived,
    aging,
    byVisa: [...byVisa.entries()].map(([visa, v]) => ({
      visa,
      ...v,
      outstanding: Math.max(0, v.quoted - v.received),
    })),
    attention: attention.slice(0, 12),
    range,
  }
}
