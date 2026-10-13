import type { Prisma, VisaType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { logActivity, ActivityType } from '@/lib/activity'
import { normalizeEmail, normalizeName } from '@/lib/normalize'
import { CASE_NUMBER_PREFIX } from '@/lib/visa'
import { allocateCandidateNumber } from '@/lib/candidate-number'

export async function findOrCreateCandidate(input: {
  fullLegalName: string
  email: string
  phone?: string | null
  currentImmigrationStatus?: string | null
  source: string
  currentAddress?: string | null
  nationality?: string | null
}) {
  const normalizedName = normalizeName(input.fullLegalName)
  const normalizedEmail = normalizeEmail(input.email)

  const existing = await prisma.candidate.findUnique({
    where: {
      candidates_normalized_name_email_key: { normalizedName, normalizedEmail },
    },
  })

  if (existing) {
    const data: Prisma.CandidateUpdateInput = {}
    if (input.phone && !existing.phone) data.phone = input.phone
    if (input.currentImmigrationStatus && !existing.currentImmigrationStatus) {
      data.currentImmigrationStatus = input.currentImmigrationStatus
    }
    if (input.currentAddress && !existing.currentAddress) data.currentAddress = input.currentAddress
    if (input.nationality && !existing.nationality) data.nationality = input.nationality
    if (Object.keys(data).length === 0) return { candidate: existing, created: false }
    const updated = await prisma.candidate.update({ where: { id: existing.id }, data })
    return { candidate: updated, created: false }
  }

  const candidate = await prisma.candidate.create({
    data: {
      candidateNumber: await allocateCandidateNumber(),
      fullLegalName: input.fullLegalName.trim().replace(/\s+/g, ' '),
      normalizedName,
      email: input.email.trim(),
      normalizedEmail,
      phone: input.phone?.trim() || null,
      currentImmigrationStatus: input.currentImmigrationStatus?.trim() || null,
      currentAddress: input.currentAddress?.trim() || null,
      nationality: input.nationality?.trim() || null,
      source: input.source,
    },
  })

  await logActivity({
    candidateId: candidate.id,
    type: ActivityType.CANDIDATE_CREATED,
    message: 'Candidate created',
    actorType: 'SYSTEM',
  })

  return { candidate, created: true }
}

export async function nextCaseNumber(visaType: VisaType): Promise<string> {
  const year = new Date().getUTCFullYear()
  const prefix = `${CASE_NUMBER_PREFIX[visaType]}-${year}-`
  const latest = await prisma.case.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  })
  const last = latest ? Number(latest.caseNumber.slice(prefix.length)) : 0
  const next = Number.isFinite(last) ? last + 1 : 1
  return `${prefix}${String(next).padStart(6, '0')}`
}

export async function ensureCase(input: {
  candidateId: string
  visaType: VisaType
  status?: 'ASSESSMENT' | 'QUALIFIED' | 'ONBOARDING_NOT_SENT'
}) {
  const existing = await prisma.case.findFirst({
    where: { candidateId: input.candidateId, lifecycle: 'ACTIVE' },
    orderBy: { createdAt: 'desc' },
  })
  if (existing) return existing

  const caseNumber = await nextCaseNumber(input.visaType)
  const created = await prisma.case.create({
    data: {
      candidateId: input.candidateId,
      caseNumber,
      visaType: input.visaType,
      status: input.status ?? 'ASSESSMENT',
    },
  })
  await logActivity({
    candidateId: input.candidateId,
    caseId: created.id,
    type: ActivityType.CASE_CREATED,
    message: `${created.caseNumber} case created`,
    actorType: 'SYSTEM',
  })
  return created
}

export async function recordAssessment(input: {
  candidateId: string
  submittedData: Prisma.InputJsonValue
  visaRecommendation?: string | null
  result?: string | null
}) {
  const assessment = await prisma.assessment.create({
    data: {
      candidateId: input.candidateId,
      submittedData: input.submittedData,
      visaRecommendation: input.visaRecommendation ?? null,
      result: input.result ?? 'RECEIVED',
    },
  })
  await prisma.candidate.update({
    where: { id: input.candidateId },
    data: { assessmentCompleted: true, assessmentCompletedAt: new Date() },
  })
  await logActivity({
    candidateId: input.candidateId,
    type: ActivityType.ASSESSMENT_SUBMITTED,
    message: 'Assessment submitted',
    actorType: 'CANDIDATE',
    metadata: { assessmentId: assessment.id },
  })
  return assessment
}
