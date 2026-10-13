import { describe, expect, it } from 'vitest'
import { isLawyerUser } from '@/lib/is-lawyer'
import {
  lawyerAssignedCandidateWhere,
  stripFinanceForLawyer,
} from '@/lib/lawyer-access'
import { formatRole } from '@/lib/role-labels'

describe('lawyer access helpers', () => {
  it('detects lawyer role', () => {
    expect(isLawyerUser({ role: 'ATTORNEY' })).toBe(true)
    expect(isLawyerUser({ role: 'ADMIN' })).toBe(false)
  })

  it('scopes candidates to assigned attorney', () => {
    const where = lawyerAssignedCandidateWhere('lawyer-1')
    expect(where).toEqual({
      cases: {
        some: {
          lifecycle: 'ACTIVE',
          assignedAttorneyId: 'lawyer-1',
        },
      },
    })
  })

  it('strips payment fields from payloads', () => {
    const safe = stripFinanceForLawyer({
      id: 'c1',
      fullLegalName: 'Priya',
      cases: [
        {
          id: 'case1',
          payments: [{ id: 'p1' }],
          quotedAmountCents: 250000,
          paymentReceipts: [{ id: 'r1' }],
          status: 'DOCUMENT_REVIEW',
        },
      ],
    })
    expect(safe.fullLegalName).toBe('Priya')
    const c0 = (safe.cases as Array<Record<string, unknown>>)[0]
    expect(c0.payments).toBeUndefined()
    expect(c0.quotedAmountCents).toBeUndefined()
    expect(c0.paymentReceipts).toBeUndefined()
    expect(c0.status).toBe('DOCUMENT_REVIEW')
  })
})

describe('role labels', () => {
  it('maps ATTORNEY to Lawyer and CASE_MANAGER to Staff', () => {
    expect(formatRole('ATTORNEY')).toBe('Lawyer')
    expect(formatRole('CASE_MANAGER')).toBe('Staff')
    expect(formatRole('SUPER_ADMIN')).toBe('Super Admin')
    expect(formatRole('READ_ONLY')).toBe('Read Only')
  })
})
