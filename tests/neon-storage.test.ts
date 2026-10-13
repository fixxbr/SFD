import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'crypto'

describe('neon BYTEA storage', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('writes and reads files through StoredObject in Neon', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    // Keep DATABASE_URL from environment / .env via vitest process
    const { putPrivateObject, getPrivateObject, usingNeonStorage, buildStorageKey, storageProviderName } =
      await import('@/lib/storage')
    const { prisma } = await import('@/lib/db')

    expect(usingNeonStorage()).toBe(true)
    expect(storageProviderName()).toBe('neon_pg')

    const key = buildStorageKey({
      candidateId: '00000000-0000-4000-8000-000000000001',
      caseId: '00000000-0000-4000-8000-000000000002',
      category: 'basic',
      documentType: 'resume',
      filename: 'Resume.pdf',
    })
    const body = Buffer.from('%PDF-1.4 neon-persist-test')
    const stored = await putPrivateObject({ key, body, mimeType: 'application/pdf' })
    expect(stored.provider).toBe('neon_pg')
    expect(stored.checksum).toBe(createHash('sha256').update(body).digest('hex'))

    const read = await getPrivateObject(key, 'neon_pg')
    expect(read.body.equals(body)).toBe(true)

    const row = await prisma.storedObject.findUnique({ where: { key } })
    expect(row?.byteSize).toBe(body.byteLength)
    expect(row?.content).toBeTruthy()

    await prisma.storedObject.delete({ where: { key } }).catch(() => undefined)
  }, 30000)
})
