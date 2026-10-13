import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { audit } from '@/lib/activity'
import { normalizeName } from '@/lib/normalize'

export async function GET() {
  try {
    const user = await requireUser()
    const record = await prisma.adminUser.findUnique({
      where: { id: user.id },
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
    return NextResponse.json({ user: record })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireUser()
    const body = (await request.json()) as { fullName?: string }
    if (!body.fullName?.trim()) return jsonError('Name is required.')
    const fullName = body.fullName.trim().replace(/\s+/g, ' ')
    const updated = await prisma.adminUser.update({
      where: { id: user.id },
      data: { fullName },
      select: { id: true, fullName: true, email: true, role: true, status: true },
    })
    await audit({
      actorId: user.id,
      action: 'PROFILE_SELF_UPDATE',
      entityType: 'admin_user',
      entityId: user.id,
      metadata: { previousName: user.fullName, normalized: normalizeName(fullName) },
    })
    return NextResponse.json({ user: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
