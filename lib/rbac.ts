import type { AdminRole } from '@prisma/client'

export type Permission =
  | 'dashboard:read'
  | 'candidates:read'
  | 'candidates:write'
  | 'candidates:archive'
  | 'candidates:view_archived'
  | 'candidates:full_profile'
  | 'cases:read'
  | 'cases:write'
  | 'cases:legal'
  | 'onboarding:read'
  | 'onboarding:write'
  | 'onboarding:review'
  | 'documents:read'
  | 'documents:write'
  | 'documents:review'
  | 'evidence:read'
  | 'notes:read'
  | 'notes:write'
  | 'payments:read'
  | 'payments:write'
  | 'communications:read'
  | 'communications:write'
  | 'activity:read'
  | 'team:read'
  | 'team:write'
  | 'team:delete'
  | 'candidates:purge'
  | 'settings:read'
  | 'settings:write'

const ALL: Permission[] = [
  'dashboard:read',
  'candidates:read',
  'candidates:write',
  'candidates:archive',
  'candidates:view_archived',
  'candidates:full_profile',
  'cases:read',
  'cases:write',
  'cases:legal',
  'onboarding:read',
  'onboarding:write',
  'onboarding:review',
  'documents:read',
  'documents:write',
  'documents:review',
  'evidence:read',
  'notes:read',
  'notes:write',
  'payments:read',
  'payments:write',
  'communications:read',
  'communications:write',
  'activity:read',
  'team:read',
  'team:write',
  'team:delete',
  'candidates:purge',
  'settings:read',
  'settings:write',
]

const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  SUPER_ADMIN: ALL,
  ADMIN: ALL.filter(
    (p) => p !== 'candidates:view_archived' && p !== 'team:delete' && p !== 'candidates:purge',
  ),
  CASE_MANAGER: [
    'dashboard:read',
    'candidates:read',
    'candidates:write',
    'candidates:full_profile',
    'cases:read',
    'cases:write',
    'onboarding:read',
    'onboarding:write',
    'onboarding:review',
    'documents:read',
    'documents:write',
    'documents:review',
    'evidence:read',
    'notes:read',
    'notes:write',
    'communications:read',
    'communications:write',
    'activity:read',
  ],
  ATTORNEY: [
    // Lawyer portal — assigned candidates + document review only.
    'candidates:read',
    'candidates:full_profile',
    'cases:read',
    'cases:legal',
    'onboarding:read',
    'onboarding:review',
    'documents:read',
    'documents:write',
    'documents:review',
    'evidence:read',
    'notes:read',
    'notes:write',
  ],
  FINANCE: [
    'dashboard:read',
    'candidates:read',
    'payments:read',
    'payments:write',
    'communications:read',
    'communications:write',
    'activity:read',
  ],
  READ_ONLY: [
    'dashboard:read',
    'candidates:read',
    'candidates:full_profile',
    'cases:read',
    'onboarding:read',
    'documents:read',
    'evidence:read',
    'notes:read',
    'payments:read',
    'communications:read',
    'activity:read',
    'team:read',
    'settings:read',
  ],
}

export function can(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function assertCan(role: AdminRole, permission: Permission): void {
  if (!can(role, permission)) {
    throw new RbacError(`Role ${role} cannot ${permission}`)
  }
}

export class RbacError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RbacError'
  }
}

export function isWriteRole(role: AdminRole): boolean {
  return role !== 'READ_ONLY'
}
