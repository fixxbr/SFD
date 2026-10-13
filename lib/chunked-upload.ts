import { randomToken } from '@/lib/crypto'
import { prisma } from '@/lib/db'
import { UPLOAD_CHUNK_BYTES } from '@/lib/brand'
import { StorageError, putPrivateObjectTx } from '@/lib/storage'
import type { Prisma } from '@prisma/client'

export { UPLOAD_CHUNK_BYTES }
export function chunkObjectKey(uploadId: string, index: number) {
  return `__upload_chunks__/${uploadId}/${index}`
}

/** FormData file parts are File in the DOM typings; Edge/undici may expose Blob-like values. */
export function isUploadBlob(value: FormDataEntryValue | null): value is File {
  return Boolean(value) && typeof value !== 'string' && typeof (value as Blob).arrayBuffer === 'function'
}

export function uploadFilename(value: Blob, fallback = 'upload.bin') {
  if (typeof File !== 'undefined' && value instanceof File && value.name.trim()) return value.name.trim()
  const named = value as Blob & { name?: string }
  if (typeof named.name === 'string' && named.name.trim()) return named.name.trim()
  return fallback
}

export async function saveUploadChunk(input: {
  uploadId: string
  index: number
  total: number
  bytes: Buffer
  mimeType?: string
}) {
  if (!input.uploadId || input.total < 1 || input.index < 0 || input.index >= input.total) {
    throw new StorageError('Invalid upload chunk.', 400)
  }
  if (input.bytes.byteLength <= 0 || input.bytes.byteLength > UPLOAD_CHUNK_BYTES + 64 * 1024) {
    throw new StorageError('Upload chunk is empty or too large.', 413)
  }
  const key = chunkObjectKey(input.uploadId, input.index)
  await putPrivateObjectTx(prisma, {
    key,
    body: input.bytes,
    mimeType: input.mimeType || 'application/octet-stream',
  })
  return { key, index: input.index, total: input.total }
}

export async function assembleUploadChunks(
  uploadId: string,
  total: number,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<Buffer> {
  if (!uploadId || total < 1 || total > 40) {
    throw new StorageError('Invalid chunked upload.', 400)
  }
  const parts: Buffer[] = []
  for (let i = 0; i < total; i++) {
    const key = chunkObjectKey(uploadId, i)
    const row = await db.storedObject.findUnique({ where: { key } })
    if (!row) throw new StorageError('Upload incomplete. Please try uploading the file again.', 400)
    parts.push(Buffer.from(row.content))
  }
  const body = Buffer.concat(parts)
  // Cleanup chunk rows (best-effort outside caller transaction if needed)
  await db.storedObject.deleteMany({
    where: { key: { startsWith: `__upload_chunks__/${uploadId}/` } },
  })
  return body
}

export function newUploadId() {
  return randomToken(18)
}
