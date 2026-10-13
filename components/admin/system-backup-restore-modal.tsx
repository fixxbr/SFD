'use client'

import { useEffect, useState } from 'react'
import { saveBlob } from '@/lib/admin-downloads'

const btn = 'rounded border border-[#D7DEE6] px-3 py-1.5 text-xs font-medium hover:bg-[#F3F5F7] disabled:opacity-50'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#16375F] disabled:opacity-50'
const danger = 'rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50'

type Preview = {
  valid: boolean
  errors: string[]
  warnings: string[]
  manifest: any
  counts: Record<string, number>
}

type Tab = 'export' | 'restore' | 'backup-history' | 'restore-history'

export function SystemBackupRestoreModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [tab, setTab] = useState<Tab>('export')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [mode, setMode] = useState<'MERGE' | 'MISSING_ONLY' | 'UPDATE_EXISTING' | 'FULL'>('MERGE')
  const [confirmText, setConfirmText] = useState('')
  const [result, setResult] = useState<any>(null)
  const [backupJobs, setBackupJobs] = useState<any[]>([])
  const [restoreJobs, setRestoreJobs] = useState<any[]>([])

  useEffect(() => {
    if (!open) return
    setError('')
    setResult(null)
  }, [open])

  async function downloadBackup(action: string) {
    setError('')
    setBusy(action)
    try {
      const res = await fetch(`/api/admin/system/backup?action=${action}`)
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? "We couldn't prepare this download. Please try again.")
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const match = /filename="([^"]+)"/i.exec(cd)
      saveBlob(blob, match?.[1] || `Afterstem_Backup_${action}.zip`)
      if (res.headers.get('X-Backup-Incomplete') === '1') {
        setError('Backup completed with warnings — some storage files could not be retrieved. Check Backup History for details.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Backup failed')
    } finally {
      setBusy('')
    }
  }

  async function validateFile(file: File) {
    setError('')
    setPreview(null)
    setResult(null)
    setBusy('validate')
    try {
      const form = new FormData()
      form.set('action', 'validate')
      form.set('file', file)
      const res = await fetch('/api/admin/system/restore', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Validation failed')
      setPreview(json.preview)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed')
    } finally {
      setBusy('')
    }
  }

  async function runRestore(file: File) {
    setError('')
    setBusy('restore')
    try {
      const form = new FormData()
      form.set('action', 'restore')
      form.set('file', file)
      form.set('mode', mode)
      form.set('confirmation', confirmText)
      form.set('conflictPolicy', mode === 'MERGE' ? 'skip' : 'update')
      const res = await fetch('/api/admin/system/restore', { method: 'POST', body: form })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Restore failed')
      setResult(json.result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Restore failed')
    } finally {
      setBusy('')
    }
  }

  async function loadHistory(kind: 'backup' | 'restore') {
    setBusy(kind)
    try {
      if (kind === 'backup') {
        const res = await fetch('/api/admin/system/backup?action=history')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Unable to load history')
        setBackupJobs(json.jobs ?? [])
      } else {
        const res = await fetch('/api/admin/system/restore')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Unable to load history')
        setRestoreJobs(json.jobs ?? [])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load history')
    } finally {
      setBusy('')
    }
  }

  const [pendingFile, setPendingFile] = useState<File | null>(null)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-10">
      <div className="w-full max-w-3xl rounded-xl border border-[#D7DEE6] bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-[#EEF1F4] px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0F766E]">Afterstem</p>
            <h2 className="text-lg font-semibold text-[#0C2340]">System Backup & Restore</h2>
            <p className="text-xs text-[#64748B]">Super Admin only — portable ZIP with data and uploaded files</p>
          </div>
          <button type="button" className={btn} onClick={onClose}>
            Close
          </button>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-[#EEF1F4] px-4 py-2">
          {(
            [
              ['export', 'Export'],
              ['restore', 'Restore / Import'],
              ['backup-history', 'Backup History'],
              ['restore-history', 'Restore History'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded px-3 py-1.5 text-xs font-medium ${tab === id ? 'bg-[#0C2340] text-white' : 'text-[#5B6B7C] hover:bg-[#F3F5F7]'}`}
              onClick={() => {
                setTab(id)
                if (id === 'backup-history') void loadHistory('backup')
                if (id === 'restore-history') void loadHistory('restore')
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          {busy && (
            <p className="rounded border border-[#D7DEE6] bg-[#F8FAFC] px-3 py-2 text-sm text-[#0C2340]">
              {busy === 'validate'
                ? 'Validating backup…'
                : busy === 'restore'
                  ? 'Restoring Afterstem backup… this may take several minutes.'
                  : 'Preparing download…'}
            </p>
          )}

          {tab === 'export' && (
            <div className="space-y-3">
              <p className="text-sm text-[#475569]">
                Full backup includes JSON machine data plus the actual PDF/image/document bytes under each candidate folder.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" className={primary} disabled={Boolean(busy)} onClick={() => void downloadBackup('full')}>
                  Download Full System Backup
                </button>
                <button type="button" className={btn} disabled={Boolean(busy)} onClick={() => void downloadBackup('data-only')}>
                  Download Candidate Data Only
                </button>
                <button type="button" className={btn} disabled={Boolean(busy)} onClick={() => void downloadBackup('excel')}>
                  Download Excel Export
                </button>
                <button type="button" className={btn} disabled={Boolean(busy)} onClick={() => void downloadBackup('csv')}>
                  Download CSV Export
                </button>
              </div>
            </div>
          )}

          {tab === 'restore' && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-[#0C2340]">
                Upload Afterstem backup ZIP
                <input
                  type="file"
                  accept=".zip,application/zip"
                  className="mt-2 block w-full text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setPendingFile(f)
                    setPreview(null)
                    setResult(null)
                    if (f) void validateFile(f)
                  }}
                />
              </label>

              {preview && (
                <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm">
                  <p className="font-semibold text-[#0C2340]">Afterstem Backup Found</p>
                  <dl className="mt-2 grid gap-1 sm:grid-cols-2">
                    <div>Created: {String(preview.manifest?.createdAt || '—')}</div>
                    <div>Backup Version: {String(preview.manifest?.backupVersion || '—')}</div>
                    <div>Schema Version: {String(preview.manifest?.schemaVersion || '—')}</div>
                    <div>Candidates: {preview.counts.candidates}</div>
                    <div>Cases: {preview.counts.cases}</div>
                    <div>Documents: {preview.counts.documents}</div>
                    <div>Payments: {preview.counts.payments}</div>
                    <div>PDF Files: {preview.counts.pdfFiles}</div>
                    <div>Images: {preview.counts.imageFiles}</div>
                    <div>Files verified: {preview.counts.filesVerified}</div>
                  </dl>
                  <p className={`mt-2 font-medium ${preview.valid ? 'text-emerald-700' : 'text-red-700'}`}>
                    {preview.valid ? 'Backup validation passed' : 'Backup validation failed'}
                  </p>
                  {preview.warnings?.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-amber-800">
                      {preview.warnings.slice(0, 8).map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                  {preview.errors?.length > 0 && (
                    <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
                      {preview.errors.map((w) => (
                        <li key={w}>{w}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {preview?.valid && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Restore mode</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {(
                      [
                        ['MERGE', 'Merge With Existing Data (default)'],
                        ['MISSING_ONLY', 'Restore Missing Data Only'],
                        ['UPDATE_EXISTING', 'Update Existing Matching Records'],
                        ['FULL', 'Full System Restore (destructive)'],
                      ] as const
                    ).map(([id, label]) => (
                      <label key={id} className="flex items-center gap-2 text-sm">
                        <input type="radio" name="mode" checked={mode === id} onChange={() => setMode(id)} />
                        {label}
                      </label>
                    ))}
                  </div>

                  {mode === 'FULL' && (
                    <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                      <p className="font-semibold">Full System Restore</p>
                      <p className="mt-1 text-xs">
                        This can replace existing Afterstem candidate and case data. A pre-restore backup will be generated first.
                        Type <strong>RESTORE Afterstem</strong> to continue.
                      </p>
                      <input
                        className="mt-2 w-full rounded border border-red-300 px-2 py-1.5 text-sm"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="RESTORE Afterstem"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    className={mode === 'FULL' ? danger : primary}
                    disabled={
                      Boolean(busy) || !pendingFile || (mode === 'FULL' && confirmText.trim() !== 'RESTORE Afterstem')
                    }
                    onClick={() => pendingFile && void runRestore(pendingFile)}
                  >
                    {busy === 'restore' ? 'Restoring…' : 'Start Restore'}
                  </button>
                </div>
              )}

              {result && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                  <p className="font-semibold">Restore complete</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    <li>Candidates created: {result.candidatesCreated}</li>
                    <li>Candidates updated: {result.candidatesUpdated}</li>
                    <li>Candidates skipped: {result.candidatesSkipped}</li>
                    <li>Cases created: {result.casesCreated}</li>
                    <li>Evidence created: {result.evidenceCreated}</li>
                    <li>Documents created: {result.documentsCreated}</li>
                    <li>Documents skipped: {result.documentsSkipped}</li>
                    <li>Documents failed: {result.documentsFailed}</li>
                    <li>Payments created: {result.paymentsCreated}</li>
                    <li>Notes created: {result.notesCreated}</li>
                  </ul>
                  {result.verification && (
                    <div className="mt-3">
                      <p className="font-medium">Restore Verification</p>
                      <ul className="mt-1 text-xs">
                        {Object.entries(result.verification).map(([k, v]) => (
                          <li key={k}>
                            {k}: {String(v)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {result.failures?.length > 0 && (
                    <details className="mt-2 text-xs">
                      <summary>Error report ({result.failures.length})</summary>
                      <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap">
                        {JSON.stringify(result.failures, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'backup-history' && (
            <div className="space-y-2">
              {backupJobs.length === 0 ? (
                <p className="text-sm text-[#64748B]">No backup history yet.</p>
              ) : (
                <ul className="divide-y divide-[#EEF1F4] text-sm">
                  {backupJobs.map((j) => (
                    <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <div>
                        <p className="font-medium text-[#0C2340]">
                          {j.kind} · {j.status}
                        </p>
                        <p className="text-xs text-[#64748B]">
                          {new Date(j.createdAt).toLocaleString()} · {j.candidateCount} candidates · {j.documentCount}{' '}
                          documents · by {j.requestedBy?.fullName}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={btn}
                        onClick={() =>
                          void fetch('/api/admin/system/backup', {
                            method: 'DELETE',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ jobId: j.id }),
                          }).then(() => loadHistory('backup'))
                        }
                      >
                        Delete Record
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'restore-history' && (
            <div className="space-y-2">
              {restoreJobs.length === 0 ? (
                <p className="text-sm text-[#64748B]">No restore history yet.</p>
              ) : (
                <ul className="divide-y divide-[#EEF1F4] text-sm">
                  {restoreJobs.map((j) => (
                    <li key={j.id} className="py-2">
                      <p className="font-medium text-[#0C2340]">
                        {j.mode} · {j.status}
                      </p>
                      <p className="text-xs text-[#64748B]">
                        {new Date(j.createdAt).toLocaleString()} · {j.sourceFilename} · by {j.requestedBy?.fullName}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
