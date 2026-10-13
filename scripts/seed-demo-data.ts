/**
 * Seed demo team members + 5 fake candidates for local play.
 * Safe to re-run: upserts team by email; skips existing candidate name+email pairs.
 */
import { PrismaClient, AdminRole, CaseStatus, VisaType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const TEAM = [
  { fullName: 'Sarah Smith', email: 'sarah.smith@afterstem.ai', role: AdminRole.ATTORNEY },
  { fullName: 'Jonna', email: 'jonna@afterstem.ai', role: AdminRole.CASE_MANAGER },
  { fullName: 'Alex Rivera', email: 'alex.rivera@afterstem.ai', role: AdminRole.ADMIN },
]

const STUDENTS: Array<{
  fullLegalName: string
  email: string
  phone: string
  visaType: VisaType
  quotedDollars: number
  status: CaseStatus
  paidInstallments: number
  referredBy: 'jonna' | 'alex'
  lawyer: 'sarah' | null
  note: string
}> = [
  {
    fullLegalName: 'Thanuja Narameta',
    email: 'thanuja.demo@example.com',
    phone: '+1 415 555 0101',
    visaType: 'O_1A',
    quotedDollars: 20000,
    status: 'EVIDENCE_BUILDING',
    paidInstallments: 2,
    referredBy: 'jonna',
    lawyer: 'sarah',
    note: 'Demo candidate — waiting on updated I-797.',
  },
  {
    fullLegalName: 'John Smith',
    email: 'john.smith.demo@example.com',
    phone: '+1 212 555 0142',
    visaType: 'O_1A',
    quotedDollars: 18000,
    status: 'QUALIFIED',
    paidInstallments: 1,
    referredBy: 'jonna',
    lawyer: 'sarah',
    note: 'Demo candidate — documentation request next.',
  },
  {
    fullLegalName: 'Rahul Patel',
    email: 'rahul.patel.demo@example.com',
    phone: '+1 408 555 0199',
    visaType: 'EB_1A',
    quotedDollars: 22000,
    status: 'ONBOARDING_IN_PROGRESS',
    paidInstallments: 0,
    referredBy: 'alex',
    lawyer: 'sarah',
    note: 'Demo candidate — onboarding in progress.',
  },
  {
    fullLegalName: 'Maria Garcia',
    email: 'maria.garcia.demo@example.com',
    phone: '+1 310 555 0177',
    visaType: 'O_1B',
    quotedDollars: 16000,
    status: 'PETITION_DRAFTING',
    paidInstallments: 3,
    referredBy: 'jonna',
    lawyer: 'sarah',
    note: 'Demo candidate — pre-filing nearly complete.',
  },
  {
    fullLegalName: 'Wei Chen',
    email: 'wei.chen.demo@example.com',
    phone: '+1 617 555 0133',
    visaType: 'EB_2_NIW',
    quotedDollars: 15000,
    status: 'ASSESSMENT',
    paidInstallments: 0,
    referredBy: 'alex',
    lawyer: null,
    note: 'Demo candidate — assessment stage.',
  },
]

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}
function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

