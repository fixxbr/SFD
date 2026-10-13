import { prisma } from '@/lib/db'

/** Full structured export of Afterstem operational data (or one candidate). */
export async function exportAfterstemData(input?: { candidateId?: string }) {
  const where = input?.candidateId ? { id: input.candidateId } : undefined
  const candidates = await prisma.candidate.findMany({
    where,
    orderBy: { candidateNumber: 'asc' },
    include: {
      assessments: true,
      notes: true,
      activities: { orderBy: { createdAt: 'desc' }, take: 500 },
      communications: { orderBy: { sentAt: 'desc' }, take: 500 },
      documentRequests: { orderBy: { sentAt: 'desc' } },
      customDocumentDefs: true,
      documents: { orderBy: [{ questionKey: 'asc' }, { version: 'desc' }] },
      payments: { include: { events: true } },
      cases: {
        include: {
          assignedAttorney: { select: { id: true, fullName: true, email: true, role: true } },
          referredByAdmin: { select: { id: true, fullName: true, email: true, role: true } },
          assignedCaseManager: { select: { id: true, fullName: true, email: true, role: true } },
          payments: { include: { events: true } },
          documents: true,
          notes: true,
          activities: true,
          communications: true,
          documentRequests: true,
          lawyerAssignments: true,
          statusHistory: true,
          onboardingSubmissions: true,
        },
      },
    },
  })

  const team = await prisma.adminUser.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
    },
    orderBy: { fullName: 'asc' },
  })

  return {
    exportedAt: new Date().toISOString(),
    brand: 'Afterstem',
    version: 1,
    team,
    candidates,
  }
}

export async function importAfterstemData(payload: {
  candidates?: Array<{
    fullLegalName: string
    email: string
    phone?: string | null
    source?: string
    cases?: Array<{
      visaType: string
      status?: string
      quotedAmountCents?: number | null
      currency?: string
      referredByName?: string | null
      caseHealth?: string
    }>
  }>
}) {
  const { findOrCreateCandidate, nextCaseNumber } = await import('@/lib/candidates')
  const { parseVisaType } = await import('@/lib/visa')
  const created: string[] = []
  const reused: string[] = []

  for (const row of payload.candidates ?? []) {
    if (!row.fullLegalName || !row.email) continue
    const { candidate, created: wasCreated } = await findOrCreateCandidate({
      fullLegalName: row.fullLegalName,
      email: row.email,
      phone: row.phone,
      source: row.source || 'import',
    })
    if (wasCreated) created.push(candidate.candidateNumber)
    else reused.push(candidate.candidateNumber)

    for (const c of row.cases ?? []) {
      const existing = await prisma.case.findFirst({
        where: { candidateId: candidate.id, lifecycle: 'ACTIVE' },
      })
      if (existing) continue
      const visaType = parseVisaType(c.visaType)
      await prisma.case.create({
        data: {
          candidateId: candidate.id,
          caseNumber: await nextCaseNumber(visaType),
          visaType,
          status: (c.status as never) || 'QUALIFIED',
          quotedAmountCents: c.quotedAmountCents ?? undefined,
          currency: c.currency || 'usd',
          referredByName: c.referredByName ?? undefined,
          caseHealth: (c.caseHealth as never) || undefined,
        },
      })
    }
  }

  return { created, reused, createdCount: created.length, reusedCount: reused.length }
}
