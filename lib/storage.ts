import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createHash, createHmac, timingSafeEqual } from 'crypto'
import { mkdir, readFile, unlink, writeFile } from 'fs/promises'
import path from 'path'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/db'
import { randomToken } from '@/lib/crypto'
import { sanitizeFilename } from '@/lib/normalize'
import { MAX_UPLOAD_BYTES, SIGNED_URL_TTL_SECONDS } from '@/lib/brand'
import { resolveAllowedMimeType } from '@/lib/upload-validation'

export class StorageError extends Error {
  status: number
  constructor(message: string, status = 400) {
    super(message)
    this.name = 'StorageError'
    this.status = status
  }
}

export type StorageProviderId =
  | 'neon_pg'
  | 'aws_s3'
  | 'cloudflare_r2'
  | 's3_compatible'
  | 'netlify_blobs'
  | 'local_disk'

type DbClient = PrismaClient | Prisma.TransactionClient

function required(name: string): string {
  const value = process.env[name]
  if (!value) throw new StorageError(`${name} is not configured`, 500)
  return value
}

/** Neon BYTEA is the permanent store whenever DATABASE_URL is available. */
export function usingNeonStorage(): boolean {
  return Boolean(process.env.DATABASE_URL)
}

/** Optional cloud object storage (legacy / overflow). */
export function usingCloudStorage(): boolean {
  return Boolean(process.env.S3_BUCKET && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY)
}

export function usingNetlifyBlobs(): boolean {
  if (process.env.USE_NETLIFY_BLOBS === 'true') return true
  if (process.env.NETLIFY === 'true') return true
  if (process.env.NETLIFY_SITE_ID || process.env.SITE_ID) return true
  const url = `${process.env.URL || ''}${process.env.DEPLOY_URL || ''}${process.env.DEPLOY_PRIME_URL || ''}`
  return /netlify\.app/i.test(url)
}

function allowLocalDisk(): boolean {
  if (process.env.ALLOW_LOCAL_STORAGE === 'true') return true
  return process.env.NODE_ENV !== 'production'
}

export function storageConfigured(): boolean {
  return usingNeonStorage() || usingCloudStorage() || usingNetlifyBlobs() || allowLocalDisk()
}

export function storageProviderName(): StorageProviderId {
  if (usingNeonStorage()) return 'neon_pg'
  if (usingCloudStorage()) {
    if (process.env.S3_ENDPOINT?.includes('r2.cloudflarestorage.com')) return 'cloudflare_r2'
    if (process.env.S3_ENDPOINT) return 's3_compatible'
    return 'aws_s3'
  }
  if (usingNetlifyBlobs()) return 'netlify_blobs'
  return 'local_disk'
}

export function isS3Provider(provider?: string | null) {
  return provider === 'aws_s3' || provider === 'cloudflare_r2' || provider === 's3_compatible'
}

function localRoot() {
  return path.join(process.cwd(), '.data', 'uploads')
}

function localPathForKey(key: string) {
  const normalized = key.replace(/^\/+/, '').replace(/\.\./g, '')
  const full = path.resolve(localRoot(), normalized)
  if (!full.startsWith(path.resolve(localRoot()))) {
    throw new StorageError('Invalid storage key.', 400)
  }
  return full
}

function client(): S3Client {
  const endpoint = process.env.S3_ENDPOINT || undefined
  return new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: required('S3_ACCESS_KEY_ID'),
      secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
    },
  })
}

async function blobStore() {
  const { getStore } = await import('@netlify/blobs')
  return getStore({ name: 'lawfirm-uploads', consistency: 'strong' })
}

function sha256(buf: Buffer) {
  return createHash('sha256').update(buf).digest('hex')
}

