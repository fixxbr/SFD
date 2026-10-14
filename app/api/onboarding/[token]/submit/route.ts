import { NextResponse } from 'next/server'
import { getOrCreateDraft, onboardingCatalogForCase, resolveInvite } from '@/lib/onboarding'
import { answerText, onboardingUrlQuestions, syncOnboardingUrlField } from '@/lib/onboarding-links'
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
    // Every URL field is saved as links on submit too (in case a field was never left).
    const answers = (draft.answers ?? {}) as Record<string, unknown>
    const linkErrors: Record<string, string[]> = {}
    for (const q of onboardingUrlQuestions(await onboardingCatalogForCase(invite.case.visaType))) {
      const raw = answerText(answers[q.key])
      if (!raw.trim()) continue
      const result = await syncOnboardingUrlField({
        candidateId: invite.candidateId,
        caseId: invite.caseId,
        submissionId: draft.id,
        visaTypeCode: String(invite.case.visaType),
        questionKey: q.key,
        label: q.label,
        raw,
      })
      if (result.errors.length) linkErrors[q.key] = result.errors
    }
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
    return NextResponse.json({ status: updated.status, submittedAt: updated.submittedAt, linkErrors })
  } catch (error) {
    return handleApiError(error)
  }
}
