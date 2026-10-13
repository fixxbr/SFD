/**
 * Read-only (default) diagnostic for documents missing from Admin/Lawyer panels.
 *
 *   npx tsx scripts/diagnose-missing-documents.ts
 *   npx tsx scripts/diagnose-missing-documents.ts --repair
 *   npx tsx scripts/diagnose-missing-documents.ts --candidate=<uuid>
 */
import { diagnoseDocumentIntegrity, repairUnambiguousDocumentLinks } from '../lib/document-integrity'
import { prisma } from '../lib/db'

async function main() {
  const args = process.argv.slice(2)
  const repair = args.includes('--repair')
  const candidateArg = args.find((a) => a.startsWith('--candidate='))
  const candidateId = candidateArg?.split('=')[1]

  if (repair) {
    const result = await repairUnambiguousDocumentLinks({
      candidateId,
      dryRun: false,
    })
    console.log(JSON.stringify(result, null, 2))
    return
  }

  const report = await diagnoseDocumentIntegrity({ candidateId })
  console.log(
    JSON.stringify(
      {
        scannedDocuments: report.scannedDocuments,
        scannedStoredObjects: report.scannedStoredObjects,
        issueCount: report.issues.length,
        issues: report.issues,
        note:
          'STORAGE_WITHOUT_METADATA rows are ambiguous and are not auto-repaired. Re-run with --repair only clears dangling evidenceEntryId pointers.',
      },
      null,
      2,
    ),
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
