import { NextResponse } from 'next/server'
import { getOrCreateDraft, onboardingCatalogForCase, resolveInvite } from '@/lib/onboarding'
import { formatVisa } from '@/lib/visa'
import { jsonError, handleApiError } from '@/lib/http'
import { prisma } from '@/lib/db'
import { ActivityType, logActivity } from '@/lib/activity'
import { candidateCanReplaceFile } from '@/lib/candidate-file-rules'

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
    const rows = await prisma.caseDocument.findMany({
      where: { caseId: invite.caseId, isCurrentVersion: true, status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        questionKey: true,
        originalFilename: true,
        status: true,
        version: true,
        uploadedAt: true,
        uploadedByType: true,
        onboardingSubmissionId: true,
        externalUrl: true,
      },
      orderBy: { uploadedAt: 'asc' },
    })
    // Files and links are sent separately: links are never shown as documents.
    const documents = rows
      .filter((row) => !row.externalUrl)
      .map((row) => ({
        id: row.id,
        questionKey: row.questionKey,
        originalFilename: row.originalFilename,
        status: row.status,
        version: row.version,
        uploadedAt: row.uploadedAt,
        // Before Submit the candidate may replace or remove it; after Submit only if staff disapproved it.
        canReplace: candidateCanReplaceFile(row, draft),
      }))
    const links = rows
      .filter((row) => row.externalUrl)
      .map((row) => ({ id: row.id, questionKey: row.questionKey, url: row.externalUrl as string }))

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
      links,
      // The form for this case's own visa type.
      catalog: await onboardingCatalogForCase(invite.case.visaType),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
