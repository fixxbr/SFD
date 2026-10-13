import { describe, expect, it } from 'vitest'
import { resolveCandidateTab } from '@/lib/candidate-profile-tabs'

describe('resolveCandidateTab', () => {
  it('prefers ?tab= over hash', () => {
    expect(resolveCandidateTab('payments', 'summary')).toBe('payments')
  })

  it('maps financial hash to payments when no tab param', () => {
    expect(resolveCandidateTab(null, 'financial')).toBe('payments')
  })

  it('defaults to overview', () => {
    expect(resolveCandidateTab(null, '')).toBe('overview')
  })

  it('clamps lawyer mode away from payments', () => {
    expect(resolveCandidateTab('payments', '', true)).toBe('overview')
    expect(resolveCandidateTab('documents', '', true)).toBe('documents')
  })
})
