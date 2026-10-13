import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { assertCanAccessDocument, isLawyerUser } from '@/lib/lawyer-access'
import { deleteCaseLink, updateCaseLink } from '@/lib/case-links'
import { audit } from '@/lib/activity'
import { LINK_ONLY_ERROR } from '@/lib/link-request-items'

type Ctx = { params: Promise<{ documentId: string }> }

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('documents:write')
    const { documentId } = await ctx.params
    await assertCanAccessDocument(user, documentId)
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) return jsonError(LINK_ONLY_ERROR, 415)
    const body = (await request.json().catch(() => null)) as { url?: string; label?: string } | null
    if (!body || (typeof body.url !== 'string' && typeof body.label !== 'string')) {
      return jsonError('Provide a URL or a link name to update.')
    }
    const link = await updateCaseLink({
      documentId,
      url: typeof body.url === 'string' ? body.url : null,
      label: typeof body.label === 'string' ? body.label : null,
      actorId: user.id,
      actorType: isLawyerUser(user) ? 'LAWYER' : 'ADMIN',
    })
    await audit({
      actorId: user.id,
      action: 'LINK_UPDATED',
      entityType: 'case_document',
      entityId: link.id,
      metadata: { previousDocumentId: documentId, url: link.externalUrl },
    })
    return NextResponse.json({ success: true, link, document: link })
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
    const link = await deleteCaseLink({ documentId, actorId: user.id })
    await audit({
      actorId: user.id,
      action: 'LINK_REMOVED',
      entityType: 'case_document',
      entityId: documentId,
      metadata: { url: link.externalUrl },
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
