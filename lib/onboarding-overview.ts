import { O1_CATEGORIES, type OnboardingQuestion } from '@/lib/onboarding-catalog'
import {
  documentMatchesSlot,
  documentHasContent,
  visibleDocumentName,
  buildChecklist,
  isReceivedChecklistItem,
  type DocumentVersion,
} from '@/lib/documents-checklist'
import { isAdditionalEvidenceKey, OTHER_SUPPORTING_DOCUMENT_KEY, canonicalDocumentLabel } from '@/lib/document-keys'
import { isExternalLinkDocument, extractExternalUrls } from '@/lib/document-links'
import { isLinkRequestKey } from '@/lib/link-request-items'

export type OnboardingDisplayStatus =
  | 'NOT_STARTED'
  | 'INVITED'
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'MORE_INFORMATION_REQUIRED'
  | 'ACCEPTED'

export type OverviewFile = {
  id: string
  /** Visible file name (rename or original) — same helper as Received Documents. */
  originalFilename: string
  /** Raw upload filename, when it differs from originalFilename. */
  uploadedFilename?: string | null
  displayName?: string | null
  mimeType?: string | null
  status: string
  uploadedAt: string
  fileSizeBytes?: number | null
  isLink?: boolean
  urls?: string[]
}

export type OverviewField = {
  key: string
  label: string
  type: OnboardingQuestion['type']
  /** Formatted display text; null means genuinely not provided. */
  text: string | null
  files: OverviewFile[]
  reviewStatus?: string | null
  hasValue: boolean
}

export type OverviewSection = {
  id: string
  title: string
  folderTitle: string
  fields: OverviewField[]
  answeredCount: number
  totalCount: number
}

function isBlankValue(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (typeof value === 'number') return false // preserve 0
  if (typeof value === 'boolean') return false // preserve false / No
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    if ('value' in obj) return isBlankValue(obj.value)
    if ('items' in obj && Array.isArray(obj.items)) return obj.items.length === 0
    // Review metadata alone is not a submitted answer.
    const keys = Object.keys(obj).filter((k) => k !== 'reviewStatus' && k !== 'adminNote')
    return keys.length === 0
  }
  return false
}

/** Extract a displayable string from stored onboarding answer shapes. */
export function formatOnboardingAnswer(answer: unknown, type: OnboardingQuestion['type']): string | null {
  if (isBlankValue(answer)) return null

  if (typeof answer === 'string' || typeof answer === 'number' || typeof answer === 'boolean') {
    return String(answer)
  }

  if (typeof answer !== 'object' || answer === null) return null
  const obj = answer as Record<string, unknown>

  if (type === 'repeater') {
    const items = (Array.isArray(obj.items) ? obj.items : Array.isArray(answer) ? answer : []) as Array<
      Record<string, unknown>
    >
    if (!items.length) return null
    return items
      .map((item, index) => {
        const parts = Object.entries(item)
          .filter(([, v]) => !isBlankValue(v))
          .map(([k, v]) => `${k}: ${String(v)}`)
        return parts.length ? `${index + 1}. ${parts.join(' · ')}` : null
      })
      .filter(Boolean)
      .join('\n')
  }

  if ('value' in obj) {
    if (isBlankValue(obj.value)) return null
    if (typeof obj.value === 'object') return JSON.stringify(obj.value)
    return String(obj.value)
  }

  // Ignore review-only stubs.
  const dataKeys = Object.keys(obj).filter((k) => k !== 'reviewStatus' && k !== 'adminNote')
  if (!dataKeys.length) return null

  if (Array.isArray(answer)) return answer.map(String).join(', ')
  return JSON.stringify(answer)
}

function answerHasProgress(answers: Record<string, unknown> | null | undefined): boolean {
  if (!answers) return false
  for (const value of Object.values(answers)) {
    if (!isBlankValue(value)) return true
  }
  return false
}

function activeDocuments(documents: DocumentVersion[]) {
  return documents.filter(
    (d) =>
      d.isCurrentVersion &&
      d.status !== 'ARCHIVED' &&
      d.status !== 'REJECTED' &&
      !d.evidenceEntryId &&
      documentHasContent(d),
  )
}

