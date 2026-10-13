import { describe, expect, it } from 'vitest'
import { isLawyerRole, lawyerOptions, referralOptions } from '@/lib/staff-options'

describe('lawyer vs referral staff lists', () => {
  const staff = [
    { id: '1', fullName: 'Sarah Smith', role: 'ATTORNEY' },
    { id: '2', fullName: 'Jonna', role: 'CASE_MANAGER' },
    { id: '3', fullName: 'Alex Rivera', role: 'ADMIN' },
    { id: '4', fullName: 'Super', role: 'SUPER_ADMIN' },
  ]

  it('treats only ATTORNEY as lawyers', () => {
    expect(isLawyerRole('ATTORNEY')).toBe(true)
    expect(isLawyerRole('CASE_MANAGER')).toBe(false)
    expect(lawyerOptions(staff).map((s) => s.fullName)).toEqual(['Sarah Smith'])
  })

  it('keeps referral names separate from lawyers', () => {
    expect(referralOptions(staff).map((s) => s.fullName)).toEqual(['Jonna', 'Alex Rivera', 'Super'])
    expect(referralOptions(staff).some((s) => s.role === 'ATTORNEY')).toBe(false)
  })
})
