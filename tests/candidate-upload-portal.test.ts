import { describe, expect, it } from 'vitest'
import {
  fileExtension,
  formatFileSize,
  resolveAllowedMimeType,
  validateCandidateUploadFile,
} from '@/lib/upload-validation'
import { nextDocumentVersion } from '@/lib/documents-version'
import { buildChecklist } from '@/lib/documents-checklist'

describe('candidate upload validation', () => {
  it('accepts allowed types by mime or extension', () => {
    expect(validateCandidateUploadFile({ filename: 'Resume.pdf', size: 1400, mimeType: 'application/pdf' }).ok).toBe(
      true,
    )
    expect(validateCandidateUploadFile({ filename: 'scan.JPG', size: 900, mimeType: '' }).ok).toBe(true)
    expect(resolveAllowedMimeType({ mimeType: '', filename: 'letter.docx' })).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
    expect(validateCandidateUploadFile({ filename: 'legacy.doc', size: 900, mimeType: 'application/msword' }).ok).toBe(true)
    expect(validateCandidateUploadFile({ filename: 'scan.jpeg', size: 900, mimeType: 'image/jpeg' }).ok).toBe(true)
    expect(fileExtension('Passport.PDF')).toBe('pdf')
  })

  it('rejects empty, oversized, and unsupported files', () => {
    expect(validateCandidateUploadFile({ filename: 'a.pdf', size: 0, mimeType: 'application/pdf' }).ok).toBe(false)
    expect(validateCandidateUploadFile({ filename: 'x.exe', size: 10, mimeType: 'application/octet-stream' }).ok).toBe(
      false,
    )
    for (const [filename, mimeType] of [
      ['sheet.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['image.png', 'image/png'],
      ['notes.txt', 'text/plain'],
      ['photo.jpg', 'application/zip'],
      ['sheet.xlsx', 'application/pdf'],
    ]) {
      expect(validateCandidateUploadFile({ filename, size: 900, mimeType }).ok, filename).toBe(false)
    }
    const rejected = validateCandidateUploadFile({
      filename: 'sheet.xlsx',
      size: 900,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })
    expect(rejected).toMatchObject({ ok: false })
    if (!rejected.ok) {
      expect(rejected.error).toContain('sheet.xlsx')
      expect(rejected.error).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      expect(rejected.error).toContain('Word (.doc, .docx)')
      expect(rejected.error).toContain('For links, enter a URL')
    }
    expect(validateCandidateUploadFile({ filename: 'huge.pdf', size: 40 * 1024 * 1024, mimeType: 'application/pdf' }).ok).toBe(
      false,
    )
  })

  it('formats sizes for UI', () => {
    expect(formatFileSize(850)).toContain('B')
    expect(formatFileSize(850 * 1024)).toContain('KB')
  })
})

describe('reusable candidate upload history', () => {
  it('retains prior versions when a later file is uploaded for the same slot', () => {
    expect(nextDocumentVersion(1)).toBe(2)
    const checklist = buildChecklist([
      {
        id: '1',
        questionKey: 'resume',
        originalFilename: 'Resume.pdf',
        status: 'ARCHIVED',
        version: 1,
        isCurrentVersion: false,
        uploadedAt: '2026-09-01',
      },
      {
        id: '2',
        questionKey: 'resume',
        originalFilename: 'Resume.pdf',
        status: 'UPLOADED',
        version: 2,
        isCurrentVersion: true,
        uploadedAt: '2026-09-03',
      },
      {
        id: '3',
        questionKey: 'passport',
        originalFilename: 'Passport.pdf',
        status: 'UPLOADED',
        version: 1,
        isCurrentVersion: true,
        uploadedAt: '2026-09-02',
      },
    ])
    const resume = checklist.folders[0].items.find((i) => i.questionKey === 'resume')
    expect(resume?.versions).toHaveLength(2)
    expect(resume?.versions.map((v) => v.originalFilename)).toEqual(['Resume.pdf', 'Resume.pdf'])
    expect(resume?.current?.id).toBe('2')

    const all = [
      { name: 'Resume.pdf', day: 'Sep 1' },
      { name: 'Passport.pdf', day: 'Sep 2' },
      { name: 'Resume.pdf', day: 'Sep 3' },
    ]
    expect(all).toHaveLength(3)
  })

  it('models three sequential submissions under one candidate without losing earlier files', () => {
    const history = [
      { submission: 1, file: 'Resume.pdf' },
      { submission: 2, file: 'Passport.pdf' },
      { submission: 3, file: 'Certificate.pdf' },
    ]
    const retained = history.map((h) => h.file)
    expect(retained).toEqual(['Resume.pdf', 'Passport.pdf', 'Certificate.pdf'])
    expect(new Set(['candidate-a']).size).toBe(1)
  })
})
