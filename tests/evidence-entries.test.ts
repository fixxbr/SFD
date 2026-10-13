import { describe, expect, it } from 'vitest'
import { candidateEvidenceSections, EVIDENCE_SECTIONS, sectionMeta } from '@/lib/evidence-section-meta'
import { nextDocumentVersion } from '@/lib/documents-version'

describe('evidence multi-document sections', () => {
  it('covers education, transcripts, employment, licenses, and clients', () => {
    expect(EVIDENCE_SECTIONS.map((s) => s.key)).toEqual([
      'EDUCATION',
      'TRANSCRIPT',
      'EMPLOYMENT',
      'LICENSE',
      'CLIENT',
    ])
  })

  it('requires a description field for clients', () => {
    const clients = sectionMeta('CLIENT')
    expect(clients.descriptionLabel).toBe('Description')
    expect(clients.descriptionPlaceholder).toMatch(/client/i)
  })

  it('always returns the five structured sections even when they were not requested', () => {
    expect(candidateEvidenceSections(['resume', 'passport'])).toEqual([
      'EDUCATION',
      'TRANSCRIPT',
      'EMPLOYMENT',
      'LICENSE',
      'CLIENT',
    ])
    expect(candidateEvidenceSections([])).toHaveLength(5)
  })

  it('keeps section documents grouped by dedicated question key prefixes', () => {
    for (const section of EVIDENCE_SECTIONS) {
      expect(section.questionKeyPrefix.length).toBeGreaterThan(2)
      expect(section.category.length).toBeGreaterThan(2)
    }
  })

  it('versions append uploads independently so prior files stay current', () => {
    // Append mode counts existing files then bumps — first file is v1, second is v2, both remain current.
    expect(nextDocumentVersion(0)).toBe(1)
    expect(nextDocumentVersion(1)).toBe(2)
    expect(nextDocumentVersion(2)).toBe(3)
  })
})
