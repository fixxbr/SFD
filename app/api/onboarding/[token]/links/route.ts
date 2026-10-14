import { NextResponse } from 'next/server'
import { getOrCreateDraft, onboardingCatalogForCase, resolveInvite } from '@/lib/onboarding'
import { jsonError, handleApiError, assertSameOrigin } from '@/lib/http'
import { onboardingUrlQuestions, syncOnboardingUrlField } from '@/lib/onboarding-links'

type Ctx = { params: Promise<{ token: string }> }

/** Save the URLs typed into one onboarding URL field as links (checked; never stored as documents). */
export async function POST(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const { token } = await ctx.params
    const invite = await resolveInvite(token)
    if (!invite) return jsonError('This onboarding link is invalid or has expired.', 404)

    const body = (await request.json().catch(() => null)) as { questionKey?: string; value?: string } | null
    const questionKey = String(body?.questionKey ?? '')
    const question = onboardingUrlQuestions(await onboardingCatalogForCase(invite.case.visaType)).find(
      (q) => q.key === questionKey,
    )
    if (!question) return jsonError('Unknown link field.')

    const draft = await getOrCreateDraft(invite.caseId, invite.candidateId)
    const result = await syncOnboardingUrlField({
      candidateId: invite.candidateId,
      caseId: invite.caseId,
      submissionId: draft.id,
      visaTypeCode: String(invite.case.visaType),
      questionKey,
      label: question.label,
      raw: String(body?.value ?? ''),
    })
    return NextResponse.json(result, { status: result.errors.length ? 422 : 200 })
  } catch (error) {
    return handleApiError(error)
  }
}
