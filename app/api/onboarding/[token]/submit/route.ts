import { NextResponse } from 'next/server'
import { getOrCreateDraft, resolveInvite } from '@/lib/onboarding'
import { jsonError, handleApiError } from '@/lib/http'
import { prisma } from '@/lib/db'
import { formatVisa } from '@/lib/visa'
import { ActivityType, logActivity } from '@/lib/activity'

type Ctx = { params: Promise<{ token: string }> }

export async function POST(_request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params
    const invite = await resolveInvite(token)
    if (!invite) return jsonError('This onboarding link is invalid or has expired.', 404)
    const draft = await getOrCreateDraft(invite.caseId, invite.candidateId)
    const updated = await prisma.o1OnboardingSubmission.update({
      where: { id: draft.id },
      data: { status: 'SUBMITTED', submittedAt: new Date(), lastSavedAt: new Date() },
    })
    await prisma.case.update({
      where: { id: invite.caseId },
      data: { status: 'ONBOARDING_SUBMITTED' },
    })
    await logActivity({
      candidateId: invite.candidateId,
      caseId: invite.caseId,
      type: ActivityType.ONBOARDING_SUBMITTED,
      message: `${formatVisa(invite.case.visaType)} onboarding submitted`,
      actorType: 'CANDIDATE',
    })
    return NextResponse.json({ status: updated.status, submittedAt: updated.submittedAt })
  } catch (error) {
    return handleApiError(error)
  }
}
