/** Split staff for Lawyer vs Referred By — these are different lists. */

export type StaffOption = { id: string; fullName: string; role: string; email?: string }

export function isLawyerRole(role: string) {
  return role === 'ATTORNEY'
}

/** Only attorneys appear in Lawyer / Assigned Lawyer dropdowns. */
export function lawyerOptions(staff: StaffOption[]) {
  return staff.filter((s) => isLawyerRole(s.role))
}

/**
 * Referral / Referred By options — never attorneys.
 * Afterstem team members, partners, and other non-lawyer staff.
 */
export function referralOptions(staff: StaffOption[]) {
  return staff.filter((s) => !isLawyerRole(s.role))
}
