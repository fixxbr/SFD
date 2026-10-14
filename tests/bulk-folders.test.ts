import { describe, expect, it } from 'vitest'
import {
  candidateFolderNames,
  classifyZipPath,
  matchDocumentFolder,
  parseDetailsJson,
  parseLinksTxt,
  safeFolderName,
  uniqueFileName,
} from '@/lib/bulk-folders'

describe('candidate folder names', () => {
  it('names each folder after the candidate; a clash adds the candidate number', () => {
    const names = candidateFolderNames([
      { id: '1', fullLegalName: 'Ana Silva', candidateNumber: 'AFT-1' },
      { id: '2', fullLegalName: 'Ana Silva', candidateNumber: 'AFT-2' },
      { id: '3', fullLegalName: 'Raj / Kumar', candidateNumber: 'AFT-3' },
    ])
    expect(names.get('1')).toBe('Ana Silva (AFT-1)')
    expect(names.get('2')).toBe('Ana Silva (AFT-2)')
    expect(names.get('3')).toBe('Raj Kumar')
  })
  it('keeps names safe for every OS', () => {
    expect(safeFolderName('a:b*c?.')).toBe('a b c')
    expect(safeFolderName('')).toBe('Item')
  })
  it('keeps original file names, numbering only duplicates', () => {
    const used = new Set<string>()
    expect(uniqueFileName(used, 'passport.pdf')).toBe('passport.pdf')
    expect(uniqueFileName(used, 'passport.pdf')).toBe('passport (2).pdf')
  })
})

describe('classifying ZIP paths', () => {
  it('reads the standard structure, with or without the Candidates/ root', () => {
    expect(classifyZipPath('Candidates/Ana Silva/Candidate_Details.json')).toMatchObject({ folder: 'Ana Silva', kind: 'details-json' })
    expect(classifyZipPath('Ana Silva/Uploaded_Documents/Passport copy/p.pdf')).toMatchObject({ kind: 'document', documentFolder: 'Passport copy', fileName: 'p.pdf' })
    expect(classifyZipPath('Candidates/Ana Silva/Uploaded_Documents/loose.pdf')).toMatchObject({ kind: 'document', documentFolder: null })
    expect(classifyZipPath('Candidates/Ana Silva/Quoted_Amount.pdf').kind).toBe('quote-file')
    expect(classifyZipPath('Candidates/Ana Silva/Payment_Plan/plan.pdf').kind).toBe('payment-plan-file')
    expect(classifyZipPath('Candidates/Ana Silva/Lawyers_Notes.pdf').kind).toBe('notes-file')
    expect(classifyZipPath('Candidates/Ana Silva/Additional_Information/Links.txt').kind).toBe('links-txt')
    expect(classifyZipPath('Candidates/Ana Silva/Additional_Information/extra.docx').kind).toBe('additional-file')
  })
  it('ignores system files, templates and files outside candidate folders', () => {
    expect(classifyZipPath('__MACOSX/Candidates/Ana/._x.pdf').kind).toBe('ignored')
    expect(classifyZipPath('Candidates/Ana/.DS_Store').kind).toBe('ignored')
    expect(classifyZipPath('Candidates/_New_Candidate_Template/Candidate_Details.json').kind).toBe('ignored')
    expect(classifyZipPath('Candidates/README.txt').kind).toBe('ignored')
  })
})

describe('mapping and parsing', () => {
  const items = [
    { key: 'passport', label: 'Passport copy' },
    { key: 'i94', label: 'Latest I-94' },
  ]
  it('maps a document folder by name or key, ignoring case and punctuation', () => {
    expect(matchDocumentFolder('passport COPY', items)?.key).toBe('passport')
    expect(matchDocumentFolder('latest_i-94', items)?.key).toBe('i94')
    expect(matchDocumentFolder('i94', items)?.key).toBe('i94')
    expect(matchDocumentFolder('Something else', items)).toBeNull()
  })
  it('reads Links.txt lines with or without a name', () => {
    expect(parseLinksTxt('# comment\nLinkedIn: https://linkedin.com/in/x\nhttps://a.example.com\n\nexample.org/page')).toEqual([
      { label: 'LinkedIn', url: 'https://linkedin.com/in/x' },
      { label: '', url: 'https://a.example.com' },
      { label: '', url: 'example.org/page' },
    ])
  })
  it('reads Candidate_Details.json and reports bad JSON instead of throwing', () => {
    expect(parseDetailsJson('{"fullLegalName":" Ana ","newLawyerNotes":["a",""," b "]}').details).toMatchObject({ fullLegalName: 'Ana', newLawyerNotes: ['a', 'b'] })
    expect(parseDetailsJson('{oops').error).toMatch(/could not be read/)
    expect(parseDetailsJson('[]').error).toMatch(/not an object/)
  })
})
