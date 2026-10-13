import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { handleApiError, jsonError } from '@/lib/http'
import { DOC_SESSION_COOKIE, resolveSubmissionSession } from '@/lib/submission-session'
import { documentAccessUrl } from '@/lib/documents'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ documentId: string }> }

/** Candidate-facing view: session-scoped, never trust body candidate IDs. */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { documentId } = await ctx.params
    const jar = await cookies()
    const session = await resolveSubmissionSession(jar.get(DOC_SESSION_COOKIE)?.value)
    if (!session) return jsonError('Please verify your Candidate ID and email to continue.', 401)

    const document = await prisma.caseDocument.findUnique({ where: { id: documentId } })
    if (!document || document.candidateId !== session.candidateId || document.caseId !== session.caseId) {
      return jsonError('Document not found.', 404)
    }

    const access = await documentAccessUrl(document.id, 'inline')
    return NextResponse.json({ url: access.url, expiresIn: access.expiresIn })
  } catch (error) {
    return handleApiError(error)
  }
}
