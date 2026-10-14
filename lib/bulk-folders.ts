/**
 * Candidate folder layout shared by "Download All" and "Bulk Upload".
 *
 * Candidates/
 * ├── README.txt
 * ├── _New_Candidate_Template/            (copy, rename and fill in to add a candidate)
 * └── <Candidate Name>/
 *     ├── Candidate_Details.pdf           readable summary (export only)
 *     ├── Candidate_Details.json          machine-readable details; edit to update the record
 *     ├── Uploaded_Documents/<Document name>/<original file name>
 *     ├── Quoted_Amount.pdf
 *     ├── Payment_Plan.pdf
 *     ├── Lawyers_Notes.pdf
 *     └── Additional_Information/         onboarding answers, links (Links.txt), other files
 *
 * The same rules are used in the browser (building and reading the ZIP) and on the server
 * (matching folders to candidates), so this module has no server-only imports.
 */

export const BULK_ROOT = 'Candidates'
export const BULK_FORMAT = 'afterstem-candidate-folder/v1'
export const DETAILS_JSON = 'Candidate_Details.json'
export const DETAILS_PDF = 'Candidate_Details.pdf'
export const DOCUMENTS_DIR = 'Uploaded_Documents'
export const QUOTE_PDF = 'Quoted_Amount.pdf'
export const PAYMENT_PLAN_PDF = 'Payment_Plan.pdf'
export const NOTES_PDF = 'Lawyers_Notes.pdf'
export const ADDITIONAL_DIR = 'Additional_Information'
export const LINKS_TXT = 'Links.txt'
export const ANSWERS_PDF = 'Onboarding_Answers.pdf'
export const MANIFEST_FILE = '.afterstem-manifest.json'
export const TEMPLATE_DIR = '_New_Candidate_Template'
/** PDF subject written into every generated summary, so re-uploading it is recognised and skipped. */
export const GENERATED_PDF_SUBJECT = 'afterstem-export'

/** Editable details for one candidate folder (Candidate_Details.json). */
export type CandidateFolderDetails = {
  format?: string
  candidateNumber?: string | null
  fullLegalName?: string | null
  email?: string | null
  phone?: string | null
  nationality?: string | null
  dateOfBirth?: string | null
  currentImmigrationStatus?: string | null
  currentAddress?: string | null
  /** Visa type code (O_1A, H_1B, …). Used when a new candidate is created. */
  visaType?: string | null
  /** Read-only on upload: shown for reference. */
  caseNumber?: string | null
  caseStatus?: string | null
  quotedAmount?: string | null
  /** Add text here offline; each entry is added as a new note on upload. */
  newLawyerNotes?: string[]
}

/** Fields an upload may change on an existing candidate. */
export const EDITABLE_FIELDS = [
  'fullLegalName',
  'email',
  'phone',
  'nationality',
  'dateOfBirth',
  'currentImmigrationStatus',
  'currentAddress',
] as const
export type EditableField = (typeof EDITABLE_FIELDS)[number]

export const FIELD_LABELS: Record<EditableField, string> = {
  fullLegalName: 'Name',
  email: 'Email',
  phone: 'Phone',
  nationality: 'Nationality',
  dateOfBirth: 'Date of birth',
  currentImmigrationStatus: 'Immigration status',
  currentAddress: 'Address',
}

/** Characters that are not safe in file or folder names on Windows, macOS or in ZIPs. */
export function safeFolderName(value: string | null | undefined, fallback = 'Item'): string {
  const cleaned = String(value ?? '')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .slice(0, 120)
  return cleaned || fallback
}

/** Folder per candidate, named after them; a clash adds the candidate number. */
export function candidateFolderNames(candidates: Array<{ id: string; fullLegalName: string; candidateNumber: string }>) {
  const counts = new Map<string, number>()
  for (const c of candidates) {
    const key = safeFolderName(c.fullLegalName, 'Unnamed').toLowerCase()
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const names = new Map<string, string>()
  for (const c of candidates) {
    const base = safeFolderName(c.fullLegalName, 'Unnamed')
    names.set(c.id, (counts.get(base.toLowerCase()) ?? 0) > 1 ? `${base} (${c.candidateNumber})` : base)
  }
  return names
}

/** Unique file name inside one folder ("Passport.pdf", "Passport (2).pdf"). */
export function uniqueFileName(used: Set<string>, name: string): string {
  const safe = safeFolderName(name, 'file')
  if (!used.has(safe.toLowerCase())) {
    used.add(safe.toLowerCase())
    return safe
  }
  const dot = safe.lastIndexOf('.')
  const stem = dot > 0 ? safe.slice(0, dot) : safe
  const ext = dot > 0 ? safe.slice(dot) : ''
  let i = 2
  while (used.has(`${stem} (${i})${ext}`.toLowerCase())) i += 1
  const next = `${stem} (${i})${ext}`
  used.add(next.toLowerCase())
  return next
}

export type BulkEntryKind =
  | 'details-json'
  | 'details-file'
  | 'document'
  | 'quote-file'
  | 'payment-plan-file'
  | 'notes-file'
  | 'links-txt'
  | 'additional-file'
  | 'manifest'
  | 'ignored'

export type ClassifiedEntry = {
  /** Candidate folder name, or null for files outside any candidate folder. */
  folder: string | null
  kind: BulkEntryKind
  /** Path inside the candidate folder. */
  relativePath: string
  fileName: string
  /** Document name folder under Uploaded_Documents (null = loose file there). */
  documentFolder: string | null
  reason?: string
}

const norm = (value: string) => value.toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, '')

