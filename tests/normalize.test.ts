import { describe, expect, it } from 'vitest'
import { emailsMatch, isDuplicateCandidate, namesMatch, normalizeEmail, normalizeName, sanitizeFilename } from '@/lib/normalize'

describe('candidate name/email normalization', () => {
  it('collapses spaces and ignores case for names', () => {
    expect(normalizeName('Thanuja Narameta')).toBe(normalizeName('THANUJA   NARAMETA'))
    expect(namesMatch('Thanuja Narameta', '  thanuja narameta ')).toBe(true)
  })

  it('lowercases and trims emails', () => {
    expect(normalizeEmail('Candidate@Test.com')).toBe('candidate@test.com')
    expect(emailsMatch('Candidate@Test.com', 'candidate@test.com')).toBe(true)
  })

  it('reuses a candidate when both normalized name and email match', () => {
    expect(
      isDuplicateCandidate(
        { normalizedName: 'thanuja narameta', normalizedEmail: 'candidate@test.com' },
        { name: 'THANUJA   NARAMETA', email: 'Candidate@Test.com' },
      ),
    ).toBe(true)
  })

  it('keeps same name + different email as separate candidates', () => {
    expect(
      isDuplicateCandidate(
        { normalizedName: 'john smith', normalizedEmail: 'john1@email.com' },
        { name: 'John Smith', email: 'john2@email.com' },
      ),
    ).toBe(false)
  })

  it('sanitizes storage names', () => {
    expect(sanitizeFilename('../../passport.pdf')).toBe('passport.pdf')
  })
})
