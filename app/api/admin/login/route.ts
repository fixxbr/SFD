import { NextResponse } from 'next/server'
import { SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/brand'
import {
  clientIp,
  createSession,
  isLoginRateLimited,
  recordLoginAttempt,
  verifyPassword,
} from '@/lib/auth'
import { prisma } from '@/lib/db'
import { audit } from '@/lib/activity'
import { handleApiError, jsonError, cookieSecureFromRequest } from '@/lib/http'
import { normalizeEmail } from '@/lib/normalize'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string }
    const email = normalizeEmail(body.email ?? '')
    const password = body.password ?? ''
    const ip = await clientIp()

    if (!email || !password) return jsonError('Email and password are required.')
    if (await isLoginRateLimited(email, ip)) {
      return jsonError('Too many login attempts. Try again in 15 minutes.', 429)
    }

    const user = await prisma.adminUser.findUnique({ where: { email } })
    const valid = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false
    if (!user || user.status !== 'ACTIVE' || !valid) {
      await recordLoginAttempt(email, ip, false)
      return jsonError('Invalid email or password.', 401)
    }

    await recordLoginAttempt(email, ip, true)
    const userAgent = request.headers.get('user-agent')
    const { token, expiresAt } = await createSession(user, ip, userAgent)
    await audit({
      actorId: user.id,
      action: 'LOGIN',
      entityType: 'admin_user',
      entityId: user.id,
      ipAddress: ip,
    })

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role },
    })
    const secure = cookieSecureFromRequest(request)
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    })
    return response
  } catch (error) {
    console.error('[admin-login]', error instanceof Error ? error.message : 'unknown error')
    // Surface common misconfig to operators without leaking internals to clients.
    if (error instanceof Error) {
      if (/DATABASE_URL|Can't reach database|P1001|P1017|ECONNREFUSED|ENOTFOUND/i.test(error.message)) {
        return jsonError('Database connection failed. Check DATABASE_URL on this deploy.', 503)
      }
      if (/Environment variable not found|PrismaClientInitializationError/i.test(error.message)) {
        return jsonError('Server database is not configured for this deploy.', 503)
      }
    }
    return handleApiError(error)
  }
}
