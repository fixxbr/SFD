'use client'

/** Trigger a browser file download from a blob/array buffer response. */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function filenameFromDisposition(header: string | null, fallback: string) {
  if (!header) return fallback
  const utf = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (utf?.[1]) return decodeURIComponent(utf[1])
  const plain = /filename="([^"]+)"/i.exec(header) || /filename=([^;]+)/i.exec(header)
  return plain?.[1]?.trim() || fallback
}

/** Do not open a file URL. Preview must use DocumentPreviewModal and the inline preview route. */
export async function previewAdminDocument(documentId: string) {
  const res = await fetch(`/api/admin/documents/${documentId}/preview`, { credentials: 'same-origin' })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? 'Unable to preview this document.')
  }
  if (/attachment/i.test(res.headers.get('Content-Disposition') || '')) {
    throw new Error('Unable to preview this document.')
  }
  return res
}

/** Authenticated attachment download (streams through API with Content-Disposition). */
export async function downloadAdminDocument(documentId: string) {
  const res = await fetch(`/api/admin/documents/${documentId}?download=1&stream=1`)
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? "We couldn't prepare this download. Please try again.")
  }
  const blob = await res.blob()
  const name = filenameFromDisposition(res.headers.get('Content-Disposition'), 'document')
  saveBlob(blob, name)
}

export async function downloadCandidateExport(
  candidateId: string,
  type: 'pdf' | 'xlsx' | 'csv' | 'package' | 'documents-zip',
  extra?: { section?: string; category?: string },
) {
  const params = new URLSearchParams({ type })
  if (extra?.section) params.set('section', extra.section)
  if (extra?.category) params.set('category', extra.category)
  const res = await fetch(`/api/admin/candidates/${candidateId}/exports?${params}`)
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? "We couldn't prepare this download. Please try again.")
  }
  const blob = await res.blob()
  const name = filenameFromDisposition(
    res.headers.get('Content-Disposition'),
    `export.${type === 'documents-zip' || type === 'package' ? 'zip' : type}`,
  )
  saveBlob(blob, name)
}

export async function downloadBulkCandidates(input: {
  candidateIds: string[]
  includeDocuments?: boolean
  includeData?: boolean
}) {
  const res = await fetch('/api/admin/candidates/bulk-export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    throw new Error(json.error ?? "We couldn't prepare this download. Please try again.")
  }
  const blob = await res.blob()
  const name = filenameFromDisposition(res.headers.get('Content-Disposition'), 'Candidate_Bulk_Export.zip')
  saveBlob(blob, name)
}
