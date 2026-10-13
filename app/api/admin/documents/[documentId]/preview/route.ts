import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/http'
import { prisma } from '@/lib/db'
import { audit } from '@/lib/activity'
import { assertCanAccessDocument } from '@/lib/lawyer-access'
import { getPrivateObject } from '@/lib/storage'
import { materializeInlinePreview, previewResponseHeaders } from '@/lib/document-preview'

type Ctx = { params: Promise<{ documentId: string }> }

/**
 * Inline preview stream. Does not use Content-Disposition: attachment.
 * Lawyers are allowed only after assignment + document ownership checks.
 */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requirePermission('documents:read')
    const { documentId } = await ctx.params
    await assertCanAccessDocument(user, documentId)
    const document = await prisma.caseDocument.findUnique({ where: { id: documentId } })
    if (!document || document.status === 'ARCHIVED') return jsonError('Document not found.', 404)

    const stored = await getPrivateObject(document.storageKey, document.storageProvider)
    const filename = document.displayName || document.originalFilename
    const preview = await materializeInlinePreview({
      body: stored.body,
      filename: document.originalFilename,
      documentMimeType: document.mimeType,
      storageContentType: stored.contentType,
    })

    await audit({
      actorId: user.id,
      action: 'DOCUMENT_PREVIEW',
      entityType: 'case_document',
      entityId: document.id,
      metadata: { candidateId: document.candidateId, caseId: document.caseId, inline: true },
    })

    return new NextResponse(new Uint8Array(preview.body), {
      headers: previewResponseHeaders(filename, preview.mimeType),
    })
  } catch (error) {
    console.error('[document-preview]', error instanceof Error ? error.message : 'unknown error')
    return handleApiError(error)
  }
}
