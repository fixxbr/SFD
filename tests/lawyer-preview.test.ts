import { describe, expect, it } from 'vitest'
import { AuthError } from '@/lib/auth'
import { assertLawyerCannotDownload } from '@/lib/lawyer-download-policy'
import {
  classifyPreview,
  isInlineDisposition,
  materializeInlinePreview,
  previewContentType,
  previewResponseHeaders,
} from '@/lib/document-preview'
import JSZip from 'jszip'
import * as XLSX from '@e965/xlsx'
import { officeFileToHtml } from '@/lib/office-preview'

describe('lawyer download policy', () => {
  it('forbids lawyer downloads', () => {
    expect(() => assertLawyerCannotDownload({ role: 'ATTORNEY' })).toThrow(AuthError)
    try {
      assertLawyerCannotDownload({ role: 'ATTORNEY' })
    } catch (error) {
      expect(error).toBeInstanceOf(AuthError)
      expect((error as AuthError).status).toBe(403)
      expect((error as Error).message).toMatch(/permission/i)
    }
  })

  it('does not block admin downloads', () => {
    expect(() => assertLawyerCannotDownload({ role: 'SUPER_ADMIN' })).not.toThrow()
    expect(() => assertLawyerCannotDownload({ role: 'ADMIN' })).not.toThrow()
  })
})

describe('inline document preview', () => {
  it('classifies pdf and images without treating them as downloads', () => {
    expect(classifyPreview('application/pdf', 'Degree.pdf')).toBe('pdf')
    expect(classifyPreview('image/png', 'Verification Screenshot.png')).toBe('image')
    expect(classifyPreview('image/jpeg', 'scan.jpg')).toBe('image')
    expect(classifyPreview('image/tiff', 'scan.tiff')).toBe('image')
    expect(classifyPreview('application/zip', 'bundle.zip')).toBe('unsupported')
  })

  it('classifies word and spreadsheet uploads as in-app html previews', () => {
    expect(classifyPreview('application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Letter.docx')).toBe(
      'html',
    )
    expect(classifyPreview('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Pay.xlsx')).toBe('html')
    expect(classifyPreview('application/msword', 'Old.doc')).toBe('html')
    expect(classifyPreview('text/csv', 'table.csv')).toBe('html')
  })

  it('renders docx bytes as inline html instead of a download', async () => {
    const zip = new JSZip()
    zip.file(
      '[Content_Types].xml',
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
    )
    zip.file(
      '_rels/.rels',
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
    )
    zip.file(
      'word/document.xml',
      '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Passport copy</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>Employer</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>Example Inc.</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>',
    )
    const body = await zip.generateAsync({ type: 'nodebuffer' })
    const preview = await materializeInlinePreview({
      body,
      filename: 'Passport.docx',
      documentMimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })
    expect(preview.mimeType).toContain('text/html')
    const html = preview.body.toString('utf8')
    expect(html).toContain('<strong>Passport copy</strong>')
    expect(html).toContain('<table>')
    expect(html).toContain('Example Inc.')
  })

  it.each([
    ['legacy XLS', 'legacy.xls', 'biff8'],
    ['XLSX', 'modern.xlsx', 'xlsx'],
  ])('renders %s spreadsheet cells in an inline table', async (_label, filename, bookType) => {
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['Name', 'Status'], ['Resume', 'Received']]), 'Documents')
    const body = Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType } as XLSX.WritingOptions))
    const html = await officeFileToHtml({
      buffer: body,
      filename,
      mimeType: filename.endsWith('.xls') ? 'application/vnd.ms-excel' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    })

    expect(html).toContain('<table>')
    expect(html).toContain('Resume')
    expect(html).toContain('Received')
  })

  it('uses inline disposition, never attachment', () => {
    const headers = previewResponseHeaders('Degree.pdf', 'application/pdf')
    expect(headers['Content-Disposition']).toMatch(/^inline\b/i)
    expect(headers['Content-Disposition']).not.toMatch(/attachment/i)
    expect(isInlineDisposition(headers['Content-Disposition'])).toBe(true)
    expect(previewContentType({ documentMimeType: 'application/octet-stream', filename: 'Degree.pdf' })).toBe(
      'application/pdf',
    )
  })
})
