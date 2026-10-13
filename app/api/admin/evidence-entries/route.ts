import { NextResponse } from 'next/server'
import type { EvidenceSection } from '@prisma/client'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { prisma } from '@/lib/db'
import {
  createEvidenceEntry,
  deleteEvidenceEntry,
  listEvidenceEntries,
  updateEvidenceEntry,
  EVIDENCE_SECTIONS,
} from '@/lib/evidence-entries'
import { assertCanAccessCase, isLawyerUser } from '@/lib/lawyer-access'
import { sanitizeEvidenceMetadata } from '@/lib/evidence-section-meta'

const SECTIONS = new Set(EVIDENCE_SECTIONS.map((s) => s.key))

export async function GET(request: Request) {
  try {
    const user = await requirePermission('documents:read')
    const url = new URL(request.url)
    const caseId = url.searchParams.get('caseId')
    if (!caseId) return jsonError('caseId is required.')
    await assertCanAccessCase(user, caseId)
    const entries = await listEvidenceEntries(caseId)
    return NextResponse.json({ entries, sections: EVIDENCE_SECTIONS })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('documents:write')
    if (isLawyerUser(user)) return jsonError('Lawyers cannot create evidence entries.', 403)
    const body = (await request.json()) as {
      candidateId?: string
      caseId?: string
      section?: EvidenceSection
      title?: string
      subtitle?: string
      description?: string
      metadata?: unknown
    }
    if (!body.candidateId || !body.caseId || !body.section || !body.title?.trim()) {
      return jsonError('candidateId, caseId, section, and title are required.')
    }
    if (!SECTIONS.has(body.section)) return jsonError('Invalid section.')
    const record = await prisma.case.findFirst({
      where: { id: body.caseId, candidateId: body.candidateId },
      select: { id: true },
    })
    if (!record) return jsonError('Case not found for this candidate.', 404)
    const entry = await createEvidenceEntry({
      candidateId: body.candidateId,
      caseId: body.caseId,
      section: body.section,
      title: body.title,
      subtitle: body.subtitle,
      description: body.description,
      metadata: sanitizeEvidenceMetadata(body.metadata),
      actorId: user.id,
    })
    return NextResponse.json({ entry })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('documents:write')
    if (isLawyerUser(user)) return jsonError('Lawyers cannot edit evidence entries.', 403)
    const body = (await request.json()) as {
      entryId?: string
      title?: string
      subtitle?: string | null
      description?: string | null
    }
    if (!body.entryId) return jsonError('entryId is required.')
    const entry = await updateEvidenceEntry({
      entryId: body.entryId,
      title: body.title,
      subtitle: body.subtitle,
      description: body.description,
      actorId: user.id,
    })
    return NextResponse.json({ entry })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('documents:write')
    if (isLawyerUser(user)) return jsonError('Lawyers cannot delete evidence entries.', 403)
    const body = (await request.json()) as { entryId?: string }
    if (!body.entryId) return jsonError('entryId is required.')
    const entry = await deleteEvidenceEntry({ entryId: body.entryId, actorId: user.id })
    return NextResponse.json({ ok: true, entry })
  } catch (error) {
    return handleApiError(error)
  }
}
