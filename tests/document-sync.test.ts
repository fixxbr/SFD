import { describe, expect, it } from 'vitest'
import { buildChecklist, type DocumentVersion } from '@/lib/documents-checklist'
import { countChecklist, missingChecklistItems, requirementItems } from '@/lib/document-counts'
import { buildOnboardingOverview } from '@/lib/onboarding-overview'
import { isAdditionalEvidenceKey } from '@/lib/document-keys'
import { SEED_VISA_TEMPLATES } from '@/lib/visa-template-seed-data'
import { LINK_ONLY_ERROR, looksLikeFileName, validateHttpUrl } from '@/lib/link-request-items'
import { isExternalLinkDocument, linkUrlsForDocument } from '@/lib/document-links'
import { validateCandidateUploadFile } from '@/lib/upload-validation'

function doc(id: string, questionKey: string, extra: Partial<DocumentVersion> = {}): DocumentVersion {
  return {
    id,
    questionKey,
    originalFilename: `${id}.pdf`,
    displayName: null,
    mimeType: 'application/pdf',
    status: 'UPLOADED',
    version: 1,
    isCurrentVersion: true,
    uploadedAt: '2026-10-01T12:00:00.000Z',
    fileSizeBytes: 1000,
    evidenceEntryId: null,
    ...extra,
  }
}

function link(id: string, questionKey: string, url: string, label = 'Portfolio'): DocumentVersion {
  return doc(id, questionKey, {
    originalFilename: `${questionKey}.url.txt`,
    mimeType: 'text/uri-list',
    displayName: label,
    externalUrl: url,
  } as Partial<DocumentVersion>)
}

const overviewFileIds = (overview: ReturnType<typeof buildOnboardingOverview>) =>
  overview.sections.flatMap((s) => s.fields).flatMap((f) => f.files.map((file) => file.id)).sort()

const documentFileIds = (checklist: ReturnType<typeof buildChecklist>) =>
  checklist.folders.flatMap((f) => f.items).flatMap((i) => i.files.map((file) => file.id)).sort()

describe('one checklist for Overview, Documents and Request Documents', () => {
  for (const template of SEED_VISA_TEMPLATES) {
    it(`${template.visaTypeCode}: lists only that visa's slots and Overview shows exactly the Documents files`, () => {
      const first = template.items[0]!
      const documents = [
        doc('a', first.documentKey),
        doc('b', 'lawyer_upload_123'),
        doc('c', 'other_supporting_document'),
        doc('rejected', first.documentKey, { status: 'REJECTED' }),
        doc('old', first.documentKey, { isCurrentVersion: false, status: 'ARCHIVED', version: 0 }),
        link('l1', 'link_portfolio_abc', 'https://example.com/me'),
      ]
      const checklist = buildChecklist(documents, [], { templateItems: template.items })
      const counts = countChecklist(checklist)

      const requiredKeys = template.items.filter((i) => !isAdditionalEvidenceKey(i.documentKey)).map((i) => i.documentKey)
      expect(requirementItems(checklist).map((i) => i.questionKey)).toEqual(requiredKeys)
      expect(counts.required).toBe(requiredKeys.length)
      expect(counts.submitted).toBe(1)
      expect(counts.missing).toBe(requiredKeys.length - 1)
      expect(missingChecklistItems(checklist)).toHaveLength(counts.missing)

      // Archived versions are hidden; rejected files stay visible (and are counted) everywhere.
      expect(documentFileIds(checklist)).toEqual(['a', 'b', 'c', 'rejected'])
      expect(counts.files).toBe(4)

      // Links are separate and never change document numbers.
      expect(counts.links).toBe(1)
      expect(documentFileIds(checklist)).not.toContain('l1')

      const overview = buildOnboardingOverview({ documents, checklist })
      expect(overviewFileIds(overview)).toEqual(documentFileIds(checklist))
    })
  }

  it('maps onboarding catalog uploads into the visa slot with the same name', () => {
    const eb1 = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'EB_1A')!
    const checklist = buildChecklist([doc('cert', 'award_certificates'), doc('st', 'immigration_status_docs')], [], {
      templateItems: eb1.items,
    })
    const items = checklist.folders.flatMap((f) => f.items)
    expect(items.find((i) => i.questionKey === 'awards')?.files.map((f) => f.id)).toEqual(['cert'])
    expect(items.find((i) => i.questionKey === 'status_docs')?.files.map((f) => f.id)).toEqual(['st'])
    expect(checklist.folders.find((f) => f.id === 'extra')).toBeUndefined()
  })

  it('never lets an alias steal a sibling slot that has its own exact key', () => {
    const other = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'OTHER')!
    const checklist = buildChecklist([doc('emp', 'employment_letter'), doc('offer', 'offer_letter')], [], {
      templateItems: other.items,
    })
    const items = checklist.folders.flatMap((f) => f.items)
    expect(items.find((i) => i.questionKey === 'employment_letter')?.files.map((f) => f.id)).toEqual(['emp'])
    expect(items.find((i) => i.questionKey === 'offer_letter')?.files.map((f) => f.id)).toEqual(['offer'])
  })

  it('counts requested custom documents and keeps pending link requests out of document counts', () => {
    const h1b = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'H_1B')!
    const defs = [
      { key: 'custom_lca_1', label: 'Certified LCA', category: 'Employer' },
      { key: 'github_url', label: 'GitHub profile URL', category: 'Profile & links' },
    ]
    const checklist = buildChecklist([doc('lca', 'custom_lca_1')], defs, { templateItems: h1b.items })
    const counts = countChecklist(checklist)
    const base = h1b.items.filter((i) => !isAdditionalEvidenceKey(i.documentKey)).length
    expect(counts.required).toBe(base + 1)
    expect(counts.submitted).toBe(1)
    expect(counts.linksPending).toBe(1)
    expect(counts.links).toBe(0)
  })

  it('updates counts when a file is added and when it is removed', () => {
    const o1 = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'O_1A')!
    const before = countChecklist(buildChecklist([], [], { templateItems: o1.items }))
    const added = countChecklist(buildChecklist([doc('p', 'passport')], [], { templateItems: o1.items }))
    const removed = countChecklist(
      buildChecklist([doc('p', 'passport', { status: 'ARCHIVED', isCurrentVersion: false })], [], {
        templateItems: o1.items,
      }),
    )
    expect(added.submitted).toBe(before.submitted + 1)
    expect(added.missing).toBe(before.missing - 1)
    expect(removed).toEqual(before)
  })
})

