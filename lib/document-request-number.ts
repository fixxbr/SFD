import { prisma } from '@/lib/db'

export async function allocateDocumentRequestNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT nextval('lawfirm_document_request_seq') AS n
  `
  const n = rows[0]?.n
  if (n == null) throw new Error('Unable to allocate a document request number.')
  return `REQ-${n}`
}
