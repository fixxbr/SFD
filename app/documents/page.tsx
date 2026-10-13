import { cookies } from 'next/headers'
import { DocumentsPortal } from '@/components/client/documents-portal'
import { DOC_SESSION_COOKIE, resolveSubmissionSession } from '@/lib/submission-session'
import { formatVisa } from '@/lib/visa'
import { groupItemsForPortal, type RequestedDocItem } from '@/lib/document-request-items'
import { prisma } from '@/lib/db'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsTicker } from '@/components/news-ticker'
import { resolveLinkInputKind } from '@/lib/link-request-items'
import { sanitizeEvidenceMetadata } from '@/lib/evidence-section-meta'
import { ensureSessionDocumentRequest } from '@/lib/document-request-access'
import { isAdditionalEvidenceKey, OTHER_SUPPORTING_DOCUMENT_KEY } from '@/lib/document-keys'

export const metadata = { title: 'Submit documents | Afterstem.ai' }

function parseItems(raw: unknown): RequestedDocItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  return raw as RequestedDocItem[]
}

function ensureOtherSupportingSlot(items: RequestedDocItem[]): RequestedDocItem[] {
  if (items.some((item) => isAdditionalEvidenceKey(item.key))) return items
  return [
    ...items,
    {
      key: OTHER_SUPPORTING_DOCUMENT_KEY,
      label: 'Other supporting document',
      category: 'additional',
      instructions:
        'Upload any supporting document that does not fit another category. Add a clear description for each file.',
      source: 'custom',
      inputKind: 'file',
    },
  ]
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = (await searchParams) ?? {}
  const errorKey = typeof sp.error === 'string' ? sp.error : Array.isArray(sp.error) ? sp.error[0] : ''
  const linkError =
    errorKey === 'invalid'
      ? 'This document request link is invalid.'
      : errorKey === 'revoked'
        ? 'This document request link has been revoked.'
        : errorKey === 'expired'
          ? 'This document request link has expired. Ask Afterstem for a new secure link.'
          : errorKey === 'inactive'
            ? 'This document request is no longer active.'
            : errorKey
              ? "We couldn't load your document request. Please try again."
              : ''

  const jar = await cookies()
  const session = await resolveSubmissionSession(jar.get(DOC_SESSION_COOKIE)?.value)
  const boundRequestId = session ? await ensureSessionDocumentRequest(session) : null
  const boundRequest = boundRequestId
    ? await prisma.documentRequest.findUnique({
        where: { id: boundRequestId },
        select: {
          id: true,
          requestNumber: true,
          requestedItems: true,
        },
      })
    : null

  const previousDocuments =
    session?.case.documents
      .filter((d) => !d.evidenceEntryId)
      .map((d) => ({
        id: d.id,
        questionKey: d.questionKey,
        documentType: d.documentType,
        originalFilename: d.displayName || d.originalFilename,
        description: d.description ?? null,
        mimeType: d.mimeType,
        fileSizeBytes: d.fileSizeBytes,
        version: d.version,
        status: d.status,
        isCurrentVersion: d.isCurrentVersion,
        uploadedAt: d.uploadedAt.toISOString(),
      })) ?? []

  const docsForSlots = (session?.case.documents ?? []).filter((d) => d.isCurrentVersion && !d.evidenceEntryId)
  const filesByKey = new Map<string, typeof docsForSlots>()
  for (const d of docsForSlots) {
    const list = filesByKey.get(d.questionKey) ?? []
    list.push(d)
    filesByKey.set(d.questionKey, list)
  }
  const currentByKey = new Map(docsForSlots.map((d) => [d.questionKey, d]))
  const requestItemsMeta = parseItems(boundRequest?.requestedItems ?? session?.documentRequest?.requestedItems)

  function slotPayload(q: {
    key: string
    label: string
    instructions?: string | null
    help?: string | null
    inputKind?: 'file' | 'url' | 'urls'
    requestStatus?: string | null
  }) {
    const files = (filesByKey.get(q.key) ?? []).map((d) => ({
      id: d.id,
      originalFilename: d.displayName || d.originalFilename,
      description: d.description ?? null,
      version: d.version,
      uploadedAt: d.uploadedAt.toISOString(),
      fileSizeBytes: d.fileSizeBytes,
      status: d.status,
    }))
    const current = currentByKey.get(q.key)
    const meta = requestItemsMeta?.find((m) => m.key === q.key)
    return {
      key: q.key,
      label: q.label,
      help: q.instructions ?? q.help ?? null,
      inputKind: q.inputKind ?? meta?.inputKind ?? resolveLinkInputKind(q.key),
      requestStatus: q.requestStatus ?? null,
      files,
      current: current
        ? {
            id: current.id,
            originalFilename: current.displayName || current.originalFilename,
            description: current.description ?? null,
            version: current.version,
            uploadedAt: current.uploadedAt.toISOString(),
            fileSizeBytes: current.fileSizeBytes,
          }
        : null,
    }
  }

  let categories: Array<{ id: string; title: string; questions: ReturnType<typeof slotPayload>[] }> = []
  if (session) {
    const dbItems = boundRequestId
      ? await prisma.documentRequestItem.findMany({
          where: { documentRequestId: boundRequestId },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        })
      : []
    if (dbItems.length > 0) {
      const asRequested: RequestedDocItem[] = ensureOtherSupportingSlot(
        dbItems.map((i) => {
          const meta = requestItemsMeta?.find((m) => m.key === i.documentKey)
          return {
            key: i.documentKey,
            label: i.documentName,
            category: i.category,
            instructions: i.instructions,
            source: meta?.source ?? (i.templateItemId ? 'catalog' : 'custom'),
            inputKind: meta?.inputKind ?? resolveLinkInputKind(i.documentKey),
            requestStatus: i.status,
          }
        }),
      )
      categories = groupItemsForPortal(asRequested).map((cat) => ({
        id: cat.id,
        title: cat.title,
        questions: cat.questions.map((q) => slotPayload(q)),
      }))
    } else {
      const requestItems = requestItemsMeta
      categories = groupItemsForPortal(ensureOtherSupportingSlot(requestItems ?? [])).map((cat) => ({
        id: cat.id,
        title: cat.title,
        questions: cat.questions.map((q) => slotPayload(q)),
      }))
    }
  }

  const evidenceRows = session
    ? await prisma.evidenceEntry.findMany({
        where: { caseId: session.caseId },
        orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          documents: {
            where: { status: { not: 'ARCHIVED' } },
            orderBy: { uploadedAt: 'desc' },
            select: {
              id: true,
              originalFilename: true,
              displayName: true,
              description: true,
              mimeType: true,
              uploadedAt: true,
              fileSizeBytes: true,
              status: true,
            },
          },
        },
      })
    : []

  const initialSession = session
    ? {
        firstName: session.candidate.fullLegalName.split(' ')[0] ?? '',
        visaLabel: formatVisa(session.case.visaType),
        candidateNumber: session.candidate.candidateNumber,
        requestNumber: boundRequest?.requestNumber ?? session.documentRequest?.requestNumber ?? null,
        categories,
        previousDocuments,
        evidenceEntries: evidenceRows.map((entry) => ({
          id: entry.id,
          section: entry.section,
          title: entry.title,
          subtitle: entry.subtitle,
          description: entry.description,
          metadata: sanitizeEvidenceMetadata(entry.metadata),
          documents: entry.documents.map((doc) => ({
            id: doc.id,
            originalFilename: doc.displayName || doc.originalFilename,
            description: doc.description,
            uploadedAt: doc.uploadedAt.toISOString(),
            fileSizeBytes: doc.fileSizeBytes,
            status: doc.status,
          })),
        })),
      }
    : null

  return (
    <div className="flex min-h-screen flex-col">
      <NewsTicker />
      <SiteHeader />
      <main className="relative flex-1 bg-background">
        <div className="relative mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:py-16 lg:px-8">
          {linkError && !initialSession ? (
            <div className="paper-card sketch-radius-a mb-6 border-destructive/30 bg-destructive/5 p-4 text-sm text-foreground">
              {linkError}
            </div>
          ) : null}
          <DocumentsPortal initialSession={initialSession} />
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
