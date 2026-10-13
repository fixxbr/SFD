import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, assertSameOrigin, jsonError } from '@/lib/http'
import { exportAfterstemData, importAfterstemData } from '@/lib/data-portability'
import { audit } from '@/lib/activity'
import { assertCanAccessCandidate, isLawyerUser } from '@/lib/lawyer-access'

export async function GET(request: Request) {
  try {
    const user = await requirePermission('candidates:read')
    if (isLawyerUser(user)) {
      return jsonError('You do not have permission to download this data.', 403)
    }
    const url = new URL(request.url)
    const candidateId = url.searchParams.get('candidateId') || undefined
    if (candidateId) await assertCanAccessCandidate(user, candidateId)
    const data = await exportAfterstemData({ candidateId })
    await audit({
      actorId: user.id,
      action: 'DATA_EXPORT',
      entityType: candidateId ? 'candidate' : 'system',
      entityId: candidateId ?? null,
      metadata: { candidateCount: data.candidates.length },
    })
    const filename = candidateId
      ? `afterstem-candidate-${candidateId}.json`
      : `afterstem-export-${new Date().toISOString().slice(0, 10)}.json`
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('candidates:write')
    const body = await request.json()
    if (!body || typeof body !== 'object') return jsonError('Invalid import payload.')
    const result = await importAfterstemData(body)
    await audit({
      actorId: user.id,
      action: 'DATA_IMPORT',
      entityType: 'system',
      metadata: result,
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return handleApiError(error)
  }
}
