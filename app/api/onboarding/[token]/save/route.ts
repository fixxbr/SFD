import { NextResponse } from 'next/server'
import { getOrCreateDraft, resolveInvite } from '@/lib/onboarding'
import { jsonError, handleApiError } from '@/lib/http'
import { prisma } from '@/lib/db'
import { ActivityType, logActivity } from '@/lib/activity'

type Ctx = { params: Promise<{ token: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params
    const invite = await resolveInvite(token)
    if (!invite) return jsonError('This onboarding link is invalid or has expired.', 404)

    const draft = await getOrCreateDraft(invite.caseId, invite.candidateId)
    if (draft.status === 'ACCEPTED') return jsonError('This onboarding has already been accepted.', 409)

    const body = (await request.json()) as { answers?: Record<string, unknown> }
    const updated = await prisma.o1OnboardingSubmission.update({
      where: { id: draft.id },
      data: {
        answers: (body.answers ?? draft.answers) as never,
        lastSavedAt: new Date(),
        status: draft.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT',
      },
    })
    await logActivity({
      candidateId: invite.candidateId,
      caseId: invite.caseId,
      type: ActivityType.DRAFT_SAVED,
      message: 'Onboarding draft saved',
      actorType: 'CANDIDATE',
    })
    return NextResponse.json({ lastSavedAt: updated.lastSavedAt, status: updated.status })
  } catch (error) {
    return handleApiError(error)
  }
}