async function allocateCandidateNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT nextval('lawfirm_candidate_number_seq') AS n
  `
  return `ASM-${rows[0].n}`
}

async function nextCaseNumber(visaType: VisaType): Promise<string> {
  const map: Record<VisaType, string> = {
    O_1A: 'O1A',
    O_1B: 'O1B',
    EB_1A: 'EB1A',
    EB_2_NIW: 'NIW',
    EB_5: 'EB5',
    H_1B: 'H1B',
    L_1A: 'L1A',
    L_1B: 'L1B',
    OTHER: 'GEN',
  }
  const year = new Date().getUTCFullYear()
  const prefix = `${map[visaType]}-${year}-`
  const latest = await prisma.case.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  })
  const last = latest ? Number(latest.caseNumber.slice(prefix.length)) : 0
  return `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(6, '0')}`
}

async function upsertTeam() {
  const passwordHash = await bcrypt.hash('AfterstemDemo1!', 12)
  const byKey: Record<string, { id: string; fullName: string }> = {}
  for (const member of TEAM) {
    const user = await prisma.adminUser.upsert({
      where: { email: member.email },
      update: { fullName: member.fullName, role: member.role, status: 'ACTIVE', passwordHash },
      create: {
        fullName: member.fullName,
        email: member.email,
        role: member.role,
        status: 'ACTIVE',
        passwordHash,
        authProvider: 'password',
      },
    })
    const key = member.fullName.toLowerCase().includes('sarah')
      ? 'sarah'
      : member.fullName.toLowerCase().includes('jonna')
        ? 'jonna'
        : 'alex'
    byKey[key] = { id: user.id, fullName: user.fullName }
    console.log(`Team: ${user.fullName} <${user.email}> (${user.role})`)
  }
  return byKey
}

async function seedStudent(
  student: (typeof STUDENTS)[number],
  team: Record<string, { id: string; fullName: string }>,
  actorId: string,
) {
  const normalizedName = normalizeName(student.fullLegalName)
  const normalizedEmail = normalizeEmail(student.email)
  const existing = await prisma.candidate.findUnique({
    where: { candidates_normalized_name_email_key: { normalizedName, normalizedEmail } },
  })

  if (existing) {
    const hasCase = await prisma.case.findFirst({ where: { candidateId: existing.id, lifecycle: 'ACTIVE' } })
    if (hasCase) {
      console.log(`Skip existing: ${existing.candidateNumber} ${existing.fullLegalName}`)
      return existing
    }
    console.log(`Repairing case for ${existing.candidateNumber} ${existing.fullLegalName}`)
  }

  const lawyer = student.lawyer ? team[student.lawyer] : null
  const referrer = team[student.referredBy]
  const quotedAmountCents = student.quotedDollars * 100
  const preFiling = Math.round(quotedAmountCents * 0.75)
  const p1 = Math.floor(preFiling / 3)
  const p2 = Math.floor(preFiling / 3)
  const p3 = preFiling - p1 - p2
  const p4 = quotedAmountCents - preFiling
  const amounts = [p1, p2, p3, p4]

  const candidate =
    existing ??
    (await prisma.candidate.create({
      data: {
        candidateNumber: await allocateCandidateNumber(),
        fullLegalName: student.fullLegalName,
        normalizedName,
        email: student.email,
        normalizedEmail,
        phone: student.phone,
        source: 'seed_demo',
      },
    }))

  const caseRow = await prisma.case.create({
    data: {
      candidateId: candidate.id,
      caseNumber: await nextCaseNumber(student.visaType),
      visaType: student.visaType,
      status: student.status,
      quotedAmountCents,
      currency: 'usd',
      quotedAmountUpdatedById: actorId,
      quotedAmountLockedAt: new Date(),
      assignedAttorneyId: lawyer?.id,
      referredByAdminId: referrer?.id,
      referredByName: referrer?.fullName,
      referralType: 'TEAM_MEMBER',
      referredAt: new Date(),
      caseHealth: student.paidInstallments >= 2 ? 'ON_TRACK' : 'WAITING_ON_CANDIDATE',
    },
  })

  if (lawyer) {
    await prisma.lawyerAssignment.create({
      data: { caseId: caseRow.id, lawyerId: lawyer.id, assignedById: actorId },
    })
  }

  for (let i = 0; i < 4; i += 1) {
    const paid = i < student.paidInstallments
    await prisma.payment.create({
      data: {
        candidateId: candidate.id,
        caseId: caseRow.id,
        installmentNumber: i + 1,
        amountCents: amounts[i],
        currency: 'usd',
        status: paid ? 'PAID' : 'READY',
        paidAt: paid ? new Date() : undefined,
        paidAmountCents: paid ? amounts[i] : undefined,
        paymentMethodType: paid ? 'Stripe' : undefined,
        referenceId: paid ? `demo_pi_${candidate.candidateNumber}_${i + 1}` : undefined,
        confirmedById: paid ? actorId : undefined,
        confirmedSource: paid ? 'ADMIN' : undefined,
        createdById: actorId,
      },
    })
  }

  await prisma.caseNote.create({
    data: {
      candidateId: candidate.id,
      caseId: caseRow.id,
      authorId: actorId,
      note: student.note,
      visibility: 'INTERNAL',
      isPinned: student.fullLegalName.startsWith('Thanuja'),
    },
  })

  await prisma.caseActivity.create({
    data: {
      candidateId: candidate.id,
      caseId: caseRow.id,
      type: 'CANDIDATE_CREATED',
      message: `Demo seed created ${candidate.candidateNumber}`,
      actorType: 'SYSTEM',
    },
  })

  console.log(`Candidate: ${candidate.candidateNumber} ${candidate.fullLegalName} (${caseRow.caseNumber})`)
  return candidate
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  const team = await upsertTeam()
  const actor =
    (await prisma.adminUser.findFirst({ where: { role: 'SUPER_ADMIN' } })) ??
    (await prisma.adminUser.findFirst({ where: { status: 'ACTIVE' } }))
  if (!actor) throw new Error('No admin user found. Run create-super-admin first.')

  for (const student of STUDENTS) {
    await seedStudent(student, team, actor.id)
  }
  console.log('Done. Team password for demo accounts: AfterstemDemo1!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
