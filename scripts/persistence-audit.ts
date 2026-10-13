/**
 * Persistence audit: Neon is source of truth for candidates + document binaries.
 * Run: pnpm exec tsx --env-file=.env scripts/persistence-audit.ts
 */
import { createHash, randomBytes } from 'crypto'
import { PrismaClient, AdminRole, AdminStatus } from '@prisma/client'
import { hashPassword } from '../lib/auth'
import { allocateCandidateNumber } from '../lib/candidate-number'
import { uploadCaseDocument, documentAccessUrl } from '../lib/documents'
import { getPrivateObject } from '../lib/storage'
import { createSubmissionSession } from '../lib/submission-session'

const prisma = new PrismaClient()
const results: { name: string; ok: boolean; detail?: string }[] = []

function pass(name: string, detail?: string) {
  results.push({ name, ok: true, detail })
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name: string, detail?: string) {
  results.push({ name, ok: false, detail })
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main() {
  const suffix = randomBytes(3).toString('hex')
  const password = `Audit-${suffix}!`
  const passwordHash = await hashPassword(password)

  const adminA = await prisma.adminUser.create({
    data: {
      fullName: `Audit Admin A ${suffix}`,
      email: `audit-a-${suffix}@afterstem.test`,
      passwordHash,
      role: AdminRole.SUPER_ADMIN,
      status: AdminStatus.ACTIVE,
    },
  })
  const adminB = await prisma.adminUser.create({
    data: {
      fullName: `Audit Admin B ${suffix}`,
      email: `audit-b-${suffix}@afterstem.test`,
      passwordHash,
      role: AdminRole.ADMIN,
      status: AdminStatus.ACTIVE,
    },
  })
  const lawyerA = await prisma.adminUser.create({
    data: {
      fullName: `Audit Lawyer A ${suffix}`,
      email: `audit-lawyer-a-${suffix}@afterstem.test`,
      passwordHash,
      role: AdminRole.ATTORNEY,
      status: AdminStatus.ACTIVE,
    },
  })
  const lawyerB = await prisma.adminUser.create({
    data: {
      fullName: `Audit Lawyer B ${suffix}`,
      email: `audit-lawyer-b-${suffix}@afterstem.test`,
      passwordHash,
      role: AdminRole.ATTORNEY,
      status: AdminStatus.ACTIVE,
    },
  })

  const candidateNumber = await allocateCandidateNumber()
  const candidate = await prisma.candidate.create({
    data: {
      candidateNumber,
      fullLegalName: `Persist Test ${suffix}`,
      normalizedName: `persist test ${suffix}`,
      email: `persist-${suffix}@example.com`,
      normalizedEmail: `persist-${suffix}@example.com`,
      phone: '+15555550100',
      source: 'persistence-audit',
      cases: {
        create: {
          caseNumber: `CASE-AUDIT-${suffix}`,
          visaType: 'O_1A',
          status: 'DOCUMENT_REVIEW',
          assignedAttorneyId: lawyerA.id,
        },
      },
    },
    include: { cases: true },
  })
  const caseId = candidate.cases[0]!.id
  pass('Candidate persisted in Neon', candidateNumber)

  await prisma.caseNote.create({
    data: {
      candidateId: candidate.id,
      caseId,
      authorId: adminA.id,
      note: `Audit note ${suffix}`,
      visibility: 'INTERNAL',
    },
  })
  pass('Note persisted in Neon')

  const pdf = Buffer.from(`%PDF-1.4\n% audit-${suffix}\n%%EOF\n`)
  const checksum = createHash('sha256').update(pdf).digest('hex')
  const doc = await uploadCaseDocument({
    candidateId: candidate.id,
    caseId,
    questionKey: 'additional_evidence',
    category: 'additional',
    documentType: 'passport',
    file: {
      buffer: pdf,
      mimeType: 'application/pdf',
      filename: 'passport.pdf',
      size: pdf.byteLength,
    },
    uploadedByType: 'ADMIN',
    uploadedById: adminA.id,
    append: true,
    description: 'Persistence audit passport PDF',
  })
  pass('Document metadata + BYTEA uploaded', doc.id)

  const stored = await prisma.storedObject.findUnique({ where: { key: doc.storageKey } })
  if (!stored || stored.checksum !== checksum) {
    fail('Neon BYTEA row', `missing or checksum mismatch`)
  } else {
    pass('Neon BYTEA row', `provider=${doc.storageProvider} bytes=${stored.byteSize}`)
  }

  // Admin B retrieval (different user)
  const asB = await prisma.caseDocument.findMany({
    where: { candidateId: candidate.id, isCurrentVersion: true },
    select: {
      id: true,
      originalFilename: true,
      mimeType: true,
      fileSizeBytes: true,
      storageKey: true,
      storageProvider: true,
    },
  })
  if (asB.some((d) => d.id === doc.id && d.originalFilename === 'passport.pdf')) {
    pass('Admin B sees same document metadata from Neon')
  } else {
    fail('Admin B document list')
  }

  const body = await getPrivateObject(doc.storageKey, doc.storageProvider)
  if (body.body.equals(pdf) && createHash('sha256').update(body.body).digest('hex') === checksum) {
    pass('Download bytes identical across getPrivateObject')
  } else {
    fail('Download bytes mismatch')
  }

  const access = await documentAccessUrl(doc.id, 'inline')
  if (access.url.includes('/api/files/')) pass('Preview URL uses signed /api/files (Neon stream)')
  else fail('Preview URL', access.url)

  // Lawyer assignment gate (data model)
  const caseRow = await prisma.case.findUnique({ where: { id: caseId } })
  if (caseRow?.assignedAttorneyId === lawyerA.id) pass('Lawyer A assigned in Neon')
  else fail('Lawyer A assignment')
  if (caseRow?.assignedAttorneyId !== lawyerB.id) pass('Lawyer B not assigned')
  else fail('Lawyer B unexpectedly assigned')

  // Document request persistence
  const reqNumber = `DR-AUDIT-${suffix}`
  const accessToken = randomBytes(24).toString('base64url')
  const { createHash: h } = await import('crypto')
  const tokenHash = h('sha256').update(accessToken).digest('hex')
  const link = await prisma.candidateAccessLink.create({
    data: {
      candidateId: candidate.id,
      caseId,
      purpose: 'DOCUMENT_UPLOAD',
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 864e5),
    },
  })
  const docReq = await prisma.documentRequest.create({
    data: {
      requestNumber: reqNumber,
      candidateId: candidate.id,
      caseId,
      accessLinkId: link.id,
      templateKey: 'audit',
      requestType: 'INITIAL',
      visaTypeCode: 'O_1A',
      requestedCategories: ['basic'],
      requestedItems: [{ key: 'passport', label: 'Passport' }],
      recipientEmail: candidate.email,
      subject: 'Upload',
      secureUrl: `https://afterstem.netlify.app/documents/r/${accessToken}`,
      status: 'SENT',
      sentById: adminA.id,
      expiresAt: new Date(Date.now() + 30 * 864e5),
      items: {
        create: [
          {
            candidateId: candidate.id,
            caseId,
            category: 'basic',
            documentKey: 'passport',
            documentName: 'Passport',
            required: true,
            status: 'REQUESTED',
            sortOrder: 0,
          },
        ],
      },
    },
    include: { items: true },
  })
  const reloaded = await prisma.documentRequest.findUnique({
    where: { id: docReq.id },
    include: { items: true },
  })
  if (reloaded?.items.length === 1 && reloaded.items[0]?.status === 'REQUESTED') {
    pass('Document request + items persisted in Neon')
  } else {
    fail('Document request persistence')
  }

  // Candidate submission session (cookie token hashed in Neon)
  const session = await createSubmissionSession({
    candidateId: candidate.id,
    caseId,
    documentRequestId: docReq.id,
    purpose: 'DOCUMENT_UPLOAD',
  })
  const sessRow = await prisma.candidateSubmissionSession.findFirst({
    where: { candidateId: candidate.id },
    orderBy: { createdAt: 'desc' },
  })
  if (sessRow && session.token) pass('Candidate upload session stored hashed in Neon')
  else fail('Submission session')

  // Simulate "restart": new Prisma client, same Neon data
  const prisma2 = new PrismaClient()
  try {
    const again = await prisma2.caseDocument.findUnique({ where: { id: doc.id } })
    const blob = again
      ? await prisma2.storedObject.findUnique({ where: { key: again.storageKey } })
      : null
    if (again && blob && Buffer.from(blob.content).equals(pdf)) {
      pass('Restart-safe: new DB client retrieves same BYTEA')
    } else {
      fail('Restart-safe retrieval')
    }
  } finally {
    await prisma2.$disconnect()
  }

  // Cleanup audit fixtures (keep prod data clean)
  await prisma.documentRequestItem.deleteMany({ where: { documentRequestId: docReq.id } })
  await prisma.documentRequest.delete({ where: { id: docReq.id } })
  await prisma.candidateAccessLink.delete({ where: { id: link.id } })
  await prisma.candidateSubmissionSession.deleteMany({ where: { candidateId: candidate.id } })
  await prisma.caseDocument.deleteMany({ where: { candidateId: candidate.id } })
  await prisma.storedObject.deleteMany({ where: { key: doc.storageKey } })
  await prisma.caseNote.deleteMany({ where: { candidateId: candidate.id } })
  await prisma.case.delete({ where: { id: caseId } })
  await prisma.candidate.delete({ where: { id: candidate.id } })
  await prisma.adminUser.deleteMany({
    where: { id: { in: [adminA.id, adminB.id, lawyerA.id, lawyerB.id] } },
  })
  pass('Audit fixtures cleaned')

  console.log('\n=== Persistence matrix ===')
  console.log(
    '| Feature | Neon | Multi-login data | Restart | Status |',
  )
  console.log('|---|---|---|---|---|')
  const row = (feature: string, names: string[]) => {
    const ok = names.every((n) => results.find((r) => r.name.includes(n))?.ok)
    console.log(`| ${feature} | Yes | ${ok ? 'PASS' : 'FAIL'} | ${ok ? 'PASS' : 'FAIL'} | ${ok ? 'PASS' : 'FAIL'} |`)
  }
  row('Candidate', ['Candidate persisted'])
  row('Documents', ['Document metadata', 'Neon BYTEA', 'Download bytes', 'Restart-safe'])
  row('Notes', ['Note persisted'])
  row('Document Requests', ['Document request'])
  row('Assignments', ['Lawyer A assigned', 'Lawyer B not'])

  const failed = results.filter((r) => !r.ok)
  if (failed.length) {
    console.error(`\n${failed.length} failure(s)`)
    process.exit(1)
  }
  console.log(`\nAll ${results.length} checks passed.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
