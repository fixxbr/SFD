import { describe, expect, it } from 'vitest'
import { SEED_VISA_TEMPLATES, SEED_VISA_TYPES } from '@/lib/visa-template-seed-data'
import { parseVisaType, formatVisa } from '@/lib/visa'

describe('visa document templates seed', () => {
  it('covers core Afterstem visa types', () => {
    const codes = SEED_VISA_TEMPLATES.map((t) => t.visaTypeCode)
    expect(codes).toEqual(
      expect.arrayContaining(['O_1A', 'O_1B', 'EB_1A', 'EB_2_NIW', 'H_1B', 'L_1A', 'L_1B', 'EB_5', 'OTHER']),
    )
    expect(SEED_VISA_TYPES.length).toBeGreaterThanOrEqual(9)
  })

  it('keeps O-1A basic documents including resume and passport', () => {
    const o1 = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'O_1A')!
    const names = o1.items.map((i) => i.documentName)
    expect(names).toEqual(
      expect.arrayContaining([
        'Updated Resume/CV',
        'Passport copy',
        'Latest I-94',
        'Academic transcripts',
      ]),
    )
    expect(o1.items.some((i) => i.category.includes('Basic Documents'))).toBe(true)
  })
})

describe('visa parsing includes H-1B and L-1', () => {
  it('parses new visa labels', () => {
    expect(parseVisaType('H-1B')).toBe('H_1B')
    expect(parseVisaType('L-1A')).toBe('L_1A')
    expect(parseVisaType('L1B')).toBe('L_1B')
    expect(formatVisa('H_1B')).toBe('H-1B')
  })
})
