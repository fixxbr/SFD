'use client'

import { useState } from 'react'
import { copyPreparedEmail, type CopyEmailMode } from '@/lib/email/copy-email'
import { cn } from '@/lib/utils'

const btn = 'rounded border border-[#D7DEE6] px-2.5 py-1.5 text-xs font-medium hover:bg-[#F3F5F7] disabled:opacity-50'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#143a66] disabled:opacity-50'

export function EmailCopyActions({
  to,
  subject,
  body,
  htmlBody,
  candidateId,
  caseId,
  templateType,
  primaryIsCopy = true,
  showMarkSent = false,
  className,
  onCopied,
  onMarkedSent,
}: {
  to: string
  subject: string
  body: string
  htmlBody?: string | null
  candidateId?: string
  caseId?: string | null
  templateType?: string
  primaryIsCopy?: boolean
  showMarkSent?: boolean
  className?: string
  onCopied?: (mode: CopyEmailMode) => void
  onMarkedSent?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualText, setManualText] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [confirmSent, setConfirmSent] = useState(false)

  async function logCopied(mode: CopyEmailMode, snapshot: string) {
    if (!candidateId) return
    try {
      await fetch('/api/admin/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'copied',
          copyMode: mode,
          candidateId,
          caseId: caseId || undefined,
          templateType: templateType || 'GENERIC',
          to,
          subject,
          text: snapshot,
        }),
      })
    } catch {
      /* non-blocking */
    }
  }

  async function handleCopy(mode: CopyEmailMode) {
    setBusy(true)
    setError('')
    setToast('')
    setMoreOpen(false)
    try {
      const result = await copyPreparedEmail({ to, subject, body, htmlBody, mode })
      if (!result.ok) {
        setError(result.error)
        setManualText(
          mode === 'subject'
            ? subject
            : mode === 'body'
              ? body
              : `Subject: ${subject}\n\nTo: ${to}\n\n${body}`,
        )
        setManualOpen(true)
        return
      }
      await logCopied(mode, mode === 'subject' ? subject : body)
      const label =
        mode === 'subject'
          ? 'Subject copied'
          : mode === 'body'
            ? 'Branded email body copied'
            : 'Branded email copied — paste into Gmail'
      setToast(`✓ ${label}`)
      onCopied?.(mode)
      window.setTimeout(() => setToast(''), 3200)
    } finally {
      setBusy(false)
    }
  }

  async function markSent() {
    if (!candidateId) return
    setBusy(true)
    try {
      await fetch('/api/admin/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'mark-sent',
          candidateId,
          caseId: caseId || undefined,
          templateType: templateType || 'GENERIC',
          to,
          subject,
          text: body,
        }),
      })
      setConfirmSent(false)
      setToast('✓ Marked as sent')
      onMarkedSent?.()
      window.setTimeout(() => setToast(''), 2500)
    } catch {
      setError('Unable to mark as sent.')
    } finally {
      setBusy(false)
    }
  }

  function selectAllManual() {
    const el = document.getElementById('afterstem-manual-copy') as HTMLTextAreaElement | null
    el?.focus()
    el?.select()
  }

  return (
    <div className={cn('relative space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={primaryIsCopy ? primary : btn}
          disabled={busy}
          onClick={() => void handleCopy('full')}
        >
          {busy ? 'Copying…' : 'Copy Email'}
        </button>
        <div className="relative">
          <button type="button" className={btn} disabled={busy} onClick={() => setMoreOpen((v) => !v)}>
            More copy ▾
          </button>
          {moreOpen && (
            <div className="absolute left-0 z-20 mt-1 min-w-[160px] rounded-lg border border-[#E2E8F0] bg-white p-1 shadow-lg">
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-[#F8FAFC]"
                onClick={() => void handleCopy('full')}
              >
                Copy Full Email
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-[#F8FAFC]"
                onClick={() => void handleCopy('body')}
              >
                Copy Body
              </button>
              <button
                type="button"
                className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-[#F8FAFC]"
                onClick={() => void handleCopy('subject')}
              >
                Copy Subject
              </button>
            </div>
          )}
        </div>
        {showMarkSent && (
          <button type="button" className={btn} disabled={busy} onClick={() => setConfirmSent(true)}>
            Mark as Sent
          </button>
        )}
      </div>

      {toast && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800">
          {toast}
          {toast.includes('Branded') && (
            <span className="mt-0.5 block font-normal text-emerald-700">
              Paste into the Gmail message body to keep the Afterstem logo and layout. Use Copy Subject if needed.
            </span>
          )}
        </p>
      )}
      {error && !manualOpen && <p className="text-xs text-red-700">{error}</p>}

      {manualOpen && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">{error || 'Unable to copy automatically. Select and copy manually.'}</p>
          <textarea
            id="afterstem-manual-copy"
            className="mt-2 h-40 w-full rounded border border-[#D7DEE6] bg-white p-2 text-xs"
            value={manualText}
            readOnly
          />
          <div className="mt-2 flex gap-2">
            <button type="button" className={btn} onClick={selectAllManual}>
              Select All
            </button>
            <button type="button" className={btn} onClick={() => setManualOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}

      {confirmSent && (
        <div className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm">
          <p>
            Did you send this email to <strong>{to}</strong>?
          </p>
          <div className="mt-2 flex gap-2">
            <button type="button" className={primary} disabled={busy} onClick={() => void markSent()}>
              Mark as Sent
            </button>
            <button type="button" className={btn} onClick={() => setConfirmSent(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
