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
  /** A checklist slot (visa list, requested or custom). False for catch-all, orphan and evidence-record slots. */
  requirement?: boolean
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

/** One requirement slot from the case's visa document template (DB template or seed fallback). */
export type VisaTemplateSlot = {
  documentKey: string
  documentName: string
  category: string
  sortOrder?: number | null
}

export type ChecklistFolder = { id: string; title: string; items: ChecklistItem[] }

export type Checklist = {
  /** Document folders only (files). Links are never in here. */
  folders: ChecklistFolder[]
  /** Link slots (requested and/or submitted). Kept apart so links never count as documents. */
  links: ChecklistItem[]
}

function slotItem(
  base: Omit<ChecklistItem, 'status' | 'current' | 'files' | 'versions'>,
  versions: DocumentVersion[],
): ChecklistItem {
  const sorted = versions.sort((a, b) => b.version - a.version)
  const files = activeFiles(sorted)
  return { ...base, status: slotStatus(files), current: files[0] ?? null, files, versions: sorted }
}

/** Take only rows whose key is exactly `slotKey` (first pass, so aliases never steal a sibling slot's files). */
function claimExact(pool: DocumentVersion[], slotKey: string): DocumentVersion[] {
  const claimed = pool.filter((d) => d.questionKey === slotKey)
  const remaining = pool.filter((d) => d.questionKey !== slotKey)
  pool.length = 0
  pool.push(...remaining)
  return claimed
}

