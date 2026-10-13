/** Pure manual-finance helpers — no Stripe dependency. */

export const PAYMENT_METHODS = [
  'ACH',
  'Wire Transfer',
  'Check',
  'Cash',
  'Zelle',
  'Bank Transfer',
  "Cashier's Check",
  'Money Order',
  'Other',
] as const

export const FEE_CATEGORIES = [
  'PROFESSIONAL_FEE',
  'GOVERNMENT_FILING_FEE',
  'PREMIUM_PROCESSING_FEE',
  'EVALUATION_FEE',
  'TRANSLATION_FEE',
  'ADDITIONAL_SERVICE',
  'OTHER',
] as const

export type ScheduleStructure = 'SINGLE' | 'SPLIT' | 'MONTHLY' | 'CUSTOM'
export type QuoteStatus = 'DRAFT' | 'SENT' | 'AGREED' | 'UPDATED'
export type ScheduleItemStatus = 'UPCOMING' | 'DUE' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'WAIVED' | 'CANCELLED'

export type ScheduleDraftItem = {
  label: string
  amountCents: number
  dueDate?: string | null
  dueCondition?: string | null
  feeCategory?: string
  countsTowardEngagement?: boolean
  notes?: string | null
}

export function dollarsToCents(value: string | number): number {
  if (typeof value === 'number') return Math.round(value * 100)
  const cleaned = value.replace(/[$,\s]/g, '')
  if (!cleaned) return 0
  return Math.round(Number(cleaned) * 100)
}

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format((cents || 0) / 100)
}

export function startOfDay(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addMonths(date: Date, months: number) {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

export function daysBetween(from: Date, to: Date) {
  const a = startOfDay(from).getTime()
  const b = startOfDay(to).getTime()
  return Math.floor((b - a) / (24 * 60 * 60 * 1000))
}

/** Build equal monthly/biweekly installment drafts. */
export function buildInstallmentDrafts(input: {
  totalCents: number
  count: number
  firstDueDate: Date
  frequency: 'MONTHLY' | 'BIWEEKLY'
  labelPrefix?: string
}): ScheduleDraftItem[] {
  const count = Math.max(1, Math.floor(input.count))
  const base = Math.floor(input.totalCents / count)
  const remainder = input.totalCents - base * count
  const items: ScheduleDraftItem[] = []
  for (let i = 0; i < count; i++) {
    const due =
      input.frequency === 'BIWEEKLY'
        ? addDays(input.firstDueDate, i * 14)
        : addMonths(input.firstDueDate, i)
    items.push({
      label: `${input.labelPrefix ?? 'Payment'} ${i + 1}`,
      amountCents: base + (i === count - 1 ? remainder : 0),
      dueDate: due.toISOString().slice(0, 10),
      feeCategory: 'PROFESSIONAL_FEE',
      countsTowardEngagement: true,
    })
  }
  return items
}

export function moveScheduleItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items
  }
  const next = [...items]
  const [moved] = next.splice(fromIndex, 1)
  next.splice(toIndex, 0, moved)
  return next
}

export function renumberDefaultPaymentLabels<T extends { label: string }>(items: T[]): T[] {
  return items.map((item, index) =>
    /^payment\s+\d+$/i.test(item.label.trim()) ? { ...item, label: `Payment ${index + 1}` } : item,
  )
}

export function sumScheduled(items: Array<{ amountCents: number }>) {
  return items.reduce((s, i) => s + (i.amountCents || 0), 0)
}

export function scheduleTotalMatchesQuote(scheduledCents: number, quotedCents: number, tolerance = 0) {
  return Math.abs(scheduledCents - quotedCents) <= tolerance
}

export function computeItemStatus(input: {
  scheduledCents: number
  receivedCents: number
  dueDate?: Date | null
  dueCondition?: string | null
  waived?: boolean
  cancelled?: boolean
  now?: Date
}): ScheduleItemStatus {
  if (input.cancelled) return 'CANCELLED'
  if (input.waived) return 'WAIVED'
  if (input.receivedCents + 1 >= input.scheduledCents && input.scheduledCents > 0) return 'PAID'
  if (input.receivedCents > 0) return 'PARTIALLY_PAID'
  const now = startOfDay(input.now ?? new Date())
  if (input.dueDate) {
    const due = startOfDay(input.dueDate)
    if (now.getTime() > due.getTime()) return 'OVERDUE'
    if (now.getTime() === due.getTime()) return 'DUE'
  }
  return 'UPCOMING'
}

export type FinanceCalculatorInput = {
  quotedCents: number
  /** Receipts that count toward engagement balance */
  engagementReceiptsCents: number
  scheduledReceiptsCents: number
  additionalReceiptsCents: number
  externalFeesCents?: number
}

export function calculateFinanceTotals(input: FinanceCalculatorInput) {
  const quoted = Math.max(0, input.quotedCents)
  const totalReceived = Math.max(0, input.engagementReceiptsCents)
  const remaining = quoted - totalReceived
  const overpayment = remaining < 0 ? Math.abs(remaining) : 0
  const remainingBalance = Math.max(0, remaining)
  const progressPct = quoted > 0 ? Math.min(999, Math.round((totalReceived / quoted) * 1000) / 10) : 0
  const paidInFull = quoted > 0 && totalReceived + 1 >= quoted
  return {
    quotedTotal: quoted,
    scheduledReceived: Math.max(0, input.scheduledReceiptsCents),
    additionalReceived: Math.max(0, input.additionalReceiptsCents),
    totalReceived,
    remainingBalance,
    overpayment,
    progressPct,
    paidInFull,
    externalFees: Math.max(0, input.externalFeesCents ?? 0),
    totalFinancialActivity: totalReceived + Math.max(0, input.externalFeesCents ?? 0),
  }
}

export function allocatedToItem(
  itemId: string,
  receipts: Array<{
    status: string
    amountCents: number
    paymentScheduleItemId?: string | null
    allocations?: Array<{ scheduleItemId: string; amountCents: number }>
  }>,
) {
  let total = 0
  for (const r of receipts) {
    if (r.status !== 'ACTIVE') continue
    if (r.allocations?.length) {
      for (const a of r.allocations) {
        if (a.scheduleItemId === itemId) total += a.amountCents
      }
    } else if (r.paymentScheduleItemId === itemId) {
      total += r.amountCents
    }
  }
  return total
}