export function validateUpload(input: { mimeType: string; size: number; filename: string }) {
  if (input.size <= 0) throw new StorageError('Empty files are not allowed.')
  if (input.size > MAX_UPLOAD_BYTES) {
    throw new StorageError(
      `DOCUMENT_TOO_LARGE: This file exceeds the maximum allowed size of ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      413,
    )
  }
  const mime = resolveAllowedMimeType({ mimeType: input.mimeType, filename: input.filename })
  if (!mime) {
    throw new StorageError('Unsupported file type.', 415)
  }
  return sanitizeFilename(input.filename)
}

export function buildStorageKey(input: {
  candidateId: string
  caseId: string
  category: string
  documentType: string
  filename: string
}): string {
  const safeCategory = sanitizeFilename(input.category)
  const safeType = sanitizeFilename(input.documentType)
  const safeName = sanitizeFilename(input.filename)
  return `candidates/${input.candidateId}/cases/${input.caseId}/${safeCategory}/${safeType}/${randomToken(16)}-${safeName}`
}

/** Write binary into Neon (optionally inside an existing Prisma transaction). */
export async function putPrivateObjectTx(
  db: DbClient,
  input: { key: string; body: Buffer | Uint8Array; mimeType: string },
): Promise<{ key: string; provider: StorageProviderId; checksum: string; byteSize: number }> {
  const content = Buffer.from(input.body)
  if (content.byteLength > MAX_UPLOAD_BYTES) {
    throw new StorageError(
      `DOCUMENT_TOO_LARGE: This file exceeds the maximum allowed size of ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB.`,
      413,
    )
  }
  const checksum = sha256(content)
  try {
    await db.storedObject.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        mimeType: input.mimeType,
        content,
        checksum,
        byteSize: content.byteLength,
      },
      update: {
        mimeType: input.mimeType,
        content,
        checksum,
        byteSize: content.byteLength,
      },
    })
  } catch (err) {
    console.error('[storage] neon put failed', {
      key: input.key,
      error: err instanceof Error ? err.message : 'unknown',
    })
    throw new StorageError('Upload failed because storage could not save the file. Please try again.', 502)
  }
  return { key: input.key, provider: 'neon_pg', checksum, byteSize: content.byteLength }
}

/**
 * Permanent write path: Neon PostgreSQL BYTEA.
 * Legacy S3 / Netlify Blobs / local disk are read-only fallbacks for older objects.
 */
export async function putPrivateObject(input: {
  key: string
  body: Buffer | Uint8Array
  mimeType: string
}): Promise<{ key: string; provider: StorageProviderId; checksum: string; byteSize: number }> {
  if (!usingNeonStorage()) {
    throw new StorageError(
      'Private object storage is not configured. DATABASE_URL (Neon) is required to store documents permanently.',
      500,
    )
  }
  return putPrivateObjectTx(prisma, input)
}

function localFileSigningSecret() {
  return process.env.SESSION_SECRET || process.env.S3_SECRET_ACCESS_KEY || 'lawfirm-local-dev-storage'
}

/** Short-lived same-origin URL for Neon / non-S3 files. */
export function localSignedFileUrl(
  documentId: string,
  disposition: 'inline' | 'attachment',
  baseUrl: string,
) {
  const exp = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS
  const payload = `${documentId}.${disposition}.${exp}`
  const sig = createHmac('sha256', localFileSigningSecret()).update(payload).digest('base64url')
  const base = baseUrl.replace(/\/$/, '')
  return {
    url: `${base}/api/files/${encodeURIComponent(documentId)}?d=${disposition}&exp=${exp}&sig=${sig}`,
    expiresIn: SIGNED_URL_TTL_SECONDS,
  }
}

export function verifyLocalFileSignature(input: {
  documentId: string
  disposition: string
  exp: string
  sig: string
}) {
  const expNum = Number(input.exp)
  if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false
  const payload = `${input.documentId}.${input.disposition}.${input.exp}`
  const expected = createHmac('sha256', localFileSigningSecret()).update(payload).digest('base64url')
  try {
    const a = Buffer.from(expected)
    const b = Buffer.from(input.sig)
    return a.length === b.length && timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function signedGetUrl(key: string, filename: string, disposition: 'inline' | 'attachment') {
  if (!usingCloudStorage()) {
    throw new StorageError('Local storage requires documentAccessUrl(documentId).', 500)
  }
  const bucket = required('S3_BUCKET')
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: `${disposition}; filename="${sanitizeFilename(filename)}"`,
  })
  const url = await getSignedUrl(client(), command, { expiresIn: SIGNED_URL_TTL_SECONDS })
  return { url, expiresIn: SIGNED_URL_TTL_SECONDS }
}

async function getFromNeon(key: string, db: DbClient = prisma) {
  const row = await db.storedObject.findUnique({ where: { key } })
  if (!row) return null
  return { body: Buffer.from(row.content), contentType: row.mimeType || undefined, checksum: row.checksum }
}

async function getFromLegacy(key: string, provider?: string | null) {
  if (isS3Provider(provider) || (!provider && usingCloudStorage())) {
    try {
      const result = await client().send(
        new GetObjectCommand({
          Bucket: required('S3_BUCKET'),
          Key: key,
        }),
      )
      if (!result.Body) throw new StorageError('Object body is empty.', 404)
      const bytes = await result.Body.transformToByteArray()
      return { body: Buffer.from(bytes), contentType: result.ContentType }
    } catch (err) {
      if (err instanceof StorageError) throw err
      console.error('[storage] s3 get failed', { key, error: err instanceof Error ? err.message : 'unknown' })
      throw new StorageError('Unable to read the stored file.', 502)
    }
  }

  if (provider === 'netlify_blobs' || (!provider && usingNetlifyBlobs())) {
    try {
      const store = await blobStore()
      const entry = await store.getWithMetadata(key, { type: 'arrayBuffer' })
      if (!entry || entry.data == null) return null
      const contentType =
        typeof entry.metadata?.contentType === 'string' ? entry.metadata.contentType : undefined
      return { body: Buffer.from(entry.data), contentType }
    } catch (err) {
      console.error('[storage] netlify blobs get failed', {
        key,
        error: err instanceof Error ? err.message : 'unknown',
      })
      return null
    }
  }

  if (provider === 'local_disk' || allowLocalDisk()) {
    try {
      const body = await readFile(localPathForKey(key))
      return { body }
    } catch {
      return null
    }
  }

  return null
}

/**
 * Read binary: Neon first, then legacy providers.
 * On legacy hit, write-through to Neon so future deploys keep the file.
 */
export async function getPrivateObject(
  key: string,
  provider?: string | null,
): Promise<{ body: Buffer; contentType?: string }> {
  const neon = await getFromNeon(key)
  if (neon) return { body: neon.body, contentType: neon.contentType }

  const legacy = await getFromLegacy(key, provider)
  if (!legacy) throw new StorageError('Stored file not found.', 404)

  if (usingNeonStorage()) {
    try {
      await putPrivateObject({
        key,
        body: legacy.body,
        mimeType: legacy.contentType || 'application/octet-stream',
      })
    } catch (err) {
      console.error('[storage] neon write-through failed', {
        key,
        error: err instanceof Error ? err.message : 'unknown',
      })
    }
  }

  return legacy
}

export async function deleteObject(key: string, provider?: string | null) {
  if (usingNeonStorage()) {
    try {
      await prisma.storedObject.delete({ where: { key } })
    } catch {
      /* ignore missing */
    }
  }

  if (isS3Provider(provider) || (!provider && usingCloudStorage())) {
    try {
      await client().send(new DeleteObjectCommand({ Bucket: required('S3_BUCKET'), Key: key }))
    } catch {
      /* ignore */
    }
  }

  if (provider === 'netlify_blobs' || usingNetlifyBlobs()) {
    try {
      const store = await blobStore()
      await store.delete(key)
    } catch {
      /* ignore */
    }
  }

  if (provider === 'local_disk' || allowLocalDisk()) {
    try {
      await unlink(localPathForKey(key))
    } catch {
      /* ignore */
    }
  }
}

/** Dev-only helper kept for tests that force disk without Neon. */
export async function putLocalDiskObjectForTests(input: {
  key: string
  body: Buffer | Uint8Array
  mimeType: string
}) {
  const full = localPathForKey(input.key)
  await mkdir(path.dirname(full), { recursive: true })
  await writeFile(full, input.body)
  return { key: input.key, provider: 'local_disk' as const }
}
