'use client'

import { useMemo, useState } from 'react'
import type { StaffOption } from '@/lib/staff-options'
import { lawyerOptions } from '@/lib/staff-options'

const btn =
  'rounded border border-[#D7DEE6] px-3 py-1.5 text-xs font-medium hover:bg-[#F3F5F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0C2340]'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60'
const danger = 'rounded bg-red-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60'

type Mode = 'idle' | 'change' | 'confirm-assign' | 'confirm-unassign'

export function LawyerAssignmentControl({
  caseId,
  currentLawyerId,
  currentLawyerName,
  staff,
  canWrite,
  onDone,
}: {
  caseId: string
  currentLawyerId: string | null
  currentLawyerName: string | null
  staff: StaffOption[]
  canWrite: boolean
  onDone: () => void
}) {
  const lawyers = useMemo(() => lawyerOptions(staff), [staff])
  const [mode, setMode] = useState<Mode>('idle')
  const [selectedId, setSelectedId] = useState(currentLawyerId ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selected = lawyers.find((l) => l.id === selectedId) || null
  const isSame = (selectedId || null) === (currentLawyerId || null)

  async function submit(lawyerId: string | null) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/cases/${caseId}/assign-lawyer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lawyerId, confirm: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Unable to update lawyer assignment')
      setMode('idle')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update lawyer assignment')
    } finally {
      setBusy(false)
    }
  }

  if (!canWrite) {
    return (
      <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Assigned Lawyer</p>
        <p className="mt-1 text-sm font-medium text-[#0C2340]">{currentLawyerName || 'Unassigned'}</p>
        {currentLawyerName ? (
          <p className="text-xs text-[#64748B]">Immigration Attorney</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[#E2E8F0] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#94A3B8]">Case Team</p>
      <p className="mt-2 text-xs font-medium text-[#64748B]">Assigned Lawyer</p>
      <p className="mt-0.5 text-base font-semibold text-[#0C2340]">{currentLawyerName || 'Unassigned'}</p>
      {currentLawyerName ? <p className="text-xs text-[#64748B]">Immigration Attorney</p> : null}

      {mode === 'idle' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={btn}
            onClick={() => {
              setSelectedId(currentLawyerId ?? '')
              setError('')
              setMode('change')
            }}
          >
            {currentLawyerId ? 'Change Lawyer' : 'Assign Lawyer'}
          </button>
          {currentLawyerId ? (
            <button
              type="button"
              className={`${btn} text-red-700`}
              onClick={() => {
                setError('')
                setMode('confirm-unassign')
              }}
            >
              Unassign Lawyer
            </button>
          ) : null}
        </div>
      )}

      {mode === 'change' && (
        <div className="mt-3 space-y-3 border-t border-[#F1F5F9] pt-3">
          <p className="text-sm font-medium text-[#0C2340]">Select Lawyer</p>
          <div className="max-h-48 space-y-1 overflow-y-auto rounded border border-[#E2E8F0] p-2">
            {lawyers.length === 0 ? (
              <p className="px-2 py-3 text-xs text-[#64748B]">No active lawyer accounts available.</p>
            ) : (
              lawyers.map((l) => (
                <label
                  key={l.id}
                  className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-[#F8FAFC] ${
                    selectedId === l.id ? 'bg-[#F0FDFA]' : ''
                  }`}
                >
                  <input
                    type="radio"
                    name="lawyer"
                    checked={selectedId === l.id}
                    onChange={() => setSelectedId(l.id)}
                  />
                  <span>
                    {l.fullName}
                    <span className="ml-1 text-xs text-[#94A3B8]">Lawyer</span>
                  </span>
                </label>
              ))
            )}
          </div>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={btn} onClick={() => setMode('idle')} disabled={busy}>
              Cancel
            </button>
            <button
              type="button"
              className={primary}
              disabled={busy || !selectedId || isSame}
              onClick={() => {
                if (!selectedId || isSame) return
                setMode('confirm-assign')
              }}
            >
              {currentLawyerId ? 'Reassign Case' : 'Assign Case'}
            </button>
          </div>
        </div>
      )}

      {mode === 'confirm-assign' && selected && (
        <div className="mt-3 space-y-3 border-t border-[#F1F5F9] pt-3">
          <p className="text-sm font-semibold text-[#0C2340]">
            {currentLawyerId ? 'Reassign this case?' : 'Assign this case?'}
          </p>
          {currentLawyerId ? (
            <p className="text-sm text-[#475569]">
              <strong>{currentLawyerName}</strong> will immediately lose access to this candidate, case,
              documents, and lawyer-visible comments.
              <br />
              <strong>{selected.fullName}</strong> will immediately receive access.
            </p>
          ) : (
            <p className="text-sm text-[#475569]">
              <strong>{selected.fullName}</strong> will immediately receive access to this candidate and
              documents.
            </p>
          )}
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={btn} disabled={busy} onClick={() => setMode('change')}>
              Cancel
            </button>
            <button
              type="button"
              className={primary}
              disabled={busy}
              onClick={() => void submit(selected.id)}
            >
              {busy ? 'Saving…' : 'Confirm Reassignment'}
            </button>
          </div>
        </div>
      )}

      {mode === 'confirm-unassign' && (
        <div className="mt-3 space-y-3 border-t border-[#F1F5F9] pt-3">
          <p className="text-sm font-semibold text-[#0C2340]">Unassign lawyer?</p>
          <p className="text-sm text-[#475569]">
            <strong>{currentLawyerName}</strong> will immediately lose access. The candidate remains fully
            available to admin. No lawyer will see this candidate until someone is assigned again.
          </p>
          {error && <p className="text-xs text-red-700">{error}</p>}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={btn} disabled={busy} onClick={() => setMode('idle')}>
              Cancel
            </button>
            <button type="button" className={danger} disabled={busy} onClick={() => void submit(null)}>
              {busy ? 'Saving…' : 'Confirm Unassign'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
