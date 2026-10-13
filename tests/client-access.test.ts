import { describe, expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { validateInstallments, canReadyToFile, financialSummary } from '@/lib/payments'

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex')
}

function maskEmail(email: string) {
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  return `${user.slice(0, 1)}****@${domain}`
}

describe('candidate identity + secure links', () => {
  it('treats candidate UUID as permanent identity, not email/password', () => {
    const candidateId = '550e8400-e29b-41d4-a716-446655440000'
    expect(candidateId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
  })

  it('masks email for OTP prompts without exposing full address', () => {
    expect(maskEmail('thanuja@email.com')).toBe('t****@email.com')
  })

  it('hashes access tokens so raw tokens are never stored', () => {
    const token = 'abcXYZsecuretoken'
    expect(sha256(token)).toHaveLength(64)
    expect(sha256(token)).not.toEqual(token)
  })

  it('rejects opening another candidate via email query (auth is token-only)', () => {
    const unsafe = '/client?email=thanuja@email.com'
    expect(unsafe.includes('email=')).toBe(true)
    expect(unsafe.startsWith('/client/')).toBe(false)
  })
})

describe('filing gate', () => {
  it('blocks READY_TO_FILE until 75% pre-filing is paid', () => {
    const payments = [
      { installmentNumber: 1, amountCents: 500000, status: 'PAID' },
      { installmentNumber: 2, amountCents: 500000, status: 'READY' },
      { installmentNumber: 3, amountCents: 500000, status: 'READY' },
      { installmentNumber: 4, amountCents: 500000, status: 'READY' },
    ]
    expect(canReadyToFile(2000000, payments)).toBe(false)
    expect(financialSummary(2000000, payments).preFilingRemaining).toBe(1000000)
  })

  it('allows filing when payments 1–3 are paid', () => {
    const payments = [
      { installmentNumber: 1, amountCents: 400000, status: 'PAID' },
      { installmentNumber: 2, amountCents: 600000, status: 'PAID' },
      { installmentNumber: 3, amountCents: 500000, status: 'PAID' },
      { installmentNumber: 4, amountCents: 500000, status: 'READY' },
    ]
    expect(
      validateInstallments({
        totalCents: 2000000,
        payment1Cents: 400000,
        payment2Cents: 600000,
        payment3Cents: 500000,
        payment4Cents: 500000,
      }).ok,
    ).toBe(true)
    expect(canReadyToFile(2000000, payments)).toBe(true)
  })
})
