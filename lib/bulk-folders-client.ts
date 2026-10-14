'use client'

import JSZip from 'jszip'
import { saveBlob } from '@/lib/admin-downloads'
import { uploadFileToApi } from '@/lib/client-upload'
import { resolveAllowedMimeType, validateCandidateUploadFile } from '@/lib/upload-validation'
import { normalizeSubmittedUrls, validateHttpUrl } from '@/lib/link-request-items'
import {
  ADDITIONAL_DIR,
  ANSWERS_PDF,
  BULK_ROOT,
  DETAILS_JSON,
  DETAILS_PDF,
  DOCUMENTS_DIR,
  FILE_KIND_SLOT,
  GENERATED_PDF_SUBJECT,
  LINKS_TXT,
  MANIFEST_FILE,
  NOTES_PDF,
  PAYMENT_PLAN_PDF,
  QUOTE_PDF,
  README_TXT,
  TEMPLATE_DETAILS,
  TEMPLATE_DIR,
  classifyZipPath,
  formatLinksTxt,
  matchDocumentFolder,
  parseLinksTxt,
  safeFolderName,
  uniqueFileName,
  type ClassifiedEntry,
  type CandidateFolderDetails,
} from '@/lib/bulk-folders'

type ManifestCandidate = {
  id: string
  candidateNumber: string
  fullLegalName: string
  folder: string
  caseId: string | null
  details: CandidateFolderDetails
  documents: Array<{ id: string; folder: string; fileName: string; size: number }>
  links: Array<{ label: string; url: string }>
}

export type Progress = { done: number; total: number; label: string }

async function readErr(res: Response, fallback: string) {
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  return json.error ?? `${fallback} (HTTP ${res.status})`
}

/** Run tasks with a small concurrency limit, so the server and browser are not flooded. */
async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++]
        await fn(item)
      }
    }),
  )
}

/**
 * Download All: one ZIP with a folder per candidate, named after them.
 * Built in the browser from individual requests, so it works for any number of candidates.
 */