/**
 * Classify one path from an uploaded ZIP. Accepts the ZIP with or without the top
 * "Candidates/" folder, and ignores system files (__MACOSX, .DS_Store, Thumbs.db).
 */
export function classifyZipPath(path: string): ClassifiedEntry {
  const parts = path.replace(/\\/g, '/').split('/').filter(Boolean)
  const fileName = parts[parts.length - 1] ?? ''
  const base: Omit<ClassifiedEntry, 'kind'> = { folder: null, relativePath: '', fileName, documentFolder: null }
  if (!parts.length || parts.some((p) => p === '__MACOSX') || /^(\.ds_store|thumbs\.db|desktop\.ini)$/i.test(fileName) || fileName.startsWith('._')) {
    return { ...base, kind: 'ignored', reason: 'System file' }
  }
  if (parts[0].toLowerCase() === BULK_ROOT.toLowerCase()) parts.shift()
  if (parts.length < 2) return { ...base, kind: 'ignored', reason: 'Not inside a candidate folder' }
  const [folder, ...rest] = parts
  if (folder.startsWith('_')) return { ...base, kind: 'ignored', reason: 'Template folder' }
  const relativePath = rest.join('/')
  const entry = { ...base, folder, relativePath }
  const top = rest[0]
  const topNorm = norm(top)

  if (rest.length === 1) {
    if (fileName === MANIFEST_FILE) return { ...entry, kind: 'manifest' }
    if (fileName.toLowerCase() === DETAILS_JSON.toLowerCase()) return { ...entry, kind: 'details-json' }
    if (topNorm.startsWith('candidatedetails')) return { ...entry, kind: 'details-file' }
    if (topNorm.startsWith('quotedamount')) return { ...entry, kind: 'quote-file' }
    if (topNorm.startsWith('paymentplan')) return { ...entry, kind: 'payment-plan-file' }
    if (topNorm.startsWith('lawyersnotes')) return { ...entry, kind: 'notes-file' }
    // Loose files in the candidate folder are kept as additional information.
    return { ...entry, kind: 'additional-file' }
  }
  if (topNorm === norm(DOCUMENTS_DIR)) {
    return { ...entry, kind: 'document', documentFolder: rest.length > 2 ? rest[1] : null }
  }
  if (topNorm === norm(ADDITIONAL_DIR)) {
    if (rest.length === 2 && fileName.toLowerCase() === LINKS_TXT.toLowerCase()) return { ...entry, kind: 'links-txt' }
    return { ...entry, kind: 'additional-file' }
  }
  if (topNorm.startsWith('quotedamount')) return { ...entry, kind: 'quote-file' }
  if (topNorm.startsWith('paymentplan')) return { ...entry, kind: 'payment-plan-file' }
  if (topNorm.startsWith('lawyersnotes')) return { ...entry, kind: 'notes-file' }
  if (topNorm.startsWith('candidatedetails')) return { ...entry, kind: 'details-file' }
  return { ...entry, kind: 'additional-file' }
}

/** Where a non-checklist file is stored on the candidate's record. */
export const FILE_KIND_SLOT: Record<'details-file' | 'quote-file' | 'payment-plan-file' | 'notes-file' | 'additional-file', { questionKey: string; category: string; label: string }> = {
  'details-file': { questionKey: 'custom_bulk_candidate_details', category: 'Candidate details', label: 'Candidate details' },
  'quote-file': { questionKey: 'custom_bulk_quoted_amount', category: 'Pricing', label: 'Quoted amount' },
  'payment-plan-file': { questionKey: 'custom_bulk_payment_plan', category: 'Payment plan', label: 'Payment plan' },
  'notes-file': { questionKey: 'custom_bulk_lawyers_notes', category: "Lawyer's notes", label: "Lawyer's notes" },
  'additional-file': { questionKey: 'other_supporting_document', category: 'Additional information', label: 'Additional information' },
}

