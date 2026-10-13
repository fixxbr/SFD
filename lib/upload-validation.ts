import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES, UPLOAD_CHUNK_BYTES } from '@/lib/brand'

export { MAX_UPLOAD_BYTES, UPLOAD_CHUNK_BYTES }
export const UPLOAD_ACCEPT =
  '.pdf,.doc,.docx,.jpg,.jpeg,application/pdf,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document'

export const UPLOAD_TYPE_HINT = 'PDF, DOC, DOCX, JPG, JPEG'
export const MAX_UPLOAD_MB = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)
/** Soft batch hint only — candidates may submit repeatedly; no hard per-slot file cap. */
export const MAX_FILES_PER_SUBMIT = 100

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

export function fileExtension(filename: string) {
  const parts = filename.toLowerCase().split('.')
  return parts.length > 1 ? parts.pop()! : ''
}

export function resolveAllowedMimeType(input: { mimeType?: string | null; filename: string }) {
  const declared = (input.mimeType || '').toLowerCase().trim()
  const extension = fileExtension(input.filename)
  const mapped = EXT_MIME[extension]
  if (declared && (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(declared as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number])) {
    if (extension && mapped !== declared) return null
    return declared
  }
  // Some browsers send an empty or generic MIME — fall back to the extension only then.
  if (declared && declared !== 'application/octet-stream') return null
  if (mapped && (ALLOWED_UPLOAD_MIME_TYPES as readonly string[]).includes(mapped as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number])) {
    return mapped
  }
  return null
}

export function validateCandidateUploadFile(input: {
  filename: string
  size: number
  mimeType?: string | null
}): { ok: true; mimeType: string } | { ok: false; error: string } {
  const name = input.filename.trim()
  if (!name) return { ok: false, error: 'A file name is required.' }
  if (input.size <= 0) return { ok: false, error: 'Empty files are not allowed.' }
  if (input.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: `This file exceeds the maximum allowed size of ${MAX_UPLOAD_MB} MB.` }
  }
  const mimeType = resolveAllowedMimeType({ mimeType: input.mimeType, filename: name })
  if (!mimeType) {
    const extension = fileExtension(name)
    const declared = (input.mimeType || '').trim()
    const detected = declared && declared.toLowerCase() !== 'application/octet-stream'
      ? `.${extension || 'unknown'} (${declared})`
      : extension
        ? `.${extension}`
        : 'unknown file type'
    return {
      ok: false,
      error: `Cannot upload "${name}": detected ${detected}. Accepted formats are PDF (.pdf), Word (.doc, .docx), and JPEG (.jpg, .jpeg). For links, enter a URL in a link field.`,
    }
  }
  return { ok: true, mimeType }
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
