/**
 * Backfill custom_document_defs for every non-cancelled document request item.
 * Safe to re-run. Does not delete or rewrite existing submissions.
 *
 *   npx tsx scripts/backfill-document-request-defs.ts
 */
import { randomUUID } from 'crypto'
import { prisma } from '../lib/db'

async function main() {
  const requests = await prisma.documentRequest.findMany({
    where: { cancelledAt: null, status: { not: 'CANCELLED' } },
    include: {
      items: true,
      case: { select: { id: true, candidateId: true } },
    },
  })

  let upserts = 0
  for (const req of requests) {
    for (const item of req.items) {
      await prisma.customDocumentDef.upsert({
        where: { caseId_key: { caseId: req.caseId, key: item.documentKey } },
        update: {
          label: item.documentName,
          instructions: item.instructions,
          category: item.category,
        },
        create: {
          id: randomUUID(),
          candidateId: req.candidateId,
          caseId: req.caseId,
          key: item.documentKey,
          label: item.documentName,
          instructions: item.instructions,
          category: item.category,
          createdById: req.sentById,
        },
      })
      upserts += 1
    }
  }

  console.log(`Backfilled ${upserts} custom document defs across ${requests.length} requests.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
