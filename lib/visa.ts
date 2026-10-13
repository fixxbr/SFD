import type { VisaType } from '@prisma/client'

export const VISA_LABELS: Record<VisaType, string> = {
  O_1A: 'O-1A',
  O_1B: 'O-1B',
  EB_1A: 'EB-1A',
  EB_2_NIW: 'EB-2 NIW',
  EB_5: 'EB-5',
  H_1B: 'H-1B',
  L_1A: 'L-1A',
  L_1B: 'L-1B',
  OTHER: 'Other',
}

export const CASE_STATUS_LABELS: Record<string, string> = {
  ASSESSMENT: 'Assessment',
  QUALIFIED: 'Qualified',
  ONBOARDING_NOT_SENT: 'Onboarding not sent',
  ONBOARDING_SENT: 'Onboarding sent',
  ONBOARDING_IN_PROGRESS: 'Onboarding in progress',
  ONBOARDING_SUBMITTED: 'Onboarding submitted',
  DOCUMENT_REVIEW: 'Document review',
  MORE_DOCUMENTS_REQUIRED: 'More documents required',
  EVIDENCE_BUILDING: 'Evidence building',
  ATTORNEY_REVIEW: 'Attorney review',
  PETITION_DRAFTING: 'Petition drafting',
  CLIENT_REVIEW: 'Client review',
  READY_TO_FILE: 'Ready to file',
  FILED: 'Filed',
  USCIS_REVIEW: 'USCIS review',
  RFE: 'RFE',
  RFE_RESPONSE: 'RFE response',
  APPROVED: 'Approved',
  DENIED: 'Denied',
  CLOSED: 'Closed',
}

export const CASE_NUMBER_PREFIX: Record<VisaType, string> = {
  O_1A: 'O1A',
  O_1B: 'O1B',
  EB_1A: 'EB1A',
  EB_2_NIW: 'NIW',
  EB_5: 'EB5',
  H_1B: 'H1B',
  L_1A: 'L1A',
  L_1B: 'L1B',
  OTHER: 'OTH',
}

export function parseVisaType(value: string | null | undefined): VisaType {
  const raw = (value ?? '').toUpperCase().replace(/[\s-]+/g, '_')
  if (raw.includes('O_1B') || raw.includes('O1B')) return 'O_1B'
  if (raw.includes('O_1A') || raw.includes('O1A') || value?.includes('O-1A')) return 'O_1A'
  if (raw.includes('EB_1A') || raw.includes('EB1A') || value?.includes('EB-1A')) return 'EB_1A'
  if (raw.includes('NIW') || raw.includes('EB_2')) return 'EB_2_NIW'
  if (raw.includes('EB_5') || raw.includes('EB5') || value?.includes('EB-5')) return 'EB_5'
  if (raw.includes('H_1B') || raw.includes('H1B') || value?.includes('H-1B')) return 'H_1B'
  if (raw.includes('L_1A') || raw.includes('L1A') || value?.includes('L-1A')) return 'L_1A'
  if (raw.includes('L_1B') || raw.includes('L1B') || value?.includes('L-1B')) return 'L_1B'
  if (value?.includes('O-1B')) return 'O_1B'
  if (value?.includes('O-1')) return 'O_1A'
  return 'OTHER'
}

export function formatVisa(type: VisaType | string): string {
  return VISA_LABELS[type as VisaType] ?? String(type).replaceAll('_', '-')
}
