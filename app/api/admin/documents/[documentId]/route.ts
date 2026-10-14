import { NextResponse } from 'next/server'
import { DocumentStatus } from '@prisma/client'
import { requirePermission, requireUser } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { archiveCaseDocument, documentAccessUrl, reviewDocument } from '@/lib/documents'
import { prisma } from '@/lib/db'
import { audit } from '@/lib/activity'
import { assertCanAccessDocument, isLawyerUser } from '@/lib/lawyer-access'
import { assertLawyerCannotDownload } from '@/lib/lawyer-download-policy'
import { getPrivateObject } from '@/lib/storage'
import { contentDisposition, downloadFilename, safePathSegment } from '@/lib/download-names'

type Ctx = { params: Promise<{ documentId: string }> }

export async function GET(request: Request, ctx: Ctx) {
  try {
    const user = await requirePermission('documents:read')
    const { documentId } = await ctx.params
    await assertCanAccessDocument(user, documentId)
    const document = await prisma.caseDocument.findUnique({
      where: { id: documentId },
      include: { candidate: { select: { candidateNumber: true, fullLegalName: true } } },
    })
    if (!document) return jsonError('Document not found', 404)

    const url = new URL(request.url)
    const wantsDownload = url.searchParams.get('download') === '1' || url.searchParams.get('disposition') === 'attachment'
    const stream = url.searchParams.get('stream') === '1'
    // Lawyers may preview assigned files through the inline preview route only.
    // This endpoint's attachment/stream/signed-URL responses are downloads.
    if (isLawyerUser(user) && (wantsDownload || stream)) assertLawyerCannotDownload(user)
    if (isLawyerUser(user)) {
      return NextResponse.json({
        previewPath: `/api/admin/documents/${document.id}/preview`,
        filename: document.displayName || document.originalFilename,
        mimeType: document.mimeType,
        inline: true,
      })
    }
    const disposition = wantsDownload ? 'attachment' : 'inline'

    await audit({
      actorId: user.id,
      action: wantsDownload ? 'DOCUMENT_DOWNLOAD' : 'DOCUMENT_PREVIEW',
      entityType: 'case_document',
      entityId: document.id,
      metadata: { candidateId: document.candidateId, caseId: document.caseId, stream },
    })

    if (stream && wantsDownload) {
      const { body, contentType } = await getPrivateObject(document.storageKey, document.storageProvider)
      const friendly = downloadFilename(
        [
          document.candidate.candidateNumber,
          safePathSegment(document.candidate.fullLegalName.split(' ')[0] || 'Candidate'),
          document.displayName || document.originalFilename,
        ],
        document.originalFilename.includes('.')
          ? document.originalFilename.split('.').pop()
          : undefined,
      )
      return new NextResponse(new Uint8Array(body), {
        headers: {
          'Content-Type': contentType || document.mimeType || 'application/octet-stream',
          'Content-Disposition': contentDisposition(friendly, 'attachment'),
          'Cache-Control': 'no-store',
        },
      })
    }

    const signed = await documentAccessUrl(document.id, disposition)
    return NextResponse.json(signed)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    // Signed-in check first: anonymous callers get 401, not a body error.
    await requireUser()
    const { documentId } = await ctx.params
    const body = (await request.json()) as {
      status?: DocumentStatus
      adminNote?: string
      displayName?: string
      renameOnly?: boolean
    }

    if (body.renameOnly || (typeof body.displayName === 'string' && !body.status)) {
      const user = await requirePermission('documents:write')
      await assertCanAccessDocument(user, documentId)
      const updated = await prisma.caseDocument.update({
        where: { id: documentId },
        data: { displayName: body.displayName?.trim() || null },
      })
      await audit({
        actorId: user.id,
        action: 'DOCUMENT_RENAME',
        entityType: 'case_document',
        entityId: documentId,
        metadata: { displayName: updated.displayName },
      })
      return NextResponse.json({ document: updated })
    }

    const user = await requirePermission('documents:review')
    await assertCanAccessDocument(user, documentId)
    if (!body.status) return jsonError('Status is required.')
    const updated = await reviewDocument({
      documentId,
      reviewerId: user.id,
      status: body.status as 'ACCEPTED' | 'REJECTED' | 'NEEDS_REPLACEMENT' | 'NOT_APPLICABLE' | 'UNDER_REVIEW',
      adminNote: body.adminNote,
    })
    return NextResponse.json({ document: updated })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('documents:write')
    const { documentId } = await ctx.params
    await assertCanAccessDocument(user, documentId)
    const body = await request.json().catch(() => ({} as { reason?: string; confirmFilename?: string }))
    const document = await prisma.caseDocument.findUnique({ where: { id: documentId } })
    if (!document) return jsonError('Document not found', 404)
    if (body.confirmFilename && body.confirmFilename !== document.originalFilename) {
      return jsonError('Confirmation filename does not match.', 400)
    }
    const updated = await archiveCaseDocument({
      documentId,
      actorId: user.id,
      reason: body.reason ?? null,
    })
    await audit({
      actorId: user.id,
      action: 'DOCUMENT_ARCHIVED',
      entityType: 'case_document',
      entityId: document.id,
      metadata: {
        candidateId: document.candidateId,
        filename: document.originalFilename,
        version: document.version,
      },
    })
    return NextResponse.json({ ok: true, document: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
