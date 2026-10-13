import { describe, expect, it } from 'vitest'
import {
  allocatedToItem,
  buildInstallmentDrafts,
  calculateFinanceTotals,
  computeItemStatus,
  dollarsToCents,
  formatCents,
  moveScheduleItem,
  renumberDefaultPaymentLabels,
  scheduleTotalMatchesQuote,
  sumScheduled,
} from '@/lib/manual-finance'
import { renderFinanceEmail, scheduleRowsHtml } from '@/lib/finance-email-templates'

describe('manual finance calculator', () => {
  it('parses dollars and formats cents', () => {
    expect(dollarsToCents('20,000')).toBe(2000000)
    expect(dollarsToCents('$5,000.50')).toBe(500050)
    expect(formatCents(2000000)).toBe('$20,000.00')
  })

  it('builds monthly installments that sum to total', () => {
    const items = buildInstallmentDrafts({
      totalCents: 1200000,
      count: 6,
      firstDueDate: new Date('2026-09-15'),
      frequency: 'MONTHLY',
    })
    expect(items).toHaveLength(6)
    expect(sumScheduled(items)).toBe(1200000)
    expect(items[0].dueDate).toBe('2026-09-15')
  })

  it('supports schedules beyond four items, deletion renumbering, and reordering', () => {
    const schedule = Array.from({ length: 6 }, (_, index) => ({
      label: `Payment ${index + 1}`,
      amountCents: (index + 1) * 100,
    }))
    const afterDelete = renumberDefaultPaymentLabels(schedule.filter((_, index) => index !== 1))
    expect(afterDelete.map((item) => item.label)).toEqual(['Payment 1', 'Payment 2', 'Payment 3', 'Payment 4', 'Payment 5'])

    const reordered = renumberDefaultPaymentLabels(moveScheduleItem(afterDelete, 2, 0))
    expect(reordered.map((item) => item.amountCents)).toEqual([400, 100, 300, 500, 600])
    expect(reordered.map((item) => item.label)).toEqual(['Payment 1', 'Payment 2', 'Payment 3', 'Payment 4', 'Payment 5'])
  })

  it('preserves custom payment labels while moving them', () => {
    const items = [
      { label: 'Payment 1' },
      { label: 'Final filing fee' },
    ]
    expect(renumberDefaultPaymentLabels(moveScheduleItem(items, 1, 0))).toEqual([
      { label: 'Final filing fee' },
      { label: 'Payment 2' },
    ])
  })

  it('validates schedule vs quote', () => {
    expect(scheduleTotalMatchesQuote(2000000, 2000000)).toBe(true)
    expect(scheduleTotalMatchesQuote(1900000, 2000000)).toBe(false)
  })

  it('computes item statuses', () => {
    expect(
      computeItemStatus({
        scheduledCents: 500000,
        receivedCents: 500000,
        dueDate: new Date('2026-09-01'),
      }),
    ).toBe('PAID')
    expect(
      computeItemStatus({
        scheduledCents: 500000,
        receivedCents: 200000,
        dueDate: new Date('2026-09-01'),
      }),
    ).toBe('PARTIALLY_PAID')
    expect(
      computeItemStatus({
        scheduledCents: 500000,
        receivedCents: 0,
        dueDate: new Date('2020-01-01'),
        now: new Date('2026-09-03'),
      }),
    ).toBe('OVERDUE')
  })

  it('calculates totals, remaining, and overpayment', () => {
    const calc = calculateFinanceTotals({
      quotedCents: 2000000,
      engagementReceiptsCents: 1150000,
      scheduledReceiptsCents: 1000000,
      additionalReceiptsCents: 150000,
    })
    expect(calc.totalReceived).toBe(1150000)
    expect(calc.remainingBalance).toBe(850000)
    expect(calc.overpayment).toBe(0)
    expect(calc.progressPct).toBe(57.5)

    const over = calculateFinanceTotals({
      quotedCents: 2000000,
      engagementReceiptsCents: 2050000,
      scheduledReceiptsCents: 2000000,
      additionalReceiptsCents: 50000,
    })
    expect(over.overpayment).toBe(50000)
    expect(over.paidInFull).toBe(true)
  })

  it('allocates receipts to schedule items', () => {
    const total = allocatedToItem('item-2', [
      { status: 'ACTIVE', amountCents: 800000, paymentScheduleItemId: null, allocations: [
        { scheduleItemId: 'item-2', amountCents: 500000 },
        { scheduleItemId: 'item-3', amountCents: 300000 },
      ] },
      { status: 'VOIDED', amountCents: 100000, paymentScheduleItemId: 'item-2' },
    ])
    expect(total).toBe(500000)
  })
})

describe('finance email templates', () => {
  it('renders agreed quote and payment due with Afterstem branding', () => {
    const quote = renderFinanceEmail('AGREED_QUOTE', {
      'Client Name': 'Thanuja',
      'Candidate ID': 'ASM-1001',
      'Visa Type': 'O-1A',
      'Quoted Amount': '$20,000.00',
      'Payment Structure Summary': '4 payments',
      'First Due Date': 'Sep 5, 2026',
    })
    expect(quote.subject).toContain('ASM-1001')
    expect(quote.html).toContain('clients@afterstem.ai')
    expect(quote.html).toContain('ASM-1001')
    expect(quote.html).toContain('$20,000.00')

    const due = renderFinanceEmail('PAYMENT_DUE', {
      'Client Name': 'Thanuja',
      'Candidate ID': 'ASM-1001',
      'Visa Type': 'O-1A',
      'Payment Label': 'Payment 3',
      'Amount Due': '$5,000.00',
      'Due Date': 'Sep 20, 2026',
      'Quoted Amount': '$20,000.00',
      'Total Paid': '$10,000.00',
      'Remaining Balance': '$10,000.00',
    })
    expect(due.html).toContain('Payment 3')
    expect(due.html).toContain('Afterstem')

    const rows = scheduleRowsHtml([
      { label: 'Payment 1', amount: '$5,000.00', due: 'Sep 5' },
      { label: 'Payment 2', amount: '$5,000.00', due: 'Oct 5' },
    ])
    expect(rows).toContain('Payment 1')
    expect(rows).toContain('$5,000.00')
  })
})
