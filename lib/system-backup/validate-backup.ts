import JSZip from 'jszip'
import {
  BACKUP_APPLICATION,
  BACKUP_VERSION,
  SCHEMA_VERSION,
  assertSafeZipPath,
  sha256,
} from '@/lib/system-backup/common'

export type BackupPreview = {
  valid: boolean
  errors: string[]
  warnings: string[]
  manifest: Record<string, unknown> | null
  counts: {
    candidates: number
    cases: number
    documents: number
    evidence: number
    payments: number
    pdfFiles: number
    imageFiles: number
    otherFiles: number
    filesVerified: number
    filesMissingInZip: number
  }
  rootPrefix: string
}

function findRootPrefix(paths: string[]): string {
  const manifestPath = paths.find((p) => p.endsWith('/manifest.json') || p === 'manifest.json')
  if (!manifestPath) return ''
  if (manifestPath === 'manifest.json') return ''
  return manifestPath.slice(0, manifestPath.length - 'manifest.json'.length)
}

export async function validateBackupZip(buffer: Buffer): Promise<BackupPreview> {
  const errors: string[] = []
  const warnings: string[] = []
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(buffer)
  } catch {
    return {
      valid: false,
      errors: ['ZIP is not readable.'],
      warnings: [],
      manifest: null,
      counts: emptyCounts(),
      rootPrefix: '',
    }
  }

  const paths: string[] = []
  zip.forEach((relativePath, entry) => {
    if (entry.dir) return
    try {
      paths.push(assertSafeZipPath(relativePath))
    } catch (err) {
      errors.push(err instanceof Error ? err.message : 'Unsafe ZIP entry')
    }
  })
  if (errors.length) {
    return { valid: false, errors, warnings, manifest: null, counts: emptyCounts(), rootPrefix: '' }
  }

  const rootPrefix = findRootPrefix(paths)
  const need = (rel: string) => zip.file(`${rootPrefix}${rel}`)

  const manifestEntry = need('manifest.json')
  if (!manifestEntry) {
    errors.push('manifest.json is missing.')
    return { valid: false, errors, warnings, manifest: null, counts: emptyCounts(), rootPrefix }
  }

  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(await manifestEntry.async('string'))
  } catch {
    errors.push('manifest.json is invalid JSON.')
    return { valid: false, errors, warnings, manifest: null, counts: emptyCounts(), rootPrefix }
  }

  if (manifest.application !== BACKUP_APPLICATION && manifest.application !== 'LAWFIRM') {
    errors.push('This ZIP is not an Afterstem backup (application mismatch).')
  }
  if (!manifest.backupVersion) errors.push('backupVersion is missing.')
  if (!manifest.schemaVersion) errors.push('schemaVersion is missing.')
  if (manifest.backupVersion && String(manifest.backupVersion) !== BACKUP_VERSION) {
    warnings.push(`Backup version ${manifest.backupVersion} differs from current ${BACKUP_VERSION}.`)
  }
  if (manifest.schemaVersion && String(manifest.schemaVersion) !== SCHEMA_VERSION) {
    warnings.push(`Schema version ${manifest.schemaVersion} differs from current ${SCHEMA_VERSION}.`)
  }

  const graphEntry = need('data/graph.json') || need('data/candidates.json')
  if (!graphEntry) errors.push('data/graph.json (or candidates.json) is missing.')
  const docsEntry = need('data/documents.json')
  if (!docsEntry) errors.push('data/documents.json is missing.')

  let documents: Array<Record<string, any>> = []
  if (docsEntry) {
    try {
      documents = JSON.parse(await docsEntry.async('string'))
    } catch {
      errors.push('documents.json is invalid JSON.')
    }
  }

  let graph: any = null
  if (need('data/graph.json')) {
    try {
      graph = JSON.parse(await need('data/graph.json')!.async('string'))
    } catch {
      errors.push('graph.json is invalid JSON.')
    }
  }

  let filesVerified = 0
  let filesMissingInZip = 0
  let pdfFiles = 0
  let imageFiles = 0
  let otherFiles = 0

  for (const doc of documents) {
    if (!doc.backupPath || doc.included === false) continue
    const path = assertSafeZipPath(`${rootPrefix}${doc.backupPath}`.replace(/\/+/g, '/').replace(/^\//, ''))
    // backupPath is relative to root folder already in our builder
    const entry =
      zip.file(`${rootPrefix}${doc.backupPath}`) ||
      zip.file(doc.backupPath) ||
      zip.file(path)
    if (!entry) {
      filesMissingInZip += 1
      warnings.push(`Referenced file missing in ZIP: ${doc.backupPath}`)
      continue
    }
    const bytes = await entry.async('nodebuffer')
    if (doc.checksum) {
      const actual = sha256(bytes)
      if (actual !== doc.checksum) {
        errors.push(`Checksum mismatch for ${doc.backupPath}`)
        continue
      }
    }
    filesVerified += 1
    const name = String(doc.originalFileName || doc.backupPath).toLowerCase()
    if (name.endsWith('.pdf') || doc.mimeType === 'application/pdf') pdfFiles += 1
    else if (/\.(png|jpe?g|webp|gif)$/.test(name) || String(doc.mimeType || '').startsWith('image/')) imageFiles += 1
    else otherFiles += 1
  }

  const counts = {
    candidates: Number(manifest.candidateCount ?? graph?.candidates?.length ?? 0),
    cases: Number(manifest.caseCount ?? graph?.cases?.length ?? 0),
    documents: Number(manifest.documentCount ?? documents.length),
    evidence: Number(manifest.evidenceCount ?? graph?.evidenceEntries?.length ?? 0),
    payments: Number(manifest.paymentCount ?? graph?.payments?.length ?? 0),
    pdfFiles,
    imageFiles,
    otherFiles,
    filesVerified,
    filesMissingInZip,
  }

  if (manifest.incomplete) warnings.push('Backup was marked incomplete when created (some storage objects were missing).')

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    manifest,
    counts,
    rootPrefix,
  }
}

function emptyCounts(): BackupPreview['counts'] {
  return {
    candidates: 0,
    cases: 0,
    documents: 0,
    evidence: 0,
    payments: 0,
    pdfFiles: 0,
    imageFiles: 0,
    otherFiles: 0,
    filesVerified: 0,
    filesMissingInZip: 0,
  }
}

export async function readBackupGraph(buffer: Buffer) {
  const preview = await validateBackupZip(buffer)
  if (!preview.valid) throw new Error(preview.errors.join(' '))
  const zip = await JSZip.loadAsync(buffer)
  const root = preview.rootPrefix
  const graphFile = zip.file(`${root}data/graph.json`)
  if (!graphFile) throw new Error('graph.json missing')
  const graph = JSON.parse(await graphFile.async('string'))
  const docsFile = zip.file(`${root}data/documents.json`)
  const documents = docsFile ? JSON.parse(await docsFile.async('string')) : graph.documents ?? []
  return { zip, root, graph, documents, preview }
}
