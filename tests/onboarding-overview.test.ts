import { describe, expect, it } from 'vitest'
import {
  buildOnboardingOverview,
  deriveOnboardingDisplayStatus,
  formatOnboardingAnswer,
} from '@/lib/onboarding-overview'
import { buildChecklist, visibleDocumentName } from '@/lib/documents-checklist'

describe('formatOnboardingAnswer', () => {
  it('preserves zero and No', () => {
    expect(formatOnboardingAnswer({ value: 0 }, 'text')).toBe('0')
    expect(formatOnboardingAnswer({ value: 'No' }, 'select')).toBe('No')
    expect(formatOnboardingAnswer(false, 'text')).toBe('false')
  })

  it('returns null for empty and review-only stubs', () => {
    expect(formatOnboardingAnswer(null, 'text')).toBeNull()
    expect(formatOnboardingAnswer({ value: '' }, 'text')).toBeNull()
    expect(formatOnboardingAnswer({ reviewStatus: 'ACCEPTED' }, 'text')).toBeNull()
  })

  it('formats employment history repeaters', () => {
    const text = formatOnboardingAnswer(
      {
        items: [
          { employer: 'Acme', title: 'Engineer', dates: '2020-2022', description: 'Built APIs' },
          { employer: 'Beta', title: 'Lead', dates: '2022-present' },
        ],
      },
      'repeater',
    )
    expect(text).toContain('Acme')
    expect(text).toContain('Beta')
    expect(text).toContain('1.')
  })
})

describe('deriveOnboardingDisplayStatus', () => {
  it('does not show NOT_STARTED when documents exist', () => {
    expect(
      deriveOnboardingDisplayStatus({
        submissionStatus: null,
        hasAnswerProgress: false,
        hasDocumentProgress: true,
      }),
    ).toBe('IN_PROGRESS')
  })

  it('does not treat a single document as SUBMITTED', () => {
    expect(
      deriveOnboardingDisplayStatus({
        submissionStatus: 'DRAFT',
        hasAnswerProgress: false,
        hasDocumentProgress: true,
      }),
    ).toBe('IN_PROGRESS')
  })

  it('shows INVITED when invite exists without progress', () => {
    expect(
      deriveOnboardingDisplayStatus({
        submissionStatus: 'DRAFT',
        hasInvite: true,
        hasAnswerProgress: false,
        hasDocumentProgress: false,
      }),
    ).toBe('INVITED')
  })

  it('respects explicit SUBMITTED', () => {
    expect(
      deriveOnboardingDisplayStatus({
        submissionStatus: 'SUBMITTED',
        hasAnswerProgress: true,
        hasDocumentProgress: true,
      }),
    ).toBe('SUBMITTED')
  })
})

