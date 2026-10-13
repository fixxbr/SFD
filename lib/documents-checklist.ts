import type { DocumentStatus } from '@prisma/client'
import { O1_CATEGORIES } from '@/lib/onboarding-catalog'
import {
  canonicalDocumentLabel,
  documentKeyLookupKeys,
  isAdditionalEvidenceKey,
  isKnownDocumentKey,
  OTHER_SUPPORTING_DOCUMENT_KEY,
  type DocumentLabelDef,
} from '@/lib/document-keys'
import { isLinkRequestKey, PROFILE_LINK_OPTIONS } from '@/lib/link-request-items'
import { isExternalLinkDocument } from '@/lib/document-links'
import { EVIDENCE_SECTIONS, evidenceSectionFromQuestionKey } from '@/lib/evidence-section-meta'

export type DocumentVersion = {
  id: string
  questionKey: string
  originalFilename: string
  status: DocumentStatus
  version: number
  isCurrentVersion: boolean
  uploadedAt: Date | string
  adminNote?: string | null
  fileSizeBytes?: number | null
  displayName?: string | null
  description?: string | null
  mimeType?: string | null
  uploadedByType?: string | null
  uploadedById?: string | null
  evidenceEntryId?: string | null
  evidenceEntry?: {
    id: string
    section?: string | null
    title?: string | null
    subtitle?: string | null
  } | null
  category?: string | null
  documentType?: string | null
}

export type ChecklistItem = {
  categoryId: string
  categoryTitle: string
  folderTitle: string
  questionKey: string
  label: string
  documentType: string
  status: DocumentStatus | 'MISSING' | 'PARTIALLY_UPLOADED'
  current: DocumentVersion | null
  /** All active (current, non-archived) files for this slot — append uploads. */
  files: DocumentVersion[]
  versions: DocumentVersion[]
  kind?: 'file' | 'link'
}

/** True when the file row has real payload (not an empty stub). */
export function documentHasContent(file: Pick<DocumentVersion, 'fileSizeBytes' | 'originalFilename' | 'displayName'>) {
  if (typeof file.fileSizeBytes === 'number' && file.fileSizeBytes <= 0) return false
  const name = (file.displayName || file.originalFilename || '').trim()
  return Boolean(name)
}

/**
 * User-facing file name shared by Overview and Received Documents.
 * Prefer a non-URL displayName (admin/lawyer rename); otherwise the original upload name.
 */
