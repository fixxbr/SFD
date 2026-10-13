import { PrismaClient } from '@prisma/client'
import { uploadCaseDocument } from '../lib/documents'
import { getPrivateObject } from '../lib/storage'

const prisma = new PrismaClient()

async function main() {
  const candidate = await prisma.candidate.findFirst({
    include: { cases: { where: { lifecycle: 'ACTIVE' }, take: 1 } },
    orderBy: { createdAt: 'desc' },
  })
  if (!candidate?.cases[0]) {
    console.log('No candidate — creating one for upload smoke')
  }
  let candidateId = candidate?.id
  let caseId = candidate?.cases[0]?.id
  let createdTemp = false

  if (!candidateId || !caseId) {
    const { allocateCandidateNumber } = await import('../lib/candidate-number')
    const n = await allocateCandidateNumber()
    const c = await prisma.candidate.create({
      data: {
        candidateNumber: n,
        fullLegalName: 'Upload Smoke',
        normalizedName: 'upload smoke',
        email: `upload-smoke-${Date.now()}@example.com`,
        normalizedEmail: `upload-smoke-${Date.now()}@example.com`,
        source: 'smoke',
        cases: { create: { caseNumber: `SMOKE-${Date.now()}`, visaType: 'O_1A', status: 'DOCUMENT_REVIEW' } },
      },
      include: { cases: true },
    })
    candidateId = c.id
    caseId = c.cases[0]!.id
    createdTemp = true
  }

  const pdf = Buffer.from('%PDF-1.4\n% smoke\n%%EOF\n')
  const doc = await uploadCaseDocument({
    candidateId,
    caseId,
    questionKey: 'additional_evidence',
    category: 'additional',
    documentType: 'passport',
    file: { buffer: pdf, mimeType: 'application/pdf', filename: 'smoke.pdf', size: pdf.length },
    uploadedByType: 'ADMIN',
    append: true,
    description: 'Smoke test PDF upload to Neon storage',
  })
  console.log('upload ok', { id: doc.id, provider: doc.storageProvider, key: doc.storageKey })
  const body = await getPrivateObject(doc.storageKey, doc.storageProvider)
  console.log('read ok', body.body.length)

  if (createdTemp) {
    await prisma.caseDocument.deleteMany({ where: { candidateId } })
    await prisma.storedObject.deleteMany({ where: { key: doc.storageKey } })
    await prisma.case.delete({ where: { id: caseId } })
    await prisma.candidate.delete({ where: { id: candidateId } })
    console.log('cleaned temp candidate')
  } else {
    await prisma.caseDocument.delete({ where: { id: doc.id } })
    await prisma.storedObject.deleteMany({ where: { key: doc.storageKey } })
    console.log('cleaned smoke doc')
  }
}

main()
  .catch((e) => {
    console.error('SMOKE FAIL', e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
