import type { EvidenceSection } from '@prisma/client'

export type EvidenceExtraFieldKey = 'fieldOfStudy' | 'startDate' | 'endDate' | 'issueDate' | 'expirationDate'

export type EvidenceExtraField = {
  key: EvidenceExtraFieldKey
  label: string
  input: 'text' | 'date'
  placeholder?: string
}

export type EvidenceSectionMeta = {
  key: EvidenceSection
  label: string
  addLabel: string
  emptyCandidate: string
  titleLabel: string
  subtitleLabel: string
  descriptionLabel?: string
  titlePlaceholder: string
  subtitlePlaceholder: string
  descriptionPlaceholder?: string
  questionKeyPrefix: string
  category: string
  extraFields: EvidenceExtraField[]
}

/** Client-safe section metadata (no Prisma runtime). */
export const EVIDENCE_SECTIONS: EvidenceSectionMeta[] = [
  {
    key: 'EDUCATION',
    label: 'Education History',
    addLabel: 'Add Education',
    emptyCandidate: 'No education records yet.',
    titleLabel: 'School / University',
    subtitleLabel: 'Degree / Program',
    descriptionLabel: 'Description / notes',
    titlePlaceholder: 'e.g. University of Texas',
    subtitlePlaceholder: 'e.g. M.S. Data Science',
    descriptionPlaceholder: 'Optional notes about this program',
    questionKeyPrefix: 'education',
    category: 'education',
    extraFields: [
      { key: 'fieldOfStudy', label: 'Field of Study', input: 'text', placeholder: 'e.g. Computer Science' },
      { key: 'startDate', label: 'Start date', input: 'date' },
      { key: 'endDate', label: 'End date', input: 'date' },
    ],
  },
  {
    key: 'TRANSCRIPT',
    label: 'Transcripts',
    addLabel: 'Add Transcript Set',
    emptyCandidate: 'No transcript records yet.',
    titleLabel: 'Institution',
    subtitleLabel: 'Period / semester / program',
    titlePlaceholder: 'e.g. University of Texas',
    subtitlePlaceholder: 'e.g. Fall 2022 — M.S. Data Science',
    questionKeyPrefix: 'transcripts',
    category: 'education',
    extraFields: [],
  },
  {
    key: 'EMPLOYMENT',
    label: 'Employment History',
    addLabel: 'Add Employment',
    emptyCandidate: 'No employment records yet.',
    titleLabel: 'Employer',
    subtitleLabel: 'Position / title',
    descriptionLabel: 'Description / responsibilities',
    titlePlaceholder: 'e.g. ABC Technologies',
    subtitlePlaceholder: 'e.g. Senior Engineer',
    descriptionPlaceholder: 'Responsibilities or context',
    questionKeyPrefix: 'employment',
    category: 'employment',
    extraFields: [
      { key: 'startDate', label: 'Start date', input: 'date' },
      { key: 'endDate', label: 'End date', input: 'date' },
    ],
  },
  {
    key: 'LICENSE',
    label: 'Licenses & Certifications',
    addLabel: 'Add License / Certification',
    emptyCandidate: 'No licenses or certifications yet.',
    titleLabel: 'Certification / license name',
    subtitleLabel: 'Issuing organization',
    titlePlaceholder: 'e.g. AWS Solutions Architect',
    subtitlePlaceholder: 'e.g. Amazon Web Services',
    questionKeyPrefix: 'license',
    category: 'credentials',
    extraFields: [
      { key: 'issueDate', label: 'Issue date', input: 'date' },
      { key: 'expirationDate', label: 'Expiration date', input: 'date' },
    ],
  },
  {
    key: 'CLIENT',
    label: 'Clients',
    addLabel: 'Add Client',
    emptyCandidate: 'No client records yet.',
    titleLabel: 'Client name',
    subtitleLabel: 'Relationship / project',
    descriptionLabel: 'Description',
    titlePlaceholder: 'e.g. Contoso Ltd',
    subtitlePlaceholder: 'e.g. Lead consultant',
    descriptionPlaceholder: 'Who the client is, type of work, and the candidate role',
    questionKeyPrefix: 'client',
    category: 'clients',
    extraFields: [],
  },
]

const META_KEYS: EvidenceExtraFieldKey[] = ['fieldOfStudy', 'startDate', 'endDate', 'issueDate', 'expirationDate']

/** Extra dates/fields stored on the existing EvidenceEntry.metadata JSON — no new tables. */
export function sanitizeEvidenceMetadata(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const source = raw as Record<string, unknown>
  const out: Record<string, string> = {}
  for (const key of META_KEYS) {
    const value = source[key]
    if (typeof value !== 'string') continue
    const trimmed = value.trim().slice(0, 200)
    if (trimmed) out[key] = trimmed
  }
  return out
}

export function evidenceFactLines(
  section: EvidenceSection,
  metadata: unknown,
): Array<{ label: string; value: string }> {
  const meta = sanitizeEvidenceMetadata(metadata)
  const fields = sectionMeta(section).extraFields
  return fields.flatMap((field) => {
    const value = meta[field.key]
    return value ? [{ label: field.label, value }] : []
  })
}

/**
 * The five structured evidence sections are always available to a candidate.
 * Admin-requested document keys must not hide them.
 */
export function candidateEvidenceSections(_requestedDocumentKeys: readonly string[] = []) {
  return EVIDENCE_SECTIONS.map((section) => section.key)
}

export function sectionMeta(section: EvidenceSection) {
  const found = EVIDENCE_SECTIONS.find((s) => s.key === section)
  if (!found) throw new Error(`Unknown evidence section: ${section}`)
  return found
}

/** Map an evidence attachment questionKey (education__entryId__stamp) back to its section. */
export function evidenceSectionFromQuestionKey(key: string): EvidenceSectionMeta | null {
  const normalized = key.trim().toLowerCase()
  if (!normalized) return null
  return (
    EVIDENCE_SECTIONS.find(
      (section) =>
        normalized === section.questionKeyPrefix ||
        normalized.startsWith(`${section.questionKeyPrefix}__`),
    ) ?? null
  )
}
