import JSZip from 'jszip'
import mammoth from 'mammoth'
import * as XLSX from '@e965/xlsx'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function wrapHtml(title: string, body: string) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  body { font-family: ui-sans-serif, system-ui, sans-serif; color: #0C2340; margin: 16px; line-height: 1.5; }
  h1 { font-size: 14px; margin: 0 0 12px; }
  pre { white-space: pre-wrap; word-break: break-word; font-size: 13px; }
  p { margin: 0 0 0.75em; }
  img { max-width: 100%; height: auto; }
  ul, ol { padding-left: 1.5em; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; margin-bottom: 20px; }
  th, td { border: 1px solid #E2E8F0; padding: 4px 6px; text-align: left; vertical-align: top; }
  th { background: #F8FAFC; }
  h2 { font-size: 13px; margin: 16px 0 8px; }
</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`
}

function extractDocxText(xml: string) {
  return decodeXmlEntities(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br\b[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<w:t\b[^>]*>/g, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  )
}

function extractBinaryDocText(buffer: Buffer) {
  const chunks: string[] = []
  let current = ''
  for (let i = 0; i < buffer.length; i++) {
    const code = buffer[i]
    if (code >= 32 && code < 127) {
      current += String.fromCharCode(code)
    } else if (code === 0 && current.length >= 4) {
      chunks.push(current)
      current = ''
    } else {
      if (current.length >= 8) chunks.push(current)
      current = ''
    }
  }
  if (current.length >= 8) chunks.push(current)
  const text = chunks
    .filter((s) => /[A-Za-z]/.test(s))
    .join('\n')
    .trim()
  return text.slice(0, 80_000)
}

async function docxToHtml(buffer: Buffer, filename: string) {
  try {
    const result = await mammoth.convertToHtml(
      { buffer },
      { convertImage: mammoth.images.dataUri, externalFileAccess: false },
    )
    if (result.value.trim()) return wrapHtml(filename, result.value)
  } catch {
    // Fall back to extracting text from the DOCX XML below.
  }

  const zip = await JSZip.loadAsync(buffer)
  const xml = await zip.file('word/document.xml')?.async('string')
  if (!xml) return null
  const text = extractDocxText(xml)
  if (!text) return wrapHtml(filename, '<p>This Word document has no extractable text.</p>')
  return wrapHtml(filename, `<pre>${escapeHtml(text)}</pre>`)
}

async function spreadsheetToHtml(buffer: Buffer, filename: string) {
  const ext = filename.toLowerCase().split('.').pop()
  let workbook: XLSX.WorkBook
  try {
    if (ext === 'csv') {
      workbook = XLSX.read(buffer.toString('utf8'), { type: 'string' })
    } else {
      workbook = XLSX.read(buffer, { type: 'buffer' })
    }
  } catch {
    return null
  }

  const sheets = workbook.SheetNames.map((name) => {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
      header: 1,
      raw: true,
      defval: '',
    }) as unknown[][]
    const tableRows = rows
      .slice(0, 200)
      .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell == null ? '' : String(cell))}</td>`).join('') || '<td></td>'}</tr>`)
      .join('')
    return `<h2>${escapeHtml(name)}</h2><table>${tableRows || '<tr><td>Empty sheet</td></tr>'}</table>`
  })
  if (!sheets.length) return wrapHtml(filename, '<p>This spreadsheet has no visible rows.</p>')
  return wrapHtml(filename, sheets.join(''))
}

export async function officeFileToHtml(input: {
  buffer: Buffer
  filename: string
  mimeType?: string | null
}): Promise<string | null> {
  const name = input.filename.toLowerCase()
  const mime = (input.mimeType || '').toLowerCase()
  if (name.endsWith('.docx') || mime.includes('wordprocessingml')) {
    try {
      return await docxToHtml(input.buffer, input.filename)
    } catch {
      return null
    }
  }
  if (name.endsWith('.doc') || mime === 'application/msword') {
    const text = extractBinaryDocText(input.buffer)
    if (!text) return wrapHtml(input.filename, '<p>Preview is limited for this older Word (.doc) file.</p>')
    return wrapHtml(input.filename, `<pre>${escapeHtml(text)}</pre>`)
  }
  if (
    name.endsWith('.xlsx') ||
    name.endsWith('.xls') ||
    name.endsWith('.csv') ||
    mime.includes('spreadsheet') ||
    mime.includes('excel') ||
    mime === 'text/csv'
  ) {
    try {
      return await spreadsheetToHtml(input.buffer, input.filename)
    } catch {
      return null
    }
  }
  return null
}

export async function rasterizePreviewImage(input: {
  buffer: Buffer
  filename: string
  mimeType?: string | null
}): Promise<{ body: Buffer; mimeType: string } | null> {
  const name = input.filename.toLowerCase()
  const mime = (input.mimeType || '').toLowerCase()
  const needsRaster =
    name.endsWith('.tif') ||
    name.endsWith('.tiff') ||
    name.endsWith('.heic') ||
    name.endsWith('.heif') ||
    mime.includes('tiff') ||
    mime.includes('heic') ||
    mime.includes('heif')
  if (!needsRaster) return null
  try {
    const sharp = (await import('sharp')).default
    const body = await sharp(input.buffer).rotate().jpeg({ quality: 88 }).toBuffer()
    return { body, mimeType: 'image/jpeg' }
  } catch {
    return null
  }
}
