import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { assertCanAccessCandidate, isLawyerUser } from '@/lib/lawyer-access'
import { assertLawyerCannotDownload } from '@/lib/lawyer-download-policy'
import { can } from '@/lib/rbac'
import { audit } from '@/lib/activity'
import { contentDisposition } from '@/lib/download-names'
import { buildBulkExport, type ExportScope } from '@/lib/candidate-exports'

function scopeFor(user: { role: Parameters<typeof can>[0] }): ExportScope {
  const lawyer = user.role === 'ATTORNEY'
  return {
    includeFinance: !lawyer && can(user.role, 'payments:read'),
    includeNotes: can(user.role, 'notes:read') || can(user.role, 'notes:write'),
    includeCommunications: !lawyer && can(user.role, 'communications:read'),
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('documents:read')
    assertLawyerCannotDownload(user)
    const body = (await request.json()) as {
      candidateIds?: string[]
      includeDocuments?: boolean
      includeData?: boolean
    }
    const ids = Array.isArray(body.candidateIds) ? [...new Set(body.candidateIds.filter(Boolean))] : []
    if (ids.length === 0) return jsonError('Select at least one candidate.')
    if (ids.length > 50) return jsonError('You can export up to 50 candidates at a time.')

    for (const id of ids) {
      await assertCanAccessCandidate(user, id)
    }

    const includeDocuments = body.includeDocuments !== false
    const includeData = body.includeData !== false
    if (!includeDocuments && !includeData) return jsonError('Choose data and/or documents to export.')

    const result = await buildBulkExport(ids, scopeFor(user), { includeDocuments, includeData })

    await audit({
      actorId: user.id,
      action: 'CANDIDATE_BULK_EXPORT',
      entityType: 'system',
      metadata: {
        count: ids.length,
        includeDocuments,
        includeData,
        lawyer: isLawyerUser(user),
        filename: result.filename,
      },
    })

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': contentDisposition(result.filename),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