describe('buildOnboardingOverview', () => {
  it('wires employment answers and file uploads into the correct sections', () => {
    const overview = buildOnboardingOverview({
      answers: {
        current_employer: { value: 'Acme Corp' },
        job_title: { value: 'Staff Engineer' },
        annual_compensation: { value: '0' },
        linkedin_url: { value: 'https://linkedin.com/in/example' },
        employment_history: {
          items: [{ employer: 'Prior Co', title: 'SWE', dates: '2018-2020' }],
        },
      },
      documents: [
        {
          id: 'doc-resume',
          questionKey: 'resume',
          originalFilename: 'resume.pdf',
          status: 'UPLOADED',
          version: 1,
          isCurrentVersion: true,
          uploadedAt: '2026-09-23T12:00:00.000Z',
          fileSizeBytes: 1200,
          mimeType: 'application/pdf',
        },
        {
          id: 'doc-offer',
          questionKey: 'employment_letter',
          originalFilename: 'offer.pdf',
          status: 'UPLOADED',
          version: 1,
          isCurrentVersion: true,
          uploadedAt: '2026-09-23T12:00:00.000Z',
          fileSizeBytes: 2200,
          mimeType: 'application/pdf',
        },
        {
          id: 'doc-other',
          questionKey: 'other_supporting_document',
          originalFilename: 'extra.pdf',
          status: 'UPLOADED',
          version: 1,
          isCurrentVersion: true,
          uploadedAt: '2026-09-23T12:00:00.000Z',
          fileSizeBytes: 800,
          mimeType: 'application/pdf',
        },
        {
          id: 'doc-awards',
          questionKey: 'awards_evidence',
          originalFilename: 'award.pdf',
          status: 'UPLOADED',
          version: 1,
          isCurrentVersion: true,
          uploadedAt: '2026-09-23T12:00:00.000Z',
          fileSizeBytes: 900,
          mimeType: 'application/pdf',
        },
      ],
      submissionStatus: 'DRAFT',
    })

    expect(overview.status).toBe('IN_PROGRESS')
    expect(overview.showSendInvite).toBe(false)
    expect(overview.showResendInvite).toBe(true)

    const employment = overview.sections.find((s) => s.id === 'employment')!
    expect(employment.fields.find((f) => f.key === 'current_employer')?.text).toBe('Acme Corp')
    expect(employment.fields.find((f) => f.key === 'job_title')?.text).toBe('Staff Engineer')
    expect(employment.fields.find((f) => f.key === 'annual_compensation')?.text).toBe('0')
    expect(employment.fields.find((f) => f.key === 'linkedin_url')?.text).toContain('linkedin.com')
    expect(employment.fields.find((f) => f.key === 'offer_letter')?.files.map((f) => f.id)).toContain('doc-offer')

    const basic = overview.sections.find((s) => s.id === 'basic_documents')!
    expect(basic.fields.find((f) => f.key === 'resume')?.files[0]?.originalFilename).toBe('resume.pdf')

    const awards = overview.sections.find((s) => s.id === 'awards')!
    const awardFiles = awards.fields.flatMap((f) => f.files)
    expect(awardFiles.some((f) => f.id === 'doc-awards')).toBe(true)

    const additional = overview.sections.find((s) => s.id === 'additional')!
    expect(additional.fields.find((f) => f.key === 'additional_files')?.files.some((f) => f.id === 'doc-other')).toBe(
      true,
    )
  })

  it('keeps overview file names and extra slot labels aligned with Received Documents', () => {
    const documents = [
      {
        id: 'doc-resume',
        questionKey: 'resume',
        originalFilename: 'scan_final.pdf',
        displayName: 'Updated Resume.pdf',
        status: 'UPLOADED' as const,
        version: 1,
        isCurrentVersion: true,
        uploadedAt: '2026-09-23T12:00:00.000Z',
        fileSizeBytes: 1200,
        mimeType: 'application/pdf',
      },
      {
        id: 'doc-custom',
        questionKey: 'custom_offer_1',
        originalFilename: 'letter.pdf',
        displayName: 'Signed offer',
        status: 'UPLOADED' as const,
        version: 1,
        isCurrentVersion: true,
        uploadedAt: '2026-09-23T12:00:00.000Z',
        fileSizeBytes: 800,
        mimeType: 'application/pdf',
      },
    ]
    const customDefs = [{ key: 'custom_offer_1', label: 'Company offer letter', category: 'Requested documents' }]
    const overview = buildOnboardingOverview({ documents, customDefs })
    const checklist = buildChecklist(documents, customDefs)

    const resumeOverview = overview.sections.flatMap((s) => s.fields).find((f) => f.key === 'resume')
    const resumeDocs = checklist.folders.flatMap((f) => f.items).find((i) => i.questionKey === 'resume')
    expect(resumeOverview?.label).toBe(resumeDocs?.label)
    expect(resumeOverview?.files[0]?.originalFilename).toBe(visibleDocumentName(documents[0]))
    expect(resumeOverview?.files[0]?.uploadedFilename).toBe('scan_final.pdf')

    const customOverview = overview.sections.flatMap((s) => s.fields).find((f) => f.key === 'custom_offer_1')
    const customDocs = checklist.folders.flatMap((f) => f.items).find((i) => i.questionKey === 'custom_offer_1')
    expect(customOverview?.label).toBe(customDocs?.label)
    expect(customOverview?.label).toBe('Company offer letter')
    expect(customOverview?.files[0]?.originalFilename).toBe('Signed offer')
  })

  it('shows education evidence uploads in overview with the same names as documents', () => {
    const documents = [
      {
        id: 'doc-degree',
        questionKey: 'education__entry-9__x',
        originalFilename: 'diploma.pdf',
        displayName: 'UT diploma.pdf',
        status: 'UPLOADED' as const,
        version: 1,
        isCurrentVersion: true,
        uploadedAt: '2026-09-23T12:00:00.000Z',
        fileSizeBytes: 4000,
        mimeType: 'application/pdf',
        evidenceEntryId: 'entry-9',
        evidenceEntry: { id: 'entry-9', section: 'EDUCATION', title: 'UT Austin', subtitle: 'M.S. Data Science' },
      },
    ]
    const overview = buildOnboardingOverview({ documents })
    const checklist = buildChecklist(documents)
    const overviewEdu = overview.sections.find((s) => s.id === 'evidence_EDUCATION')
    const docsEdu = checklist.folders.find((f) => f.id === 'evidence_EDUCATION')
    expect(overviewEdu?.folderTitle).toBe(docsEdu?.title)
    expect(overviewEdu?.fields[0]?.label).toBe(docsEdu?.items[0]?.label)
    expect(overviewEdu?.fields[0]?.files[0]?.originalFilename).toBe('UT diploma.pdf')
    expect(overview.status).toBe('IN_PROGRESS')
  })

  it('exposes all 14 catalog sections plus structured evidence sections', () => {
    const overview = buildOnboardingOverview({})
    expect(overview.sections.filter((s) => !s.id.startsWith('evidence_'))).toHaveLength(14)
    expect(overview.sections.map((s) => s.id)).toEqual(
      expect.arrayContaining([
        'evidence_EDUCATION',
        'evidence_TRANSCRIPT',
        'evidence_EMPLOYMENT',
        'evidence_LICENSE',
        'evidence_CLIENT',
      ]),
    )
    expect(overview.status).toBe('NOT_STARTED')
    expect(overview.showSendInvite).toBe(true)
  })
})
