import { NextResponse } from 'next/server'
import { getOrCreateDraft, resolveInvite } from '@/lib/onboarding'
import { jsonError, handleApiError } from '@/lib/http'
import { prisma } from '@/lib/db'
import { ActivityType, logActivity } from '@/lib/activity'
import { O1_CATEGORIES } from '@/lib/onboarding-catalog'

type Ctx = { params: Promise<{ token: string }> }

export async function GET(_request: Request, ctx: Ctx) {
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
      submission: {
        id: draft.id,
        status: draft.status,
        answers: draft.answers,
        lastSavedAt: draft.lastSavedAt,
        submittedAt: draft.submittedAt,
      },
      documents,
      catalog: O1_CATEGORIES,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
