import { describe, expect, it } from 'vitest'
import { onboardingCatalogFor, PERSONAL_SECTION } from '@/lib/onboarding-form'
import { checkOnboardingUrls, onboardingUrlQuestions, answerText } from '@/lib/onboarding-links'
import { SEED_VISA_TEMPLATES } from '@/lib/visa-template-seed-data'
import { buildChecklist } from '@/lib/documents-checklist'
import { buildOnboardingOverview } from '@/lib/onboarding-overview'

describe('personal and immigration details', () => {
  for (const t of SEED_VISA_TEMPLATES) {
    it(`${t.visaTypeCode} form starts with personal & immigration questions`, () => {
      const catalog = onboardingCatalogFor(t.visaTypeCode, t.items)
      expect(catalog[0]).toBe(PERSONAL_SECTION)
      const keys = catalog[0].questions.map((q) => q.key)
      for (const key of ['nationality', 'current_address', 'current_immigration_status', 'status_expiry', 'date_of_birth']) {
        expect(keys).toContain(key)
      }
      // Personal details are answers, not uploads.
      expect(catalog[0].questions.every((q) => q.type !== 'file')).toBe(true)
    })
  }
})

describe('URLs typed into the onboarding form', () => {
  it('accepts real links (several per field) and reports bad entries', () => {
    expect(checkOnboardingUrls('linkedin.com/in/ana, https://ana.dev')).toEqual({
      urls: ['https://linkedin.com/in/ana', 'https://ana.dev/'],
      errors: [],
    })
    const bad = checkOnboardingUrls('resume.pdf')
    expect(bad.urls).toEqual([])
    expect(bad.errors[0]).toMatch(/file name, not a link/)
  })

  it('finds the URL fields on each visa form', () => {
    const o1 = onboardingUrlQuestions(onboardingCatalogFor('O_1A', [])).map((q) => q.key)
    expect(o1).toEqual(expect.arrayContaining(['linkedin_url', 'scholar_url', 'additional_urls']))
    const o1b = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'O_1B')!
    expect(onboardingUrlQuestions(onboardingCatalogFor('O_1B', o1b.items)).map((q) => q.key)).toContain('link_portfolio')
    expect(answerText({ value: 'x' })).toBe('x')
  })

  it('a saved onboarding URL shows under Links, not as an answer or a document', () => {
    const h1b = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'H_1B')!
    const catalog = onboardingCatalogFor('H_1B', h1b.items)
    const link = {
      id: 'l1', questionKey: 'linkedin_url', originalFilename: 'linkedin_url.url.txt', displayName: 'LinkedIn profile URL',
      externalUrl: 'https://linkedin.com/in/ana', mimeType: 'text/uri-list', status: 'UPLOADED' as const, version: 1,
      isCurrentVersion: true, uploadedAt: '2026-10-14', fileSizeBytes: 30,
    }
    const checklist = buildChecklist([link], [], { templateItems: h1b.items })
    expect(checklist.links.flatMap((i) => i.files.map((f) => f.id))).toEqual(['l1'])
    expect(checklist.folders.flatMap((f) => f.items).flatMap((i) => i.files.map((f) => f.id))).not.toContain('l1')
    const overview = buildOnboardingOverview({ answers: { linkedin_url: { value: 'https://linkedin.com/in/ana' } }, checklist, catalog })
    expect(overview.sections.flatMap((s) => s.fields).some((f) => f.key === 'linkedin_url')).toBe(false)
  })
})
