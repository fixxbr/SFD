/** Server-safe tab helpers for Candidate Profile (no React / client APIs). */

export type CandidateProfileTab =
  | 'overview'
  | 'documents'
  | 'lawyer-workspace'
  | 'payments'
  | 'emails'
  | 'notes'
  | 'activity'

export const CANDIDATE_PROFILE_TABS: Array<{ key: CandidateProfileTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'documents', label: 'Documents' },
  { key: 'lawyer-workspace', label: 'Lawyer Workspace' },
  { key: 'payments', label: 'Payments' },
  { key: 'emails', label: 'Communications' },
  { key: 'notes', label: 'Notes' },
  { key: 'activity', label: 'Activity' },
]

export const HASH_TO_TAB: Record<string, CandidateProfileTab> = {
  summary: 'overview',
  onboarding: 'overview',
  progress: 'overview',
  lawyer: 'overview',
  financial: 'payments',
  payment: 'payments',
  'doc-requests': 'documents',
  'missing-docs': 'documents',
  documents: 'documents',
  'lawyer-workspace': 'lawyer-workspace',
  notes: 'notes',
  communications: 'emails',
  activity: 'activity',
}

export const VALID_TABS = new Set<string>(CANDIDATE_PROFILE_TABS.map((t) => t.key))

/** Shared by the server page and client so the first paint matches hydration. */
export function resolveCandidateTab(
  searchTab: string | null | undefined,
  hash = '',
  lawyerMode = false,
): CandidateProfileTab {
  let tab: CandidateProfileTab = 'overview'
  if (searchTab && VALID_TABS.has(searchTab)) tab = searchTab as CandidateProfileTab
  else if (hash && HASH_TO_TAB[hash]) tab = HASH_TO_TAB[hash]
  if (lawyerMode && tab !== 'overview' && tab !== 'documents' && tab !== 'notes') return 'overview'
  return tab
}