export function visibleDocumentName(
  file: Pick<DocumentVersion, 'originalFilename' | 'displayName'>,
  fallback = 'file',
): string {
  const display = (file.displayName || '').trim()
  const original = (file.originalFilename || '').trim()
  if (display && !/^https?:\/\//i.test(display)) return display
  return original.replace(/\.url\.txt$/i, '') || display || fallback
}

/** Original upload name when it differs from the visible name — show both. */
export function secondaryDocumentName(file: Pick<DocumentVersion, 'originalFilename' | 'displayName'>): string | null {
  const primary = visibleDocumentName(file)
  const original = (file.originalFilename || '').trim().replace(/\.url\.txt$/i, '')
  if (!original || original === primary) return null
  if (/^https?:\/\//i.test(primary)) return null
  return original
}

/** Match catalog/template/custom slots even when legacy aliases were used on upload. */
export function documentMatchesSlot(documentQuestionKey: string, slotKey: string): boolean {
  if (!documentQuestionKey || !slotKey) return false
  if (documentQuestionKey === slotKey) return true
  const slotAliases = documentKeyLookupKeys(slotKey)
  if (slotAliases.includes(documentQuestionKey)) return true
  return documentKeyLookupKeys(documentQuestionKey).includes(slotKey)
}

function activeFiles(versions: DocumentVersion[]) {
  return versions
    .filter((d) => d.isCurrentVersion && d.status !== 'ARCHIVED' && documentHasContent(d))
    .sort((a, b) => b.version - a.version)
}

function slotStatus(files: DocumentVersion[]): DocumentStatus | 'MISSING' | 'PARTIALLY_UPLOADED' {
  if (!files.length) return 'MISSING'
  if (files.some((f) => f.status === 'NEEDS_REPLACEMENT')) return 'NEEDS_REPLACEMENT'
  if (files.every((f) => f.status === 'ACCEPTED')) return 'ACCEPTED'
  if (files.every((f) => f.status === 'REJECTED')) return 'REJECTED'
  if (files.length > 1 && files.some((f) => f.status === 'UPLOADED' || f.status === 'UNDER_REVIEW')) {
    return 'PARTIALLY_UPLOADED'
  }
  return files[0]?.status ?? 'UPLOADED'
}

function claimDocuments(pool: DocumentVersion[], slotKey: string): DocumentVersion[] {
  const claimed: DocumentVersion[] = []
  const remaining: DocumentVersion[] = []
  for (const doc of pool) {
    if (documentMatchesSlot(doc.questionKey, slotKey)) claimed.push(doc)
    else remaining.push(doc)
  }
  pool.length = 0
  pool.push(...remaining)
  return claimed
}

/** Uploaded slots with at least one file that has content. */
export function isReceivedChecklistItem(item: ChecklistItem) {
  return item.status !== 'MISSING' && (item.files?.length ?? 0) > 0
}

/** Not yet uploaded (no content on file). Catch-all “other” slots are never “missing”. */
export function isMissingChecklistItem(item: ChecklistItem) {
  if (isAdditionalEvidenceKey(item.questionKey)) return false
  return item.status === 'MISSING' || !(item.files?.length)
}

function labelForKey(key: string, customDefs: DocumentLabelDef[], files: DocumentVersion[]): string {
  const def = customDefs.find((d) => documentMatchesSlot(key, d.key) || documentMatchesSlot(d.key, key))
  if (def?.label) return def.label
  if (isKnownDocumentKey(key) || isLinkRequestKey(key) || isAdditionalEvidenceKey(key)) {
    return canonicalDocumentLabel(key, customDefs)
  }
  if (files[0] && isExternalLinkDocument(files[0])) {
    return files[0].displayName || 'Submitted link'
  }
  return (
    files[0]?.displayName ||
    files[0]?.originalFilename ||
    canonicalDocumentLabel(key, customDefs) ||
    'Uploaded file'
  )
}

function evidenceItemLabel(docs: DocumentVersion[]): string {
  const entry = docs.find((d) => d.evidenceEntry)?.evidenceEntry
  if (entry?.title?.trim()) {
    return [entry.title.trim(), entry.subtitle?.trim()].filter(Boolean).join(' — ')
  }
  if (docs[0]) return visibleDocumentName(docs[0])
  return 'Uploaded file'
}

function buildEvidenceFolders(documents: DocumentVersion[]): { id: string; title: string; items: ChecklistItem[] }[] {
  const evidenceDocs = documents.filter((d) => d.evidenceEntryId)
  const folders: { id: string; title: string; items: ChecklistItem[] }[] = []

  for (const section of EVIDENCE_SECTIONS) {
    const sectionDocs = evidenceDocs.filter((d) => {
      const fromEntry = (d.evidenceEntry?.section || '').toUpperCase()
      if (fromEntry) return fromEntry === section.key
      return evidenceSectionFromQuestionKey(d.questionKey)?.key === section.key
    })
    const grouped = new Map<string, DocumentVersion[]>()
    for (const doc of sectionDocs) {
      const groupKey = doc.evidenceEntryId || doc.evidenceEntry?.id || doc.questionKey
      const list = grouped.get(groupKey) ?? []
      list.push(doc)
      grouped.set(groupKey, list)
    }
    const items: ChecklistItem[] = [...grouped.entries()].map(([groupKey, versions]) => {
      const files = activeFiles(versions)
      return {
        categoryId: `evidence_${section.key}`,
        categoryTitle: section.label,
        folderTitle: section.label,
        questionKey: groupKey,
        label: evidenceItemLabel(versions),
        documentType: section.questionKeyPrefix,
        status: slotStatus(files),
        current: files[0] ?? null,
        files,
        versions: versions.sort((a, b) => b.version - a.version),
        kind: 'file' as const,
      }
    })
    folders.push({ id: `evidence_${section.key}`, title: section.label, items })
  }

  return folders
}

/**
 * Build the admin/lawyer Documents checklist from the same CaseDocument rows
 * the candidate portal writes. Template aliases, profile links, and
 * “Other supporting document” always surface when files exist.
 */
export function buildChecklist(
  documents: DocumentVersion[],
  customDefs: DocumentLabelDef[] = [],
): { folders: { id: string; title: string; items: ChecklistItem[] }[] } {
  // Structured evidence files go in dedicated section folders, not the catalog pool.
  const pool = documents.filter((d) => !d.evidenceEntryId)
  const folders: { id: string; title: string; items: ChecklistItem[] }[] = []

  for (const category of O1_CATEGORIES) {
    const items: ChecklistItem[] = category.questions
      .filter((q) => q.type === 'file')
      .map((question) => {
        const versions = claimDocuments(pool, question.key).sort((a, b) => b.version - a.version)
        const files = activeFiles(versions)
        return {
          categoryId: category.id,
          categoryTitle: category.title,
          folderTitle: category.folderTitle,
          questionKey: question.key,
          label: canonicalDocumentLabel(question.key, customDefs),
          documentType: question.documentType ?? question.key,
          status: slotStatus(files),
          current: files[0] ?? null,
          files,
          versions,
          kind: 'file' as const,
        }
      })
    folders.push({ id: category.id, title: category.folderTitle, items })
  }

  folders.push(...buildEvidenceFolders(documents))

  // Profile / web links (GitHub, LinkedIn, other_links, custom link_*).
  const linkDefs = [
    ...PROFILE_LINK_OPTIONS.map((o) => ({ key: o.key, label: o.label, category: o.category })),
    ...customDefs.filter((d) => isLinkRequestKey(d.key)),
  ]
  const linkItems: ChecklistItem[] = []
  const seenLinkKeys = new Set<string>()
  for (const def of linkDefs) {
    if (seenLinkKeys.has(def.key)) continue
    seenLinkKeys.add(def.key)
    const versions = claimDocuments(pool, def.key).sort((a, b) => b.version - a.version)
    const files = activeFiles(versions)
    linkItems.push({
      categoryId: 'profile_links',
      categoryTitle: 'Profile & links',
      folderTitle: def.category || 'Profile & links',
      questionKey: def.key,
      label: def.label,
      documentType: def.key,
      status: slotStatus(files),
      current: files[0] ?? null,
      files,
      versions,
      kind: 'link',
    })
  }
  // Any remaining link-keyed docs not covered above.
  const leftoverLinkKeys = [...new Set(pool.filter((d) => isLinkRequestKey(d.questionKey)).map((d) => d.questionKey))]
  for (const key of leftoverLinkKeys) {
    const versions = claimDocuments(pool, key).sort((a, b) => b.version - a.version)
    const files = activeFiles(versions)
    linkItems.push({
      categoryId: 'profile_links',
      categoryTitle: 'Profile & links',
      folderTitle: 'Profile & links',
      questionKey: key,
      label: labelForKey(key, customDefs, files),
      documentType: key,
      status: slotStatus(files),
      current: files[0] ?? null,
      files,
      versions,
      kind: 'link',
    })
  }
  if (linkItems.some((item) => isReceivedChecklistItem(item) || customDefs.some((d) => documentMatchesSlot(d.key, item.questionKey)))) {
    folders.push({
      id: 'profile_links',
      title: 'Profile & links',
      items: linkItems.filter(
        (item) =>
          isReceivedChecklistItem(item) ||
          customDefs.some((d) => documentMatchesSlot(d.key, item.questionKey)),
      ),
    })
  }

  // Custom request slots (including template keys persisted as customDocumentDef).
  const catalogKeys = new Set(folders.flatMap((f) => f.items.map((i) => i.questionKey)))
  const customItems: ChecklistItem[] = []
  for (const def of customDefs) {
    if (catalogKeys.has(def.key) || isLinkRequestKey(def.key)) continue
    const versions = claimDocuments(pool, def.key).sort((a, b) => b.version - a.version)
    const files = activeFiles(versions)
    customItems.push({
      categoryId: 'custom',
      categoryTitle: 'Requested documents',
      folderTitle: def.category || 'Requested documents',
      questionKey: def.key,
      label: def.label,
      documentType: def.key,
      status: slotStatus(files),
      current: files[0] ?? null,
      files,
      versions,
      kind: 'file',
    })
    catalogKeys.add(def.key)
  }
  if (customItems.length) {
    folders.push({ id: 'custom', title: 'Requested documents', items: customItems })
  }

  // Always keep a catch-all “Other supporting document” bucket.
  const otherVersions = claimDocuments(pool, OTHER_SUPPORTING_DOCUMENT_KEY).sort((a, b) => b.version - a.version)
  // Also claim any remaining additional_* aliases still in the pool.
  for (const key of [...new Set(pool.map((d) => d.questionKey))]) {
    if (isAdditionalEvidenceKey(key)) {
      otherVersions.push(...claimDocuments(pool, key))
    }
  }
  otherVersions.sort((a, b) => b.version - a.version)
  const otherFiles = activeFiles(otherVersions)
  folders.push({
    id: 'other_supporting',
    title: 'Other supporting documents',
    items: [
      {
        categoryId: 'other_supporting',
        categoryTitle: 'Other supporting documents',
        folderTitle: 'Other supporting documents',
        questionKey: OTHER_SUPPORTING_DOCUMENT_KEY,
        label: 'Additional supporting files',
        documentType: 'additional_evidence',
        status: slotStatus(otherFiles),
        current: otherFiles[0] ?? null,
        files: otherFiles,
        versions: otherVersions,
        kind: 'file',
      },
    ],
  })

  // True orphans (lawyer uploads, unknown keys) — still visible, never dropped.
  const orphanKeys = [...new Set(pool.map((d) => d.questionKey))]
  if (orphanKeys.length) {
    const items: ChecklistItem[] = orphanKeys.map((key) => {
      const versions = claimDocuments(pool, key).sort((a, b) => b.version - a.version)
      const files = activeFiles(versions)
      return {
        categoryId: 'extra',
        categoryTitle: 'Additional uploads',
        folderTitle: 'Additional uploads',
        questionKey: key,
        label: labelForKey(key, customDefs, files),
        documentType: key,
        status: slotStatus(files),
        current: files[0] ?? null,
        files,
        versions,
        kind: isLinkRequestKey(key) ? 'link' : 'file',
      }
    })
    folders.push({ id: 'extra', title: 'Additional uploads', items })
  }

  return { folders }
}

/** Count received files visible to admin/lawyer Documents tabs (excludes evidence-entry attachments). */
export function countVisibleReceivedDocuments(documents: DocumentVersion[]) {
  const { folders } = buildChecklist(documents)
  return folders
    .flatMap((f) => f.items)
    .filter(isReceivedChecklistItem)
    .reduce((n, item) => n + item.files.length, 0)
}
