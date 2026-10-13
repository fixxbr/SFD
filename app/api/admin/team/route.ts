import { NextResponse } from 'next/server'
import { AdminRole, AdminStatus } from '@prisma/client'
import { hashPassword, requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, jsonError, assertSameOrigin, appUrl } from '@/lib/http'
import { normalizeEmail } from '@/lib/normalize'
import { audit } from '@/lib/activity'
import { randomToken } from '@/lib/crypto'
import { BRAND_NAME, CLIENT_FROM_EMAIL } from '@/lib/brand'
import { afterstemEmailHtml, textToEmailHtml } from '@/lib/email-html'

const MANAGEABLE_ROLES: AdminRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'CASE_MANAGER',
  'ATTORNEY',
  'FINANCE',
  'READ_ONLY',
]

async function sendTeamInviteEmail(input: {
  to: string
  fullName: string
  temporaryPassword: string
  invitedBy: string
}) {
  const portalUrl = appUrl()
  const subject = `${BRAND_NAME} — your team account invitation`
  const text = `Hi ${input.fullName},

${input.invitedBy} invited you to the ${BRAND_NAME} admin portal.

Sign in: ${portalUrl}/admin/login
Email: ${input.to}
Temporary password: ${input.temporaryPassword}

Please sign in and change your password after first login.

— ${BRAND_NAME} Team`
  if (!process.env.RESEND_API_KEY) return { status: 'LOGGED' as const }
  try {
    const from = process.env.EMAIL_FROM || CLIENT_FROM_EMAIL
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${BRAND_NAME} <${from}>`,
        to: [input.to],
        subject,
        text,
        html: afterstemEmailHtml({
          headline: subject,
          bodyHtml: textToEmailHtml(text),
          ctaLabel: 'Open Admin Login',
          ctaHref: `${portalUrl}/admin/login`,
        }),
      }),
    })
    return { status: res.ok ? ('SENT' as const) : ('FAILED' as const) }
  } catch {
    return { status: 'FAILED' as const }
  }
}

export async function GET() {
  try {
    await requirePermission('team:read')
    const users = await prisma.adminUser.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })
    return NextResponse.json({
      users,
      lawyers: users.filter((u) => u.role === 'ATTORNEY'),
      referrals: users.filter((u) => u.role !== 'ATTORNEY'),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const actor = await requirePermission('team:write')
    const body = (await request.json()) as {
      fullName?: string
      email?: string
      password?: string
      phone?: string
      kind?: 'lawyer' | 'referral' | 'team'
      role?: AdminRole
      status?: AdminStatus
      sendInvite?: boolean
    }
    if (!body.fullName?.trim()) return jsonError('Name is required.')

    const kind = body.kind ?? (body.role === 'ATTORNEY' ? 'lawyer' : 'referral')
    const isLawyer = kind === 'lawyer'
    const role: AdminRole =
      isLawyer
        ? 'ATTORNEY'
        : body.role && MANAGEABLE_ROLES.includes(body.role)
          ? body.role
          : 'CASE_MANAGER'

    if (role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      return jsonError('Only Super Admin can create Super Admin accounts.', 403)
    }

    const name = body.fullName.trim().replace(/\s+/g, ' ')
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '') || 'member'
    const email = body.email?.trim()
      ? normalizeEmail(body.email)
      : isLawyer
        ? ''
        : `referral.${slug}.${randomToken(3)}@afterstem.internal`

    if (isLawyer && !email) return jsonError('Lawyer email is required.')
    if (!email) return jsonError('Email is required.')

    if (body.password && body.password.length > 0 && body.password.length < 10) {
      return jsonError('Password must be at least 10 characters, or leave blank to auto-generate.')
    }

    const temporaryPassword =
      body.password && body.password.length >= 10 ? null : `As-${randomToken(6)}!`
    const password = body.password && body.password.length >= 10 ? body.password : temporaryPassword!

    const user = await prisma.adminUser.create({
      data: {
        fullName: name,
        email,
        passwordHash: await hashPassword(password),
        role,
        status: body.status === 'DISABLED' ? 'DISABLED' : 'ACTIVE',
        authProvider: 'password',
      },
      select: { id: true, fullName: true, email: true, role: true, status: true },
    })
    await audit({
      actorId: actor.id,
      action: isLawyer ? 'LAWYER_CREATE' : 'TEAM_MEMBER_CREATE',
      entityType: 'admin_user',
      entityId: user.id,
      metadata: { kind, phone: body.phone ?? null, role },
    })

    let inviteStatus: 'SENT' | 'LOGGED' | 'FAILED' | null = null
    if (body.sendInvite && temporaryPassword && !email.includes('@afterstem.internal')) {
      const invite = await sendTeamInviteEmail({
        to: email,
        fullName: name,
        temporaryPassword,
        invitedBy: actor.fullName,
      })
      inviteStatus = invite.status
    }

    return NextResponse.json({
      user,
      temporaryPassword: body.email ? temporaryPassword : null,
      kind,
      inviteStatus,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request)
    const actor = await requirePermission('team:write')
    const body = (await request.json()) as {
      id?: string
      fullName?: string
      email?: string
      role?: AdminRole
      status?: AdminStatus
      resetPassword?: boolean
      newPassword?: string
      sendInvite?: boolean
    }
    if (!body.id) return jsonError('Team member id is required.')

    const target = await prisma.adminUser.findUnique({ where: { id: body.id } })
    if (!target) return jsonError('Team member not found', 404)

    if (target.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      return jsonError('Only Super Admin can modify Super Admin accounts.', 403)
    }
    if (body.role === 'SUPER_ADMIN' && actor.role !== 'SUPER_ADMIN') {
      return jsonError('Only Super Admin can assign Super Admin.', 403)
    }

    const wantsPasswordReset = Boolean(body.resetPassword) || Boolean(body.newPassword?.trim())
    if (wantsPasswordReset && actor.role !== 'SUPER_ADMIN') {
      return jsonError('Only Super Admin can reset team passwords.', 403)
    }

    if (body.status === 'DISABLED' && target.role === 'SUPER_ADMIN') {
      const otherSupers = await prisma.adminUser.count({
        where: { role: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: target.id } },
      })
      if (otherSupers === 0) {
        return jsonError('Cannot disable the only active Super Admin.', 400)
      }
    }

    let temporaryPassword: string | null = null
    const data: {
      fullName?: string
      email?: string
      role?: AdminRole
      status?: AdminStatus
      passwordHash?: string
    } = {}
    if (body.fullName?.trim()) data.fullName = body.fullName.trim()
    if (body.email?.trim()) data.email = normalizeEmail(body.email)
    if (body.role && MANAGEABLE_ROLES.includes(body.role)) data.role = body.role
    if (body.status === 'ACTIVE' || body.status === 'DISABLED') data.status = body.status
    if (wantsPasswordReset) {
      const direct = body.newPassword?.trim() || ''
      if (direct) {
        if (direct.length < 10) return jsonError('Password must be at least 10 characters.')
        temporaryPassword = direct
      } else {
        temporaryPassword = `As-${randomToken(6)}!`
      }
      data.passwordHash = await hashPassword(temporaryPassword)
    }

    const user = await prisma.adminUser.update({
      where: { id: target.id },
      data,
      select: { id: true, fullName: true, email: true, role: true, status: true },
    })

    if (wantsPasswordReset) {
      // Force re-login after Super Admin sets a new password
      await prisma.adminSession.deleteMany({ where: { adminUserId: target.id } })
    }

    await audit({
      actorId: actor.id,
      action: 'TEAM_MEMBER_UPDATE',
      entityType: 'admin_user',
      entityId: user.id,
      metadata: {
        role: user.role,
        status: user.status,
        resetPassword: wantsPasswordReset,
        passwordSetDirectly: Boolean(body.newPassword?.trim()),
      },
    })

    let inviteStatus: 'SENT' | 'LOGGED' | 'FAILED' | null = null
    if (body.sendInvite && temporaryPassword) {
      const invite = await sendTeamInviteEmail({
        to: user.email,
        fullName: user.fullName,
        temporaryPassword,
        invitedBy: actor.fullName,
      })
      inviteStatus = invite.status
    }

    return NextResponse.json({
      user,
      temporaryPassword: wantsPasswordReset ? temporaryPassword : null,
      inviteStatus,
      passwordReset: wantsPasswordReset,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request)
    const actor = await requirePermission('team:delete')
    const body = (await request.json()) as { id?: string; confirmEmail?: string }
    if (!body.id) return jsonError('Team member id is required.')

    const target = await prisma.adminUser.findUnique({ where: { id: body.id } })
    if (!target) return jsonError('Team member not found', 404)

    if (target.id === actor.id) {
      return jsonError('You cannot delete your own account.', 400)
    }
    if (target.role === 'SUPER_ADMIN') {
      const otherSupers = await prisma.adminUser.count({
        where: { role: 'SUPER_ADMIN', status: 'ACTIVE', id: { not: target.id } },
      })
      if (otherSupers === 0) {
        return jsonError('Cannot delete the only Super Admin account.', 400)
      }
    }
    if (body.confirmEmail && normalizeEmail(body.confirmEmail) !== normalizeEmail(target.email)) {
      return jsonError('Confirmation email does not match.', 400)
    }

    // Soft-disable preferred; hard delete only when never logged in and no assignments.
    const [casesAsManager, casesAsAttorney, notes] = await Promise.all([
      prisma.case.count({ where: { assignedCaseManagerId: target.id } }),
      prisma.case.count({ where: { assignedAttorneyId: target.id } }),
      prisma.caseNote.count({ where: { authorId: target.id } }),
    ])
    const hasHistory = Boolean(target.lastLoginAt) || casesAsManager + casesAsAttorney + notes > 0

    if (hasHistory) {
      await prisma.adminUser.update({
        where: { id: target.id },
        data: { status: 'DISABLED' },
      })
      await audit({
        actorId: actor.id,
        action: 'TEAM_MEMBER_DISABLED',
        entityType: 'admin_user',
        entityId: target.id,
        metadata: { email: target.email, role: target.role },
      })
      return NextResponse.json({ ok: true, disabled: true, email: target.email })
    }

    await prisma.adminSession.deleteMany({ where: { adminUserId: target.id } })
    await prisma.adminUser.delete({ where: { id: target.id } })
    await audit({
      actorId: actor.id,
      action: 'TEAM_MEMBER_DELETED',
      entityType: 'admin_user',
      entityId: target.id,
      metadata: { email: target.email, role: target.role },
    })
    return NextResponse.json({ ok: true, deleted: true, email: target.email })
  } catch (error) {
    return handleApiError(error)
  }
}
