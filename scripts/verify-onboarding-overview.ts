/**
 * Read-only: sample Overview status for candidates that have documents or answers.
 *   npx tsx --env-file=.env scripts/verify-onboarding-overview.ts
 */
import { PrismaClient } from '@prisma/client'
import { buildOnboardingOverview } from '../lib/onboarding-overview'

const prisma = new PrismaClient()

async function main() {
  const cases = await prisma.case.findMany({
    where: { lifecycle: 'ACTIVE' },
    orderBy: { updatedAt: 'desc' },
    take: 25,
    include: {
      candidate: { select: { candidateNumber: true, fullLegalName: true } },
      documents: {
        where: { status: { not: 'ARCHIVED' }, isCurrentVersion: true },
        select: {
          id: true,
          questionKey: true,
          originalFilename: true,
          displayName: true,
          description: true,
          mimeType: true,
          status: true,
          version: true,
          isCurrentVersion: true,
          uploadedAt: true,
          fileSizeBytes: true,
          evidenceEntryId: true,
        },
      },
      onboardingSubmissions: { orderBy: { updatedAt: 'desc' }, take: 1 },
      onboardingInvites: { where: { revokedAt: null }, take: 1, select: { id: true } },
    },
  })

  const rows = []
  for (const c of cases) {
    const sub = c.onboardingSubmissions[0]
    const overview = buildOnboardingOverview({
      answers: (sub?.answers as Record<string, unknown>) ?? {},
      documents: c.documents,
      submissionStatus: sub?.status ?? null,
      caseStatus: c.status,
      hasInvite: c.onboardingInvites.length > 0,
    })
    const answered = overview.sections.reduce((n, s) => n + s.answeredCount, 0)
    rows.push({
      candidate: c.candidate.candidateNumber,
      docs: c.documents.length,
      submission: sub?.status ?? null,
      displayStatus: overview.status,
      fieldsWithData: answered,
      wouldShowNotStarted: overview.status === 'NOT_STARTED' && (c.documents.length > 0 || answered > 0),
    })
  }

  console.log(JSON.stringify({ scanned: rows.length, rows }, null, 2))
  const bad = rows.filter((r) => r.wouldShowNotStarted)
  if (bad.length) {
    console.error('BAD_ROWS', bad)
    process.exitCode = 1
  } else {
    console.log('OK: no candidate with docs/answers incorrectly shows NOT_STARTED')
  }
}

main()
  .finally(() => prisma.$disconnect())
