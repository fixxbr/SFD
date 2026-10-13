import { describe, expect, it } from 'vitest'
import { can } from '@/lib/rbac'

describe('admin RBAC', () => {
  it('gives SUPER_ADMIN every control including archived records', () => {
    expect(can('SUPER_ADMIN', 'documents:review')).toBe(true)
    expect(can('SUPER_ADMIN', 'payments:write')).toBe(true)
    expect(can('SUPER_ADMIN', 'candidates:view_archived')).toBe(true)
    expect(can('SUPER_ADMIN', 'team:write')).toBe(true)
  })

  it('lets CASE_MANAGER work candidates/onboarding/documents/notes but not payments', () => {
    expect(can('CASE_MANAGER', 'candidates:write')).toBe(true)
    expect(can('CASE_MANAGER', 'onboarding:review')).toBe(true)
    expect(can('CASE_MANAGER', 'documents:write')).toBe(true)
    expect(can('CASE_MANAGER', 'notes:write')).toBe(true)
    expect(can('CASE_MANAGER', 'payments:write')).toBe(false)
    expect(can('CASE_MANAGER', 'team:write')).toBe(false)
  })

  it('limits FINANCE to payments plus identity read', () => {
    expect(can('FINANCE', 'payments:write')).toBe(true)
    expect(can('FINANCE', 'candidates:read')).toBe(true)
    expect(can('FINANCE', 'candidates:full_profile')).toBe(false)
    expect(can('FINANCE', 'documents:read')).toBe(false)
  })

  it('blocks document mutations for READ_ONLY', () => {
    expect(can('READ_ONLY', 'documents:read')).toBe(true)
    expect(can('READ_ONLY', 'documents:write')).toBe(false)
    expect(can('READ_ONLY', 'documents:review')).toBe(false)
    expect(can('READ_ONLY', 'notes:write')).toBe(false)
  })

  it('limits Lawyer (ATTORNEY) to assigned-candidate workspace permissions', () => {
    expect(can('ATTORNEY', 'cases:legal')).toBe(true)
    expect(can('ATTORNEY', 'documents:review')).toBe(true)
    expect(can('ATTORNEY', 'documents:read')).toBe(true)
    expect(can('ATTORNEY', 'evidence:read')).toBe(true)
    expect(can('ATTORNEY', 'payments:write')).toBe(false)
    expect(can('ATTORNEY', 'payments:read')).toBe(false)
    expect(can('ATTORNEY', 'team:read')).toBe(false)
    expect(can('ATTORNEY', 'settings:read')).toBe(false)
    expect(can('ATTORNEY', 'dashboard:read')).toBe(false)
    expect(can('ATTORNEY', 'communications:read')).toBe(false)
    expect(can('ATTORNEY', 'documents:write')).toBe(true)
    expect(can('ATTORNEY', 'candidates:archive')).toBe(false)
  })

  it('lets ADMIN manage team members but not purge or delete team', () => {
    expect(can('ADMIN', 'team:write')).toBe(true)
    expect(can('ADMIN', 'candidates:archive')).toBe(true)
    expect(can('ADMIN', 'candidates:view_archived')).toBe(false)
    expect(can('ADMIN', 'team:delete')).toBe(false)
    expect(can('ADMIN', 'candidates:purge')).toBe(false)
  })

  it('reserves team delete and candidate purge for SUPER_ADMIN', () => {
    expect(can('SUPER_ADMIN', 'team:delete')).toBe(true)
    expect(can('SUPER_ADMIN', 'candidates:purge')).toBe(true)
  })
})
