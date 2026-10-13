import { NextResponse } from 'next/server'
import type { EvidenceSection } from '@prisma/client'
import { cookies } from 'next/headers'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { DOC_SESSION_COOKIE, resolveSubmissionSession } from '@/lib/submission-session'
import { createEvidenceEntry } from '@/lib/evidence-entries'
import { EVIDENCE_SECTIONS, sanitizeEvidenceMetadata } from '@/lib/evidence-section-meta'

const SECTIONS = new Set(EVIDENCE_SECTIONS.map((s) => s.key))

/**
 * Candidate-created structured evidence (education, transcripts, employment,
 * licenses, clients). Identity comes only from the document-upload session.
 * These records are the same EvidenceEntry rows admin and lawyers read.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const jar = await cookies()
    const session = await resolveSubmissionSession(jar.get(DOC_SESSION_COOKIE)?.value)
    if (!session) return jsonError('Please verify your Candidate ID and email to continue.', 401)

    const body = (await request.json().catch(() => null)) as {
      section?: EvidenceSection
      title?: string
      subtitle?: string | null
      description?: string | null
      metadata?: unknown
    } | null
    if (!body?.section || !SECTIONS.has(body.section)) return jsonError('Invalid evidence section.')
    const title = body.title?.trim() ?? ''
    if (!title) return jsonError('A name is required for this record.')

    const entry = await createEvidenceEntry({
      candidateId: session.candidateId,
      caseId: session.caseId,
      section: body.section,
      title,
      subtitle: body.subtitle,
      description: body.description,
      metadata: sanitizeEvidenceMetadata(body.metadata),
      actorType: 'CANDIDATE',
    })

    return NextResponse.json({
      entry: {
        id: entry.id,
        section: entry.section,
        title: entry.title,
        subtitle: entry.subtitle,
        description: entry.description,
        metadata: sanitizeEvidenceMetadata(entry.metadata),
        documents: [],
      },
    })
  } catch (error) {
    console.error('[candidate-evidence]', error instanceof Error ? error.message : 'unknown error')
    return handleApiError(error)
  }
}
