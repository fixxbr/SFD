import { describe, expect, it } from 'vitest'
import {
  autoPayment4,
  canReadyToFile,
  expectedSplit,
  financialSummary,
  overallPaymentStatus,
  validateInstallments,
  validatePreFilingAllocation,
} from '@/lib/payments'

describe('Afterstem 4-payment structure', () => {
  it('splits 75% / 25% with cents rounding', () => {
    expect(expectedSplit(100000)).toEqual({ preFilingCents: 75000, postApprovalCents: 25000 })
    expect(expectedSplit(2000000)).toEqual({ preFilingCents: 1500000, postApprovalCents: 500000 })
  })

  it('accepts unequal first three payments that still total 75%', () => {
    const result = validateInstallments({
      totalCents: 2000000,
      payment1Cents: 400000,
      payment2Cents: 600000,
      payment3Cents: 500000,
      payment4Cents: 500000,
    })
    expect(result.ok).toBe(true)
  })

  it('auto-calculates payment 4 as the remaining 25%', () => {
    expect(autoPayment4(2000000, 400000, 600000, 500000)).toBe(500000)
  })

  it('shows live allocation shortfall', () => {
    const live = validatePreFilingAllocation(2000000, 400000, 600000, 400000)
    expect(live.valid).toBe(false)
    expect(live.shortfallCents).toBe(100000)
  })

  it('tracks paid / remaining / pre-filing progress after payment 2', () => {
    const payments = [
      { installmentNumber: 1, amountCents: 500000, status: 'PAID', paidAmountCents: 500000 },
      { installmentNumber: 2, amountCents: 500000, status: 'PAID', paidAmountCents: 500000 },
      { installmentNumber: 3, amountCents: 500000, status: 'READY' },
      { installmentNumber: 4, amountCents: 500000, status: 'READY' },
    ]
    const summary = financialSummary(2000000, payments)
    expect(summary.totalPaid).toBe(1000000)
    expect(summary.remaining).toBe(1000000)
    expect(summary.prePaid).toBe(1000000)
    expect(summary.preFilingCents).toBe(1500000)
    expect(overallPaymentStatus(payments)).toBe('Partially Paid')
    expect(canReadyToFile(2000000, payments)).toBe(false)
  })

  it('marks pre-filing complete after payment 3 and paid in full after payment 4', () => {
    const after3 = [
      { installmentNumber: 1, amountCents: 500000, status: 'PAID' },
      { installmentNumber: 2, amountCents: 500000, status: 'PAID' },
      { installmentNumber: 3, amountCents: 500000, status: 'PAID' },
      { installmentNumber: 4, amountCents: 500000, status: 'READY' },
    ]
    expect(financialSummary(2000000, after3).preFilingComplete).toBe(true)
    expect(overallPaymentStatus(after3)).toBe('75% Pre-Filing')
    expect(canReadyToFile(2000000, after3)).toBe(true)

    const after4 = after3.map((p) => ({ ...p, status: 'PAID' }))
    expect(financialSummary(2000000, after4).paidInFull).toBe(true)
    expect(overallPaymentStatus(after4)).toBe('Paid in Full')
  })
})
