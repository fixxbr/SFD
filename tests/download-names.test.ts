import { describe, expect, it } from 'vitest'
import { candidateSlug, downloadFilename, safePathSegment, uniqueName } from '@/lib/download-names'

describe('download filenames', () => {
  it('sanitizes path segments', () => {
    // Basename-only — path traversal prefixes are stripped.
    expect(safePathSegment('../evil/name.pdf')).toBe('name.pdf')
    expect(safePathSegment('ABC University')).toBe('ABC_University')
  })

  it('builds candidate slug without UUIDs', () => {
    expect(candidateSlug('ASM-1001', 'John Doe')).toBe('ASM-1001_John_Doe')
  })

  it('deduplicates filenames in a folder', () => {
    const used = new Set<string>()
    expect(uniqueName(used, 'Passport.pdf')).toBe('Passport.pdf')
    expect(uniqueName(used, 'Passport.pdf')).toBe('Passport_2.pdf')
  })

  it('appends extensions for downloads', () => {
    expect(downloadFilename(['ASM-1001', 'John_Doe', 'Passport'], 'pdf')).toBe('ASM-1001_John_Doe_Passport.pdf')
  })
})
