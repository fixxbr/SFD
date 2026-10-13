import { describe, expect, it } from 'vitest'
import { EMAIL_TEMPLATES, templateByKey } from '@/lib/email-templates'

describe('template catalog', () => {
  it('includes payment due, confirmation, docs, and custom templates', () => {
    const keys = EMAIL_TEMPLATES.map((t) => t.key)
    expect(keys).toContain('O1_PROCESS_STARTED')
    expect(keys).toContain('DOCUMENTATION_REQUEST')
    expect(keys).toContain('PAYMENT_2_DUE')
    expect(keys).toContain('PRE_FILING_COMPLETE')
    expect(keys).toContain('FINAL_PAYMENT_DUE')
    expect(keys).toContain('CUSTOM')
  })

  it('falls back to custom for unknown keys', () => {
    expect(templateByKey('NOPE').key).toBe('CUSTOM')
  })
})
