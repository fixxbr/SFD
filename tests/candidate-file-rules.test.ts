import { describe, expect, it } from 'vitest'
import { candidateCanReplaceFile } from '@/lib/candidate-file-rules'

const submission = (status: string, submittedAt: string | null = null) => ({ id: 'sub1', status, submittedAt })
const file = (over: Partial<Parameters<typeof candidateCanReplaceFile>[0]> = {}) => ({
  uploadedByType: 'CANDIDATE',
  status: 'UPLOADED',
  uploadedAt: '2026-10-10T10:00:00Z',
  onboardingSubmissionId: 'sub1',
  ...over,
})

describe('candidate file replace rule', () => {
  it('lets the candidate replace or remove a file before Submit', () => {
    expect(candidateCanReplaceFile(file(), submission('DRAFT'))).toBe(true)
  })
  it('keeps a submitted file once Submit was clicked', () => {
    expect(candidateCanReplaceFile(file(), submission('SUBMITTED', '2026-10-11T00:00:00Z'))).toBe(false)
  })
  it('a file added after Submit (reopened link) can be changed until the next Submit', () => {
    expect(candidateCanReplaceFile(file({ uploadedAt: '2026-10-12T00:00:00Z' }), submission('SUBMITTED', '2026-10-11T00:00:00Z'))).toBe(true)
  })
  it('a submitted file opens up again only when an admin or lawyer disapproves it', () => {
    const s = submission('SUBMITTED', '2026-10-11T00:00:00Z')
    expect(candidateCanReplaceFile(file({ status: 'NEEDS_REPLACEMENT' }), s)).toBe(true)
    expect(candidateCanReplaceFile(file({ status: 'REJECTED' }), s)).toBe(true)
    expect(candidateCanReplaceFile(file({ status: 'ACCEPTED' }), s)).toBe(false)
    expect(candidateCanReplaceFile(file({ status: 'UNDER_REVIEW' }), s)).toBe(false)
  })
  it('never lets the candidate change staff uploads or files from another channel', () => {
    expect(candidateCanReplaceFile(file({ uploadedByType: 'ADMIN' }), submission('DRAFT'))).toBe(false)
    expect(candidateCanReplaceFile(file({ onboardingSubmissionId: null }), submission('DRAFT'))).toBe(false)
  })
  it('a file staff is already reviewing stays even before Submit', () => {
    expect(candidateCanReplaceFile(file({ status: 'UNDER_REVIEW' }), submission('DRAFT'))).toBe(false)
  })
})
