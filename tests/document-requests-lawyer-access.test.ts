import { afterEach, describe, expect, it, vi } from 'vitest'

class AuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

const prismaMock = {
  case: { findUnique: vi.fn(), findFirst: vi.fn() },
  customDocumentDef: { upsert: vi.fn(), findUnique: vi.fn(), delete: vi.fn() },
  documentRequest: { findFirst: vi.fn(), update: vi.fn() },
  documentRequestItem: { create: vi.fn() },
  caseActivity: { create: vi.fn() },
}
const lawyer = { id: 'lawyer-1', fullName: 'Attorney', email: 'l@x.com', role: 'ATTORNEY', status: 'ACTIVE' }

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ requirePermission: vi.fn(async () => lawyer), requireUser: vi.fn(async () => lawyer), AuthError }))
vi.mock('@/lib/http', () => ({
  assertSameOrigin: () => {},
  publicAppUrlFromRequest: () => 'https://example.com',
  jsonError: (error: string, status = 400) => new Response(JSON.stringify({ error }), { status }),
  handleApiError: (error: unknown) =>
    new Response(JSON.stringify({ error: (error as Error).message }), {
      status: error instanceof AuthError ? error.status : 500,
    }),
}))

describe('document requirement actions are limited to the lawyer’s assigned cases', () => {
  afterEach(() => vi.clearAllMocks())

  const post = async (body: Record<string, unknown>) => {
    const { POST } = await import('@/app/api/admin/document-requests/route')
    return POST(new Request('https://example.com/api/admin/document-requests', { method: 'POST', body: JSON.stringify(body) }))
  }

  it.each([
    { action: 'add-custom-requirement', caseId: 'case-2', documentName: 'Injected requirement' },
    { action: 'request-additional', caseId: 'case-2', documentKey: 'passport', documentNote: 'More pages' },
    { action: 'remove-custom-requirement', caseId: 'case-2', documentKey: 'custom_x' },
  ])('$action on an unassigned case is refused without writing', async (body) => {
    prismaMock.case.findFirst.mockResolvedValue(null) // not assigned to this lawyer
    const res = await post(body)
    expect(res.status).toBe(403)
    expect(prismaMock.customDocumentDef.upsert).not.toHaveBeenCalled()
    expect(prismaMock.customDocumentDef.delete).not.toHaveBeenCalled()
    expect(prismaMock.documentRequestItem.create).not.toHaveBeenCalled()
  })

  it('still allows the lawyer on their own case', async () => {
    prismaMock.case.findFirst.mockResolvedValue({ id: 'case-1' })
    prismaMock.case.findUnique.mockResolvedValue({ id: 'case-1', candidateId: 'cand-1' })
    prismaMock.customDocumentDef.upsert.mockResolvedValue({ key: 'custom_a' })
    const res = await post({ action: 'add-custom-requirement', caseId: 'case-1', documentName: 'Letter' })
    expect(res.status).toBe(200)
  })
})
