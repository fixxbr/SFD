import { NextResponse } from 'next/server'
import { handleApiError, jsonError } from '@/lib/http'
import { prisma } from '@/lib/db'
import { getSessionUser } from '@/lib/auth'
import { isLawyerUser } from '@/lib/is-lawyer'
import { assertCanAccessDocument } from '@/lib/lawyer-access'
import { assertLawyerCannotDownload } from '@/lib/lawyer-download-policy'
import { getPrivateObject, verifyLocalFileSignature } from '@/lib/storage'
import { contentDisposition } from '@/lib/download-names'

type Ctx = { params: Promise<{ documentId: string }> }

/**
 * Short-lived signed file stream for local-disk / Netlify Blobs storage.
 * Cloud storage uses S3/R2 signed URLs instead.
 */
export async function GET(request: Request, ctx: Ctx) {
  try {
    const { documentId } = await ctx.params
    const url = new URL(request.url)
    const disposition = url.searchParams.get('d') === 'attachment' ? 'attachment' : 'inline'
    const exp = url.searchParams.get('exp') || ''
    const sig = url.searchParams.get('sig') || ''

    if (
      !verifyLocalFileSignature({
        documentId,
        disposition,
        exp,
        sig,
      })
    ) {
      return jsonError('This file link is invalid or has expired.', 403)
    }

    const document = await prisma.caseDocument.findUnique({ where: { id: documentId } })
    if (!document) return jsonError('Document not found.', 404)

    const user = await getSessionUser()
    if (user && isLawyerUser(user)) {
      await assertCanAccessDocument(user, documentId)
      assertLawyerCannotDownload(user)
      return jsonError('You do not have permission to download this document.', 403)
    }

    const { body, contentType } = await getPrivateObject(document.storageKey, document.storageProvider)
    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': contentType || document.mimeType || 'application/octet-stream',
        'Content-Disposition': contentDisposition(document.displayName || document.originalFilename, disposition),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
