'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { admin } from '@/lib/admin/ui'
import {
  applyCandidateZip,
  downloadCandidateFolders,
  previewCandidateZip,
  readCandidateZip,
  saveUploadSummary,
  type FolderPlan,
  type ParsedZip,
  type Progress,
  type UploadRow,
} from '@/lib/bulk-folders-client'

function ProgressBar({ progress }: { progress: Progress | null }) {
  if (!progress) return null
  const pct = progress.total ? Math.round((progress.done / progress.total) * 100) : 0
  return (
    <div className="space-y-1" role="status" aria-live="polite">
      <div className="h-2 w-full overflow-hidden rounded-full bg-[#E2E8F0]">
        <div className="h-full bg-[#0F766E] transition-[width]" style={{ width: `${pct}%` }} />
      </div>
      <p className="truncate text-xs text-[#64748B]">
        {progress.done} of {progress.total} · {progress.label}
      </p>
    </div>
  )
}

/** "Download All" (folder per candidate) and "Bulk Upload" (the same folders back). */
export function CandidateFoldersActions({ canUpload }: { canUpload: boolean }) {
  const [downloading, setDownloading] = useState<Progress | null>(null)
  const [downloadError, setDownloadError] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  async function downloadAll() {
    setDownloadError('')
    setDownloading({ done: 0, total: 1, label: 'Preparing…' })
    try {
      const result = await downloadCandidateFolders({ onProgress: setDownloading })
      if (result.errors.length) {
        setDownloadError(`${result.errors.length} file(s) could not be included; see _Download_Errors.txt in the ZIP.`)
      }
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "We couldn't prepare this download.")
    } finally {
      setDownloading(null)
    }
  }

  return (
    <>
      <button type="button" className={admin.btnSecondary} disabled={Boolean(downloading)} onClick={() => void downloadAll()}>
        {downloading ? `Preparing… ${downloading.total ? Math.round((downloading.done / downloading.total) * 100) : 0}%` : 'Download All'}
      </button>
      {canUpload && (
        <button type="button" className={admin.btnSecondary} onClick={() => setUploadOpen(true)}>
          Bulk Upload
        </button>
      )}
      {downloadError && <p className="w-full text-xs text-red-700">{downloadError}</p>}
      {uploadOpen && <BulkUploadModal onClose={() => setUploadOpen(false)} />}
    </>
  )
}

const OUTCOME_LABEL: Record<UploadRow['outcome'], string> = {
  uploaded: 'Uploaded',
  link: 'Link added',
  updated: 'Updated',
  created: 'Created',
  skipped: 'Skipped',
  error: 'Error',
}

function BulkUploadModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'choose' | 'preview' | 'running' | 'done'>('choose')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [parsed, setParsed] = useState<ParsedZip | null>(null)
  const [plans, setPlans] = useState<FolderPlan[]>([])
  const [progress, setProgress] = useState<Progress | null>(null)
  const [rows, setRows] = useState<UploadRow[]>([])

  async function choose(file: File) {
    setBusy(true)
    setError('')
    try {
      const zip = await readCandidateZip(file)
      setParsed(zip)
      setPlans(await previewCandidateZip(zip))
      setStep('preview')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This ZIP could not be read.')
    } finally {
      setBusy(false)
    }
  }

  async function apply() {
    if (!parsed) return
    setStep('running')
    try {
      setRows(await applyCandidateZip({ parsed, plans, onProgress: setProgress }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk upload stopped.')
    } finally {
      setStep('done')
      router.refresh()
    }
  }

  const count = (outcome: UploadRow['outcome']) => rows.filter((r) => r.outcome === outcome).length
  const fileCount = (folder: string) => parsed?.folders.find((f) => f.folder === folder)?.entries.length ?? 0
  const runnable = plans.filter((p) => p.action !== 'skip').length

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="bulk-upload-title">
      <div className="w-full max-w-4xl rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="bulk-upload-title" className="text-lg font-semibold text-[#0C2340]">
              Bulk Upload
            </h2>
            <p className="mt-1 text-sm text-[#64748B]">
              Upload a ZIP with one folder per candidate, in the same structure Download All creates. You review what will
              happen before anything is saved.
            </p>
          </div>
          <button type="button" className={admin.btnGhost} onClick={onClose} disabled={step === 'running'} aria-label="Close">
            ✕
          </button>
        </div>

        {step === 'choose' && (
          <div className="mt-4 space-y-3">
            <button type="button" className={admin.btnPrimary} disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? 'Reading ZIP…' : 'Choose ZIP file'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,application/zip"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void choose(f)
                e.currentTarget.value = ''
              }}
            />
            <ul className="list-disc space-y-1 pl-5 text-xs text-[#64748B]">
              <li>Candidates are matched by candidate number, then email, then name. A match updates the record; nothing is duplicated.</li>
              <li>A folder that matches no one creates a new candidate (Candidate_Details.json needs name, email and visa type).</li>
              <li>Files already on the record are skipped. Nothing on the record is replaced or deleted.</li>
              <li>Allowed document types: PDF, DOC, DOCX, JPG, JPEG.</li>
            </ul>
          </div>
        )}

        {step === 'preview' && parsed && (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-[#0C2340]">
              {plans.filter((p) => p.action === 'update').length} to update · {plans.filter((p) => p.action === 'create').length} new ·{' '}
              {plans.filter((p) => p.action === 'skip').length} skipped
            </p>
            <div className="max-h-[50vh] overflow-auto rounded-lg border border-[#E2E8F0]">
              <table className="w-full min-w-[640px] text-left text-sm" data-testid="bulk-preview">
                <thead className="sticky top-0 bg-[#F8FAFC]">
                  <tr>
                    <th className={admin.th}>Folder</th>
                    <th className={admin.th}>Action</th>
                    <th className={admin.th}>Files</th>
                    <th className={admin.th}>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => (
                    <tr key={p.folder} className="border-t border-[#E2E8F0] align-top">
                      <td className={admin.td}>
                        <p className="font-medium">{p.folder}</p>
                        {p.candidateNumber && <p className="text-xs text-[#64748B]">{p.candidateNumber}</p>}
                      </td>
                      <td className={admin.td}>
                        {p.action === 'update' && <span className={`${admin.badge} bg-sky-50 text-sky-800`}>Update · matched by {p.matchedBy}</span>}
                        {p.action === 'create' && <span className={`${admin.badge} bg-emerald-50 text-emerald-800`}>New candidate</span>}
                        {p.action === 'skip' && <span className={`${admin.badge} bg-red-50 text-red-700`}>Skipped</span>}
                      </td>
                      <td className={admin.td}>{fileCount(p.folder)}</td>
                      <td className={`${admin.td} text-xs`}>
                        {p.changes.map((c) => (
                          <p key={c.label}>
                            {c.label}: {c.from || '—'} → <strong>{c.to}</strong>
                          </p>
                        ))}
                        {p.newNotes > 0 && <p>{p.newNotes} new note(s)</p>}
                        {p.warnings.map((w) => (
                          <p key={w} className="text-amber-700">
                            {w}
                          </p>
                        ))}
                        {p.errors.map((e) => (
                          <p key={e} className="text-red-700">
                            {e}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {parsed.ignored.length > 0 && (
              <p className="text-xs text-amber-700">
                {parsed.ignored.length} file(s) outside candidate folders will be ignored: {parsed.ignored.slice(0, 3).map((i) => i.path).join(', ')}
                {parsed.ignored.length > 3 ? '…' : ''}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={admin.btnAccent} disabled={!runnable} onClick={() => void apply()}>
                Upload {runnable} candidate folder{runnable === 1 ? '' : 's'}
              </button>
              <button
                type="button"
                className={admin.btnSecondary}
                onClick={() => {
                  setStep('choose')
                  setParsed(null)
                  setPlans([])
                }}
              >
                Choose another ZIP
              </button>
            </div>
          </div>
        )}

        {step === 'running' && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-[#0C2340]">Uploading… keep this window open.</p>
            <ProgressBar progress={progress} />
          </div>
        )}

        {step === 'done' && (
          <div className="mt-4 space-y-3" data-testid="bulk-summary">
            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-6">
              {(['uploaded', 'link', 'updated', 'created', 'skipped', 'error'] as const).map((o) => (
                <div key={o} className="rounded-lg border border-[#E2E8F0] p-2">
                  <p className="text-[11px] uppercase tracking-wide text-[#64748B]">{OUTCOME_LABEL[o]}</p>
                  <p className={`text-lg font-semibold ${o === 'error' && count(o) ? 'text-red-700' : 'text-[#0C2340]'}`}>{count(o)}</p>
                </div>
              ))}
            </div>
            <div className="max-h-[45vh] overflow-auto rounded-lg border border-[#E2E8F0]">
              <table className="w-full min-w-[640px] text-left text-xs">
                <thead className="sticky top-0 bg-[#F8FAFC]">
                  <tr>
                    <th className={admin.th}>Folder</th>
                    <th className={admin.th}>File</th>
                    <th className={admin.th}>Result</th>
                    <th className={admin.th}>Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-[#E2E8F0] align-top">
                      <td className="px-3 py-1.5">{r.folder}</td>
                      <td className="break-all px-3 py-1.5">{r.path || '—'}</td>
                      <td className={`px-3 py-1.5 font-medium ${r.outcome === 'error' ? 'text-red-700' : ''}`}>{OUTCOME_LABEL[r.outcome]}</td>
                      <td className="px-3 py-1.5">{r.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {error && <p className="text-sm text-red-700">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" className={admin.btnSecondary} onClick={() => saveUploadSummary(rows)}>
                Download summary (CSV)
              </button>
              <button type="button" className={admin.btnPrimary} onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        )}
        {error && step !== 'done' && <p className="mt-3 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  )
}
