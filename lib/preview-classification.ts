export type PreviewKind = 'pdf' | 'image' | 'text' | 'html' | 'unsupported'

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'tif', 'tiff', 'heic', 'heif'])
const TEXT_EXT = new Set(['txt', 'csv', 'md'])
const WORD_EXT = new Set(['doc', 'docx'])
const SHEET_EXT = new Set(['xls', 'xlsx', 'csv'])

function extension(filename: string | null | undefined) {
  const name = (filename ?? '').trim().toLowerCase()
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot + 1) : ''
}

function baseMime(mimeType: string | null | undefined) {
  return (mimeType ?? '').split(';')[0].trim().toLowerCase()
}

function isOctet(mime: string) {
  return !mime || mime === 'application/octet-stream'
}

/** Browser-safe classification for choosing an inline preview renderer. */
export function classifyPreview(mimeType?: string | null, filename?: string | null): PreviewKind {
  const mime = baseMime(mimeType)
  const ext = extension(filename)
  if (mime === 'text/html' || ext === 'html' || ext === 'htm') return 'html'
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf'
  if (mime.startsWith('image/') || IMAGE_EXT.has(ext)) {
    if (mime && !mime.startsWith('image/') && !isOctet(mime)) return 'unsupported'
    return 'image'
  }
  if (WORD_EXT.has(ext) || mime.includes('wordprocessingml') || mime === 'application/msword') return 'html'
  if (SHEET_EXT.has(ext) || mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return 'html'
  if (mime.startsWith('text/') || TEXT_EXT.has(ext)) {
    if (mime && !mime.startsWith('text/') && !isOctet(mime) && mime !== 'application/csv') return 'unsupported'
    return 'text'
  }
  return 'unsupported'
}

/** Prefer the document MIME, with an extension fallback for generic storage MIME types. */
export function previewContentType(input: {
  documentMimeType?: string | null
  storageContentType?: string | null
  filename?: string | null
}) {
  const doc = baseMime(input.documentMimeType)
  const stored = baseMime(input.storageContentType)
  if (doc && doc !== 'application/octet-stream') return doc
  if (stored && stored !== 'application/octet-stream') return stored
  const kind = classifyPreview(doc || stored, input.filename)
  if (kind === 'pdf') return 'application/pdf'
  if (kind === 'html') return 'text/html; charset=utf-8'
  if (kind === 'image') {
    const ext = extension(input.filename)
    if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
    if (ext === 'png') return 'image/png'
    if (ext === 'webp') return 'image/webp'
    if (ext === 'gif') return 'image/gif'
    if (ext === 'tif' || ext === 'tiff') return 'image/tiff'
    if (ext === 'heic') return 'image/heic'
    if (ext === 'heif') return 'image/heif'
  }
  if (kind === 'text') return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}