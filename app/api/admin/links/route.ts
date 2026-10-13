import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { assertCanAccessCase, isLawyerUser } from '@/lib/lawyer-access'
import { createCaseLink } from '@/lib/case-links'
import { audit } from '@/lib/activity'
import { LINK_ONLY_ERROR } from '@/lib/link-request-items'

/** Links section: accepts a JSON URL only. Files belong to /api/admin/documents. */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('documents:write')
    const contentType = request.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) return jsonError(LINK_ONLY_ERROR, 415)

    const body = (await request.json().catch(() => null)) as {
      candidateId?: string
      caseId?: string
      url?: string
      label?: string
      note?: string
    } | null
    const candidateId = String(body?.candidateId ?? '')
    const caseId = String(body?.caseId ?? '')
    if (!candidateId || !caseId) return jsonError('Candidate and case are required.')
    if (typeof body?.url !== 'string') return jsonError('A URL is required.')

    const record = await prisma.case.findFirst({ where: { id: caseId, candidateId } })
    if (!record) return jsonError('Case not found for this candidate.', 404)
    if (isLawyerUser(user)) await assertCanAccessCase(user, caseId)

    const link = await createCaseLink({
      candidateId,
      caseId,
      url: body.url,
      label: body.label,
      note: body.note,
      uploadedByType: isLawyerUser(user) ? 'LAWYER' : 'ADMIN',
      uploadedById: user.id,
      visaTypeCode: String(record.visaType),
    })
    await audit({
      actorId: user.id,
      action: 'LINK_ADDED',
      entityType: 'case_document',
      entityId: link.id,
      metadata: { candidateId, caseId, url: link.externalUrl },
    })
    return NextResponse.json({ success: true, link, document: link }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
