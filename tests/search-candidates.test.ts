import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    candidate: {
      count: prismaMock.count,
      findMany: prismaMock.findMany,
    },
    $transaction: prismaMock.transaction,
  },
}))

const candidate = {
  id: 'candidate-id',
  candidateNumber: 'ASM-1001',
  fullLegalName: 'Avery Example',
  email: 'avery@example.com',
  phone: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-02T00:00:00.000Z'),
  cases: [
    {
      id: 'case-id',
      visaType: 'O_1A',
      caseNumber: 'O1-1001',
      status: 'QUALIFIED',
      quotedAmountCents: 100_000,
      referredByName: null,
      assignedCaseManager: { id: 'manager-id', fullName: 'Case Manager' },
      assignedAttorney: { id: 'attorney-id', fullName: 'Attorney' },
      referredByAdmin: null,
      payments: [],
      documents: [
        { isCurrentVersion: true, status: 'ACCEPTED' },
        { isCurrentVersion: true, status: 'UPLOADED' },
      ],
      onboardingSubmissions: [{ status: 'SUBMITTED' }],
      activities: [{ createdAt: new Date('2026-01-03T00:00:00.000Z') }],
      financialEngagement: { quotedAmountCents: 100_000, quoteStatus: 'AGREED' },
      paymentReceipts: [],
      paymentScheduleItems: [],
    },
  ],
}

const admin = {
  id: 'admin-id',
  fullName: 'Admin User',
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
} as const

describe('searchCandidates query projection', () => {
  beforeEach(() => {
    vi.resetModules()
    prismaMock.count.mockResolvedValue(1)
    prismaMock.findMany.mockResolvedValue([candidate])
    prismaMock.transaction.mockImplementation((operations: Promise<unknown>[]) => Promise.all(operations))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns list summaries using a narrow 25-candidate projection', async () => {
    const { searchCandidates } = await import('@/lib/admin/search-candidates')
    const result = await searchCandidates(admin, new URLSearchParams())

    const query = prismaMock.findMany.mock.calls[0][0]
    const caseSelect = query.select.cases.select
    expect(query.take).toBe(25)
    expect(query.select.fullLegalName).toBe(true)
    expect(caseSelect.payments.select).toEqual({
      installmentNumber: true,
      amountCents: true,
      status: true,
      paidAmountCents: true,
    })
    expect(caseSelect.documents.select).toEqual({ isCurrentVersion: true, status: true })
    expect(caseSelect.activities.select).toEqual({ createdAt: true })
    expect(result.items[0]).toMatchObject({
      fullLegalName: 'Avery Example',
      caseNumber: 'O1-1001',
      manager: { fullName: 'Case Manager' },
      documents: { uploaded: 2, accepted: 1 },
    })
  })

  it('omits finance relations for attorney candidate lists', async () => {
    const { searchCandidates } = await import('@/lib/admin/search-candidates')
    await searchCandidates({ ...admin, role: 'ATTORNEY' }, new URLSearchParams())

    const caseSelect = prismaMock.findMany.mock.calls[0][0].select.cases.select
    expect(caseSelect.payments).toBe(false)
    expect(caseSelect.financialEngagement).toBe(false)
    expect(caseSelect.paymentReceipts).toBe(false)
    expect(caseSelect.paymentScheduleItems).toBe(false)
  })

  it('logs query timing and payload estimates only when enabled', async () => {
    vi.stubEnv('CANDIDATE_SEARCH_METRICS', 'true')
    const log = vi.spyOn(console, 'info').mockImplementation(() => undefined)
    const { searchCandidates } = await import('@/lib/admin/search-candidates')
    await searchCandidates(admin, new URLSearchParams())

    expect(log).toHaveBeenCalledWith(
      '[candidate-search-metrics]',
      expect.objectContaining({
        durationMs: expect.any(Number),
        returnedCandidates: 1,
        relatedRecords: 4,
        projectedBytes: expect.any(Number),
        page: 1,
      }),
    )
  })
})