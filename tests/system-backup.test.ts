import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { assertSafeZipPath, sha256, BACKUP_APPLICATION, SCHEMA_VERSION } from '@/lib/system-backup/common'
import { validateBackupZip } from '@/lib/system-backup/validate-backup'

describe('system backup safety', () => {
  it('rejects path traversal in ZIP entries', () => {
    expect(() => assertSafeZipPath('../../etc/passwd')).toThrow(/Unsafe/)
    expect(() => assertSafeZipPath('candidates/ASM-1001/basic/Passport.pdf')).not.toThrow()
  })

  it('hashes file bytes stably', () => {
    expect(sha256(Buffer.from('hello'))).toBe(sha256('hello'))
    expect(sha256(Buffer.from('hello'))).not.toBe(sha256('world'))
  })

  it('exports Afterstem version constants', () => {
    expect(BACKUP_APPLICATION).toBe('Afterstem')
    expect(SCHEMA_VERSION).toMatch(/^2026/)
  })

  it('accepts backups created before the Afterstem rebrand', async () => {
    const zip = new JSZip()
    zip.file('manifest.json', JSON.stringify({
      application: 'LAWFIRM',
      backupVersion: '1.0',
      schemaVersion: SCHEMA_VERSION,
    }))
    zip.file('data/graph.json', JSON.stringify({ candidates: [] }))
    zip.file('data/documents.json', '[]')

    const result = await validateBackupZip(await zip.generateAsync({ type: 'nodebuffer' }))
    expect(result.valid).toBe(true)
  })
})