export async function downloadCandidateFolders(input: { ids?: string[]; onProgress?: (p: Progress) => void }) {
  const q = input.ids?.length ? `?ids=${input.ids.join(',')}` : ''
  const res = await fetch(`/api/admin/candidates/bulk-folders${q}`, { cache: 'no-store' })
  if (!res.ok) throw new Error(await readErr(res, "We couldn't prepare this download"))
  const { scope, candidates } = (await res.json()) as { scope: { includeFinance: boolean; includeNotes: boolean }; candidates: ManifestCandidate[] }
  if (!candidates.length) throw new Error('There are no candidates to download.')

  const zip = new JSZip()
  const root = zip.folder(BULK_ROOT)!
  root.file('README.txt', README_TXT)
  root.folder(TEMPLATE_DIR)!.file(DETAILS_JSON, JSON.stringify(TEMPLATE_DETAILS, null, 2))
  root.folder(TEMPLATE_DIR)!.folder(DOCUMENTS_DIR)
  root.folder(TEMPLATE_DIR)!.folder(ADDITIONAL_DIR)

  const parts: Array<{ part: string; file: string; inAdditional?: boolean; when: boolean }> = [
    { part: 'details', file: DETAILS_PDF, when: true },
    { part: 'quote', file: QUOTE_PDF, when: scope.includeFinance },
    { part: 'payment-plan', file: PAYMENT_PLAN_PDF, when: scope.includeFinance },
    { part: 'notes', file: NOTES_PDF, when: scope.includeNotes },
    { part: 'answers', file: ANSWERS_PDF, inAdditional: true, when: true },
  ]
  const total = candidates.reduce((n, c) => n + c.documents.length + parts.filter((p) => p.when).length, 0)
  let done = 0
  const errors: string[] = []
  const tick = (label: string) => input.onProgress?.({ done: ++done, total, label })

  type Job = { candidate: ManifestCandidate; run: () => Promise<void> }
  const jobs: Job[] = []
  for (const candidate of candidates) {
    const folder = root.folder(candidate.folder)!
    const docsDir = folder.folder(DOCUMENTS_DIR)!
    const additional = folder.folder(ADDITIONAL_DIR)!
    folder.file(DETAILS_JSON, JSON.stringify(candidate.details, null, 2))
    additional.file(LINKS_TXT, formatLinksTxt(candidate.links))
    const manifest: Array<{ path: string; size: number; documentId: string }> = []
    const usedByFolder = new Map<string, Set<string>>()
    for (const doc of candidate.documents) {
      const sub = safeFolderName(doc.folder, 'Other')
      const used = usedByFolder.get(sub.toLowerCase()) ?? new Set<string>()
      usedByFolder.set(sub.toLowerCase(), used)
      const name = uniqueFileName(used, doc.fileName)
      const path = `${DOCUMENTS_DIR}/${sub}/${name}`
      manifest.push({ path, size: doc.size, documentId: doc.id })
      jobs.push({
        candidate,
        run: async () => {
          const r = await fetch(`/api/admin/documents/${doc.id}?download=1&stream=1`, { cache: 'no-store' })
          if (!r.ok) {
            errors.push(`${candidate.folder}/${path}: ${await readErr(r, 'download failed')}`)
          } else {
            docsDir.folder(sub)!.file(name, await r.arrayBuffer())
          }
          tick(`${candidate.fullLegalName}: ${name}`)
        },
      })
    }
    // Lets a re-upload recognise files that are already on the record.
    folder.file(MANIFEST_FILE, JSON.stringify({ candidateNumber: candidate.candidateNumber, files: manifest }, null, 2))
    for (const p of parts.filter((x) => x.when)) {
      jobs.push({
        candidate,
        run: async () => {
          const r = await fetch(`/api/admin/candidates/bulk-folders?candidateId=${candidate.id}&part=${p.part}`, { cache: 'no-store' })
          if (!r.ok) errors.push(`${candidate.folder}/${p.file}: ${await readErr(r, 'could not create')}`)
          else (p.inAdditional ? additional : folder).file(p.file, await r.arrayBuffer())
          tick(`${candidate.fullLegalName}: ${p.file}`)
        },
      })
    }
  }
  await pool(jobs, 4, (job) => job.run())
  if (errors.length) root.file('_Download_Errors.txt', `Some files could not be included:\n\n${errors.join('\n')}\n`)
  input.onProgress?.({ done: total, total, label: 'Compressing…' })
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  saveBlob(blob, `Candidates_${new Date().toISOString().slice(0, 10)}.zip`)
  return { candidates: candidates.length, files: total - errors.length, errors }
}

// ---------- Bulk Upload ----------

export type ParsedFolder = {
  folder: string
  detailsText: string | null
  entries: Array<ClassifiedEntry & { zipEntry: JSZip.JSZipObject }>
  manifest: Array<{ path: string; size: number }>
}

export type ParsedZip = { folders: ParsedFolder[]; ignored: Array<{ path: string; reason: string }> }

export async function readCandidateZip(file: File): Promise<ParsedZip> {
  if (!/\.zip$/i.test(file.name)) throw new Error('Choose a .zip file (the same folder structure Download All creates).')
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch {
    throw new Error('This ZIP file could not be opened. It may be damaged or password-protected.')
  }
  const folders = new Map<string, ParsedFolder>()
  const ignored: ParsedZip['ignored'] = []
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue
    const c = classifyZipPath(path)
    if (c.kind === 'ignored' || !c.folder) {
      if (c.reason !== 'System file' && c.reason !== 'Template folder' && !/README\.txt$|_Download_Errors\.txt$/i.test(path)) {
        ignored.push({ path, reason: c.reason ?? 'Not inside a candidate folder' })
      }
      continue
    }
    const f = folders.get(c.folder) ?? { folder: c.folder, detailsText: null, entries: [], manifest: [] }
    folders.set(c.folder, f)
    if (c.kind === 'details-json') f.detailsText = await entry.async('string')
    else if (c.kind === 'manifest') {
      try {
        const m = JSON.parse(await entry.async('string')) as { files?: Array<{ path: string; size: number }> }
        f.manifest = Array.isArray(m.files) ? m.files : []
      } catch {
        /* a broken manifest only means no skip hints */
      }
    } else f.entries.push({ ...c, zipEntry: entry })
  }
  if (!folders.size) throw new Error('No candidate folders were found. The ZIP should contain Candidates/<Candidate Name>/… folders.')
  return { folders: [...folders.values()].sort((a, b) => a.folder.localeCompare(b.folder)), ignored }
}

