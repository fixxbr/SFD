import { describe, expect, it } from 'vitest'
import {
  buildChecklist,
  countVisibleReceivedDocuments,
  documentMatchesSlot,
  isReceivedChecklistItem,
  visibleDocumentName,
} from '@/lib/documents-checklist'
import {
  advertisedFileDocumentKeys,
  documentKeyLookupKeys,
  isAdditionalEvidenceKey,
  OTHER_SUPPORTING_DOCUMENT_KEY,
} from '@/lib/document-keys'
import { PROFILE_LINK_OPTIONS, validateHttpUrl } from '@/lib/link-request-items'
import { UPLOAD_TYPE_HINT, validateCandidateUploadFile } from '@/lib/upload-validation'
import { lawyerAssignedCandidateWhere } from '@/lib/lawyer-access'

function doc(partial: {
  id: string
  questionKey: string
  originalFilename: string
  mimeType?: string
  displayName?: string
  evidenceEntryId?: string | null
  evidenceEntry?: { id: string; section?: string | null; title?: string | null; subtitle?: string | null } | null
  fileSizeBytes?: number
}) {
  return {
    id: partial.id,
    questionKey: partial.questionKey,
    originalFilename: partial.originalFilename,
    displayName: partial.displayName ?? null,
    mimeType: partial.mimeType ?? 'application/pdf',
    status: 'UPLOADED' as const,
    version: 1,
    isCurrentVersion: true,
    uploadedAt: '2026-09-23T12:00:00.000Z',
    fileSizeBytes: partial.fileSizeBytes ?? 12_000,
    evidenceEntryId: partial.evidenceEntryId ?? null,
    evidenceEntry: partial.evidenceEntry ?? null,
  }
}

describe('global document category compatibility', () => {
  it('drives advertised keys from the canonical registry (future-proof)', () => {
    const keys = advertisedFileDocumentKeys()
    expect(keys.length).toBeGreaterThan(20)
    expect(keys).toContain(OTHER_SUPPORTING_DOCUMENT_KEY)
    expect(keys).toContain('awards_evidence')
    expect(keys).toContain('resume')
    for (const key of keys) {
      // Every advertised key must either be additional, a known alias family, or match itself.
      expect(documentKeyLookupKeys(key).length).toBeGreaterThan(0)
    }
  })

  it('accepts only advertised document extensions via validation', () => {
    expect(UPLOAD_TYPE_HINT).toMatch(/PDF/i)
    for (const sample of [
      { filename: '任意文件名.pdf', mimeType: 'application/pdf' },
      { filename: 'file with spaces.PDF', mimeType: '' },
      { filename: 'scan.jpg', mimeType: 'image/jpeg' },
      { filename: 'resume.docx', mimeType: '' },
      { filename: 'scan.jpeg', mimeType: 'image/jpeg' },
    ]) {
      expect(validateCandidateUploadFile({ ...sample, size: 4000 }).ok).toBe(true)
    }
    expect(validateCandidateUploadFile({ filename: 'sheet.xlsx', mimeType: '', size: 4000 }).ok).toBe(false)
  })
})