/** Match a document folder name to one of the case's document items (by name or key). */
export function matchDocumentFolder(
  folderName: string | null,
  items: Array<{ key: string; label: string }>,
): { key: string; label: string } | null {
  if (!folderName) return null
  const target = norm(folderName)
  if (!target) return null
  return items.find((i) => norm(i.label) === target) ?? items.find((i) => norm(i.key) === target) ?? null
}

/** Parse Links.txt: one link per line, optionally "Name: https://…". Lines starting with # are comments. */
export function parseLinksTxt(text: string): Array<{ label: string; url: string }> {
  const out: Array<{ label: string; url: string }> = []
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const match = line.match(/^(.*?)(?:\s*[:\-–]\s+)?((?:https?:\/\/)\S+)$/i)
    if (match) out.push({ label: match[1].trim(), url: match[2].trim() })
    else if (/^[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(line)) out.push({ label: '', url: line })
  }
  return out
}

export function formatLinksTxt(links: Array<{ label: string; url: string }>): string {
  return [
    '# Links saved for this candidate. Add a new link on its own line (optionally "Name: https://…")',
    '# and it is added on Bulk Upload. Removing a line here does not delete a saved link.',
    ...links.map((l) => (l.label && l.label !== l.url ? `${l.label}: ${l.url}` : l.url)),
    '',
  ].join('\n')
}

export const README_TXT = `Afterstem candidate folders
===========================

Each folder is one candidate, named after them. Inside:

  Candidate_Details.pdf     readable summary of the candidate
  Candidate_Details.json    the candidate's details - edit this file to update them
  Uploaded_Documents/       their documents, one folder per document on their list
  Quoted_Amount.pdf         quoted amount (if you have finance access)
  Payment_Plan.pdf          payment plan and payments received (if you have finance access)
  Lawyers_Notes.pdf         case notes (if you have notes access)
  Additional_Information/   onboarding answers, Links.txt and any other files

Bulk Upload (Candidates page) reads the same structure back:

  * Candidates are matched by candidate number, then email, then name.
    A match updates the existing record; nothing is duplicated.
  * A folder that matches no one creates a new candidate. It needs a
    Candidate_Details.json with at least fullLegalName, email and visaType.
    Copy _New_Candidate_Template, rename it and fill it in.
  * Put new files in Uploaded_Documents/<Document name>/. A folder name that
    matches a document on the candidate's list files it there; anything else
    is kept under Additional information.
  * Files already on the record are skipped, so re-uploading a downloaded
    folder never creates copies. Nothing already on the record is replaced or deleted.
  * Add new notes in "newLawyerNotes" in Candidate_Details.json.
  * Add new links on their own line in Additional_Information/Links.txt.
  * Quoted amounts and payment plans are not changed by an upload; change them
    in the Payments tab. Edited files placed there are kept as documents.
  * Allowed document types: PDF, DOC, DOCX, JPG, JPEG.
`

export const TEMPLATE_DETAILS: CandidateFolderDetails = {
  format: BULK_FORMAT,
  candidateNumber: null,
  fullLegalName: 'First Last',
  email: 'name@example.com',
  phone: null,
  nationality: null,
  dateOfBirth: null,
  currentImmigrationStatus: null,
  currentAddress: null,
  visaType: 'O_1A',
  newLawyerNotes: [],
}

/** Read Candidate_Details.json safely; returns an error message instead of throwing. */
export function parseDetailsJson(text: string): { details: CandidateFolderDetails | null; error?: string } {
  try {
    const value = JSON.parse(text.replace(/^﻿/, '')) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return { details: null, error: 'Candidate_Details.json is not an object.' }
    const raw = value as Record<string, unknown>
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() || null : typeof v === 'number' ? String(v) : null)
    const details: CandidateFolderDetails = {
      format: str(raw.format) ?? undefined,
      candidateNumber: str(raw.candidateNumber),
      fullLegalName: str(raw.fullLegalName),
      email: str(raw.email),
      phone: str(raw.phone),
      nationality: str(raw.nationality),
      dateOfBirth: str(raw.dateOfBirth),
      currentImmigrationStatus: str(raw.currentImmigrationStatus),
      currentAddress: str(raw.currentAddress),
      visaType: str(raw.visaType),
      caseNumber: str(raw.caseNumber),
      caseStatus: str(raw.caseStatus),
      quotedAmount: str(raw.quotedAmount),
      newLawyerNotes: Array.isArray(raw.newLawyerNotes)
        ? raw.newLawyerNotes.map((n) => (typeof n === 'string' ? n.trim() : '')).filter(Boolean)
        : [],
    }
    return { details }
  } catch (err) {
    return { details: null, error: `Candidate_Details.json could not be read: ${err instanceof Error ? err.message : 'invalid JSON'}` }
  }
}