/** Visa-template folders, in template order. The catch-all “additional” item is optional, not a requirement. */
function buildTemplateFolders(
  pool: DocumentVersion[],
  templateItems: VisaTemplateSlot[],
  customDefs: DocumentLabelDef[],
): ChecklistFolder[] {
  const ordered = [...templateItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const slots: Array<{ item: VisaTemplateSlot; key: string; versions: DocumentVersion[] }> = []
  const seen = new Set<string>()
  for (const item of ordered) {
    const key = item.documentKey.trim()
    if (!key || seen.has(key) || isLinkRequestKey(key)) continue
    seen.add(key)
    slots.push({ item, key, versions: claimExact(pool, key) })
  }
  // Second pass: legacy / onboarding aliases (e.g. award_certificates → awards_evidence).
  for (const slot of slots) slot.versions.push(...claimDocuments(pool, slot.key))

  const folders: ChecklistFolder[] = []
  for (const { item, key, versions } of slots) {
    const title = item.category.trim() || 'Documents'
    let folder = folders.find((f) => f.title === title)
    if (!folder) {
      folder = { id: `visa_${folders.length + 1}`, title, items: [] }
      folders.push(folder)
    }
    folder.items.push(
      slotItem(
        {
          categoryId: folder.id,
          categoryTitle: title,
          folderTitle: title,
          questionKey: key,
          label:
            customDefs.find((d) => d.key === key)?.label?.trim() ||
            item.documentName.trim() ||
            canonicalDocumentLabel(key, customDefs),
          documentType: key,
          kind: 'file',
          // Every item on the visa list counts, the "additional evidence" item included,
          // so the number of documents always equals the rows shown everywhere.
          requirement: true,
        },
        versions,
      ),
    )
  }
  return folders
}

/** Legacy O-1 onboarding catalog folders (used when no visa template is supplied). */
function buildCatalogFolders(pool: DocumentVersion[], customDefs: DocumentLabelDef[]): ChecklistFolder[] {
  return O1_CATEGORIES.map((category) => ({
    id: category.id,
    title: category.folderTitle,
    items: category.questions
      .filter((q) => q.type === 'file')
      .map((question) =>
        slotItem(
          {
            categoryId: category.id,
            categoryTitle: category.title,
            folderTitle: category.folderTitle,
            questionKey: question.key,
            label: canonicalDocumentLabel(question.key, customDefs),
            documentType: question.documentType ?? question.key,
            kind: 'file',
            requirement: !isAdditionalEvidenceKey(question.key),
          },
          claimDocuments(pool, question.key),
        ),
      ),
  }))
}

function linkSlotLabel(key: string, customDefs: DocumentLabelDef[], versions: DocumentVersion[]) {
  const def = customDefs.find((d) => d.key === key)
  if (def?.label) return def.label
  if (PROFILE_LINK_OPTIONS.some((o) => o.key === key)) return canonicalDocumentLabel(key, customDefs)
  const named = versions.find((v) => v.displayName && !/^https?:\/\//i.test(v.displayName))
  return named?.displayName?.trim() || 'Link'
}

function buildLinkItems(linkDocs: DocumentVersion[], customDefs: DocumentLabelDef[]): ChecklistItem[] {
  const pool = [...linkDocs]
  const items: ChecklistItem[] = []
  const seen = new Set<string>()
  // Requested link slots (request items / custom defs) first, so pending requests stay visible.
  for (const def of customDefs.filter((d) => isLinkRequestKey(d.key))) {
    if (seen.has(def.key)) continue
    seen.add(def.key)
    items.push(
      slotItem(
        {
          categoryId: 'profile_links',
          categoryTitle: 'Links',
          folderTitle: 'Links',
          questionKey: def.key,
          label: def.label || canonicalDocumentLabel(def.key, customDefs),
          documentType: def.key,
          kind: 'link',
          requirement: true,
        },
        claimDocuments(pool, def.key),
      ),
    )
  }
  for (const key of [...new Set(pool.map((d) => d.questionKey))]) {
    const versions = claimDocuments(pool, key)
    items.push(
      slotItem(
        {
          categoryId: 'profile_links',
          categoryTitle: 'Links',
          folderTitle: 'Links',
          questionKey: key,
          label: linkSlotLabel(key, customDefs, versions),
          documentType: key,
          kind: 'link',
          requirement: false,
        },
        versions,
      ),
    )
  }
  return items
}

/**
 * Build the admin/lawyer document checklist from the same CaseDocument rows
 * the candidate portal writes. Overview, Documents and Request Documents all
 * read this one result, so their lists and counts cannot drift apart.
 *
 * - `templateItems`: the case's visa template. When given, requirement slots
 *   come from that visa only; otherwise the legacy O-1 catalog is used.
 * - Links (rows with an external URL) are returned in `links`, never in `folders`.
 * - Files that match no slot are still shown (Additional uploads) — never dropped.
 */
export function buildChecklist(
  documents: DocumentVersion[],
  customDefs: DocumentLabelDef[] = [],
  options: { templateItems?: VisaTemplateSlot[] | null } = {},
): Checklist {
  const nonEvidence = documents.filter((d) => !d.evidenceEntryId)
  const linkDocs = nonEvidence.filter((d) => isExternalLinkDocument(d))
  // Structured evidence files go in dedicated section folders, not the catalog pool.
  const pool = nonEvidence.filter((d) => !isExternalLinkDocument(d))

  const folders: ChecklistFolder[] = options.templateItems?.length
    ? buildTemplateFolders(pool, options.templateItems, customDefs)
    : buildCatalogFolders(pool, customDefs)

  folders.push(...buildEvidenceFolders(documents))

  // Custom / requested file slots (request items and case-specific requirements).
  const slotKeys = new Set(folders.flatMap((f) => f.items.map((i) => i.questionKey)))
  const customItems: ChecklistItem[] = []
  for (const def of customDefs) {
    if (isLinkRequestKey(def.key)) continue
    if ([...slotKeys].some((key) => documentMatchesSlot(def.key, key))) continue
    customItems.push(
      slotItem(
        {
          categoryId: 'custom',
          categoryTitle: 'Requested documents',
          folderTitle: def.category || 'Requested documents',
          questionKey: def.key,
          label: def.label,
          documentType: def.key,
          kind: 'file',
          requirement: !isAdditionalEvidenceKey(def.key),
        },
        claimDocuments(pool, def.key),
      ),
    )
    slotKeys.add(def.key)
  }
  if (customItems.length) {
    folders.push({ id: 'custom', title: 'Requested documents', items: customItems })
  }

  // Always keep a catch-all “Other supporting document” bucket.
  const otherVersions = claimDocuments(pool, OTHER_SUPPORTING_DOCUMENT_KEY)
  for (const key of [...new Set(pool.map((d) => d.questionKey))]) {
    if (isAdditionalEvidenceKey(key)) otherVersions.push(...claimDocuments(pool, key))
  }
  folders.push({
    id: 'other_supporting',
    title: 'Other supporting documents',
    items: [
      slotItem(
        {
          categoryId: 'other_supporting',
          categoryTitle: 'Other supporting documents',
          folderTitle: 'Other supporting documents',
          questionKey: OTHER_SUPPORTING_DOCUMENT_KEY,
          label: 'Additional supporting files',
          documentType: 'additional_evidence',
          kind: 'file',
          requirement: false,
        },
        otherVersions,
      ),
    ],
  })

  // True orphans (lawyer uploads, onboarding keys outside this visa's template) — still visible, never dropped.
  const orphanKeys = [...new Set(pool.map((d) => d.questionKey))]
  if (orphanKeys.length) {
    folders.push({
      id: 'extra',
      title: 'Additional uploads',
      items: orphanKeys.map((key) => {
        const versions = claimDocuments(pool, key)
        return slotItem(
          {
            categoryId: 'extra',
            categoryTitle: 'Additional uploads',
            folderTitle: 'Additional uploads',
            questionKey: key,
            label: labelForKey(key, customDefs, versions),
            documentType: key,
            kind: 'file',
            requirement: false,
          },
          versions,
        )
      }),
    })
  }

  return { folders, links: buildLinkItems(linkDocs, customDefs) }
}

/** Count received files visible to admin/lawyer Documents tabs (excludes evidence-entry attachments). */
export function countVisibleReceivedDocuments(documents: DocumentVersion[]) {
  const { folders } = buildChecklist(documents)
  return folders
    .flatMap((f) => f.items)
    .filter(isReceivedChecklistItem)
    .reduce((n, item) => n + item.files.length, 0)
}
