import { describe, expect, it } from 'vitest'
import { formatCandidateNumber, isCandidateNumber, normalizeCandidateNumber } from '@/lib/candidate-number'
import { candidateCredentialsMatch, VERIFY_GENERIC_ERROR } from '@/lib/verify-candidate'
import { buildMergeVars, mergeTemplate, EMAIL_TEMPLATES } from '@/lib/email-templates'

describe('Afterstem candidate numbers', () => {
  it('formats ASM-1001 style IDs', () => {
    expect(formatCandidateNumber(1001)).toBe('ASM-1001')
    expect(formatCandidateNumber(1002n)).toBe('ASM-1002')
  })

  it('normalizes and validates candidate numbers', () => {
    expect(normalizeCandidateNumber(' asm-1001 ')).toBe('ASM-1001')
    expect(isCandidateNumber('ASM-1001')).toBe(true)
    expect(isCandidateNumber('thanuja@email.com')).toBe(false)
  })
})

describe('ID + email verification', () => {
  it('accepts matching candidate number and normalized email', () => {
    expect(
      candidateCredentialsMatch(
        { candidateNumber: 'ASM-1001', normalizedEmail: 'thanuja@email.com' },
        { candidateNumber: 'asm-1001', email: 'Thanuja@Email.com' },
      ),
    ).toBe(true)
  })

  it('rejects correct ID with wrong email', () => {
    expect(
      candidateCredentialsMatch(
        { candidateNumber: 'ASM-1001', normalizedEmail: 'thanuja@email.com' },
        { candidateNumber: 'ASM-1001', email: 'wrong@email.com' },
      ),
    ).toBe(false)
  })

  it('rejects wrong ID with correct email', () => {
    expect(
      candidateCredentialsMatch(
        { candidateNumber: 'ASM-1001', normalizedEmail: 'thanuja@email.com' },
        { candidateNumber: 'ASM-1002', email: 'thanuja@email.com' },
      ),
    ).toBe(false)
  })

  it('uses a generic error message', () => {
    expect(VERIFY_GENERIC_ERROR.toLowerCase()).toContain('could not verify')
  })
})

describe('template merge includes Candidate ID', () => {
  it('merges {{Candidate ID}} into documentation and payment templates', () => {
    const vars = buildMergeVars({
      fullLegalName: 'Thanuja Narameta',
      candidateNumber: 'ASM-1001',
      email: 'thanuja@email.com',
      visaLabel: 'O-1A',
      caseNumber: 'O1A-2026-000041',
      quotedCents: 2000000,
      paymentCents: 500000,
      paymentNumber: 2,
      documentLink: 'https://afterstem.ai/documents',
      paymentLink: 'https://checkout.stripe.com/x',
    })
    expect(mergeTemplate('ID {{Candidate ID}}', vars)).toBe('ID ASM-1001')
    const keys = EMAIL_TEMPLATES.map((t) => t.key)
    expect(keys).toEqual(
      expect.arrayContaining([
        'O1_PROCESS_STARTED',
        'DOCUMENTATION_REQUEST',
        'PAYMENT_1_DUE',
        'PAYMENT_2_DUE',
        'PAYMENT_3_DUE',
        'FINAL_PAYMENT_DUE',
        'PAYMENT_3_CONFIRMATION',
        'FINAL_PAYMENT_CONFIRMATION',
      ]),
    )
    const p3 = EMAIL_TEMPLATES.find((t) => t.key === 'PAYMENT_3_CONFIRMATION')!
    expect(mergeTemplate(p3.body, vars)).toContain('75% pre-filing')
    const p4 = EMAIL_TEMPLATES.find((t) => t.key === 'FINAL_PAYMENT_CONFIRMATION')!
    expect(mergeTemplate(p4.body, vars)).toContain('Paid in Full')
  })
})
