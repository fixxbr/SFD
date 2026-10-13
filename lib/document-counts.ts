import type { ChecklistItem } from '@/lib/documents-checklist'
import { isMissingChecklistItem } from '@/lib/documents-checklist'

export type DocumentCounts = {
  required: number
  submitted: number
  missing: number
  underReview: number
  accepted: number
  needsRevision: number
  rejected: number
  notRequested: number
}

const SUBMITTED: Array<ChecklistItem['status']> = [
  'UPLOADED',
  'UNDER_REVIEW',
  'ACCEPTED',
  'NEEDS_REPLACEMENT',
  'REJECTED',
  'PARTIALLY_UPLOADED',
]

/** Derive document progress counts from a checklist (not dummy numbers). */
export function countChecklist(items: ChecklistItem[]): DocumentCounts {
  const counts: DocumentCounts = {
    required: items.length,
    submitted: 0,
    missing: 0,
    underReview: 0,
    accepted: 0,
    needsRevision: 0,
    rejected: 0,
    notRequested: 0,
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

export function missingChecklistItems(items: ChecklistItem[]) {
  return items.filter((i) => isMissingChecklistItem(i))
}
