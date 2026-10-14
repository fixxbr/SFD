import { NextResponse } from 'next/server'
import { getOrCreateDraft, onboardingCatalogForCase, resolveInvite } from '@/lib/onboarding'
import { formatVisa } from '@/lib/visa'
import { jsonError, handleApiError } from '@/lib/http'
import { prisma } from '@/lib/db'
import { ActivityType, logActivity } from '@/lib/activity'

type Ctx = { params: Promise<{ token: string }> }

/** Invite state can change (revoked, visa type changed); never let a browser reuse an old answer. */
function noStore(res: Response) {
  res.headers.set('Cache-Control', 'no-store')
  return res
}

export async function GET(request: Request, ctx: Ctx) {
  return noStore(await getInvite(request, ctx))
}

async function getInvite(_request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params
    const invite = await resolveInvite(token)
    if (!invite) return jsonError('This onboarding link is invalid or has expired.', 404)

    if (!invite.usedAt) {
      await prisma.onboardingInvite.update({ where: { id: invite.id }, data: { usedAt: new Date() } })
      await logActivity({
        candidateId: invite.candidateId,
        caseId: invite.caseId,
        type: ActivityType.ONBOARDING_OPENED,
        message: 'Onboarding opened',
        actorType: 'CANDIDATE',
      })
      if (invite.case.status === 'ONBOARDING_SENT' || invite.case.status === 'ONBOARDING_NOT_SENT') {
        await prisma.case.update({ where: { id: invite.caseId }, data: { status: 'ONBOARDING_IN_PROGRESS' } })
      }
    }

    const draft = await getOrCreateDraft(invite.caseId, invite.candidateId)
    const documents = await prisma.caseDocument.findMany({
      where: { caseId: invite.caseId, isCurrentVersion: true },
      select: {
        id: true,
        questionKey: true,
        originalFilename: true,
        status: true,
        version: true,
        uploadedAt: true,
      },
    })

    return NextResponse.json({
      candidate: {
        fullLegalName: invite.candidate.fullLegalName,
        email: invite.candidate.email,
      },
      caseNumber: invite.case.caseNumber,
      visaType: invite.case.visaType,
      visaLabel: formatVisa(invite.case.visaType),
      submission: {
        id: draft.id,
        status: draft.status,
        answers: draft.answers,
        lastSavedAt: draft.lastSavedAt,
        submittedAt: draft.submittedAt,
      },
      documents,
      // The form for this case's own visa type.
      catalog: await onboardingCatalogForCase(invite.case.visaType),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
