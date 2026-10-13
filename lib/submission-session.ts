import { prisma } from '@/lib/db'
import { randomToken, sha256 } from '@/lib/crypto'

export const DOC_SESSION_COOKIE = 'as_doc_session'
export const DOC_SESSION_TTL_MS = 4 * 60 * 60 * 1000

export async function createSubmissionSession(input: {
  candidateId: string
  caseId: string
  purpose?: string
  documentRequestId?: string | null
}) {
  const token = randomToken(32)
  const session = await prisma.candidateSubmissionSession.create({
    data: {
      candidateId: input.candidateId,
      caseId: input.caseId,
      documentRequestId: input.documentRequestId ?? null,
      purpose: input.purpose ?? 'DOCUMENT_UPLOAD',
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + DOC_SESSION_TTL_MS),
    },
  })
  return { session, token }
}

export async function resolveSubmissionSession(token: string | undefined | null) {
  if (!token) return null
  const session = await prisma.candidateSubmissionSession.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      candidate: {
        select: {
          id: true,
          candidateNumber: true,
          fullLegalName: true,
          email: true,
        },
      },
      case: {
        select: {
          id: true,
          caseNumber: true,
          visaType: true,
          status: true,
          documents: {
            where: { status: { not: 'REJECTED' } },
            select: {
              id: true,
              questionKey: true,
              documentType: true,
              originalFilename: true,
              displayName: true,
              description: true,
              mimeType: true,
              fileSizeBytes: true,
              version: true,
              status: true,
              isCurrentVersion: true,
              uploadedAt: true,
              evidenceEntryId: true,
            },
            orderBy: { uploadedAt: 'desc' },
          },
        },
      },
      documentRequest: {
        select: {
          id: true,
          requestNumber: true,
          requestType: true,
          requestedItems: true,
          visaTypeCode: true,
          expiresAt: true,
          openedAt: true,
          status: true,
          cancelledAt: true,
        },
      },
    },
  })
  if (!session || session.revokedAt) return null
  if (session.expiresAt.getTime() < Date.now()) return null
  return session
}
