import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { QuestionReviewStatus } from '@prisma/client'
import { assertCanAccessCandidate } from '@/lib/lawyer-access'

type Ctx = { params: Promise<{ submissionId: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('onboarding:review')
    const { submissionId } = await ctx.params
    const body = (await request.json()) as {
      status?: 'UNDER_REVIEW' | 'MORE_INFORMATION_REQUIRED' | 'ACCEPTED'
      questionKey?: string
      reviewStatus?: QuestionReviewStatus
      adminNote?: string
    }
    const submission = await prisma.o1OnboardingSubmission.findUnique({ where: { id: submissionId } })
    if (!submission) return jsonError('Submission not found', 404)
    await assertCanAccessCandidate(user, submission.candidateId)

    const answers = (submission.answers ?? {}) as Record<
      string,
      { value?: unknown; urls?: string[]; reviewStatus?: string; adminNote?: string }
    >
    if (body.questionKey) {
      answers[body.questionKey] = {
        ...(answers[body.questionKey] ?? {}),
        reviewStatus: body.reviewStatus ?? answers[body.questionKey]?.reviewStatus,
        adminNote: body.adminNote ?? answers[body.questionKey]?.adminNote,
      }
    }

    const updated = await prisma.o1OnboardingSubmission.update({
      where: { id: submissionId },
      data: {
        answers: answers as never,
        status: body.status ?? submission.status,
        reviewedAt: new Date(),
        reviewedById: user.id,
      },
    })
    return NextResponse.json({ submission: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
