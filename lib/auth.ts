import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import bcrypt from 'bcryptjs'
import type { AdminRole, AdminStatus, AdminUser } from '@prisma/client'
import { prisma } from '@/lib/db'
import { SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/brand'
import { randomToken, sha256 } from '@/lib/crypto'
import { can, type Permission, RbacError } from '@/lib/rbac'

export type AuthUser = {
  id: string
  fullName: string
  email: string
  role: AdminRole
  status: AdminStatus
}

const LOGIN_WINDOW_MS = 15 * 60 * 1000
const MAX_FAILURES_PER_EMAIL = 5
const MAX_FAILURES_PER_IP = 20

export class AuthError extends Error {
  status: number
  constructor(message: string, status = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function clientIp(): Promise<string> {
  const h = await headers()
  const forwarded = h.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() || 'unknown'
  return h.get('x-real-ip') ?? 'unknown'
}

export async function isLoginRateLimited(email: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - LOGIN_WINDOW_MS)
  const [emailFails, ipFails] = await Promise.all([
    prisma.loginAttempt.count({
      where: { email, success: false, createdAt: { gte: since } },
    }),
    prisma.loginAttempt.count({
      where: { ipAddress: ip, success: false, createdAt: { gte: since } },
    }),
  ])
  return emailFails >= MAX_FAILURES_PER_EMAIL || ipFails >= MAX_FAILURES_PER_IP
}

export async function recordLoginAttempt(email: string, ip: string, success: boolean) {
  await prisma.loginAttempt.create({ data: { email, ipAddress: ip, success } })
}

export async function createSession(user: AdminUser, ip: string, userAgent: string | null) {
  const token = randomToken(32)
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS)
  await prisma.adminSession.create({
    data: {
      adminUserId: user.id,
      tokenHash: sha256(token),
      expiresAt,
      ipAddress: ip,
      userAgent,
    },
  })
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  })
  return { token, expiresAt }
}

export async function destroySession(token: string | undefined) {
  if (!token) return
  await prisma.adminSession.deleteMany({ where: { tokenHash: sha256(token) } })
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.adminSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: { adminUser: true },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.adminSession.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  if (session.adminUser.status !== 'ACTIVE') return null

  return {
    id: session.adminUser.id,
    fullName: session.adminUser.fullName,
    email: session.adminUser.email,
    role: session.adminUser.role,
    status: session.adminUser.status,
  }
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getSessionUser()
  if (!user) throw new AuthError('Authentication required')
  return user
}

export async function requirePermission(permission: Permission): Promise<AuthUser> {
  const user = await requireUser()
  if (!can(user.role, permission)) {
    throw new RbacError(`Role ${user.role} cannot ${permission}`)
  }
  return user
}

export async function requireAdminPage(permission: Permission = 'dashboard:read'): Promise<AuthUser> {
  const user = await getSessionUser()
  if (!user) redirect('/admin/login')
  if (user.role === 'ATTORNEY') redirect('/lawyer/candidates')
  if (!can(user.role, permission)) {
    redirect('/admin/candidates?denied=1')
  }
  return user
}

/** Lawyer portal pages — ATTORNEY only. */
export async function requireLawyerPage(): Promise<AuthUser> {
  const user = await getSessionUser()
  if (!user) redirect('/admin/login')
  if (user.role !== 'ATTORNEY') redirect('/admin')
  return user
}

export function toPublicUser(user: AuthUser) {
  return { id: user.id, fullName: user.fullName, email: user.email, role: user.role }
}
