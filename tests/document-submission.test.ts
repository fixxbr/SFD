import { describe, expect, it } from 'vitest'
import {
  ADDITIONAL_EVIDENCE_KEYS,
  advertisedFileDocumentKeys,
  documentKeyLookupKeys,
  isAdditionalEvidenceKey,
  isKnownDocumentKey,
  OTHER_SUPPORTING_DOCUMENT_KEY,
  resolveDocumentCategory,
  resolveDocumentType,
} from '@/lib/document-keys'
import { validateHttpUrl, normalizeSubmittedUrls, PROFILE_LINK_OPTIONS } from '@/lib/link-request-items'
import { validateCandidateUploadFile } from '@/lib/upload-validation'

describe('document key compatibility', () => {
  it('treats visa-template evidence keys as aliases of catalog slots', () => {
    expect(documentKeyLookupKeys('awards_evidence')).toEqual(
      expect.arrayContaining(['awards_evidence', 'award_evidence', 'award_certificates']),
    )
    expect(documentKeyLookupKeys('publications_evidence')).toEqual(
      expect.arrayContaining(['publication_pdfs', 'publications']),
    )
    expect(documentKeyLookupKeys('media_evidence')).toEqual(
      expect.arrayContaining(['media_clippings', 'media']),
    )
    expect(documentKeyLookupKeys('contributions_evidence')).toEqual(
      expect.arrayContaining(['contribution_evidence']),
    )
  })

  it('recognizes additional / other supporting document aliases', () => {
    for (const key of [
      'additional_evidence',
      'additional_files',
      'additional',
      OTHER_SUPPORTING_DOCUMENT_KEY,
    ]) {
      expect(isAdditionalEvidenceKey(key)).toBe(true)
      expect(ADDITIONAL_EVIDENCE_KEYS.has(key)).toBe(true)
    }
    expect(resolveDocumentType('additional')).toBe('additional_evidence')
    expect(resolveDocumentCategory(OTHER_SUPPORTING_DOCUMENT_KEY)).toBe('additional')
  })

  it('knows seed template keys that are not in the O-1 onboarding catalog', () => {
    expect(isKnownDocumentKey('awards_evidence')).toBe(true)
    expect(isKnownDocumentKey('publications_evidence')).toBe(true)
    expect(isKnownDocumentKey('employment_letter')).toBe(true)
    expect(isKnownDocumentKey('totally_made_up_slot')).toBe(false)
  })

  it('lists advertised file keys including the other-supporting catch-all', () => {
    const keys = advertisedFileDocumentKeys()
    expect(keys).toEqual(expect.arrayContaining(['resume', 'passport', 'awards_evidence', OTHER_SUPPORTING_DOCUMENT_KEY]))
  })
})

describe('link field identifiers', () => {
  it('exposes GitHub, LinkedIn, and other links with stable keys', () => {
    expect(PROFILE_LINK_OPTIONS.map((o) => o.key)).toEqual(['github_url', 'linkedin_url', 'other_links'])
  })

  it('validates http(s) URLs and ignores empty optional entries', () => {
    expect(validateHttpUrl('https://github.com/example').ok).toBe(true)
    expect(validateHttpUrl('linkedin.com/in/example').ok).toBe(true)
    expect(validateHttpUrl('javascript:alert(1)').ok).toBe(false)
    expect(normalizeSubmittedUrls('  \n  \nhttps://github.com/a\n')).toEqual(['https://github.com/a'])
    expect(normalizeSubmittedUrls('')).toEqual([])
  })
})

describe('PDF acceptance vs category validation', () => {
  it('accepts PDFs including the previously failing filenames (format is not the issue)', () => {
    const names = [
      'Wand Offer from Somya Gupta.pdf',
      'guiness.pdf',
      'MLH-scholarship.pdf',
      'springers.pdf',
      'SLP.pdf',
      'Publications.pdf',
      'media-article-empire-city.pdf',
      'Clean Copy.pdf',
      'FYI-health.pdf',
      'FYI.pdf',
      'scanned-no-text.pdf',
    ]
    for (const filename of names) {
      const result = validateCandidateUploadFile({
        filename,
        size: 12_000,
        mimeType: 'application/pdf',
      })
      expect(result.ok, filename).toBe(true)
    }
  })

  it('still rejects unsupported and oversized files', () => {
    expect(validateCandidateUploadFile({ filename: 'x.exe', size: 10, mimeType: 'application/octet-stream' }).ok).toBe(
      false,
    )
    expect(
      validateCandidateUploadFile({
        filename: 'huge.pdf',
        size: 40 * 1024 * 1024,
        mimeType: 'application/pdf',
      }).ok,
    ).toBe(false)
  })
})
