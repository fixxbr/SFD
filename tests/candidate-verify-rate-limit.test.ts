import { afterEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  candidate: { findUnique: vi.fn() },
  loginAttempt: { count: vi.fn(), create: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-forwarded-for': '203.0.113.9' }),
  cookies: async () => ({ get: () => undefined }),
}))
vi.mock('@/lib/submission-session', () => ({
  createSubmissionSession: vi.fn(async () => ({ token: 't' })),
  DOC_SESSION_COOKIE: 'doc',
  DOC_SESSION_TTL_MS: 1000,
}))
vi.mock('@/lib/document-request-access', () => ({ findLatestOpenDocumentRequest: vi.fn(async () => null) }))

const verify = async (body: Record<string, string>) => {
  const { POST } = await import('@/app/api/client/verify/route')
  return POST(new Request('https://example.com/api/client/verify', { method: 'POST', body: JSON.stringify(body) }))
}

describe('candidate portal verification is rate limited', () => {
  afterEach(() => vi.clearAllMocks())

  it('records a failed attempt under candidate-only keys', async () => {
    prismaMock.loginAttempt.count.mockResolvedValue(0)
    prismaMock.candidate.findUnique.mockResolvedValue(null)
    const res = await verify({ candidate_number: 'ASM-1031', email: 'guess@example.com' })
    expect(res.status).toBe(401)
    expect(prismaMock.loginAttempt.create).toHaveBeenCalledWith({
      data: { email: 'candidate-verify:ASM-1031', ipAddress: 'candidate-verify:203.0.113.9', success: false },
    })
  })

  it('refuses with 429 once the limit is reached, without checking credentials', async () => {
    prismaMock.loginAttempt.count.mockResolvedValue(5)
    const res = await verify({ candidate_number: 'ASM-1031', email: 'right@example.com' })
    expect(res.status).toBe(429)
    expect(prismaMock.candidate.findUnique).not.toHaveBeenCalled()
  })
})
