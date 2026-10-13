import { sanitizeFilename } from '@/lib/normalize'

/** Safe single path segment for ZIP folders / download names. */
export function safePathSegment(value: string | null | undefined, fallback = 'Item'): string {
  const cleaned = sanitizeFilename((value ?? '').trim() || fallback)
  return cleaned.replace(/^\.+/, '') || fallback
}

export function candidateSlug(candidateNumber: string | null | undefined, fullName: string): string {
  const id = safePathSegment(candidateNumber || 'Candidate', 'Candidate')
  const name = safePathSegment(fullName, 'Unknown')
  return `${id}_${name}`
}

export function downloadFilename(parts: Array<string | null | undefined>, ext?: string): string {
  const base = parts
    .filter(Boolean)
    .map((p) => safePathSegment(String(p)))
    .join('_')
  if (!ext) return base
  const cleanExt = ext.replace(/^\./, '')
  return base.toLowerCase().endsWith(`.${cleanExt.toLowerCase()}`) ? base : `${base}.${cleanExt}`
}

/** Unique name within a folder (handles duplicates). */
export function uniqueName(used: Set<string>, filename: string): string {
  const safe = safePathSegment(filename, 'file')
  if (!used.has(safe.toLowerCase())) {
    used.add(safe.toLowerCase())
    return safe
  }
  const dot = safe.lastIndexOf('.')
  const stem = dot > 0 ? safe.slice(0, dot) : safe
  const ext = dot > 0 ? safe.slice(dot) : ''
  let i = 2
  while (used.has(`${stem}_${i}${ext}`.toLowerCase())) i += 1
  const next = `${stem}_${i}${ext}`
  used.add(next.toLowerCase())
  return next
}

export function contentDisposition(filename: string, disposition: 'attachment' | 'inline' = 'attachment') {
  const safe = sanitizeFilename(filename)
  const encoded = encodeURIComponent(safe).replace(/['()]/g, escape)
  return `${disposition}; filename="${safe}"; filename*=UTF-8''${encoded}`
}
