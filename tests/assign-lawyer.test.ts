import { beforeEach, describe, expect, it, vi } from 'vitest'

const findUnique = vi.fn()
const findFirst = vi.fn()
const caseUpdate = vi.fn()
const lawyerAssignmentCreate = vi.fn()
const caseActivityCreate = vi.fn()
const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    case: { update: caseUpdate },
    lawyerAssignment: { create: lawyerAssignmentCreate },
    caseActivity: { create: caseActivityCreate },
  }),
)

vi.mock('@/lib/db', () => ({
  prisma: {
    adminUser: { findUnique },
    case: { findUnique, findFirst },
    $transaction: transaction,
  },
}))

describe('assignCaseLawyer', () => {
  beforeEach(() => {
    vi.resetModules()
    findUnique.mockReset()
    findFirst.mockReset()
    caseUpdate.mockReset()
    lawyerAssignmentCreate.mockReset()
    caseActivityCreate.mockReset()
    transaction.mockClear()
  })

  it('rejects non-lawyer roles', async () => {
    findUnique
      .mockResolvedValueOnce({
        id: 'case-1',
        candidateId: 'cand-1',
        assignedAttorneyId: null,
        assignedAttorney: null,
        candidate: { fullLegalName: 'John' },
      })
      .mockResolvedValueOnce({
        id: 'admin-1',
        fullName: 'Not A Lawyer',
        role: 'ADMIN',
        status: 'ACTIVE',
      })

    const { assignCaseLawyer, AssignLawyerError } = await import('@/lib/assign-lawyer')
    await expect(
      assignCaseLawyer({
        caseId: 'case-1',
        lawyerId: 'admin-1',
        actor: {
          id: 'actor-1',
          fullName: 'Ops Admin',
          email: 'a@x.com',
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      }),
    ).rejects.toBeInstanceOf(AssignLawyerError)
  })

  it('no-ops when the same lawyer is already assigned', async () => {
    findUnique.mockResolvedValueOnce({
      id: 'case-1',
      candidateId: 'cand-1',
      assignedAttorneyId: 'law-1',
      assignedAttorney: { id: 'law-1', fullName: 'Sarah Smith' },
      candidate: { fullLegalName: 'John' },
    })

    const { assignCaseLawyer } = await import('@/lib/assign-lawyer')
    const result = await assignCaseLawyer({
      caseId: 'case-1',
      lawyerId: 'law-1',
      actor: {
        id: 'actor-1',
        fullName: 'Ops Admin',
        email: 'a@x.com',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    })
    expect(result.changed).toBe(false)
    expect(result.message).toMatch(/already assigned/i)
    expect(transaction).not.toHaveBeenCalled()
  })

  it('reassigns atomically and writes activity + history', async () => {
    findUnique
      .mockResolvedValueOnce({
        id: 'case-1',
        candidateId: 'cand-1',
        assignedAttorneyId: 'law-a',
        assignedAttorney: { id: 'law-a', fullName: 'Sarah Smith' },
        candidate: { fullLegalName: 'John' },
      })
      .mockResolvedValueOnce({
        id: 'law-b',
        fullName: 'Michael Brown',
        role: 'ATTORNEY',
        status: 'ACTIVE',
      })

    const { assignCaseLawyer } = await import('@/lib/assign-lawyer')
    const result = await assignCaseLawyer({
      caseId: 'case-1',
      lawyerId: 'law-b',
      actor: {
        id: 'actor-1',
        fullName: 'Ops Admin',
        email: 'a@x.com',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    })

    expect(result.changed).toBe(true)
    expect(result.message).toContain('Lawyer reassigned from Sarah Smith to Michael Brown by Ops Admin')
    expect(transaction).toHaveBeenCalled()
    expect(caseUpdate).toHaveBeenCalled()
    expect(lawyerAssignmentCreate).toHaveBeenCalled()
    expect(caseActivityCreate).toHaveBeenCalled()
  })

  it('unassigns and clears access without deleting case data', async () => {
    findUnique.mockResolvedValueOnce({
      id: 'case-1',
      candidateId: 'cand-1',
      assignedAttorneyId: 'law-b',
      assignedAttorney: { id: 'law-b', fullName: 'Michael Brown' },
      candidate: { fullLegalName: 'John' },
    })

    const { assignCaseLawyer } = await import('@/lib/assign-lawyer')
    const result = await assignCaseLawyer({
      caseId: 'case-1',
      lawyerId: null,
      actor: {
        id: 'actor-1',
        fullName: 'Ops Admin',
        email: 'a@x.com',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    })

    expect(result.changed).toBe(true)
    expect(result.nextLawyerId).toBeNull()
    expect(result.message).toMatch(/was unassigned/i)
    expect(caseUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { assignedAttorney: { disconnect: true } },
      }),
    )
    expect(lawyerAssignmentCreate).not.toHaveBeenCalled()
  })
})

describe('canLawyerAccessCandidate', () => {
  beforeEach(() => {
    vi.resetModules()
    findFirst.mockReset()
  })

  it('allows only the currently assigned lawyer', async () => {
    findFirst.mockResolvedValueOnce({ id: 'case-1' })
    const { canLawyerAccessCandidate } = await import('@/lib/assign-lawyer')
    await expect(canLawyerAccessCandidate('law-b', 'cand-1')).resolves.toBe(true)

    findFirst.mockResolvedValueOnce(null)
    await expect(canLawyerAccessCandidate('law-a', 'cand-1')).resolves.toBe(false)
  })
})