function filesForQuestion(
  documents: DocumentVersion[],
  questionKey: string,
  type: OnboardingQuestion['type'],
): OverviewFile[] {
  const matched = documents.filter((d) => {
    if (documentMatchesSlot(d.questionKey, questionKey)) return true
    // Additional Evidence also absorbs other_supporting / additional_* uploads.
    if (questionKey === 'additional_files' || questionKey === 'additional_notes') {
      return isAdditionalEvidenceKey(d.questionKey) || d.questionKey === OTHER_SUPPORTING_DOCUMENT_KEY
    }
    // LinkedIn / profile link docs stored as link keys.
    if (type === 'url' && isLinkRequestKey(d.questionKey) && documentMatchesSlot(d.questionKey, questionKey)) {
      return true
    }
    return false
  })

  return matched.map((d) => overviewFileFromDocument(d))
}

function overviewFileFromDocument(d: DocumentVersion): OverviewFile {
  const link = isExternalLinkDocument(d)
  const urls = link
    ? extractExternalUrls({
        displayName: d.displayName,
        description: d.description,
      })
    : []
  const visible = visibleDocumentName(d)
  const uploaded = (d.originalFilename || '').trim()
  return {
    id: d.id,
    originalFilename: visible,
    uploadedFilename: uploaded && uploaded !== visible ? uploaded : null,
    displayName: d.displayName ?? null,
    mimeType: d.mimeType ?? null,
    status: d.status,
    uploadedAt: typeof d.uploadedAt === 'string' ? d.uploadedAt : new Date(d.uploadedAt).toISOString(),
    fileSizeBytes: d.fileSizeBytes ?? null,
    isLink: link,
    urls,
  }
}

/**
 * Derive the badge shown on Overview from submission + invite + document progress.
 * Document uploads alone never equal SUBMITTED.
 */
export function deriveOnboardingDisplayStatus(input: {
  submissionStatus?: string | null
  caseStatus?: string | null
  hasInvite?: boolean
  hasAnswerProgress: boolean
  hasDocumentProgress: boolean
}): OnboardingDisplayStatus {
  const raw = (input.submissionStatus || '').toUpperCase()
  if (raw === 'SUBMITTED') return 'SUBMITTED'
  if (raw === 'UNDER_REVIEW') return 'UNDER_REVIEW'
  if (raw === 'MORE_INFORMATION_REQUIRED') return 'MORE_INFORMATION_REQUIRED'
  if (raw === 'ACCEPTED') return 'ACCEPTED'

  if (raw === 'DRAFT') {
    if (input.hasAnswerProgress || input.hasDocumentProgress) return 'IN_PROGRESS'
    if (input.hasInvite || input.caseStatus === 'ONBOARDING_SENT') return 'INVITED'
    return 'INVITED'
  }

  // No formal onboarding submission row
  if (input.hasAnswerProgress) return 'IN_PROGRESS'
  if (input.hasDocumentProgress) return 'IN_PROGRESS'
  if (input.hasInvite || input.caseStatus === 'ONBOARDING_SENT' || input.caseStatus === 'ONBOARDING_IN_PROGRESS') {
    return 'INVITED'
  }
  return 'NOT_STARTED'
}

