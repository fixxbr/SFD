import { afterEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  caseDocument: {
    findUnique: vi.fn(),
  },
  case: {
    findFirst: vi.fn(),
  },
}

class AuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

const authMock = {
  getSessionUser: vi.fn(),
  AuthError,
}

const storageMock = {
  getPrivateObject: vi.fn(),
  verifyLocalFileSignature: vi.fn(),
}

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({
  getSessionUser: authMock.getSessionUser,
  AuthError,
}))
vi.mock('@/lib/storage', () => ({
  getPrivateObject: storageMock.getPrivateObject,
  verifyLocalFileSignature: storageMock.verifyLocalFileSignature,
}))
vi.mock('@/lib/http', () => ({
  handleApiError: async (error: unknown) => {
    if (error instanceof AuthError) {
      return new Response(JSON.stringify({ error: error.message }), { status: error.status, headers: { 'Content-Type': 'application/json' } })
    }
    const message = error instanceof Error ? error.message : 'unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  },
  jsonError: (error: string, status = 400) => new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json' } }),
}))

describe('lawyer file downloads', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('blocks lawyer attachment downloads on direct file routes', async () => {
    authMock.getSessionUser.mockResolvedValue({
      id: 'lawyer-1',
      fullName: 'Attorney Smith',
      email: 'lawyer@example.com',
      role: 'ATTORNEY',
      status: 'ACTIVE',
    })
    storageMock.verifyLocalFileSignature.mockReturnValue(true)
    prismaMock.case.findFirst.mockResolvedValue({ id: 'case-1' })
    prismaMock.caseDocument.findUnique.mockResolvedValue({
      id: 'doc-1',
      candidateId: 'cand-1',
      caseId: 'case-1',
      storageKey: 'key',
      storageProvider: 'neon_pg',
      mimeType: 'application/pdf',
      originalFilename: 'Passport.pdf',
      displayName: null,
    })

    const { GET } = await import('@/app/api/files/[documentId]/route')
    const res = await GET(new Request('https://example.com/api/files/doc-1?d=attachment&exp=9999999999&sig=abc'), {
      params: Promise.resolve({ documentId: 'doc-1' }),
    })

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toMatchObject({
      error: expect.stringContaining('Downloads are restricted for lawyer accounts.'),
    })
  })
})
