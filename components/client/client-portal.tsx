'use client'

import { useEffect, useState } from 'react'

type ClientPayload = {
  requiresVerification?: boolean
  maskedEmail?: string
  candidate?: { fullLegalName: string; email: string }
  case?: {
    caseNumber: string
    visaLabel: string
    statusLabel: string
    currency: string
  }
  financial?: {
    quotedLabel: string
    paidLabel: string
    remainingLabel: string
    preFilingCents: number
    prePaidCents: number
    preFilingComplete: boolean
    paidInFull: boolean
  }
  payments?: Array<{
    installmentNumber: number
    amountLabel: string
    status: string
    paymentUrl: string | null
  }>
  focusPayment?: {
    installmentNumber: number
    amountLabel: string
    status: string
    paymentUrl: string | null
  } | null
  purpose?: string
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: ClientPayload }

export function ClientPortal({ token }: { token: string }) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [code, setCode] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch(`/api/client/${token}`)
      .then(async (res) => {
        const json = await res.json()
        if (cancelled) return
        if (!res.ok) {
          setState({ status: 'error', message: json.error ?? 'Unable to open this link' })
          return
        }
        setState({ status: 'ready', data: json })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', message: 'Unable to open this link' })
      })
    return () => {
      cancelled = true
    }
  }, [token])

  async function sendCode() {
    const res = await fetch(`/api/client/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send-code' }),
    })
    const json = await res.json()
    if (!res.ok) alert(json.error)
    else alert(`Code sent to ${json.maskedEmail}`)
  }

  async function verify() {
    const res = await fetch(`/api/client/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'verify', code }),
    })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error)
      return
    }
    setState({ status: 'ready', data: json })
  }

  if (state.status === 'loading') {
    return <p className="p-8 text-sm text-[#5B6B7C]">Opening your Afterstem secure link…</p>
  }
  if (state.status === 'error') {
    return <p className="p-8 text-sm text-red-700">{state.message}</p>
  }

  const data = state.data

  if (data.requiresVerification) {
    return (
      <div className="mx-auto max-w-md rounded-xl border border-[#D7DEE6] bg-white p-8 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0F766E]">Afterstem</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#0C2340]">Verify your email</h1>
        <p className="mt-2 text-sm text-[#5B6B7C]">
          We sent a verification code to {data.maskedEmail}. No password is required.
        </p>
        <button type="button" onClick={sendCode} className="mt-4 text-sm text-[#0F766E] underline">
          Send / resend code
        </button>
        <div className="mt-4 flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className="flex-1 rounded-md border border-[#D7DEE6] px-3 py-2 text-sm"
          />
          <button type="button" onClick={verify} className="rounded-md bg-[#0C2340] px-4 py-2 text-sm text-white">
            Continue
          </button>
        </div>
      </div>
    )
  }

  const first = data.candidate?.fullLegalName.split(' ')[0]
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-xl border border-[#D7DEE6] bg-white p-6 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0F766E]">Afterstem</p>
        <h1 className="mt-2 text-3xl font-semibold text-[#0C2340]">Welcome, {first}</h1>
        <p className="mt-2 text-sm text-[#5B6B7C]">
          Visa {data.case?.visaLabel} · {data.case?.caseNumber} · {data.case?.statusLabel}
        </p>
        <p className="mt-3 text-xs text-[#5B6B7C]">
          You are accessing your case through a secure email link. No Afterstem password is required.
        </p>
      </div>

      <div className="rounded-xl border border-[#D7DEE6] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5B6B7C]">Payment summary</h2>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-[#5B6B7C]">Quoted amount</dt>
            <dd className="text-lg font-semibold">{data.financial?.quotedLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#5B6B7C]">Paid</dt>
            <dd className="text-lg font-semibold">{data.financial?.paidLabel}</dd>
          </div>
          <div>
            <dt className="text-xs text-[#5B6B7C]">Remaining</dt>
            <dd className="text-lg font-semibold">{data.financial?.remainingLabel}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-[#5B6B7C]">
          Pre-filing requirement:{' '}
          {data.financial
            ? `${(data.financial.prePaidCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })} / ${(data.financial.preFilingCents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`
            : '—'}
          {data.financial?.preFilingComplete ? ' · ✓ Complete' : ''}
          {data.financial?.paidInFull ? ' · ✓ Paid in full' : ''}
        </p>
      </div>

      {data.focusPayment && data.focusPayment.status !== 'PAID' && (
        <div className="rounded-xl border border-[#0F766E]/30 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[#0F766E]">Next payment</h2>
          <p className="mt-2 text-sm text-[#5B6B7C]">Visa type: {data.case?.visaLabel}</p>
          <p className="text-sm text-[#5B6B7C]">Payment number: {data.focusPayment.installmentNumber} of 4</p>
          <p className="mt-1 text-2xl font-semibold text-[#0C2340]">{data.focusPayment.amountLabel}</p>
          <p className="text-sm text-[#5B6B7C]">Total engagement: {data.financial?.quotedLabel}</p>
          {data.focusPayment.paymentUrl ? (
            <a
              href={data.focusPayment.paymentUrl}
              className="mt-5 inline-flex rounded-md bg-[#0C2340] px-5 py-2.5 text-sm font-semibold text-white"
            >
              Pay Securely with Stripe
            </a>
          ) : (
            <p className="mt-4 text-sm text-[#5B6B7C]">Your Afterstem team will send a payment link shortly.</p>
          )}
        </div>
      )}

      <div className="rounded-xl border border-[#D7DEE6] bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[#5B6B7C]">All installments</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.payments?.map((p) => (
            <li key={p.installmentNumber} className="flex items-center justify-between border-t border-[#EEF1F4] pt-2">
              <span>
                Payment {p.installmentNumber} · {p.amountLabel}
              </span>
              <span className="font-medium uppercase tracking-wide">{p.status.replaceAll('_', ' ')}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