export type FolderPlan = {
  folder: string
  action: 'update' | 'create' | 'skip'
  matchedBy: string | null
  candidateId: string | null
  candidateNumber: string | null
  caseId: string | null
  name: string
  changes: Array<{ label: string; from: string | null; to: string }>
  newNotes: number
  warnings: string[]
  errors: string[]
  documentItems: Array<{ key: string; label: string }>
  existingFiles: Array<{ name: string; size: number }>
  existingLinks: string[]
}

export async function previewCandidateZip(parsed: ParsedZip): Promise<FolderPlan[]> {
  const res = await fetch('/api/admin/candidates/bulk-folders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'preview', folders: parsed.folders.map((f) => ({ folder: f.folder, detailsText: f.detailsText })) }),
  })
  if (!res.ok) throw new Error(await readErr(res, 'Preview failed'))
  return ((await res.json()) as { plans: FolderPlan[] }).plans
}

export type UploadRow = {
  folder: string
  path: string
  outcome: 'uploaded' | 'skipped' | 'error' | 'updated' | 'created' | 'link'
  detail: string
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
}

const stripCopySuffix = (name: string) => name.replace(/ \(\d+\)(?=\.[^.]+$|$)/, '').toLowerCase()

/** A summary PDF this app generated (re-uploading it would only add a stale copy). */
async function isGeneratedPdf(bytes: ArrayBuffer) {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false })
    return pdf.getSubject() === GENERATED_PDF_SUBJECT
  } catch {
    return false
  }
}

