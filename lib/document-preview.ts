import { contentDisposition } from '@/lib/download-names'
import { officeFileToHtml, rasterizePreviewImage } from '@/lib/office-preview'
import { classifyPreview, previewContentType, type PreviewKind } from '@/lib/preview-classification'

export { classifyPreview, previewContentType }
export type { PreviewKind }

export function previewResponseHeaders(filename: string, mimeType: string): Record<string, string> {
  return {
    'Content-Type': mimeType,
    'Content-Disposition': contentDisposition(filename, 'inline'),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }
}

export function isInlineDisposition(header: string) {
  return /^inline\b/i.test(header) && !/\battachment\b/i.test(header)
}

/**
 * Convert Office / TIFF / HEIC uploads into something the in-app viewer can render.
 * Never switches to Content-Disposition: attachment.
 */
export async function materializeInlinePreview(input: {
  body: Buffer | Uint8Array
  filename: string
  documentMimeType?: string | null
  storageContentType?: string | null
}): Promise<{ body: Buffer; mimeType: string }> {
  const buffer = Buffer.isBuffer(input.body) ? input.body : Buffer.from(input.body)
  const filename = input.filename || 'document'
  const sourceMime = previewContentType({
    documentMimeType: input.documentMimeType,
    storageContentType: input.storageContentType,
    filename,
  })
  const kind = classifyPreview(sourceMime, filename)

  if (kind === 'image') {
    const raster = await rasterizePreviewImage({ buffer, filename, mimeType: sourceMime })
    if (raster) return raster
    return { body: buffer, mimeType: sourceMime.startsWith('image/') ? sourceMime : 'image/jpeg' }
  }

  if (kind === 'pdf') return { body: buffer, mimeType: 'application/pdf' }
  if (kind === 'text') {
    return { body: buffer, mimeType: sourceMime.startsWith('text/') ? sourceMime : 'text/plain; charset=utf-8' }
  }

  const html = await officeFileToHtml({ buffer, filename, mimeType: sourceMime })
  if (html) return { body: Buffer.from(html, 'utf8'), mimeType: 'text/html; charset=utf-8' }

  if (kind === 'html') {
    const fallback = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body><p>This file was opened for preview, but its contents could not be rendered. Try another format such as PDF if you need a full layout view.</p></body></html>`
    return { body: Buffer.from(fallback, 'utf8'), mimeType: 'text/html; charset=utf-8' }
  }
  return { body: buffer, mimeType: sourceMime }
}
