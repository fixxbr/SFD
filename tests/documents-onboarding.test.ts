import { describe, expect, it } from 'vitest'
import { buildChecklist } from '@/lib/documents-checklist'
import { documentAccessIsReusable, mergeOnboardingAnswers, nextDocumentVersion } from '@/lib/documents-version'
import { can } from '@/lib/rbac'

describe('document versioning and private access', () => {
  it('increments versions instead of overwriting', () => {
    expect(nextDocumentVersion(undefined)).toBe(1)
    expect(nextDocumentVersion(1)).toBe(2)
    expect(nextDocumentVersion(7)).toBe(8)
  })

  it('keeps prior versions while marking a current file', () => {
    const checklist = buildChecklist([
      {
        id: 'v1',
        questionKey: 'resume',
        originalFilename: 'resume-aug.pdf',
        status: 'ARCHIVED',
        version: 1,
        isCurrentVersion: false,
        uploadedAt: '2026-08-20',
      },
      {
        id: 'v2',
        questionKey: 'resume',
        originalFilename: 'resume-sep.pdf',
        status: 'ACCEPTED',
        version: 2,
        isCurrentVersion: true,
        uploadedAt: '2026-09-02',
      },
    ])
    const resume = checklist.folders[0].items.find((item) => item.questionKey === 'resume')
    expect(resume?.status).toBe('ACCEPTED')
    expect(resume?.current?.version).toBe(2)
    expect(resume?.files.map((v) => v.version)).toEqual([2])
    expect(resume?.versions.map((v) => v.version)).toEqual([2, 1])
  })

  it('keeps multiple current append files under one checklist slot', () => {
    const checklist = buildChecklist([
      {
        id: 'a',
        questionKey: 'resume',
        originalFilename: 'resume-1.pdf',
        status: 'UPLOADED',
        version: 1,
        isCurrentVersion: true,
        uploadedAt: '2026-09-01',
      },
      {
        id: 'b',
        questionKey: 'resume',
        originalFilename: 'resume-2.pdf',
        status: 'UPLOADED',
        version: 2,
        isCurrentVersion: true,
        uploadedAt: '2026-09-02',
      },
    ])
    const resume = checklist.folders[0].items.find((item) => item.questionKey === 'resume')
    expect(resume?.files).toHaveLength(2)
    expect(resume?.status).toBe('PARTIALLY_UPLOADED')
  })

  it('treats missing files as MISSING until uploaded', () => {
    const checklist = buildChecklist([])
    const passport = checklist.folders[0].items.find((item) => item.questionKey === 'passport')
    expect(passport?.status).toBe('MISSING')
  })

  it('treats zero-byte files as missing (no content)', () => {
    const checklist = buildChecklist([
      {
        id: 'empty',
        questionKey: 'passport',
        originalFilename: 'empty.pdf',
        status: 'UPLOADED',
        version: 1,
        isCurrentVersion: true,
        uploadedAt: '2026-09-02',
        fileSizeBytes: 0,
      },
    ])
    const passport = checklist.folders[0].items.find((item) => item.questionKey === 'passport')
    expect(passport?.status).toBe('MISSING')
    expect(passport?.files).toHaveLength(0)
  })

  it('requires a stored private key and never a public URL for repeated preview/download', () => {
    expect(documentAccessIsReusable('candidates/abc/passport.pdf')).toBe(true)
    expect(documentAccessIsReusable('candidates/abc/passport.pdf', 'https://public.example/file')).toBe(false)
  })

  it('enforces document RBAC', () => {
    expect(can('READ_ONLY', 'documents:read')).toBe(true)
    expect(can('READ_ONLY', 'documents:review')).toBe(false)
    expect(can('FINANCE', 'documents:read')).toBe(false)
    expect(can('CASE_MANAGER', 'documents:review')).toBe(true)
  })
})

describe('onboarding persistence', () => {
  it('autosave merges onto the existing Neon draft', () => {
    const saved = mergeOnboardingAnswers({ current_employer: { value: 'Acme' } }, { job_title: { value: 'Engineer' } })
    expect(saved).toEqual({
      current_employer: { value: 'Acme' },
      job_title: { value: 'Engineer' },
    })
  })

  it('reload keeps previously saved answers', () => {
    const draft = { passport_note: { value: 'bio page' } }
    expect(mergeOnboardingAnswers(draft, {})).toEqual(draft)
  })
})