describe('links accept URLs only', () => {
  it('rejects file names, file schemes and invalid entries', () => {
    for (const value of ['resume.pdf', 'Passport.JPG', 'letter.docx', 'C:\\scans\\cv.jpeg', 'file:///tmp/a.pdf', 'data:text/plain,hi']) {
      const check = validateHttpUrl(value)
      expect(check.ok, value).toBe(false)
    }
    expect(validateHttpUrl('resume.pdf')).toEqual({ ok: false, error: LINK_ONLY_ERROR })
    expect(validateHttpUrl('not a url').ok).toBe(false)
    expect(validateHttpUrl('javascript:alert(1)').ok).toBe(false)
    expect(validateHttpUrl('https://user:pw@example.com').ok).toBe(false)
    expect(validateHttpUrl('localhost:3000').ok).toBe(false)
    expect(looksLikeFileName('https://example.com/paper.pdf')).toBe(false)
  })

  it('accepts real web links and normalizes bare domains to https', () => {
    expect(validateHttpUrl('linkedin.com/in/example')).toEqual({ ok: true, href: 'https://linkedin.com/in/example' })
    expect(validateHttpUrl('https://scholar.google.com/citations?user=x').ok).toBe(true)
    // A link to a hosted publication is still a link, not an upload.
    expect(validateHttpUrl('https://example.com/paper.pdf').ok).toBe(true)
  })

  it('reads the saved URL of a link row', () => {
    const row = { externalUrl: 'https://example.com/a', displayName: 'Portfolio', mimeType: 'text/uri-list' }
    expect(isExternalLinkDocument(row)).toBe(true)
    expect(linkUrlsForDocument(row)).toEqual(['https://example.com/a'])
  })
})

describe('document uploads accept PDF, DOC, DOCX, JPG and JPEG only', () => {
  it.each([
    ['cv.pdf', 'application/pdf'],
    ['cv.doc', 'application/msword'],
    ['cv.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['id.jpg', 'image/jpeg'],
    ['id.jpeg', 'image/jpeg'],
    ['id.JPEG', ''],
  ])('accepts %s', (filename, mimeType) => {
    expect(validateCandidateUploadFile({ filename, size: 10, mimeType }).ok).toBe(true)
  })

  it.each([
    ['photo.png', 'image/png'],
    ['notes.txt', 'text/plain'],
    ['links.url.txt', 'text/uri-list'],
    ['sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['renamed.pdf', 'image/png'],
    ['noext', ''],
  ])('rejects %s', (filename, mimeType) => {
    expect(validateCandidateUploadFile({ filename, size: 10, mimeType }).ok).toBe(false)
  })
})
