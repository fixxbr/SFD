'use client'

import { useEffect, useRef, useState } from 'react'
import { downloadCandidateExport } from '@/lib/admin-downloads'

const btn = 'rounded border border-[#D7DEE6] px-2.5 py-1.5 text-xs font-medium hover:bg-[#F3F5F7]'
const menuItem =
  'block w-full px-3 py-2 text-left text-sm text-[#0C2340] hover:bg-[#F8FAFC] disabled:opacity-50'

export function DownloadExportMenu({
  candidateId,
  lawyerMode = false,
}: {
  candidateId: string
  lawyerMode?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  if (lawyerMode) return null

  async function run(label: string, fn: () => Promise<void>) {
    setError('')
    setBusy(label)
    try {
      await fn()
      setOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "We couldn't prepare this download. Please try again.")
    } finally {
      setBusy('')
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button type="button" className={`${btn} shrink-0 whitespace-nowrap bg-[#0C2340] text-white hover:bg-[#16375F]`} onClick={() => setOpen((v) => !v)}>
        {busy ? 'Preparing…' : lawyerMode ? 'Export Documents' : 'Download / Export'}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-[#D7DEE6] bg-white py-1 shadow-lg">
          <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">Documents</p>
          <button
            type="button"
            className={menuItem}
            disabled={Boolean(busy)}
            onClick={() => void run('docs', () => downloadCandidateExport(candidateId, 'documents-zip'))}
          >
            Download All Documents
          </button>
          {!lawyerMode && (
          <>
          <p className="mt-1 border-t border-[#EEF1F4] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
            Candidate data
          </p>
          <button
            type="button"
            className={menuItem}
            disabled={Boolean(busy)}
            onClick={() => void run('pdf', () => downloadCandidateExport(candidateId, 'pdf'))}
          >
            Download Candidate Data as PDF
          </button>
          <button
            type="button"
            className={menuItem}
            disabled={Boolean(busy)}
            onClick={() => void run('xlsx', () => downloadCandidateExport(candidateId, 'xlsx'))}
          >
            Download Candidate Data as Excel
          </button>
          <button
            type="button"
            className={menuItem}
            disabled={Boolean(busy)}
            onClick={() => void run('csv', () => downloadCandidateExport(candidateId, 'csv'))}
          >
            Download Candidate Data as CSV
          </button>
          {!lawyerMode && (
            <button
              type="button"
              className={menuItem}
              disabled={Boolean(busy)}
              onClick={() => {
                window.location.href = `/api/admin/data?candidateId=${candidateId}`
                setOpen(false)
              }}
            >
              Download Candidate Data (JSON)
            </button>
          )}
          <p className="mt-1 border-t border-[#EEF1F4] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-[#94A3B8]">
            Package
          </p>
          <button
            type="button"
            className={menuItem}
            disabled={Boolean(busy)}
            onClick={() => void run('package', () => downloadCandidateExport(candidateId, 'package'))}
          >
            Download Complete Candidate Package
          </button>
          </>
          )}
          {error && <p className="border-t border-red-100 px-3 py-2 text-xs text-red-700">{error}</p>}
        </div>
      )}
    </div>
  )
}
