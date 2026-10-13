import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { clientIp, isCandidateVerifyRateLimited, recordCandidateVerifyFailure } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin, cookieSecureFromRequest } from '@/lib/http'
import { normalizeEmail } from '@/lib/normalize'
import { normalizeCandidateNumber } from '@/lib/candidate-number'
import { VERIFY_GENERIC_ERROR } from '@/lib/verify-candidate'
import { createSubmissionSession, DOC_SESSION_COOKIE, DOC_SESSION_TTL_MS } from '@/lib/submission-session'
import { findLatestOpenDocumentRequest } from '@/lib/document-request-access'

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const body = (await request.json()) as { candidate_number?: string; email?: string }
    const candidateNumber = normalizeCandidateNumber(String(body.candidate_number ?? ''))
    const email = normalizeEmail(String(body.email ?? ''))
    if (!candidateNumber || !email) return jsonError(VERIFY_GENERIC_ERROR, 401)
    const ip = await clientIp()
    if (await isCandidateVerifyRateLimited(candidateNumber, ip)) {
      return jsonError('Too many attempts. Please wait 15 minutes and try again.', 429)
    }

    const candidate = await prisma.candidate.findUnique({
      where: { candidateNumber },
      include: {
        cases: { where: { lifecycle: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    })
    const currentCase = candidate?.cases[0]
    if (!candidate || candidate.normalizedEmail !== email || !currentCase) {
      await recordCandidateVerifyFailure(candidateNumber, ip)
      return jsonError(VERIFY_GENERIC_ERROR, 401)
    }

    const openRequest = await findLatestOpenDocumentRequest(currentCase.id)
    const { token } = await createSubmissionSession({
      candidateId: candidate.id,
      caseId: currentCase.id,
      documentRequestId: openRequest?.id ?? null,
      purpose: openRequest ? `DOCUMENT_REQUEST:${openRequest.requestNumber}` : 'DOCUMENT_UPLOAD',
    })

    const response = NextResponse.json({
      ok: true,
      firstName: candidate.fullLegalName.split(' ')[0],
      candidateNumber: candidate.candidateNumber,
    })
    response.cookies.set(DOC_SESSION_COOKIE, token, {
      httpOnly: true,
      secure: cookieSecureFromRequest(request),
      sameSite: 'lax',
      path: '/',
      maxAge: Math.floor(DOC_SESSION_TTL_MS / 1000),
    })
    return response
  } catch (error) {
    return handleApiError(error)
  }
}
