import { NextResponse } from 'next/server'
import { inspectAccessToken } from '@/lib/client-access'
import { prisma } from '@/lib/db'
import { cookieSecureFromRequest } from '@/lib/http'
import { createSubmissionSession, DOC_SESSION_COOKIE } from '@/lib/submission-session'

type Ctx = { params: Promise<{ token: string }> }

/**
 * Secure email CTA — binds a submission session to the candidate for this request.
 * Ownership comes only from the validated access token (never from query params).
 * Always redirects on the SAME origin as the request so localhost port mismatches
 * cannot break the cookie / page load.
 */
export async function GET(request: Request, ctx: Ctx) {
  const { token } = await ctx.params
  const requestUrl = new URL(request.url)

  const inspected = await inspectAccessToken(token)
  if (!inspected.ok) {
    const dest = new URL('/documents', requestUrl.origin)
    dest.searchParams.set('error', inspected.reason)
    return NextResponse.redirect(dest)
  }

  const link = inspected.link
  if (link.purpose !== 'DOCUMENT_UPLOAD') {
    const dest = new URL('/documents', requestUrl.origin)
    dest.searchParams.set('error', 'invalid')
    return NextResponse.redirect(dest)
  }

  const docRequest = await prisma.documentRequest.findFirst({
    where: {
      accessLinkId: link.id,
      candidateId: link.candidateId,
      caseId: link.caseId,
      cancelledAt: null,
      status: { not: 'CANCELLED' },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!docRequest) {
    // Token is valid but the package was cancelled / removed.
    const dest = new URL('/documents', requestUrl.origin)
    dest.searchParams.set('error', 'inactive')
    return NextResponse.redirect(dest)
  }

  if (docRequest.expiresAt && docRequest.expiresAt.getTime() < Date.now()) {
    const dest = new URL('/documents', requestUrl.origin)
    dest.searchParams.set('error', 'expired')
    return NextResponse.redirect(dest)
  }

  const { token: sessionToken } = await createSubmissionSession({
    candidateId: link.candidateId,
    caseId: link.caseId,
    documentRequestId: docRequest.id,
    purpose: `DOCUMENT_REQUEST:${docRequest.requestNumber}`,
  })

  if (!docRequest.openedAt) {
    await prisma.documentRequest.update({
      where: { id: docRequest.id },
      data: {
        openedAt: new Date(),
        status: docRequest.status === 'READY' || docRequest.status === 'SENT' ? 'OPENED' : docRequest.status,
      },
    })
  }

  const response = NextResponse.redirect(new URL('/documents', requestUrl.origin))
  response.cookies.set(DOC_SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecureFromRequest(request),
    path: '/',
    maxAge: 60 * 60 * 4,
  })
  return response
}
