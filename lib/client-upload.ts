'use client'

import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB, UPLOAD_CHUNK_BYTES } from '@/lib/upload-validation'

async function readError(res: Response): Promise<string> {
  const text = await res.text().catch(() => '')
  if (!text) {
    if (res.status === 413 || res.status === 502 || res.status === 504) {
      return `This file is too large for a single upload step. Please try again, or use a file under ${MAX_UPLOAD_MB} MB.`
    }
    if (res.status === 401) return 'Your session expired. Please sign in or verify again, then upload the file.'
    if (res.status === 403) return 'This upload was blocked. Refresh the page and try again.'
    return `Upload did not complete (HTTP ${res.status || 'network error'}). Please try again.`
  }
  try {
    const json = JSON.parse(text) as { error?: string; correlationId?: string }
    if (json.error) {
      return json.correlationId ? `${json.error} (ref ${json.correlationId})` : json.error
    }
  } catch {
    /* HTML / plain gateway body */
  }
  if (/request entity too large|payload too large|413/i.test(text) || res.status === 413) {
    return `This file is too large to upload in one request. Please use a file under ${MAX_UPLOAD_MB} MB (or compress the PDF).`
  }
  return `Upload did not complete (HTTP ${res.status}). Please try again.`
}

function assertUploadPersisted(json: Record<string, unknown>) {
  // Document upload APIs must confirm a durable record — never treat an empty 200 as success.
  if (json.success === false) {
    throw new Error(String(json.error || 'Upload failed. Please try again.'))
  }
  if (json.skipped === true) return json
  const document = json.document as { id?: string } | undefined
  if (document?.id) return json
  if (typeof json.id === 'string') return json
  if (typeof json.documentId === 'string') return json
  throw new Error('Upload did not confirm storage. Please retry — nothing was saved.')
}

/**
 * Upload a file to an Afterstem API route, using chunked requests when needed
 * so Netlify/Lambda body limits do not silently fail with a blank error.
 */
export async function uploadFileToApi(input: {
  endpoint: string
  file: File
  fields?: Record<string, string>
  /** Onboarding invite token — authorizes /api/upload-chunks without an admin/doc session. */
  inviteToken?: string
}): Promise<Record<string, unknown>> {
  if (input.file.size <= 0) throw new Error('Empty files are not allowed.')
  if (input.file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`This file exceeds the maximum allowed size of ${MAX_UPLOAD_MB} MB.`)
  }

  const fields = input.fields || {}

  // Small files: single multipart POST (under Netlify ~6MB request limit)
  if (input.file.size <= UPLOAD_CHUNK_BYTES) {
    const form = new FormData()
    for (const [k, v] of Object.entries(fields)) form.set(k, v)
    form.set('file', input.file)
    const res = await fetch(input.endpoint, { method: 'POST', body: form, credentials: 'same-origin' })
    if (!res.ok) throw new Error(await readError(res))
    return assertUploadPersisted((await res.json().catch(() => ({}))) as Record<string, unknown>)
  }

  // Large files: binary chunks → finalize without sending the full file in one request
  const uploadId = crypto.randomUUID().replace(/-/g, '')
  const total = Math.ceil(input.file.size / UPLOAD_CHUNK_BYTES)
  for (let index = 0; index < total; index++) {
    const start = index * UPLOAD_CHUNK_BYTES
    const end = Math.min(start + UPLOAD_CHUNK_BYTES, input.file.size)
    const slice = input.file.slice(start, end)
    const chunkForm = new FormData()
    chunkForm.set('uploadId', uploadId)
    chunkForm.set('index', String(index))
    chunkForm.set('total', String(total))
    chunkForm.set('mimeType', input.file.type || 'application/octet-stream')
    if (input.inviteToken) chunkForm.set('inviteToken', input.inviteToken)
    chunkForm.set('chunk', slice, input.file.name || `chunk-${index}.bin`)
    const chunkRes = await fetch('/api/upload-chunks', {
      method: 'POST',
      credentials: 'same-origin',
      body: chunkForm,
    })
    if (!chunkRes.ok) throw new Error(await readError(chunkRes))
  }

  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) form.set(k, v)
  form.set('uploadId', uploadId)
  form.set('chunkTotal', String(total))
  form.set('filename', input.file.name)
  form.set('mimeType', input.file.type || 'application/octet-stream')
  form.set('fileSize', String(input.file.size))
  const res = await fetch(input.endpoint, { method: 'POST', body: form, credentials: 'same-origin' })
  if (!res.ok) throw new Error(await readError(res))
  return assertUploadPersisted((await res.json().catch(() => ({}))) as Record<string, unknown>)
}
