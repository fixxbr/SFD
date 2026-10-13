import { createHash } from 'crypto'
import { sanitizeFilename } from '@/lib/normalize'

export const BACKUP_APPLICATION = 'Afterstem'
export const BACKUP_VERSION = '1.0'
export const SCHEMA_VERSION = '2026.09'

export function sha256(buffer: Buffer | Uint8Array | string): string {
  return createHash('sha256').update(buffer).digest('hex')
}

/** Reject ZIP path traversal and absolute paths. */
export function assertSafeZipPath(entryPath: string): string {
  const normalized = entryPath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (!normalized || normalized.includes('\0')) {
    throw new Error(`Unsafe ZIP path: ${entryPath}`)
  }
  const parts = normalized.split('/')
  if (parts.some((p) => p === '..' || p === '.' || p === '')) {
    throw new Error(`Unsafe ZIP path: ${entryPath}`)
  }
  if (/^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`Unsafe ZIP path: ${entryPath}`)
  }
  return normalized
}

export function safeZipSegment(value: string | null | undefined, fallback = 'Item'): string {
  return sanitizeFilename((value ?? '').trim() || fallback).replace(/^\.+/, '') || fallback
}

export function categoryFolderForDoc(category: string, questionKey: string, evidenceSection?: string | null): string {
  if (evidenceSection === 'EDUCATION') return 'education'
  if (evidenceSection === 'TRANSCRIPT') return 'transcripts'
  if (evidenceSection === 'EMPLOYMENT') return 'employment'
  if (evidenceSection === 'LICENSE') return 'certifications'
  if (evidenceSection === 'CLIENT') return 'clients'
  const c = `${category} ${questionKey}`.toLowerCase()
  if (c.includes('passport') || c.includes('i94') || c.includes('i-94') || c.includes('i797') || c.includes('ead') || c.includes('i20') || c.includes('immigration')) {
    return 'immigration'
  }
  if (c.includes('resume') || c.includes('cv') || c.includes('basic')) return 'basic'
  if (c.includes('payment') || c.includes('receipt') || c.includes('invoice')) return 'payments'
  if (c.includes('education') || c.includes('degree') || c.includes('transcript')) return 'education'
  if (c.includes('employ') || c.includes('offer') || c.includes('w2')) return 'employment'
  if (c.includes('license') || c.includes('cert')) return 'certifications'
  if (c.includes('client')) return 'clients'
  return 'other'
}
