import { AuthError, type AuthUser } from '@/lib/auth'
import { requirePermission } from '@/lib/auth'

export async function requireSuperAdmin(): Promise<AuthUser> {
  const user = await requirePermission('candidates:read')
  if (user.role !== 'SUPER_ADMIN') {
    throw new AuthError('Only Super Admins can manage system backup and restore.', 403)
  }
  return user
}
