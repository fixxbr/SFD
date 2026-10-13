import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/http'
import { assertCanAccessCandidate } from '@/lib/lawyer-access'
import { isLawyerUser } from '@/lib/is-lawyer'
import { assertLawyerCannotDownload } from '@/lib/lawyer-download-policy'
import { can } from '@/lib/rbac'
import { audit } from '@/lib/activity'
import { contentDisposition } from '@/lib/download-names'
import {
  buildCandidateCsv,
  buildCandidateExcel,
  buildCandidatePdf,
  buildCompletePackage,
  buildDocumentsZip,
  type ExportScope,
} from '@/lib/candidate-exports'
import type { EvidenceSection } from '@prisma/client'

type Ctx = { params: Promise<{ candidateId: string }> }

const EVIDENCE_SECTIONS = new Set(['EDUCATION', 'TRANSCRIPT', 'EMPLOYMENT', 'LICENSE', 'CLIENT'])

function scopeFor(user: { role: Parameters<typeof can>[0] }): ExportScope {
  const lawyer = user.role === 'ATTORNEY'
  return {
    includeFinance: !lawyer && can(user.role, 'payments:read'),
    includeNotes: can(user.role, 'notes:read') || can(user.role, 'notes:write'),
    includeCommunications: !lawyer && can(user.role, 'communications:read'),
  }
}

export async function GET(request: Request, ctx: Ctx) {
  try {
    const user = await requirePermission('documents:read')
    const { candidateId } = await ctx.params
    await assertCanAccessCandidate(user, candidateId)
    assertLawyerCannotDownload(user)

    const url = new URL(request.url)
    const type = url.searchParams.get('type') || 'documents-zip'
    const section = url.searchParams.get('section')
    const category = url.searchParams.get('category')
    const scope = scopeFor(user)
    const lawyer = isLawyerUser(user)

    // Lawyers are rejected above. Remaining types are admin downloads only.
    if (lawyer && (type === 'xlsx' || type === 'csv') && url.searchParams.get('finance') === '1') {
      return jsonError('Finance export is not available for Lawyer accounts.', 403)
    }

    let result: { buffer: Buffer; filename: string; contentType?: string }

    switch (type) {
      case 'pdf':
        result = await buildCandidatePdf(candidateId, scope)
        break
      case 'xlsx':
        result = await buildCandidateExcel(candidateId, scope)
        break
      case 'csv':
        result = await buildCandidateCsv(candidateId, scope)
        break
      case 'package':
        if (lawyer) {
          // Still allow package but with lawyer-scoped data (no finance).
        }
        result = await buildCompletePackage(candidateId, scope)
        break
      case 'documents-zip': {
        if (section && EVIDENCE_SECTIONS.has(section)) {
          result = await buildDocumentsZip(candidateId, {
            kind: 'section',
            section: section as EvidenceSection,
          })
        } else if (category) {
          result = await buildDocumentsZip(candidateId, { kind: 'category', category })
        } else {
          result = await buildDocumentsZip(candidateId, { kind: 'all' })
        }
        result = { ...result, contentType: 'application/zip' }
        break
      }
      default:
        return jsonError('Unknown export type.')
    }

    await audit({
      actorId: user.id,
      action: 'CANDIDATE_EXPORT',
      entityType: 'candidate',
      entityId: candidateId,
      metadata: { type, section, category, filename: result.filename },
    })

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': result.contentType || 'application/octet-stream',
        'Content-Disposition': contentDisposition(result.filename),
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    return handleApiError(error)
  }
}
