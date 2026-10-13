/**
 * One status calculation for requested documents.
 * Portals must not invent their own Uploaded / Pending rules.
 */

export const ADDITIONAL_KEY_PREFIX = 'additional__'

export type RequirementFile = {
  id?: string
  questionKey?: string | null
  documentType?: string | null
  documentRequestItemId?: string | null
  evidenceEntryId?: string | null
  isCurrentVersion?: boolean
  status?: string | null
  originalFilename?: string | null
  displayName?: string | null
  uploadedAt?: string | Date | null
  mimeType?: string | null
  description?: string | null
}

export type RequirementItem = {
  id?: string
  documentKey: string
  documentName: string
  category?: string | null
  instructions?: string | null
  status?: string | null
  documentRequestId?: string | null
}

export type RequirementDisplay = {
  code: 'UPLOADED' | 'ACCEPTED' | 'UNDER_REVIEW' | 'NEEDS_REPLACEMENT' | 'REQUESTED'
  label: string
  candidateLabel: string
}

export function additionalDocumentKey(parentKey: string, suffix = Date.now().toString(36)) {
  const parent = parentKey.replace(/[^a-zA-Z0-9_]+/g, '_').slice(0, 80) || 'document'
  return `${ADDITIONAL_KEY_PREFIX}${parent}__${suffix}`
}

export function parentKeyFromAdditional(key: string): string | null {
  if (!key.startsWith(ADDITIONAL_KEY_PREFIX)) return null
  const rest = key.slice(ADDITIONAL_KEY_PREFIX.length)
  const split = rest.lastIndexOf('__')
  if (split <= 0) return null
  return rest.slice(0, split)
}

export function isAdditionalRequestKey(key: string) {
  return key.startsWith(ADDITIONAL_KEY_PREFIX)
}

function activeFiles(files: RequirementFile[]) {
  return files.filter((file) => {
    if (file.evidenceEntryId) return false
    if (file.isCurrentVersion === false) return false
    if (String(file.status || '').toUpperCase() === 'ARCHIVED') return false
    return true
  })
}

export function filesForRequirement(item: Pick<RequirementItem, 'id' | 'documentKey'>, documents: RequirementFile[]) {
  return activeFiles(documents).filter((file) => {
    if (item.id && file.documentRequestItemId === item.id) return true
    if (file.questionKey && file.questionKey === item.documentKey) return true
    if (file.documentType && file.documentType === item.documentKey) return true

    const parentKey = parentKeyFromAdditional(item.documentKey)
    if (parentKey) {
      if (file.questionKey === parentKey) return true
      if (file.documentType === parentKey) return true
    }
    return false
  })
}

export function displayRequirementStatus(input: {
  requestStatus?: string | null
  files?: RequirementFile[]
  additional?: boolean
}): RequirementDisplay {
  const files = activeFiles(input.files ?? [])
  const statuses = files.map((file) => String(file.status || 'UPLOADED').toUpperCase())
  if (files.length) {
    if (statuses.every((status) => status === 'ACCEPTED')) {
      return { code: 'ACCEPTED', label: 'Approved', candidateLabel: 'Approved' }
    }
    if (statuses.some((status) => status === 'NEEDS_REPLACEMENT')) {
      return {
        code: 'NEEDS_REPLACEMENT',
        label: 'Needs additional documentation',
        candidateLabel: 'Needs additional documentation',
      }
    }
    if (statuses.some((status) => status === 'UNDER_REVIEW')) {
      return { code: 'UNDER_REVIEW', label: 'Under review', candidateLabel: 'Under review' }
    }
    return { code: 'UPLOADED', label: 'Uploaded', candidateLabel: 'Uploaded' }
  }
  const requestStatus = String(input.requestStatus || 'REQUESTED').toUpperCase()
  if (requestStatus === 'NEEDS_REPLACEMENT' || requestStatus === 'NEEDS_ADDITIONAL_DOCUMENTS') {
    return {
      code: 'REQUESTED',
      label: 'Additional documentation requested',
      candidateLabel: 'Additional documentation requested',
    }
  }
  return { code: 'REQUESTED', label: 'Pending', candidateLabel: 'Waiting for upload' }
}

export type RequirementRow = RequirementItem & {
  files: RequirementFile[]
  display: RequirementDisplay
  additional: boolean
  parentKey: string | null
}

/** Same rows for candidate, admin, and lawyer. Files win over a stale request-item status. */
export function buildRequirementRows(items: RequirementItem[], documents: RequirementFile[]): RequirementRow[] {
  const seen = new Set<string>()
  const rows: RequirementRow[] = []
  for (const item of items) {
    if (!item.documentKey || seen.has(item.documentKey)) continue
    seen.add(item.documentKey)
    const files = filesForRequirement(item, documents)
    const additional = isAdditionalRequestKey(item.documentKey)
    rows.push({
      ...item,
      files,
      additional,
      parentKey: parentKeyFromAdditional(item.documentKey),
      display: displayRequirementStatus({
        requestStatus: item.status,
        files,
        additional,
      }),
    })
  }
  return rows
}
