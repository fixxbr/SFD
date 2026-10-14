import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { isLawyerUser } from '@/lib/lawyer-access'
import { assertLawyerCannotDownload } from '@/lib/lawyer-download-policy'
import { can } from '@/lib/rbac'
import { audit } from '@/lib/activity'
import {
  applyFolder,
  buildFolderManifest,
  candidateDetailsPdf,
  lawyersNotesPdf,
  onboardingAnswersPdf,
  paymentPlanPdf,
  planFolders,
  quotedAmountPdf,
  type FolderInput,
  type FolderScope,
} from '@/lib/bulk-folders-server'
import { parseDetailsJson } from '@/lib/bulk-folders'

export const runtime = 'nodejs'
export const maxDuration = 60

function scopeFor(role: Parameters<typeof can>[0]): FolderScope {
  return {
    includeFinance: can(role, 'payments:read'),
    includeNotes: can(role, 'notes:read') || can(role, 'notes:write'),
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Download All, folder per candidate.
 * GET            → manifest (the browser then fetches each file and builds the ZIP itself,
 *                  so no single response has to carry every candidate's files).
 * GET ?candidateId&part=details|quote|payment-plan|notes|answers → one summary PDF.
 */
export async function GET(request: Request) {
  try {
    const user = await requirePermission('documents:read')
    assertLawyerCannotDownload(user)
    if (isLawyerUser(user)) return jsonError('You do not have permission to download this data.', 403)
    const url = new URL(request.url)
    const scope = scopeFor(user.role)
    const candidateId = url.searchParams.get('candidateId')
    const part = url.searchParams.get('part')
    if (candidateId || part) {
      if (!candidateId || !UUID.test(candidateId)) return jsonError('Candidate not found.', 404)
      let buffer: Buffer
      switch (part) {
        case 'details':
          buffer = await candidateDetailsPdf(candidateId)
          break
        case 'answers':
          buffer = await onboardingAnswersPdf(candidateId)
          break
        case 'quote':
          if (!scope.includeFinance) return jsonError('You do not have permission to see pricing.', 403)
          buffer = await quotedAmountPdf(candidateId)
          break
        case 'payment-plan':
          if (!scope.includeFinance) return jsonError('You do not have permission to see payments.', 403)
          buffer = await paymentPlanPdf(candidateId)
          break
        case 'notes':
          if (!scope.includeNotes) return jsonError('You do not have permission to see notes.', 403)
          buffer = await lawyersNotesPdf(candidateId)
          break
        default:
          return jsonError('Unknown part.')
      }
      return new NextResponse(new Uint8Array(buffer), {
        headers: { 'Content-Type': 'application/pdf', 'Cache-Control': 'no-store' },
      })
    }
    const ids = (url.searchParams.get('ids') ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => UUID.test(s))
    const candidates = await buildFolderManifest(scope, ids.length ? ids : undefined)
    await audit({
      actorId: user.id,
      action: 'CANDIDATE_BULK_EXPORT',
      entityType: 'system',
      metadata: { kind: 'folders', count: candidates.length, selected: ids.length || null },
    })
    return NextResponse.json({ scope, candidates }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * Bulk Upload.
 * { mode: 'preview', folders: [...] } → what each folder would do (nothing is written).
 * { mode: 'apply', folder: {...} }    → apply one folder (create / update / add notes).
 * Files are uploaded afterwards through the normal document upload, one by one.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('candidates:write')
    if (!can(user.role, 'documents:write') || isLawyerUser(user)) {
      return jsonError('You do not have permission to do that.', 403)
    }
    const body = (await request.json()) as {
      mode?: string
      folders?: Array<{ folder?: unknown; detailsText?: unknown }>
      folder?: { folder?: unknown; detailsText?: unknown }
    }
    const toInput = (raw: { folder?: unknown; detailsText?: unknown } | undefined): FolderInput | null => {
      const folder = typeof raw?.folder === 'string' ? raw.folder.trim().slice(0, 200) : ''
      if (!folder) return null
      if (typeof raw?.detailsText !== 'string' || !raw.detailsText.trim()) return { folder, details: null }
      if (raw.detailsText.length > 200_000) return { folder, details: null, detailsError: 'Candidate_Details.json is too large.' }
      const parsed = parseDetailsJson(raw.detailsText)
      return { folder, details: parsed.details, detailsError: parsed.error ?? null }
    }
    if (body.mode === 'preview') {
      if (!Array.isArray(body.folders) || !body.folders.length) return jsonError('No candidate folders were found in the ZIP.')
      if (body.folders.length > 500) return jsonError('Upload at most 500 candidate folders at a time.')
      const inputs = body.folders.map(toInput).filter((x): x is FolderInput => Boolean(x))
      return NextResponse.json({ plans: await planFolders(inputs) })
    }
    if (body.mode === 'apply') {
      const input = toInput(body.folder)
      if (!input) return jsonError('Folder name is required.')
      const result = await applyFolder(input, { id: user.id, canWriteNotes: can(user.role, 'notes:write') })
      if (result.applied.length) {
        await audit({
          actorId: user.id,
          action: 'CANDIDATE_BULK_IMPORT',
          entityType: 'candidate',
          entityId: result.candidateId,
          metadata: { folder: input.folder, action: result.action, applied: result.applied },
        })
      }
      return NextResponse.json({ result })
    }
    return jsonError('mode must be "preview" or "apply".')
  } catch (error) {
    return handleApiError(error)
  }
}
