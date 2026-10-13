'use client'

import { useMemo, useState } from 'react'
import {
  EMAIL_TEMPLATES,
  mergeTemplate,
  buildMergeVars,
  templateByKey,
} from '@/lib/email-templates'
import { renderCatalogEmail, hasUnresolvedMergeTokens } from '@/lib/email/catalog-html'
import { formatVisa } from '@/lib/visa'
import { EmailCopyActions } from '@/components/admin/email-copy-actions'

const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'
const btn = 'rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7] disabled:opacity-60'

type WelcomeCandidate = {
  id: string
  fullLegalName: string
  email: string
  candidateNumber?: string | null
}

type WelcomeCase = {
  id?: string
  caseNumber?: string | null
  visaType?: string | null
  quotedAmountCents?: number | null
  currency?: string | null
} | null

export function WelcomeEmailModal({
  candidate,
  currentCase,
  onSkip,
  onSent,
}: {
  candidate: WelcomeCandidate
  currentCase: WelcomeCase
  onSkip: () => void
  onSent: () => void
}) {
  const vars = useMemo(
    () =>
      buildMergeVars({
        fullLegalName: candidate.fullLegalName,
        candidateNumber: candidate.candidateNumber ?? undefined,
        email: candidate.email,
        visaLabel: currentCase?.visaType ? formatVisa(currentCase.visaType) : '',
        caseNumber: currentCase?.caseNumber ?? '',
        quotedCents: currentCase?.quotedAmountCents ?? 0,
        currency: currentCase?.currency ?? undefined,
      }),
    [candidate, currentCase],
  )
  const welcome = templateByKey('WELCOME')
  const [to, setTo] = useState(candidate.email)
  const [subject, setSubject] = useState(mergeTemplate(welcome.subject, vars))
  const [text, setText] = useState(mergeTemplate(welcome.body, vars))
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'preview' | 'edit'>('preview')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const rendered = useMemo(
    () =>
      renderCatalogEmail({
        templateKey: 'WELCOME',
        fullLegalName: candidate.fullLegalName,
        candidateNumber: candidate.candidateNumber,
        email: to,
        visaType: currentCase?.visaType,
        caseNumber: currentCase?.caseNumber,
        quotedCents: currentCase?.quotedAmountCents,
        currency: currentCase?.currency,
        subjectOverride: subject,
        textOverride: text,
      }),
    [candidate, currentCase, to, subject, text],
  )

  async function openInGmail() {
    if (busy) return
    if (!to.trim()) {
      setError('Candidate email is missing. Please add an email address before opening Gmail.')
      return
    }
    if (hasUnresolvedMergeTokens(subject) || hasUnresolvedMergeTokens(text)) {
      setError('Cannot open Gmail — unresolved template variables remain.')
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    const res = await fetch('/api/admin/communications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: 'gmail',
        templateType: 'WELCOME',
        subject,
        text,
        to,
        candidateId: candidate.id,
        caseId: currentCase?.id,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.gmailUrl) {
      setError(json.error ?? 'Unable to prepare Gmail compose.')
      setBusy(false)
      return
    }
    window.open(json.gmailUrl, '_blank', 'noopener,noreferrer')
    setSuccess('Gmail opened with the welcome template. Review, edit any line, then send from Gmail.')
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
      <div className="w-full max-w-2xl rounded-lg border border-[#D7DEE6] bg-white p-5 shadow-xl">
        <div className="mb-3">
          <h3 className="font-semibold text-[#0C2340]">Prepare Welcome Email</h3>
          <p className="mt-1 text-xs text-[#5B6B7C]">
            Preview and edit the welcome email, then Copy Email and paste into Gmail. Afterstem does not auto-send.
          </p>
        </div>

        <div className="mb-3 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Candidate successfully created: <strong>{candidate.fullLegalName}</strong> · {candidate.candidateNumber}
        </div>

        {mode === 'preview' ? (
          <div className="space-y-2">
            <p className="text-xs uppercase text-[#5B6B7C]">
              To: {to} · Subject: {subject}
            </p>
            <iframe
              title="Welcome email preview"
              srcDoc={rendered.html}
              className="h-[min(50vh,400px)] w-full max-w-[680px] rounded border border-[#D7DEE6]"
            />
            <details className="rounded border border-[#EEF1F4] p-2 text-xs text-[#5B6B7C]">
              <summary className="cursor-pointer font-medium text-[#0C2340]">Gmail plain-text body</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-5 text-[#0C2340]">{rendered.plainTextForGmail}</pre>
            </details>
          </div>
        ) : (
          <div className="space-y-2">
            <input value={to} onChange={(e) => setTo(e.target.value)} type="email" className={input} disabled={busy} />
            <input value={subject} onChange={(e) => setSubject(e.target.value)} className={input} disabled={busy} />
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={12} className={input} disabled={busy} />
          </div>
        )}

        {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        {success && <p className="mt-2 text-sm text-emerald-700">{success}</p>}

        <div className="mt-4 space-y-3">
          <EmailCopyActions
            to={to}
            subject={subject}
            body={rendered.plainTextForGmail || text}
            htmlBody={rendered.html}
            candidateId={candidate.id}
            caseId={currentCase?.id}
            templateType="WELCOME"
            showMarkSent
            onCopied={() => setSuccess('Welcome email copied — paste into Gmail to send.')}
            onMarkedSent={() => {
              setSuccess('Marked as sent.')
              setTimeout(() => onSent(), 600)
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btn} disabled={busy} onClick={() => setMode((m) => (m === 'preview' ? 'edit' : 'preview'))}>
              {mode === 'preview' ? 'Edit' : 'Preview'}
            </button>
            <button type="button" className={btn} disabled={busy} onClick={() => void openInGmail()}>
              {busy ? 'Opening…' : 'Open Gmail'}
            </button>
            <a href={`/admin/candidates/${candidate.id}`} className={btn}>
              View Candidate
            </a>
            <button type="button" className={btn} disabled={busy} onClick={onSkip}>
              Skip for now
            </button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-[#5B6B7C]">
          Template: {EMAIL_TEMPLATES.find((t) => t.key === 'WELCOME')?.label}. Copy / Open Gmail are logged as prepared, not Sent.
        </p>
      </div>
    </div>
  )
}
