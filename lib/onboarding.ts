import { prisma } from '@/lib/db'
import { ActivityType, logActivity } from '@/lib/activity'
import { randomToken, sha256 } from '@/lib/crypto'
import { appUrl } from '@/lib/http'
import { BRAND_NAME } from '@/lib/brand'
import { sendClientEmail } from '@/lib/email'
import { formatVisa } from '@/lib/visa'
import { resolveVisaTemplate } from '@/lib/visa-templates'
import { onboardingCatalogFor } from '@/lib/onboarding-form'

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000


export async function createOnboardingInvite(input: {
  candidateId: string
  caseId: string
  sentById?: string | null
  sendEmail?: boolean
  recipientEmail: string
}) {
  const caseRow = await prisma.case.findUnique({ where: { id: input.caseId }, select: { visaType: true } })
  if (!caseRow) throw new Error('Case not found')
  const visaLabel = formatVisa(caseRow.visaType)
  const token = randomToken(32)
  const invite = await prisma.onboardingInvite.create({
    data: {
      candidateId: input.candidateId,
      caseId: input.caseId,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  })

  const existing = await prisma.o1OnboardingSubmission.findFirst({
    where: { caseId: input.caseId },
    orderBy: { createdAt: 'desc' },
  })
  if (!existing) {
    await prisma.o1OnboardingSubmission.create({
      data: {
        candidateId: input.candidateId,
        caseId: input.caseId,
        status: 'DRAFT',
        answers: {},
        lastSavedAt: new Date(),
      },
    })
  }

  const url = `${appUrl()}/onboarding/o1a/${token}`
  await prisma.case.update({
    where: { id: input.caseId },
    data: { status: 'ONBOARDING_SENT' },
  })
  await logActivity({
    candidateId: input.candidateId,
    caseId: input.caseId,
    type: ActivityType.ONBOARDING_EMAIL_SENT,
    message: 'Onboarding email sent',
    actorType: input.sentById ? 'ADMIN' : 'SYSTEM',
    actorId: input.sentById,
  })

  if (input.sendEmail) {
    await sendClientEmail({
      candidateId: input.candidateId,
      caseId: input.caseId,
      type: 'ONBOARDING_INVITE',
      to: input.recipientEmail,
      subject: `${BRAND_NAME} — your ${visaLabel} onboarding is ready`,
      text: `Your ${BRAND_NAME} ${visaLabel} onboarding is ready. Use this private link to continue (do not share it):\n\n${url}\n\nThis link is unique to your case.`,
      sentById: input.sentById,
      metadata: { inviteId: invite.id },
    })
  }

  return { invite, url, token }
}

export async function resolveInvite(token: string) {
  const invite = await prisma.onboardingInvite.findUnique({
    where: { tokenHash: sha256(token) },
    include: { candidate: true, case: true },
  })
  if (!invite || invite.revokedAt) return null
  if (invite.expiresAt.getTime() < Date.now()) return null
  return invite
}

export async function getOrCreateDraft(caseId: string, candidateId: string) {
  const existing = await prisma.o1OnboardingSubmission.findFirst({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return existing
  return prisma.o1OnboardingSubmission.create({
    data: { candidateId, caseId, status: 'DRAFT', answers: {}, lastSavedAt: new Date() },
  })
}

/** The onboarding form for this case's visa type (see lib/onboarding-form.ts). */
export async function onboardingCatalogForCase(visaType: string) {
  const template = await resolveVisaTemplate(visaType)
  return onboardingCatalogFor(visaType, template?.items ?? [])
}
