import type { Checklist, ChecklistItem } from '@/lib/documents-checklist'
import { isMissingChecklistItem } from '@/lib/documents-checklist'

export type DocumentCounts = {
  /** Documents on this case's list (visa list + requested/custom documents). */
  required: number
  /** Listed documents with at least one file on record. */
  submitted: number
  /** Listed documents with no file yet. Candidates can send them any time, as often as needed. */
  missing: number
  underReview: number
  accepted: number
  needsRevision: number
  rejected: number
  notRequested: number
  /** Every active uploaded file shown in the Documents list (all folders). */
  files: number
  /** Saved links. Links never change any document number above. */
  links: number
  /** Requested links the candidate has not provided yet. */
  linksPending: number
}

const SUBMITTED: Array<ChecklistItem['status']> = [
  'UPLOADED',
  'UNDER_REVIEW',
  'ACCEPTED',
  'NEEDS_REPLACEMENT',
  'REJECTED',
  'PARTIALLY_UPLOADED',
]

/** Documents on the case's list — catch-all, orphan and evidence-record folders excluded. */
export function requirementItems(checklist: Pick<Checklist, 'folders'>): ChecklistItem[] {
  return checklist.folders.flatMap((f) => f.items).filter((item) => item.requirement === true && item.kind !== 'link')
}

/**
 * The single source for document numbers shown in Overview, Documents and
 * Request Documents. Derived from the checklist (real rows, not dummy numbers).
 */
export function countChecklist(checklist: Checklist): DocumentCounts {
  const items = requirementItems(checklist)
  const counts: DocumentCounts = {
    required: items.length,
    submitted: 0,
    missing: 0,
    underReview: 0,
    accepted: 0,
    needsRevision: 0,
    rejected: 0,
    notRequested: 0,
    files: checklist.folders.flatMap((f) => f.items).reduce((n, item) => n + item.files.length, 0),
    links: checklist.links.reduce((n, item) => n + item.files.length, 0),
    linksPending: checklist.links.filter((item) => item.requirement && !item.files.length).length,
  }
  for (const item of items) {
    if (isMissingChecklistItem(item)) {
      counts.missing += 1
      continue
    }
    if (SUBMITTED.includes(item.status)) counts.submitted += 1
    if (item.status === 'UNDER_REVIEW' || item.status === 'UPLOADED' || item.status === 'PARTIALLY_UPLOADED') {
      counts.underReview += 1
    }
    if (item.status === 'ACCEPTED') counts.accepted += 1
    if (item.status === 'NEEDS_REPLACEMENT') counts.needsRevision += 1
    if (item.status === 'REJECTED') counts.rejected += 1
    if (item.status === 'NOT_APPLICABLE') counts.notRequested += 1
  }
  return counts
}

export function missingChecklistItems(checklist: Pick<Checklist, 'folders'>) {
  return requirementItems(checklist).filter((i) => isMissingChecklistItem(i))
}
