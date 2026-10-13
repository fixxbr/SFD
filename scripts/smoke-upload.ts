import { PrismaClient } from '@prisma/client'
import { createAccessLink } from '../lib/client-access'
import { uploadCaseDocument } from '../lib/documents'
import { getPrivateObject } from '../lib/storage'
import { resolveCandidateUploadUrl } from '../lib/candidate-upload-url'

async function main() {
  const prisma = new PrismaClient()
  const candidate = await prisma.candidate.findFirst({ include: { cases: { take: 1 } } })
  if (!candidate?.cases[0]) {
    console.log('NO_CANDIDATE')
    return
  }
  const caseId = candidate.cases[0].id
  const access = await createAccessLink({
    candidateId: candidate.id,
    caseId,
    purpose: 'DOCUMENT_UPLOAD',
  })
  const url = resolveCandidateUploadUrl(`http://localhost:9999/documents/r/${access.token}`)
  console.log('TOKEN_URL', url)

  const doc = await uploadCaseDocument({
    candidateId: candidate.id,
    caseId,
    questionKey: 'resume',
    category: 'basic',
    documentType: 'resume',
    file: {
      buffer: Buffer.from('%PDF-1.4 smoke'),
      mimeType: 'application/pdf',
      filename: 'smoke-resume.pdf',
      size: 14,
    },
    uploadedByType: 'ADMIN',
    append: true,
    description: 'Smoke test resume PDF',
  })
  const again = await uploadCaseDocument({
    candidateId: candidate.id,
    caseId,
    questionKey: 'resume',
    category: 'basic',
    documentType: 'resume',
    file: {
      buffer: Buffer.from('%PDF-1.4 smoke2'),
      mimeType: 'application/pdf',
      filename: 'smoke-resume.pdf',
      size: 15,
    },
    uploadedByType: 'ADMIN',
    append: true,
    description: 'Smoke test resume PDF replacement/append',
  })
  const a = await getPrivateObject(doc.storageKey)
  const b = await getPrivateObject(again.storageKey)
  console.log(
    'UPLOAD_OK',
    doc.id,
    again.id,
    a.body.length,
    b.body.length,
    doc.storageKey !== again.storageKey,
  )
  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('FAIL', e)
  process.exit(1)
})