export function buildOnboardingOverview(input: {
  answers?: Record<string, unknown> | null
  documents?: DocumentVersion[]
  customDefs?: Array<{ key: string; label: string; category?: string | null }>
  submissionStatus?: string | null
  caseStatus?: string | null
  hasInvite?: boolean
  reviews?: Record<string, { status?: string; note?: string }> | null
}): {
  status: OnboardingDisplayStatus
  sections: OverviewSection[]
  hasAnswerProgress: boolean
  hasDocumentProgress: boolean
  showSendInvite: boolean
  showResendInvite: boolean
  statusHint: string
} {
  const answers = (input.answers ?? {}) as Record<string, unknown>
  const catalogDocs = activeDocuments(input.documents ?? [])
  const evidenceProgress = (input.documents ?? []).some(
    (d) =>
      Boolean(d.evidenceEntryId) &&
      d.isCurrentVersion &&
      d.status !== 'ARCHIVED' &&
      d.status !== 'REJECTED' &&
      documentHasContent(d),
  )
  const docs = catalogDocs
  const hasAnswerProgress = answerHasProgress(answers)
  const hasDocumentProgress = docs.length > 0 || evidenceProgress
  const status = deriveOnboardingDisplayStatus({
    submissionStatus: input.submissionStatus,
    caseStatus: input.caseStatus,
    hasInvite: input.hasInvite,
    hasAnswerProgress,
    hasDocumentProgress,
  })

  const claimed = new Set<string>()
  const sections: OverviewSection[] = O1_CATEGORIES.map((cat) => {
    const fields: OverviewField[] = cat.questions.map((q) => {
      const text = q.type === 'file' ? null : formatOnboardingAnswer(answers[q.key], q.type)
      let files = filesForQuestion(docs, q.key, q.type)
      // For URL fields, also surface a plain text URL answer as a pseudo-link when no file.
      if (q.type === 'url' && text && !files.length) {
        files = []
      }
      for (const f of files) claimed.add(f.id)

      const hasValue = Boolean(text) || files.length > 0
      return {
        key: q.key,
        label: q.type === 'file' ? canonicalDocumentLabel(q.key, input.customDefs) : q.label,
        type: q.type,
        text,
        files,
        reviewStatus: input.reviews?.[q.key]?.status ?? null,
        hasValue,
      }
    })

    return {
      id: cat.id,
      title: cat.title,
      folderTitle: cat.folderTitle,
      fields,
      answeredCount: fields.filter((f) => f.hasValue).length,
      totalCount: fields.length,
    }
  })

  // Extra checklist folders (evidence, profile links, custom requests, lawyer uploads)
  // use the same labels as Received Documents so Overview and Documents stay in sync.
  const checklist = buildChecklist(input.documents ?? [], input.customDefs ?? [])
  const extraFolderIds = new Set(['profile_links', 'custom', 'extra', 'other_supporting'])
  for (const folder of checklist.folders) {
    const isEvidence = String(folder.id).startsWith('evidence_')
    if (!extraFolderIds.has(folder.id) && !isEvidence) continue
    const received = folder.items.filter(isReceivedChecklistItem)
    if (isEvidence) {
      const fields: OverviewField[] = received.map((item) => {
        const files = item.files.filter((f) => !claimed.has(f.id)).map((f) => overviewFileFromDocument(f))
        for (const file of files) claimed.add(file.id)
        return {
          key: item.questionKey,
          label: item.label,
          type: 'file' as const,
          text: null,
          files,
          reviewStatus: null,
          hasValue: files.length > 0,
        }
      })
      sections.push({
        id: folder.id,
        title: folder.title,
        folderTitle: folder.title,
        fields:
          fields.length > 0
            ? fields
            : [
                {
                  key: folder.id,
                  label: folder.title,
                  type: 'file',
                  text: null,
                  files: [],
                  reviewStatus: null,
                  hasValue: false,
                },
              ],
        answeredCount: fields.filter((f) => f.hasValue).length,
        totalCount: Math.max(fields.length, 1),
      })
      continue
    }
    const fields: OverviewField[] = []
    for (const item of folder.items.filter(isReceivedChecklistItem)) {
      const files = item.files.filter((f) => !claimed.has(f.id)).map((f) => overviewFileFromDocument(f))
      for (const file of files) claimed.add(file.id)
      if (!files.length) continue
      fields.push({
        key: item.questionKey,
        label: item.label,
        type: item.kind === 'link' ? 'url' : 'file',
        text: null,
        files,
        reviewStatus: null,
        hasValue: true,
      })
    }
    if (!fields.length) continue
    sections.push({
      id: folder.id,
      title: folder.title,
      folderTitle: folder.title,
      fields,
      answeredCount: fields.length,
      totalCount: fields.length,
    })
  }

  // Remaining orphans → Additional Evidence (same slot label as Documents)
  const additional = sections.find((s) => s.id === 'additional')
  if (additional) {
    const orphans = docs.filter((d) => !claimed.has(d.id))
    if (orphans.length) {
      const extraField = additional.fields.find((f) => f.key === 'additional_files')
      if (extraField) {
        for (const d of orphans) {
          if (extraField.files.some((f) => f.id === d.id)) continue
          extraField.files.push(overviewFileFromDocument(d))
          claimed.add(d.id)
        }
        extraField.hasValue = extraField.files.length > 0 || Boolean(extraField.text)
        additional.answeredCount = additional.fields.filter((f) => f.hasValue).length
      }
    }
  }

  const showSendInvite = status === 'NOT_STARTED'
  const showResendInvite =
    status === 'INVITED' || status === 'IN_PROGRESS' || status === 'MORE_INFORMATION_REQUIRED'

  const statusHint =
    status === 'NOT_STARTED'
      ? 'No onboarding invite or submitted information yet.'
      : status === 'INVITED'
        ? 'Invite sent — candidate has not saved answers or uploads yet.'
        : status === 'IN_PROGRESS'
          ? 'Candidate has saved answers and/or uploaded documents. Formal onboarding submit is still pending.'
          : status === 'SUBMITTED'
            ? 'Candidate submitted the onboarding form.'
            : ''

  return {
    status,
    sections,
    hasAnswerProgress,
    hasDocumentProgress,
    showSendInvite,
    showResendInvite,
    statusHint,
  }
}
