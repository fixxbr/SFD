import { CaseStatus, DocumentStatus, Prisma, VisaType } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { can } from '@/lib/rbac'
import { financialSummary, overallPaymentStatus } from '@/lib/payments'
import { calculateFinanceTotals, computeItemStatus, startOfDay } from '@/lib/manual-finance'
import { parseVisaType } from '@/lib/visa'
import { performance } from 'node:perf_hooks'

const visaTypes = Object.values(VisaType)
const caseStatuses = Object.values(CaseStatus)

type ScheduleItemSummary = {
  scheduledAmountCents: number
  dueDate: Date | null
  dueCondition: string | null
  status: string
  label: string
  receipts: Array<{ amountCents: number }>
}

export type CandidateListItem = {
  id: string
  candidateNumber: string
  fullLegalName: string
  email: string
  phone: string | null
  createdAt: Date
  visaType: VisaType | null
  caseNumber: string | null
  caseStatus: CaseStatus | null
  caseId: string | null
  onboardingStatus: string | null
  documents: { uploaded: number; accepted: number; required: number }
  manager: { id: string; fullName: string } | null
  attorney: { id: string; fullName: string } | null
  referredBy: string | null
  paymentStatus: string
  quoteStatus: string | null
  quotedCents: number
  paidCents: number
  remainingCents: number
  preFilingPercent: number
  nextPaymentLabel: string | null
  recentlyPaid: {
    amountCents: number
    date: Date
    description: string
    recordedBy: string
  } | null
  nextDue: {
    amountCents: number
    date: Date | null
    label: string
    status: string
  } | null
  lastActivity: Date
}

function manualFinanceLabel(input: {
  quotedCents: number
  paidCents: number
  quoteStatus: string | null
  hasSchedule: boolean
  itemStatuses: string[]
}) {
  if (input.quotedCents <= 0 && !input.hasSchedule) return 'No Payment Plan'
  if (input.quotedCents > 0 && (!input.quoteStatus || input.quoteStatus === 'DRAFT')) return 'Quote Not Sent'
  if (input.quoteStatus === 'SENT') return 'Quote Sent'
  if (input.quoteStatus === 'AGREED' && input.paidCents <= 0 && !input.hasSchedule) return 'Quote Agreed'
  if (input.quotedCents > 0 && input.paidCents + 1 >= input.quotedCents) return 'Paid in Full'
  if (input.itemStatuses.includes('OVERDUE')) return 'Overdue'
  if (input.itemStatuses.includes('DUE')) return 'Payment Due'
  if (input.itemStatuses.includes('PARTIALLY_PAID') || (input.paidCents > 0 && input.paidCents < input.quotedCents)) {
    return 'Partial'
  }
  if (input.hasSchedule) return 'Payment Due'
  return overallPaymentStatus([])
}

