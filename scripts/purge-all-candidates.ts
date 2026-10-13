/**
 * Permanently remove ALL candidates and related Neon data
 * (cases, documents, notes, payments, requests, sessions, etc.)
 * plus stored_objects binaries. Does NOT delete admin users or templates.
 *
 * Run: pnpm exec tsx --env-file=.env scripts/purge-all-candidates.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const before = await prisma.candidate.count()
  const docsBefore = await prisma.caseDocument.count()
  const blobsBefore = await prisma.storedObject.count()

  console.log(`Candidates: ${before}`)
  console.log(`Case documents: ${docsBefore}`)
  console.log(`Stored objects: ${blobsBefore}`)

  if (before === 0 && docsBefore === 0) {
    // Still wipe orphaned blobs / reset sequence
    const orphan = await prisma.storedObject.deleteMany({})
    console.log(`Deleted orphaned stored_objects: ${orphan.count}`)
    await prisma.$executeRawUnsafe(`SELECT setval('lawfirm_candidate_number_seq', 1031, false)`)
    console.log('Candidate number sequence reset to next ASM-1031')
    return
  }

  const docKeys = (
    await prisma.caseDocument.findMany({ select: { storageKey: true } })
  ).map((d) => d.storageKey)

  const receiptKeys = (
    await prisma.paymentReceipt.findMany({
      where: { attachmentStorageKey: { not: null } },
      select: { attachmentStorageKey: true },
    })
  )
    .map((r) => r.attachmentStorageKey)
    .filter((k): k is string => Boolean(k))

  const keys = [...new Set([...docKeys, ...receiptKeys])]

  // Cascade deletes cases, documents, notes, payments, requests, sessions, etc.
  const deletedCandidates = await prisma.candidate.deleteMany({})
  console.log(`Deleted candidates: ${deletedCandidates.count}`)

  // StoredObject has no FK — remove binaries that belonged to candidates + any leftover
  if (keys.length) {
    const byKey = await prisma.storedObject.deleteMany({ where: { key: { in: keys } } })
    console.log(`Deleted stored_objects by key: ${byKey.count}`)
  }
  // Candidate-scoped keys use prefix candidates/{uuid}/...
  const leftoverCandidateBlobs = await prisma.$executeRawUnsafe(`
    DELETE FROM stored_objects
    WHERE key LIKE 'candidates/%'
  `)
  console.log(`Deleted leftover candidate-prefixed blobs: ${leftoverCandidateBlobs}`)

  // Reset ASM sequence so next create is ASM-1031
  await prisma.$executeRawUnsafe(`SELECT setval('lawfirm_candidate_number_seq', 1031, false)`)
  console.log('Candidate number sequence reset — next ID will be ASM-1031')

  const after = {
    candidates: await prisma.candidate.count(),
    cases: await prisma.case.count(),
    documents: await prisma.caseDocument.count(),
    notes: await prisma.caseNote.count(),
    requests: await prisma.documentRequest.count(),
    payments: await prisma.payment.count(),
    sessions: await prisma.candidateSubmissionSession.count(),
    accessLinks: await prisma.candidateAccessLink.count(),
    storedObjects: await prisma.storedObject.count(),
  }
  console.log('Remaining counts:', after)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
