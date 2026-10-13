import { describe, expect, it } from 'vitest'
import { isDocumentRequestOpen } from '@/lib/document-request-access'
import { createCorrelationId } from '@/lib/request-correlation'

describe('document request openness', () => {
  it('rejects cancelled, expired, and cancelled-status packages', () => {
    expect(isDocumentRequestOpen({ status: 'OPENED', cancelledAt: null, expiresAt: null })).toBe(true)
    expect(isDocumentRequestOpen({ status: 'SUBMITTED', cancelledAt: null, expiresAt: null })).toBe(true)
    expect(isDocumentRequestOpen({ status: 'CANCELLED', cancelledAt: null, expiresAt: null })).toBe(false)
    expect(
      isDocumentRequestOpen({ status: 'OPENED', cancelledAt: new Date(), expiresAt: null }),
    ).toBe(false)
    expect(
      isDocumentRequestOpen({
        status: 'OPENED',
        cancelledAt: null,
        expiresAt: new Date(Date.now() - 60_000),
      }),
    ).toBe(false)
    expect(
      isDocumentRequestOpen({
        status: 'PARTIALLY_SUBMITTED',
        cancelledAt: null,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).toBe(true)
  })

  it('treats missing request as closed', () => {
    expect(isDocumentRequestOpen(null)).toBe(false)
    expect(isDocumentRequestOpen(undefined)).toBe(false)
  })
})

describe('correlation ids', () => {
  it('creates opaque ids without tokens', () => {
    const id = createCorrelationId('doc')
    expect(id).toMatch(/^doc_[a-f0-9]+$/)
    expect(id.length).toBeLessThan(40)
  })
})
