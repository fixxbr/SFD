import { allQuestions, questionByKey } from '@/lib/onboarding-catalog'
import { SEED_VISA_TEMPLATES } from '@/lib/visa-template-seed-data'
import { isLinkRequestKey, PROFILE_LINK_OPTIONS } from '@/lib/link-request-items'

/** Canonical slot for uncategorized supporting files offered by the portal. */
export const OTHER_SUPPORTING_DOCUMENT_KEY = 'other_supporting_document'

/** Keys that all mean “additional / other supporting evidence”. */
export const ADDITIONAL_EVIDENCE_KEYS = new Set([
  'additional_evidence',
  'additional_files',
  'additional',
  'other_supporting_document',
  'other_supporting_documents',
])

/**
 * Explicit compatibility between visa-template keys and onboarding-catalog keys.
 * Do not silently invent mappings — only known product mismatches live here.
 */
export const DOCUMENT_KEY_ALIASES: Record<string, string[]> = {
  // O-1A template ↔ catalog file slots
  awards_evidence: ['award_evidence', 'award_certificates', 'awards'],
  award_evidence: ['awards_evidence', 'award_certificates', 'awards'],
  award_certificates: ['awards_evidence', 'award_evidence', 'awards'],
  judging_evidence: ['judging_invitations', 'judging'],
  judging_invitations: ['judging_evidence', 'judging'],
  publications_evidence: ['publication_pdfs', 'publications'],
  publication_pdfs: ['publications_evidence', 'publications'],
  media_evidence: ['media_clippings', 'media'],
  media_clippings: ['media_evidence', 'media'],
  contributions_evidence: ['contribution_evidence', 'contributions'],
  contribution_evidence: ['contributions_evidence', 'contributions'],
  critical_role_evidence: ['critical_role_letter', 'org_evidence', 'critical_role'],
  critical_role_letter: ['critical_role_evidence', 'org_evidence', 'critical_role'],
  org_evidence: ['critical_role_evidence', 'critical_role_letter', 'critical_role'],
  memberships_evidence: ['membership_proof', 'memberships'],
  membership_proof: ['memberships_evidence', 'memberships'],
  high_salary_evidence: ['salary_docs', 'salary_surveys', 'high_salary'],
  salary_docs: ['high_salary_evidence', 'salary_surveys', 'high_salary'],
  salary_surveys: ['high_salary_evidence', 'salary_docs', 'high_salary'],
  speaking_evidence: ['speaking'],
  employment_letter: ['offer_letter'],
  offer_letter: ['employment_letter'],
  recommender_contacts: ['recommenders'],
  recommenders: ['recommender_contacts'],
  // Signed letters already uploaded in onboarding belong to the signed-letters slot, not contacts.
  existing_letters: ['recommendation_letters'],
  recommendation_letters: ['existing_letters'],
  // EB-1A / NIW / L-1 / EB-5 template keys ↔ onboarding catalog keys
  status_docs: ['immigration_status_docs'],
  immigration_status_docs: ['status_docs'],
  pay_evidence: ['pay_records'],
  pay_records: ['pay_evidence'],
  proposed_work: ['support_letter', 'contract'],
  certifications: ['professional_certifications'],
  // Additional evidence family
  additional_evidence: ['additional_files', 'additional', 'other_supporting_document'],
  additional_files: ['additional_evidence', 'additional', 'other_supporting_document'],
  additional: ['additional_evidence', 'additional_files', 'other_supporting_document'],
  other_supporting_document: ['additional_evidence', 'additional_files', 'additional'],
}

/** Names for retired template keys so files uploaded under them keep a readable label. */
const LEGACY_DOCUMENT_LABELS: Record<string, string> = {
  portfolio: 'Portfolio / demo reel',
}

let cachedTemplateKeys: Set<string> | null = null

export function allTemplateDocumentKeys(): Set<string> {
  if (cachedTemplateKeys) return cachedTemplateKeys
  const keys = new Set<string>()
  for (const template of SEED_VISA_TEMPLATES) {
    for (const item of template.items) keys.add(item.documentKey)
  }
  cachedTemplateKeys = keys
  return keys
}

export function isAdditionalEvidenceKey(key: string): boolean {
  const normalized = key.trim().toLowerCase()
  return ADDITIONAL_EVIDENCE_KEYS.has(normalized)
}

/** Every identifier that should match the same request slot / upload. */
export function documentKeyLookupKeys(key: string): string[] {
  const trimmed = key.trim()
  if (!trimmed) return []
  const aliases = DOCUMENT_KEY_ALIASES[trimmed] ?? []
  const out = new Set<string>([trimmed, ...aliases])
  if (isAdditionalEvidenceKey(trimmed)) {
    for (const extra of ADDITIONAL_EVIDENCE_KEYS) out.add(extra)
  }
  return [...out]
}

