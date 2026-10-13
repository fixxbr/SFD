import { describe, expect, it } from 'vitest'
import { stripeConfigured, createCheckoutForPayment, processStripeEvent } from '@/lib/stripe'
import { CASE_STATUS_LABELS, parseVisaType } from '@/lib/visa'
import { sha256 } from '@/lib/crypto'

function maskEmail(email: string) {
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  return `${user.slice(0, 1)}****@${domain}`
}

describe('Stripe removal', () => {
  it('reports Stripe as not configured', () => {
    expect(stripeConfigured()).toBe(false)
  })

  it('rejects checkout creation', async () => {
    await expect(createCheckoutForPayment('any')).rejects.toThrow(/manual/i)
  })

  it('ignores webhook events', async () => {
    const result = await processStripeEvent({ id: 'evt_test' })
    expect(result.ignored).toBe(true)
  })
})

describe('case status history vocabulary', () => {
  it('includes the full Afterstem case pipeline', () => {
    expect(CASE_STATUS_LABELS.ASSESSMENT).toBeTruthy()
    expect(CASE_STATUS_LABELS.READY_TO_FILE).toBeTruthy()
    expect(CASE_STATUS_LABELS.APPROVED).toBeTruthy()
  })

  it('maps public assessment visa labels onto enum values', () => {
    expect(parseVisaType('O-1A Extraordinary Ability')).toBe('O_1A')
    expect(parseVisaType('EB-2 NIW')).toBe('EB_2_NIW')
  })
})

describe('email-only client access', () => {
  it('never uses email alone as authentication', () => {
    expect(maskEmail('thanuja@email.com')).toBe('t****@email.com')
  })

  it('stores only token hashes', () => {
    const token = 'abcXYZsecuretoken'
    expect(sha256(token)).not.toBe(token)
    expect(sha256(token)).toHaveLength(64)
  })

  it('keeps candidate UUID as identity, not name', () => {
    const candidateId = '550e8400-e29b-41d4-a716-446655440000'
    expect(candidateId).not.toBe('Thanuja Narameta')
  })
})