/** Apply the reviewed plan: update/create each candidate, then upload its files and links. */
export async function applyCandidateZip(input: {
  parsed: ParsedZip
  plans: FolderPlan[]
  onProgress?: (p: Progress) => void
}): Promise<UploadRow[]> {
  const rows: UploadRow[] = []
  const total = input.parsed.folders.reduce((n, f) => n + 1 + f.entries.length, 0)
  let done = 0
  const tick = (label: string) => input.onProgress?.({ done: ++done, total, label })

  for (const folder of input.parsed.folders) {
    const preview = input.plans.find((p) => p.folder === folder.folder)
    if (!preview || preview.action === 'skip') {
      rows.push({ folder: folder.folder, path: '', outcome: 'error', detail: preview?.errors.join(' ') || 'Not matched' })
      for (const e of folder.entries) rows.push({ folder: folder.folder, path: e.relativePath, outcome: 'skipped', detail: 'Candidate folder was skipped' })
      done += 1 + folder.entries.length
      input.onProgress?.({ done, total, label: folder.folder })
      continue
    }
    const res = await fetch('/api/admin/candidates/bulk-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'apply', folder: { folder: folder.folder, detailsText: folder.detailsText } }),
    })
    if (!res.ok) {
      rows.push({ folder: folder.folder, path: '', outcome: 'error', detail: await readErr(res, 'Could not save this candidate') })
      done += folder.entries.length
      tick(folder.folder)
      continue
    }
    const { result: plan } = (await res.json()) as { result: FolderPlan & { applied: string[] } }
    tick(folder.folder)
    for (const message of plan.applied) {
      rows.push({ folder: folder.folder, path: '', outcome: message.startsWith('Created') ? 'created' : 'updated', detail: message })
    }
    for (const w of plan.warnings) rows.push({ folder: folder.folder, path: '', outcome: 'skipped', detail: w })
    for (const e of plan.errors) rows.push({ folder: folder.folder, path: '', outcome: 'error', detail: e })
    if (plan.action === 'skip' || !plan.candidateId || !plan.caseId) {
      for (const e of folder.entries) {
        rows.push({ folder: folder.folder, path: e.relativePath, outcome: 'skipped', detail: 'No active case to file it under' })
        tick(e.relativePath)
      }
      continue
    }
    const existing = new Set(plan.existingFiles.map((f) => `${stripCopySuffix(f.name)}|${f.size}`))
    const manifestHit = new Set(folder.manifest.map((m) => `${m.path.toLowerCase()}|${m.size}`))
    const existingLinks = new Set(plan.existingLinks)

    for (const entry of folder.entries) {
      const path = entry.relativePath
      try {
        if (entry.kind === 'links-txt') {
          const text = await entry.zipEntry.async('string')
          let added = 0
          for (const link of parseLinksTxt(text)) {
            const [raw] = normalizeSubmittedUrls(link.url)
            const check = validateHttpUrl(raw ?? '')
            if (!check.ok) {
              rows.push({ folder: folder.folder, path, outcome: 'error', detail: `${link.url}: ${check.error}` })
              continue
            }
            if (existingLinks.has(check.href)) continue
            const r = await fetch('/api/admin/links', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ candidateId: plan.candidateId, caseId: plan.caseId, url: check.href, label: link.label }),
            })
            if (r.ok) {
              existingLinks.add(check.href)
              added += 1
              rows.push({ folder: folder.folder, path, outcome: 'link', detail: `Link added: ${check.href}` })
            } else {
              rows.push({ folder: folder.folder, path, outcome: 'error', detail: `${check.href}: ${await readErr(r, 'link not saved')}` })
            }
          }
          if (!added) rows.push({ folder: folder.folder, path, outcome: 'skipped', detail: 'No new links' })
          continue
        }
        const bytes = await entry.zipEntry.async('arraybuffer')
        const size = bytes.byteLength
        if (manifestHit.has(`${path.toLowerCase()}|${size}`) || existing.has(`${stripCopySuffix(entry.fileName)}|${size}`)) {
          rows.push({ folder: folder.folder, path, outcome: 'skipped', detail: 'Already on file' })
          continue
        }
        const ext = entry.fileName.split('.').pop()?.toLowerCase() ?? ''
        const mime = resolveAllowedMimeType({ mimeType: MIME_BY_EXT[ext] ?? '', filename: entry.fileName }) || MIME_BY_EXT[ext] || ''
        const check = validateCandidateUploadFile({ filename: entry.fileName, size, mimeType: mime })
        if (!check.ok) {
          rows.push({ folder: folder.folder, path, outcome: 'error', detail: check.error })
          continue
        }
        if (ext === 'pdf' && entry.kind !== 'document' && (await isGeneratedPdf(bytes))) {
          rows.push({ folder: folder.folder, path, outcome: 'skipped', detail: 'Summary created by Download All (not re-imported)' })
          continue
        }
        let questionKey: string
        let category: string
        let filedAs: string
        if (entry.kind === 'document') {
          const item = matchDocumentFolder(entry.documentFolder, plan.documentItems)
          if (item) {
            questionKey = item.key
            category = ''
            filedAs = item.label
          } else {
            const slot = FILE_KIND_SLOT['additional-file']
            questionKey = slot.questionKey
            category = slot.category
            filedAs = entry.documentFolder
              ? `${slot.label} (no document named "${entry.documentFolder}" on this candidate's list)`
              : slot.label
          }
        } else {
          const slot = FILE_KIND_SLOT[entry.kind as keyof typeof FILE_KIND_SLOT] ?? FILE_KIND_SLOT['additional-file']
          questionKey = slot.questionKey
          category = slot.category
          filedAs = slot.label
        }
        const file = new File([bytes], entry.fileName, { type: check.mimeType || mime })
        await uploadFileToApi({
          endpoint: '/api/admin/documents',
          file,
          fields: {
            candidateId: plan.candidateId,
            caseId: plan.caseId,
            questionKey,
            ...(category ? { category } : {}),
            description: `Bulk upload: ${path}`.slice(0, 1000),
          },
        })
        existing.add(`${stripCopySuffix(entry.fileName)}|${size}`)
        rows.push({ folder: folder.folder, path, outcome: 'uploaded', detail: `Filed under ${filedAs}` })
      } catch (err) {
        rows.push({ folder: folder.folder, path, outcome: 'error', detail: err instanceof Error ? err.message : 'Upload failed' })
      } finally {
        tick(path)
      }
    }
  }
  return rows
}

export function uploadSummaryCsv(rows: UploadRow[]) {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`
  return ['Folder,File,Result,Detail', ...rows.map((r) => [r.folder, r.path, r.outcome, r.detail].map(esc).join(','))].join('\n')
}

export function saveUploadSummary(rows: UploadRow[]) {
  saveBlob(new Blob([uploadSummaryCsv(rows)], { type: 'text/csv' }), `Bulk_Upload_Summary_${new Date().toISOString().slice(0, 10)}.csv`)
}

export { MIME_BY_EXT }