export function isKnownDocumentKey(key: string): boolean {
  const trimmed = key.trim()
  if (!trimmed) return false
  if (isAdditionalEvidenceKey(trimmed)) return true
  if (questionByKey(trimmed)) return true
  if (allTemplateDocumentKeys().has(trimmed)) return true
  if (isLinkRequestKey(trimmed)) return true
  // Any explicit alias target is known.
  for (const keys of Object.values(DOCUMENT_KEY_ALIASES)) {
    if (keys.includes(trimmed)) return true
  }
  if (trimmed in DOCUMENT_KEY_ALIASES) return true
  if (trimmed.startsWith('custom_')) return true
  return false
}

export function resolveDocumentCategory(key: string, fallback?: string | null): string {
  if (isAdditionalEvidenceKey(key) || key === OTHER_SUPPORTING_DOCUMENT_KEY) {
    return fallback?.trim() || 'additional'
  }
  const mapped = questionByKey(key)
  if (mapped) return mapped.category.id
  for (const template of SEED_VISA_TEMPLATES) {
    const item = template.items.find((i) => i.documentKey === key)
    if (item) return item.category
  }
  const link = PROFILE_LINK_OPTIONS.find((o) => o.key === key)
  if (link) return link.category
  return fallback?.trim() || 'additional'
}

export function resolveDocumentType(key: string, fallback?: string | null): string {
  if (isAdditionalEvidenceKey(key)) return 'additional_evidence'
  const mapped = questionByKey(key)
  if (mapped?.question.documentType) return mapped.question.documentType
  return fallback?.trim() || key
}

export type DocumentLabelDef = { key: string; label: string; category?: string | null }

/** Request-item names win, then custom defs — used by Overview and Received Documents. */
export function defsFromRequestItems(
  items: Array<{ documentKey?: string | null; key?: string | null; documentName?: string | null; label?: string | null; category?: string | null }> = [],
): DocumentLabelDef[] {
  const out: DocumentLabelDef[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const key = (item.documentKey || item.key || '').trim()
    const label = (item.documentName || item.label || '').trim()
    if (!key || !label || seen.has(key)) continue
    seen.add(key)
    out.push({ key, label, category: item.category ?? null })
  }
  return out
}

function templateDocumentName(key: string): string | null {
  const lookup = new Set(documentKeyLookupKeys(key))
  const preferred = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'O_1A')
  const templates = preferred
    ? [preferred, ...SEED_VISA_TEMPLATES.filter((t) => t !== preferred)]
    : SEED_VISA_TEMPLATES
  for (const template of templates) {
    const item = template.items.find((i) => lookup.has(i.documentKey))
    if (item?.documentName?.trim()) return item.documentName.trim()
  }
  return null
}

/**
 * One display name for Request Documents, Received Documents, and Overview.
 * Case-specific request labels win; otherwise the visa-template name; then the catalog label.
 */
export function canonicalDocumentLabel(key: string, customDefs: DocumentLabelDef[] = []): string {
  const trimmed = key.trim()
  if (!trimmed) return 'Document'
  const lookup = documentKeyLookupKeys(trimmed)
  const def = customDefs.find((d) => lookup.includes(d.key) || d.key === trimmed)
  if (def?.label?.trim()) return def.label.trim()
  const fromTemplate = templateDocumentName(trimmed)
  if (fromTemplate) return fromTemplate
  const mapped = questionByKey(trimmed)
  if (mapped?.question.label) return mapped.question.label
  for (const alias of lookup) {
    const q = questionByKey(alias)
    if (q?.question.label) return q.question.label
  }
  const profile = PROFILE_LINK_OPTIONS.find((o) => o.key === trimmed)
  if (profile) return profile.label
  if (LEGACY_DOCUMENT_LABELS[trimmed]) return LEGACY_DOCUMENT_LABELS[trimmed]
  return trimmed.replace(/^lawyer_upload_/, '').replaceAll('_', ' ') || 'Uploaded file'
}

/** Catalog + template keys advertised as file upload slots. */
export function advertisedFileDocumentKeys(): string[] {
  const keys = new Set<string>()
  for (const q of allQuestions()) {
    if (q.type === 'file') keys.add(q.key)
  }
  for (const key of allTemplateDocumentKeys()) keys.add(key)
  keys.add(OTHER_SUPPORTING_DOCUMENT_KEY)
  for (const key of ADDITIONAL_EVIDENCE_KEYS) keys.add(key)
  return [...keys]
}