export async function searchCandidates(user: AuthUser, params: URLSearchParams) {
  const q = params.get('q')?.trim() ?? ''
  const visaRaw = params.get('visaType') || params.get('visa') || ''
  const visaType = visaRaw
    ? visaTypes.includes(visaRaw as VisaType)
      ? (visaRaw as VisaType)
      : parseVisaType(visaRaw)
    : null
  const caseStatus = params.get('caseStatus') || params.get('status')
  const onboardingStatus = params.get('onboardingStatus')
  const documentStatus = params.get('documentStatus')
  const paymentStatus = params.get('paymentStatus')
  const dueFilter = params.get('dueFilter')
  const managerId = params.get('managerId')
  const attorneyId = params.get('attorneyId')
  const referredBy = params.get('referredBy')
  const createdFrom = params.get('createdFrom')
  const createdTo = params.get('createdTo')
  const activityFrom = params.get('activityFrom')
  const activityTo = params.get('activityTo')
  const quotedMin = params.get('quotedMin')
  const quotedMax = params.get('quotedMax')
  const balanceMin = params.get('balanceMin')
  const balanceMax = params.get('balanceMax')
  const page = Math.max(1, Number(params.get('page') ?? 1))
  const take = 25
  const includeArchived = can(user.role, 'candidates:view_archived') && params.get('archived') === '1'

  const where: Prisma.CandidateWhereInput = {
    lifecycle: includeArchived ? undefined : 'ACTIVE',
  }

  if (q) {
    const exactId = q.trim().toUpperCase()
    if (/^ASM-\d+$/.test(exactId)) {
      where.candidateNumber = exactId
    } else {
      where.OR = [
        { candidateNumber: { contains: q, mode: 'insensitive' } },
        { fullLegalName: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
        { normalizedEmail: { contains: q.toLowerCase() } },
        { phone: { contains: q } },
        { cases: { some: { caseNumber: { contains: q, mode: 'insensitive' } } } },
      ]
    }
  }

  if (createdFrom || createdTo) {
    where.createdAt = {
      gte: createdFrom ? new Date(createdFrom) : undefined,
      lte: createdTo ? new Date(`${createdTo}T23:59:59.999Z`) : undefined,
    }
  }

  const caseWhere: Prisma.CaseWhereInput = { lifecycle: 'ACTIVE' }
  if (visaType) caseWhere.visaType = visaType
  if (caseStatus && caseStatuses.includes(caseStatus as CaseStatus)) caseWhere.status = caseStatus as CaseStatus
  if (managerId) caseWhere.assignedCaseManagerId = managerId
  // Lawyers are always scoped to their own assignments — ignore client attorneyId.
  if (user.role === 'ATTORNEY') {
    caseWhere.assignedAttorneyId = user.id
  } else if (attorneyId) {
    caseWhere.assignedAttorneyId = attorneyId
  }
  if (referredBy) {
    caseWhere.OR = [
      { referredByAdminId: referredBy },
      { referredByName: { contains: referredBy, mode: 'insensitive' } },
    ]
  }
  if (onboardingStatus) {
    caseWhere.onboardingSubmissions = { some: { status: onboardingStatus as never } }
  }
  if (documentStatus && Object.values(DocumentStatus).includes(documentStatus as DocumentStatus)) {
    caseWhere.documents = { some: { isCurrentVersion: true, status: documentStatus as DocumentStatus } }
  }
  if (activityFrom || activityTo) {
    caseWhere.activities = {
      some: {
        createdAt: {
          gte: activityFrom ? new Date(activityFrom) : undefined,
          lte: activityTo ? new Date(`${activityTo}T23:59:59.999Z`) : undefined,
        },
      },
    }
  }

  if (
    caseWhere.visaType ||
    caseWhere.status ||
    caseWhere.assignedCaseManagerId ||
    caseWhere.assignedAttorneyId ||
    caseWhere.onboardingSubmissions ||
    caseWhere.documents ||
    caseWhere.activities ||
    caseWhere.OR
  ) {
    where.cases = { some: caseWhere }
  } else if (user.role === 'ATTORNEY') {
    // Always require an assigned case for lawyers even when no other filters.
    where.cases = { some: { lifecycle: 'ACTIVE', assignedAttorneyId: user.id } }
  }

  const queryStartedAt = performance.now()
  const [total, rows] = await prisma.$transaction([
    prisma.candidate.count({ where }),
    prisma.candidate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * take,
      take,
      select: {
        id: true,
        candidateNumber: true,
        fullLegalName: true,
        email: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
        cases: {
          where: { lifecycle: includeArchived ? undefined : 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            visaType: true,
            caseNumber: true,
            status: true,
            quotedAmountCents: true,
            referredByName: true,
            assignedCaseManager: { select: { id: true, fullName: true } },
            assignedAttorney: { select: { id: true, fullName: true } },
            referredByAdmin: { select: { id: true, fullName: true } },
            payments:
              user.role === 'ATTORNEY'
                ? false
                : { select: { installmentNumber: true, amountCents: true, status: true, paidAmountCents: true } },
            documents: {
              where: { isCurrentVersion: true, status: { not: 'ARCHIVED' } },
              select: { isCurrentVersion: true, status: true },
            },
            onboardingSubmissions: {
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: { status: true },
            },
            activities: { orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
            financialEngagement:
              user.role === 'ATTORNEY'
                ? false
                : { select: { quotedAmountCents: true, quoteStatus: true } },
            paymentReceipts:
              user.role === 'ATTORNEY'
                ? false
                : {
                    where: { status: 'ACTIVE' },
                    select: { amountCents: true, receivedDate: true, description: true, receivedByName: true },
                  },
            paymentScheduleItems:
              user.role === 'ATTORNEY'
                ? false
                : {
                    where: { schedule: { status: 'ACTIVE' } },
                    select: {
                      scheduledAmountCents: true,
                      dueDate: true,
                      dueCondition: true,
                      status: true,
                      label: true,
                      receipts: { where: { status: 'ACTIVE' }, select: { amountCents: true } },
                    },
                  },
          },
        },
      },
    }),
  ])
  const queryDurationMs = performance.now() - queryStartedAt

  if (process.env.CANDIDATE_SEARCH_METRICS === 'true') {
    const relatedRecordCount = rows.reduce((totalRecords, candidate) => {
      return totalRecords + candidate.cases.reduce((caseRecords, currentCase) => {
        const scheduleItems = (currentCase.paymentScheduleItems ?? []) as unknown as ScheduleItemSummary[]
        return (
          caseRecords +
          (currentCase.payments?.length ?? 0) +
          currentCase.documents.length +
          currentCase.onboardingSubmissions.length +
          currentCase.activities.length +
          (currentCase.paymentReceipts?.length ?? 0) +
          scheduleItems.length +
          scheduleItems.reduce((receiptCount, item) => receiptCount + item.receipts.length, 0)
        )
      }, 0)
    }, 0)

    console.info('[candidate-search-metrics]', {
      durationMs: Number(queryDurationMs.toFixed(1)),
      returnedCandidates: rows.length,
      relatedRecords: relatedRecordCount,
      projectedBytes: Buffer.byteLength(JSON.stringify(rows)),
      page,
    })
  }

  const today = startOfDay(new Date())
  let items: CandidateListItem[] = rows.map((candidate) => {
    const currentCase = candidate.cases[0] ?? null
    const payments = currentCase?.payments ?? []
    const engagement = currentCase?.financialEngagement
    const receipts = currentCase?.paymentReceipts ?? []
    const scheduleItems = (currentCase?.paymentScheduleItems ?? []) as unknown as ScheduleItemSummary[]
    const paidFromReceipts = receipts.reduce((s, r) => s + r.amountCents, 0)
    const quoted = engagement?.quotedAmountCents ?? currentCase?.quotedAmountCents ?? payments.reduce((s, p) => s + p.amountCents, 0)
    const stripeSummary = financialSummary(quoted, payments)
    const paidCents = paidFromReceipts > 0 ? paidFromReceipts : stripeSummary.totalPaid
    const calc = calculateFinanceTotals({
      quotedCents: quoted,
      engagementReceiptsCents: paidCents,
      scheduledReceiptsCents: paidCents,
      additionalReceiptsCents: 0,
    })
    const itemStatuses = scheduleItems.map((item) =>
      computeItemStatus({
        scheduledCents: item.scheduledAmountCents,
        receivedCents: item.receipts.reduce((s, r) => s + r.amountCents, 0),
        dueDate: item.dueDate,
        dueCondition: item.dueCondition,
        now: today,
      }),
    )
    const nextIdx = scheduleItems.findIndex((item, idx) => !['PAID', 'WAIVED', 'CANCELLED'].includes(itemStatuses[idx]))
    const nextItem = nextIdx >= 0 ? scheduleItems[nextIdx] : null
    const latestReceipt = [...receipts].sort(
      (a, b) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime(),
    )[0]
    const paymentLabel = manualFinanceLabel({
      quotedCents: quoted,
      paidCents,
      quoteStatus: engagement?.quoteStatus ?? null,
      hasSchedule: scheduleItems.length > 0,
      itemStatuses,
    })
    const currentDocs = (currentCase?.documents ?? []).filter((d) => d.isCurrentVersion && d.status !== 'ARCHIVED')
    const uploaded = currentDocs.length
    const accepted = currentDocs.filter((d) => d.status === 'ACCEPTED').length
    return {
      id: candidate.id,
      candidateNumber: candidate.candidateNumber,
      fullLegalName: candidate.fullLegalName,
      email: candidate.email,
      phone: candidate.phone,
      createdAt: candidate.createdAt,
      visaType: currentCase?.visaType ?? null,
      caseNumber: currentCase?.caseNumber ?? null,
      caseStatus: currentCase?.status ?? null,
      caseId: currentCase?.id ?? null,
      onboardingStatus: currentCase?.onboardingSubmissions[0]?.status ?? null,
      documents: {
        uploaded,
        accepted,
        required: Math.max(uploaded, accepted),
      },
      manager: currentCase?.assignedCaseManager ?? null,
      attorney: currentCase?.assignedAttorney ?? null,
      referredBy: currentCase?.referredByAdmin?.fullName ?? currentCase?.referredByName ?? null,
      paymentStatus: user.role === 'ATTORNEY' ? '—' : paymentLabel,
      quoteStatus: user.role === 'ATTORNEY' ? null : engagement?.quoteStatus ?? null,
      quotedCents: user.role === 'ATTORNEY' ? 0 : quoted,
      paidCents: user.role === 'ATTORNEY' ? 0 : paidCents,
      remainingCents: user.role === 'ATTORNEY' ? 0 : calc.remainingBalance,
      preFilingPercent: user.role === 'ATTORNEY' ? 0 : Math.round(stripeSummary.preFilingRatio * 100),
      nextPaymentLabel: user.role === 'ATTORNEY' ? null : nextItem?.label ?? (stripeSummary.nextPayment ? `Payment ${stripeSummary.nextPayment.installmentNumber}` : null),
      recentlyPaid: user.role === 'ATTORNEY' ? null : latestReceipt
        ? {
            amountCents: latestReceipt.amountCents,
            date: latestReceipt.receivedDate,
            description: latestReceipt.description,
            recordedBy: latestReceipt.receivedByName,
          }
        : null,
      nextDue: user.role === 'ATTORNEY' ? null : nextItem
        ? {
            amountCents: Math.max(
              0,
              nextItem.scheduledAmountCents - nextItem.receipts.reduce((s, r) => s + r.amountCents, 0),
            ),
            date: nextItem.dueDate,
            label: nextItem.label,
            status: itemStatuses[nextIdx] ?? nextItem.status,
          }
        : null,
      lastActivity: currentCase?.activities[0]?.createdAt ?? candidate.updatedAt,
      _itemStatuses: itemStatuses,
      _dueDates: scheduleItems.map((i) => i.dueDate),
    } as CandidateListItem & { _itemStatuses: string[]; _dueDates: Array<Date | null> }
  })

  if (paymentStatus) items = items.filter((item) => item.paymentStatus === paymentStatus)

  if (dueFilter) {
    const weekEnd = new Date(today)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const monthEnd = new Date(today)
    monthEnd.setMonth(monthEnd.getMonth() + 1)
    items = items.filter((item) => {
      const row = item as CandidateListItem & { _itemStatuses: string[]; _dueDates: Array<Date | null> }
      const overdue = row._itemStatuses?.includes('OVERDUE')
      if (dueFilter === 'overdue') return overdue
      if (dueFilter === 'due_today') return row._itemStatuses?.includes('DUE')
      if (dueFilter === 'due_week' || dueFilter === 'due_7') {
        return row._dueDates?.some((d) => d && d >= today && d <= weekEnd)
      }
      if (dueFilter === 'due_month') {
        return row._dueDates?.some((d) => d && d >= today && d <= monthEnd)
      }
      if (dueFilter === 'overdue_30') {
        return row._dueDates?.some((d, idx) => {
          if (!d || row._itemStatuses[idx] !== 'OVERDUE') return false
          const days = Math.floor((today.getTime() - startOfDay(d).getTime()) / 86400000)
          return days >= 30
        })
      }
      return true
    })
  }

  if (quotedMin) items = items.filter((i) => i.quotedCents >= Math.round(Number(quotedMin) * 100))
  if (quotedMax) items = items.filter((i) => i.quotedCents <= Math.round(Number(quotedMax) * 100))
  if (balanceMin) items = items.filter((i) => i.remainingCents >= Math.round(Number(balanceMin) * 100))
  if (balanceMax) items = items.filter((i) => i.remainingCents <= Math.round(Number(balanceMax) * 100))

  // Strip internal filter helpers before return
  items = items.map((item) => {
    const clean = { ...item } as CandidateListItem & { _itemStatuses?: unknown; _dueDates?: unknown }
    delete clean._itemStatuses
    delete clean._dueDates
    return clean
  })

  return { items, total, page, pageSize: take }
}
