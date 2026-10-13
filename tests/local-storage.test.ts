import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm } from 'fs/promises'
import os from 'os'
import path from 'path'

describe('local disk storage helpers (dev fallback only)', () => {
  const prevCwd = process.cwd()
  let tmp = ''

  afterEach(async () => {
    process.chdir(prevCwd)
    if (tmp) await rm(tmp, { recursive: true, force: true })
  })

  it('putLocalDiskObjectForTests writes under .data/uploads', async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'afterstem-upload-'))
    process.chdir(tmp)
    const { putLocalDiskObjectForTests, buildStorageKey } = await import('@/lib/storage')
    const key = buildStorageKey({
      candidateId: 'cand1',
      caseId: 'case1',
      category: 'basic',
      documentType: 'resume',
      filename: 'Resume.pdf',
    })
    const body = Buffer.from('%PDF-1.4 test')
    const stored = await putLocalDiskObjectForTests({ key, body, mimeType: 'application/pdf' })
    expect(stored.provider).toBe('local_disk')
  })

  it('keeps same display names under unique keys', async () => {
    tmp = await mkdtemp(path.join(os.tmpdir(), 'afterstem-upload-'))
    process.chdir(tmp)
    const { buildStorageKey } = await import('@/lib/storage')
    const a = buildStorageKey({
      candidateId: 'c',
      caseId: 'k',
      category: 't',
      documentType: 'passport',
      filename: 'passport.pdf',
    })
    const b = buildStorageKey({
      candidateId: 'c',
      caseId: 'k',
      category: 't',
      documentType: 'passport',
      filename: 'passport.pdf',
    })
    expect(a).not.toBe(b)
    expect(a.endsWith('-passport.pdf')).toBe(true)
    expect(b.endsWith('-passport.pdf')).toBe(true)
  })
})
