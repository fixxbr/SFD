import { describe, expect, it } from 'vitest'
import { onboardingCatalogFor, onboardingFileKeys } from '@/lib/onboarding-form'
import { O1_CATEGORIES } from '@/lib/onboarding-catalog'
import { SEED_VISA_TEMPLATES } from '@/lib/visa-template-seed-data'
import { isAdditionalEvidenceKey } from '@/lib/document-keys'
import { isLinkRequestKey } from '@/lib/link-request-items'
import { buildChecklist } from '@/lib/documents-checklist'
import { buildOnboardingOverview } from '@/lib/onboarding-overview'

describe('every visa type gets an onboarding form for its own visa', () => {
  for (const template of SEED_VISA_TEMPLATES) {
    it(`${template.visaTypeCode}: asks for exactly that visa's documents`, () => {
      const catalog = onboardingCatalogFor(template.visaTypeCode, template.items)
      if (template.visaTypeCode === 'O_1A') {
        expect(catalog).toBe(O1_CATEGORIES)
        return
      }
      const visaKeys = template.items
        .map((i) => i.documentKey)
        .filter((k) => !isAdditionalEvidenceKey(k))
      const asked = catalog.flatMap((c) => c.questions.map((q) => q.key))
      for (const key of visaKeys) expect(asked, key).toContain(key)
      // Sections are this visa's own categories (plus general info and additional), never the O-1A form's.
      const visaCategories = new Set(template.items.map((i) => i.category.replace(/^\d+\s+/, '')))
      for (const c of catalog) {
        if (c.id === 'profile' || c.id === 'additional') continue
        expect(visaCategories.has(c.title), c.title).toBe(true)
      }
      expect(catalog.map((c) => c.title).join(' | ')).not.toMatch(/Proposed O-1/)
      // URL items are URL fields, everything else is a file upload.
      for (const q of catalog.flatMap((c) => c.questions)) {
        if (isLinkRequestKey(q.key)) expect(q.type).toBe('url')
      }
      const files = onboardingFileKeys(catalog)
      expect(files.has('additional_files')).toBe(true)
      expect(files.has('award_certificates')).toBe(false)
    })
  }

  it('uploads made in the onboarding form land in the visa checklist slots', () => {
    const h1b = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'H_1B')!
    const catalog = onboardingCatalogFor('H_1B', h1b.items)
    const fileKey = catalog.flatMap((c) => c.questions).find((q) => q.type === 'file' && q.key === 'lca')!.key
    const checklist = buildChecklist(
      [{ id: 'd1', questionKey: fileKey, originalFilename: 'lca.pdf', status: 'UPLOADED', version: 1, isCurrentVersion: true, uploadedAt: '2026-10-14', fileSizeBytes: 10 }],
      [],
      { templateItems: h1b.items },
    )
    expect(checklist.folders.flatMap((f) => f.items).find((i) => i.questionKey === 'lca')?.files.map((f) => f.id)).toEqual(['d1'])
  })

  it('Overview lists a non-O-1 candidate’s answers under their own form sections, with invite actions', () => {
    const eb5 = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'EB_5')!
    const catalog = onboardingCatalogFor('EB_5', eb5.items)
    const overview = buildOnboardingOverview({
      answers: { current_employer: { value: 'Self-employed investor' } },
      checklist: buildChecklist([], [], { templateItems: eb5.items }),
      catalog,
    })
    const answers = overview.sections.find((s) => s.id === 'answers_profile')
    expect(answers?.fields.find((f) => f.key === 'current_employer')?.text).toBe('Self-employed investor')
    expect(overview.sections.some((s) => /Judging|Awards/.test(s.title))).toBe(false)
    expect(overview.showResendInvite).toBe(true)
  })
})
