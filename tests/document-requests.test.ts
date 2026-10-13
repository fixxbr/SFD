import { describe, expect, it } from 'vitest'
import { resolveRequestedItems, catalogFileOptions } from '@/lib/document-request-items'
import { renderDocRequestHtml, customListHtml } from '@/lib/document-request-templates'
import { additionalDocumentKey, buildRequirementRows } from '@/lib/document-requirement-status'
import { normalizeDocumentRequestSubject } from '@/lib/document-requests'

describe('document request subjects', () => {
  it('uses Afterstem.ai and repairs legacy lawfirm subjects', () => {
    expect(normalizeDocumentRequestSubject('LAWFIRM | Documents Requested')).toBe(
      'Afterstem.ai | Documents Requested',
    )
    expect(normalizeDocumentRequestSubject('Afterstem.ai | Documents Requested')).toBe(
      'Afterstem.ai | Documents Requested',
    )
  })
})

describe('document request items', () => {
  it('builds a full catalog file list', () => {
    const all = catalogFileOptions()
    expect(all.length).toBeGreaterThan(10)
    expect(all.some((i) => i.key === 'resume')).toBe(true)
  })

  it('builds custom and single request item lists', () => {
    const custom = resolveRequestedItems({
      requestType: 'CUSTOM',
      selectedKeys: ['resume', 'i94'],
      customItems: [{ label: 'Updated Patent Evidence', category: 'contributions', instructions: 'PDF preferred' }],
    })
    expect(custom.map((i) => i.label)).toEqual(
      expect.arrayContaining(['Updated Resume/CV', 'Latest I-94', 'Updated Patent Evidence']),
    )

    const single = resolveRequestedItems({
      requestType: 'SINGLE',
      single: { name: 'Latest I-94', note: 'From CBP website' },
    })
    expect(single).toHaveLength(1)
    expect(single[0].label).toBe('Latest I-94')
    expect(single[0].instructions).toBe('From CBP website')
  })
})

describe('additional document status sync', () => {
  it('does not match an unrequested generic upload to an additional request', () => {
    const key = additionalDocumentKey('resume')
    const rows = buildRequirementRows(
      [{ documentKey: key, documentName: 'Updated resume', status: 'REQUESTED' }],
      [{
        questionKey: 'additional_evidence',
        documentType: 'additional_evidence',
        status: 'UPLOADED',
        isCurrentVersion: true,
        evidenceEntryId: null,
      }],
    )

    expect(rows).toHaveLength(1)
    expect(rows[0].files).toHaveLength(0)
    expect(rows[0].display.code).toBe('REQUESTED')
  })

  it('matches a file uploaded for the exact additional request key', () => {
    const key = additionalDocumentKey('resume')
    const rows = buildRequirementRows(
      [{ documentKey: key, documentName: 'Updated resume', status: 'REQUESTED' }],
      [{ questionKey: key, documentType: key, status: 'UPLOADED', isCurrentVersion: true, evidenceEntryId: null }],
    )

    expect(rows[0].files).toHaveLength(1)
    expect(rows[0].display.code).toBe('UPLOADED')
  })
})

describe('professional document email templates', () => {
  it('merges candidate vars into full and custom HTML', () => {
    const full = renderDocRequestHtml('FULL_O1', {
      clientName: 'Thanuja',
      candidateId: 'ASM-1001',
      visaType: 'O-1A',
      documentRequestLink: 'https://afterstem.ai/documents/r/abc',
      checklistHtml: '01 Basic Documents<br>02 Employment Information',
    })
    expect(full).toContain('ASM-1001')
    expect(full).toContain('Thanuja')
    expect(full).toContain('Complete Your O-1A Documentation')
    expect(full).toContain('01 Basic Documents')
    expect(full).toContain('https://afterstem.ai/documents/r/abc')
    expect(full).toContain('clients@afterstem.ai')

    const custom = renderDocRequestHtml('CUSTOM', {
      clientName: 'Thanuja',
      candidateId: 'ASM-1001',
      visaType: 'O-1A',
      documentRequestLink: 'https://afterstem.ai/documents/r/abc',
      customDocumentListHtml: customListHtml(['Resume/CV', 'Latest I-94']),
    })
    expect(custom).toContain('Resume/CV')
    expect(custom).toContain('Latest I-94')

    const single = renderDocRequestHtml('SINGLE', {
      clientName: 'Thanuja',
      candidateId: 'ASM-1001',
      visaType: 'O-1A',
      documentRequestLink: 'https://afterstem.ai/documents/r/abc',
      documentName: 'Latest I-94',
      documentRequestNote: 'Please upload the most recent I-94.',
    })
    expect(single).toContain('Latest I-94')
    expect(single).toContain('most recent I-94')
  })
})
