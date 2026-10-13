/** Client-safe lawyer role helpers (no Prisma). */

export function isLawyerUser(user: { role: string } | null | undefined) {
  return user?.role === 'ATTORNEY'
}
