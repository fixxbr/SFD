import type { AdminRole } from '@prisma/client'

/** Product-facing role labels (DB enum ATTORNEY = Lawyer, CASE_MANAGER = Staff). */
export const ROLE_LABELS: Record<AdminRole, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  CASE_MANAGER: 'Staff',
  ATTORNEY: 'Lawyer',
  FINANCE: 'Finance',
  READ_ONLY: 'Read Only',
}

export function formatRole(role: string) {
  return ROLE_LABELS[role as AdminRole] ?? role.replaceAll('_', ' ')
}

/** Roles shown in Team → Add Team Member dropdown. */
export const TEAM_CREATE_ROLES: AdminRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'ATTORNEY',
  'CASE_MANAGER',
  'READ_ONLY',
]
