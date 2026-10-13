/**
 * Pure financial / payment-plan helpers for Afterstem engagements.
 * Quoted totals are per-case — never globally hard-coded.
 */

export const PRE_FILING_RATIO = 0.75
export const ROUNDING_TOLERANCE_CENTS = 2

export type InstallmentPlan = {
  totalCents: number
  payment1Cents: number
  payment2Cents: number
  payment3Cents: number
  payment4Cents: number
}

export type PaymentValidationResult =
  | { ok: true; preFilingCents: number; postApprovalCents: number }
  | { ok: false; error: string; shortfallCents?: number }

export type PaymentLike = {
  installmentNumber: number
  amountCents: number
  status: string
  paidAmountCents?: number | null
}

export function expectedSplit(totalCents: number): { preFilingCents: number; postApprovalCents: number } {
  const preFilingCents = Math.round(totalCents * PRE_FILING_RATIO)
  return { preFilingCents, postApprovalCents: totalCents - preFilingCents }
}

export function autoPayment4(totalCents: number, p1: number, p2: number, p3: number): number {
  return totalCents - p1 - p2 - p3
}

export function validatePreFilingAllocation(totalCents: number, p1: number, p2: number, p3: number) {
  const { preFilingCents, postApprovalCents } = expectedSplit(totalCents)
  const allocated = p1 + p2 + p3
  const shortfallCents = preFilingCents - allocated
  const payment4Cents = autoPayment4(totalCents, p1, p2, p3)
  return {
    preFilingCents,
    postApprovalCents,
    allocated,
    shortfallCents,
    payment4Cents,
    valid:
      totalCents > 0 &&
      p1 >= 0 &&
      p2 >= 0 &&
      p3 >= 0 &&
      Math.abs(shortfallCents) <= ROUNDING_TOLERANCE_CENTS &&
      Math.abs(payment4Cents - postApprovalCents) <= ROUNDING_TOLERANCE_CENTS,
  }
}

export function validateInstallments(plan: InstallmentPlan): PaymentValidationResult {
  const { totalCents, payment1Cents, payment2Cents, payment3Cents, payment4Cents } = plan
  if (totalCents <= 0) return { ok: false, error: 'Quoted engagement amount must be greater than zero.' }
  if ([payment1Cents, payment2Cents, payment3Cents, payment4Cents].some((n) => n < 0)) {
    return { ok: false, error: 'Payment amounts cannot be negative.' }
  }

  const sum = payment1Cents + payment2Cents + payment3Cents + payment4Cents
  if (sum !== totalCents) {
    return { ok: false, error: 'The four payments must add up to the quoted engagement amount.' }
  }

  const check = validatePreFilingAllocation(totalCents, payment1Cents, payment2Cents, payment3Cents)
  if (!check.valid) {
    if (check.shortfallCents > ROUNDING_TOLERANCE_CENTS) {
      return {
        ok: false,
        error: `$${((check.shortfallCents) / 100).toFixed(2)} still needs to be allocated to Payments 1–3 before saving.`,
        shortfallCents: check.shortfallCents,
      }
    }
    return {
      ok: false,
      error: `Payments 1–3 must equal 75% and Payment 4 must equal 25% of the quoted amount.`,
      shortfallCents: check.shortfallCents,
    }
  }

  return { ok: true, preFilingCents: check.preFilingCents, postApprovalCents: check.postApprovalCents }
}

export function formatCents(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

export function isPaidStatus(status: string) {
  return status === 'PAID'
}

export function paidCentsFor(payment: PaymentLike) {
  if (!isPaidStatus(payment.status)) return 0
  return payment.paidAmountCents ?? payment.amountCents
}

export function financialSummary(quotedCents: number, payments: PaymentLike[]) {
  const { preFilingCents, postApprovalCents } = expectedSplit(quotedCents)
  const totalPaid = payments.reduce((sum, p) => sum + paidCentsFor(p), 0)
  const remaining = Math.max(0, quotedCents - totalPaid)
  const prePaid = payments.filter((p) => p.installmentNumber <= 3).reduce((sum, p) => sum + paidCentsFor(p), 0)
  const postPaid = payments.filter((p) => p.installmentNumber === 4).reduce((sum, p) => sum + paidCentsFor(p), 0)
  const preFilingComplete = prePaid + ROUNDING_TOLERANCE_CENTS >= preFilingCents && preFilingCents > 0
  const paidInFull = totalPaid + ROUNDING_TOLERANCE_CENTS >= quotedCents && quotedCents > 0
  const next = [...payments]
    .sort((a, b) => a.installmentNumber - b.installmentNumber)
    .find((p) => !isPaidStatus(p.status) && p.status !== 'WAIVED')
  return {
    quotedCents,
    preFilingCents,
    postApprovalCents,
    totalPaid,
    remaining,
    prePaid,
    postPaid,
    preFilingRemaining: Math.max(0, preFilingCents - prePaid),
    preFilingComplete,
    paidInFull,
    preFilingRatio: preFilingCents === 0 ? 0 : prePaid / preFilingCents,
    nextPayment: next ?? null,
  }
}

export function overallPaymentStatus(payments: PaymentLike[]): string {
  if (payments.length === 0) return 'Not configured'
  const paid = payments.filter((p) => isPaidStatus(p.status))
  if (paid.length === 0) {
    if (payments.some((p) => p.status === 'PAYMENT_LINK_SENT')) return 'Link Sent'
    if (payments.some((p) => p.status === 'PAYMENT_LINK_GENERATED' || p.status === 'READY')) return 'Pending'
    return 'Unpaid'
  }
  if (paid.length === 4) return 'Paid in Full'
  const summary = financialSummary(
    payments.reduce((s, p) => s + p.amountCents, 0),
    payments,
  )
  if (summary.preFilingComplete) return '75% Pre-Filing'
  return 'Partially Paid'
}

export function canReadyToFile(quotedCents: number, payments: PaymentLike[]) {
  const summary = financialSummary(quotedCents, payments)
  return summary.preFilingComplete
}

export function paymentBadgeLabel(status: string) {
  return status.replaceAll('_', ' ')
}