describe('admin + lawyer Documents tab visibility', () => {
  it('shows template-key uploads under the matching catalog / custom slot', () => {
    const checklist = buildChecklist(
      [
        doc({ id: '1', questionKey: 'awards_evidence', originalFilename: 'guiness.pdf' }),
        doc({ id: '2', questionKey: 'publications_evidence', originalFilename: 'Publications.pdf' }),
        doc({
          id: '3',
          questionKey: 'media_evidence',
          originalFilename: 'media-article-empire-city.pdf',
        }),
        doc({
          id: '4',
          questionKey: OTHER_SUPPORTING_DOCUMENT_KEY,
          originalFilename: 'Wand Offer from Somya Gupta.pdf',
        }),
      ],
      [
        { key: 'awards_evidence', label: 'Awards & recognition evidence', category: '03 Awards & Recognition' },
        { key: 'publications_evidence', label: 'Publications & research evidence' },
        { key: 'media_evidence', label: 'Media evidence' },
      ],
    )

    const received = checklist.folders.flatMap((f) => f.items).filter(isReceivedChecklistItem)
    expect(received.length).toBeGreaterThanOrEqual(4)
    expect(
      countVisibleReceivedDocuments([
        doc({ id: '1', questionKey: 'awards_evidence', originalFilename: 'guiness.pdf' }),
        doc({ id: '2', questionKey: 'publications_evidence', originalFilename: 'Publications.pdf' }),
        doc({
          id: '3',
          questionKey: 'media_evidence',
          originalFilename: 'media-article-empire-city.pdf',
        }),
        doc({
          id: '4',
          questionKey: OTHER_SUPPORTING_DOCUMENT_KEY,
          originalFilename: 'Wand Offer from Somya Gupta.pdf',
        }),
      ]),
    ).toBe(4)

    // Alias matching works even without a custom def.
    expect(documentMatchesSlot('awards_evidence', 'award_evidence')).toBe(true)
    expect(documentMatchesSlot('award_certificates', 'awards_evidence')).toBe(true)
  })

  it('keeps two different files with the same filename as distinct rows', () => {
    const checklist = buildChecklist([
      doc({ id: 'a', questionKey: 'resume', originalFilename: 'Resume.pdf' }),
      {
        ...doc({ id: 'b', questionKey: 'resume', originalFilename: 'Resume.pdf' }),
        version: 2,
      },
    ])
    const resume = checklist.folders.flatMap((f) => f.items).find((i) => i.questionKey === 'resume')
    expect(resume?.files.map((f) => f.id).sort()).toEqual(['a', 'b'])
  })

  it('surfaces GitHub / LinkedIn / other links in the Links list, not in document folders', () => {
    const checklist = buildChecklist(
      [
        doc({
          id: 'g',
          questionKey: 'github_url',
          originalFilename: 'github_url.url.txt',
          mimeType: 'text/plain',
          displayName: 'https://github.com/example',
        }),
        doc({
          id: 'l',
          questionKey: 'linkedin_url',
          originalFilename: 'linkedin_url.url.txt',
          mimeType: 'text/plain',
          displayName: 'https://linkedin.com/in/example',
        }),
        doc({
          id: 'o',
          questionKey: 'other_links',
          originalFilename: 'other_links.txt',
          mimeType: 'text/plain',
          displayName: '2 links',
        }),
      ],
      PROFILE_LINK_OPTIONS.map((o) => ({ key: o.key, label: o.label, category: o.category })),
    )
    // Links live in their own list (Overview → Links), never among document folders.
    expect(checklist.folders.find((f) => f.id === 'profile_links')).toBeUndefined()
    const keys = checklist.links.filter(isReceivedChecklistItem).map((i) => i.questionKey)
    expect(keys).toEqual(expect.arrayContaining(['github_url', 'linkedin_url', 'other_links']))
    const docIds = checklist.folders.flatMap((f) => f.items).flatMap((i) => i.files.map((d) => d.id))
    expect(docIds).not.toContain('g')
  })

  it('surfaces education evidence attachments under Education History', () => {
    const checklist = buildChecklist([
      doc({ id: '1', questionKey: 'resume', originalFilename: 'Resume.pdf' }),
      doc({
        id: '2',
        questionKey: 'education__entry-1__abc',
        originalFilename: 'Degree.pdf',
        displayName: 'UT diploma.pdf',
        evidenceEntryId: 'entry-1',
        evidenceEntry: { id: 'entry-1', section: 'EDUCATION', title: 'UT Austin', subtitle: 'M.S. Data Science' },
      }),
    ])
    const education = checklist.folders.find((f) => f.id === 'evidence_EDUCATION')
    expect(education?.title).toBe('Education History')
    expect(education?.items[0]?.label).toContain('UT Austin')
    const ids = checklist.folders.flatMap((f) => f.items).flatMap((i) => i.files.map((f) => f.id))
    expect(ids).toContain('1')
    expect(ids).toContain('2')
    expect(visibleDocumentName({ displayName: 'UT diploma.pdf', originalFilename: 'Degree.pdf' })).toBe('UT diploma.pdf')
  })

  it('uses the same slot name as Request Documents for aliased template keys', () => {
    const checklist = buildChecklist(
      [doc({ id: '1', questionKey: 'awards_evidence', originalFilename: 'guiness.pdf' })],
      [{ key: 'awards_evidence', label: 'Awards & recognition evidence' }],
    )
    const awards = checklist.folders.flatMap((f) => f.items).find((i) => i.questionKey === 'award_evidence' || i.questionKey === 'award_certificates')
    expect(awards?.label).toBe('Awards & recognition evidence')
    expect(awards?.files[0]?.id).toBe('1')
  })

  it('never treats pending OCR/classification as a gate — UPLOADED is visible', () => {
    const checklist = buildChecklist([
      doc({ id: '1', questionKey: 'additional_evidence', originalFilename: 'scanned-no-text.pdf' }),
    ])
    const other = checklist.folders
      .flatMap((f) => f.items)
      .find((i) => isAdditionalEvidenceKey(i.questionKey) || i.questionKey === OTHER_SUPPORTING_DOCUMENT_KEY)
    expect(other?.files[0]?.status).toBe('UPLOADED')
    expect(isReceivedChecklistItem(other!)).toBe(true)
  })
})

