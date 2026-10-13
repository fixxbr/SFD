import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { normalizeEmail } from '@/lib/normalize'
import { ActivityType, audit, logActivity } from '@/lib/activity'
import { revokeCandidateAccessLinks } from '@/lib/client-access'

type Ctx = { params: Promise<{ candidateId: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('candidates:write')
    const { candidateId } = await ctx.params
    const body = (await request.json()) as { email?: string; reason?: string; confirm?: boolean }
    if (!body.email || !body.reason?.trim() || !body.confirm) {
      return jsonError('New email, confirmation, and reason are required.')
    }
    const email = normalizeEmail(body.email)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return jsonError('Invalid email.')

    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
    if (!candidate) return jsonError('Candidate not found', 404)

    const collision = await prisma.candidate.findFirst({
      where: {
        id: { not: candidateId },
        normalizedName: candidate.normalizedName,
        normalizedEmail: email,
      },
    })
    if (collision) {
      return jsonError('Another candidate already uses this name + email pair.', 409)
    }

    const updated = await prisma.candidate.update({
      where: { id: candidateId },
      data: {
        email,
        normalizedEmail: email,
      },
    })

    await revokeCandidateAccessLinks(candidateId)
    await logActivity({
      candidateId,
      type: ActivityType.EMAIL_CHANGED,
      message: `Candidate email changed to ${email}`,
      actorType: 'ADMIN',
      actorId: user.id,
      metadata: { previous: candidate.email, reason: body.reason },
    })
    await audit({
      actorId: user.id,
      action: 'CANDIDATE_EMAIL_CHANGE',
      entityType: 'candidate',
      entityId: candidateId,
      metadata: { previous: candidate.email, reason: body.reason },
    })

    return NextResponse.json({ candidate: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