describe('authorization boundaries', () => {
  it('scopes lawyers to assigned candidates only', () => {
    expect(lawyerAssignedCandidateWhere('lawyer-a')).toEqual({
      cases: {
        some: {
          lifecycle: 'ACTIVE',
          assignedAttorneyId: 'lawyer-a',
        },
      },
    })
  })

  it('rejects non-http link schemes', () => {
    expect(validateHttpUrl('javascript:alert(1)').ok).toBe(false)
    expect(validateHttpUrl('https://example.com/path').ok).toBe(true)
  })
})

describe('visible document names', () => {
  it('prefers a non-URL display name and keeps the original when they differ', () => {
    expect(
      visibleDocumentName({
        displayName: 'Updated Resume.pdf',
        originalFilename: 'scan_final.pdf',
      }),
    ).toBe('Updated Resume.pdf')
    expect(
      visibleDocumentName({
        displayName: null,
        originalFilename: 'Passport.pdf',
      }),
    ).toBe('Passport.pdf')
    expect(
      visibleDocumentName({
        displayName: 'https://github.com/example',
        originalFilename: 'github_url.url.txt',
      }),
    ).toBe('github_url')
  })

  it('keeps every catalog category folder visible even with no uploads', () => {
    const { folders } = buildChecklist([])
    const ids = folders.map((f) => f.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'basic_documents',
        'employment',
        'awards',
        'judging',
        'publications',
        'media',
        'contributions',
        'critical_role',
        'memberships',
        'high_salary',
        'speaking',
        'recommenders',
        'proposed_work',
        'additional',
      ]),
    )
  })
})

describe('multi-candidate isolation model', () => {
  it('keeps documents partitioned by questionKey + id, not filename', () => {
    const candidateA = buildChecklist([
      doc({ id: 'a1', questionKey: 'resume', originalFilename: 'same-name.pdf' }),
    ])
    const candidateB = buildChecklist([
      doc({ id: 'b1', questionKey: 'resume', originalFilename: 'same-name.pdf' }),
    ])
    const aIds = candidateA.folders.flatMap((f) => f.items).flatMap((i) => i.files.map((f) => f.id))
    const bIds = candidateB.folders.flatMap((f) => f.items).flatMap((i) => i.files.map((f) => f.id))
    expect(aIds).toEqual(['a1'])
    expect(bIds).toEqual(['b1'])
    expect(aIds).not.toEqual(bIds)
  })
})
