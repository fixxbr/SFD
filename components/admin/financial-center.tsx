'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { StatusBadge } from '@/components/admin/status-badge'
import {
  formatCents,
  PAYMENT_METHODS,
  dollarsToCents,
  buildInstallmentDrafts,
  moveScheduleItem,
  renumberDefaultPaymentLabels,
} from '@/lib/manual-finance'
import { buildPaymentDescription } from '@/lib/payment-description'
import type { FinanceTemplateKey } from '@/lib/finance-email-templates'
import { prepareGmailCompose } from '@/lib/email/gmail-prepare'
import { EmailCopyActions } from '@/components/admin/email-copy-actions'

function isManualEntryMethod(method: string) {
  const m = method.trim().toLowerCase()
  return m !== 'stripe' && m !== 'card' && m !== 'credit card' && m !== 'debit card'
}

const btn = 'rounded border border-[#D7DEE6] px-2.5 py-1.5 text-xs font-medium hover:bg-white'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#143a66]'
const teal = 'rounded bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d655e]'
const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'

type DraftItem = {
  label: string
  amount: string
  dueDate: string
  dueCondition: string
  feeCategory: string
  countsTowardEngagement: boolean
}

type FinanceSummary = {
  candidate: { id: string; fullLegalName: string; candidateNumber: string; email: string }
  visaLabel: string
  engagement: {
    quotedAmountCents: number
    currency: string
    quoteStatus: string
    structureType: string | null
    quotedBy?: { fullName: string } | null
  } | null
  quoteHistory: Array<{
    id: string
    amountCents: number
    status: string
    changeReason: string | null
    createdAt: string
    createdBy?: { fullName: string } | null
  }>
  items: Array<{
    id: string
    label: string
    sequenceNumber: number
    scheduledAmountCents: number
    dueDate: string | null
    dueCondition: string | null
    status: string
    receivedCents: number
    remainingCents: number
    reminderCount: number
    lastReminderAt: string | null
    lastOverdueNoticeAt: string | null
    feeCategory: string
  }>
  receipts: Array<{
    id: string
    description: string
    amountCents: number
    receivedDate: string
    paymentMethod: string
    paymentMethodOther: string | null
    receivedByName: string
    referenceNumber: string | null
    receiptType: string
    status: string
    attachmentFilename?: string | null
    attachmentStorageKey?: string | null
    confirmedBy?: { fullName: string } | null
    scheduleItem?: { label: string } | null
  }>
  calculator: {
    quotedTotal: number
    scheduledReceived: number
    additionalReceived: number
    totalReceived: number
    remainingBalance: number
    overpayment: number
    progressPct: number
    paidInFull: boolean
  }
  nextDue: { id: string; label: string; remainingCents: number; dueDate: string | null; dueCondition: string | null } | null
}

export function FinancialCenter({
  caseId,
  canWrite,
  adminName,
}: {
  caseId: string
  canWrite: boolean
  adminName: string
}) {
  const [data, setData] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const [quoteDollars, setQuoteDollars] = useState('')
  const [changeReason, setChangeReason] = useState('')

  const [structure, setStructure] = useState<'SINGLE' | 'SPLIT' | 'MONTHLY' | 'CUSTOM'>('SPLIT')
  const [drafts, setDrafts] = useState<DraftItem[]>([
    { label: 'Payment 1', amount: '', dueDate: '', dueCondition: '', feeCategory: 'PROFESSIONAL_FEE', countsTowardEngagement: true },
    { label: 'Payment 2', amount: '', dueDate: '', dueCondition: '', feeCategory: 'PROFESSIONAL_FEE', countsTowardEngagement: true },
    { label: 'Payment 3', amount: '', dueDate: '', dueCondition: '', feeCategory: 'PROFESSIONAL_FEE', countsTowardEngagement: true },
    { label: 'Payment 4', amount: '', dueDate: '', dueCondition: 'Due After Approval', feeCategory: 'PROFESSIONAL_FEE', countsTowardEngagement: true },
  ])
  const [monthlyCount, setMonthlyCount] = useState('6')
  const [monthlyFirst, setMonthlyFirst] = useState(new Date().toISOString().slice(0, 10))
  const [monthlyFreq, setMonthlyFreq] = useState<'MONTHLY' | 'BIWEEKLY'>('MONTHLY')

  const [recordOpen, setRecordOpen] = useState(false)
  const [recordItemId, setRecordItemId] = useState<string | null>(null)
  const [recordAdditional, setRecordAdditional] = useState(false)
  const [amount, setAmount] = useState('')
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().slice(0, 10))
  const [method, setMethod] = useState('Wire Transfer')
  const [methodOther, setMethodOther] = useState('')
  const [receivedBy, setReceivedBy] = useState(adminName)
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [description, setDescription] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)

  const [preview, setPreview] = useState<{ subject: string; html: string; plainText?: string } | null>(null)
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewPlain, setPreviewPlain] = useState('')
  const [previewTemplateKey, setPreviewTemplateKey] = useState<FinanceTemplateKey | string>('PAYMENT_REQUEST')
  const [bodyEdited, setBodyEdited] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/finance?caseId=${caseId}`)
    const json = await res.json()
    setLoading(false)
    if (!res.ok) return
    setData(json)
    if (json.engagement?.quotedAmountCents != null) {
      setQuoteDollars(String((json.engagement.quotedAmountCents / 100).toFixed(2)))
    }
  }, [caseId])

  useEffect(() => {
    void load()
  }, [load])

  const currency = data?.engagement?.currency || 'USD'

  const scheduledTotal = useMemo(
    () => drafts.reduce((s, d) => s + dollarsToCents(d.amount || '0'), 0),
    [drafts],
  )

  async function post(body: Record<string, unknown>) {
    setBusy(true)
    setMessage('')
    const res = await fetch('/api/admin/finance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) {
      if (res.status === 409 && confirm(`${json.error}\n\nSave anyway?`)) {
        return post({ ...body, allowMismatch: true })
      }
      alert(json.error ?? 'Request failed')
      return null
    }
    return json
  }

  async function saveQuote(sendEmail: boolean) {
    const json = await post({
      action: 'save-quote',
      caseId,
      amount: quoteDollars,
      currency,
      changeReason: changeReason || undefined,
      sendEmail,
      status: sendEmail ? 'SENT' : undefined,
    })
    if (!json) return
    setMessage(sendEmail ? 'Quote saved and emailed' : 'Quote saved')
    setChangeReason('')
    await load()
  }

  function applyMonthly() {
    const total = dollarsToCents(quoteDollars || '0')
    const items = buildInstallmentDrafts({
      totalCents: total,
      count: Number(monthlyCount) || 6,
      firstDueDate: new Date(monthlyFirst),
      frequency: monthlyFreq,
    })
    setDrafts(
      items.map((i) => ({
        label: i.label,
        amount: (i.amountCents / 100).toFixed(2),
        dueDate: i.dueDate || '',
        dueCondition: '',
        feeCategory: 'PROFESSIONAL_FEE',
        countsTowardEngagement: true,
      })),
    )
  }

  function moveDraft(index: number, direction: -1 | 1) {
    setDrafts((prev) => renumberDefaultPaymentLabels(moveScheduleItem(prev, index, index + direction)))
  }

  function removeDraft(index: number) {
    setDrafts((prev) => renumberDefaultPaymentLabels(prev.filter((_, i) => i !== index)))
  }

  function addDraft() {
    setDrafts((prev) => [
      ...prev,
      {
        label: `Payment ${prev.length + 1}`,
        amount: '',
        dueDate: '',
        dueCondition: '',
        feeCategory: 'PROFESSIONAL_FEE',
        countsTowardEngagement: true,
      },
    ])
  }

  async function saveSchedule(openEmailPreview: boolean) {
    let items = drafts
    if (structure === 'SINGLE') {
      items = [
        {
          label: 'Full Payment',
          amount: quoteDollars,
          dueDate: drafts[0]?.dueDate || '',
          dueCondition: drafts[0]?.dueCondition || '',
          feeCategory: 'PROFESSIONAL_FEE',
          countsTowardEngagement: true,
        },
      ]
    }
    const json = await post({
      action: 'save-schedule',
      caseId,
      structureType: structure,
      frequency: structure === 'MONTHLY' ? monthlyFreq : null,
      // Never auto-send — schedule emails use Copy Email / Gmail like document requests.
      sendEmail: false,
      items: items.map((d) => ({
        label: d.label,
        amount: d.amount,
        dueDate: d.dueDate || null,
        dueCondition: d.dueCondition || null,
        feeCategory: d.feeCategory,
        countsTowardEngagement: d.countsTowardEngagement,
      })),
    })
    if (!json) return
    await load()
    if (openEmailPreview) {
      setMessage('Schedule saved — review the template, then Copy Email and paste into Gmail.')
      await emailAction('PAYMENT_SCHEDULE', undefined, true)
    } else {
      setMessage('Schedule saved')
    }
  }

  async function recordPayment(sendConfirmation: boolean) {
    let attachment: Record<string, string | number> | null = null
    if (attachmentFile) {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = String(reader.result || '')
          const b64 = result.includes(',') ? result.split(',')[1] : result
          resolve(b64)
        }
        reader.onerror = () => reject(new Error('Unable to read attachment'))
        reader.readAsDataURL(attachmentFile)
      })
      const uploaded = await post({
        action: 'upload-receipt-attachment',
        caseId,
        filename: attachmentFile.name,
        mimeType: attachmentFile.type || 'application/octet-stream',
        contentBase64,
      })
      if (!uploaded?.storageKey) return
      attachment = {
        attachmentStorageKey: uploaded.storageKey,
        attachmentFilename: uploaded.filename,
        attachmentMimeType: uploaded.mimeType,
        attachmentSizeBytes: uploaded.sizeBytes,
        attachmentProvider: uploaded.provider,
      }
    }
    const json = await post({
      action: 'record-payment',
      caseId,
      amount,
      receivedDate,
      paymentMethod: method,
      paymentMethodOther: method === 'Other' ? methodOther : null,
      receivedByName: receivedBy,
      referenceNumber: reference,
      internalNote: note,
      description: description || undefined,
      receiptType: recordAdditional ? 'ADDITIONAL' : 'SCHEDULED',
      scheduleItemId: recordAdditional ? null : recordItemId,
      sendConfirmation,
      ...attachment,
    })
    if (!json) return
    setRecordOpen(false)
    setAmount('')
    setReference('')
    setNote('')
    setDescription('')
    setAttachmentFile(null)
    setMessage('Payment recorded')
    await load()
  }

  function openRecord(opts: { additional: boolean; itemId?: string | null; amountCents?: number }) {
    setRecordAdditional(opts.additional)
    setRecordItemId(opts.itemId ?? null)
    if (opts.amountCents != null) setAmount((opts.amountCents / 100).toFixed(2))
    if (opts.additional) {
      setDescription('Additional Payment')
    } else {
      const item = data?.items.find((i) => i.id === opts.itemId) ?? data?.items.find((i) => i.id === data.nextDue?.id)
      setDescription(
        buildPaymentDescription({
          visaType: data?.visaLabel,
          installmentNumber: item?.sequenceNumber ?? null,
          candidateNumber: data?.candidate.candidateNumber,
        }),
      )
    }
    setRecordOpen(true)
  }

  async function emailAction(templateKey: FinanceTemplateKey, scheduleItemId?: string, previewOnly = false) {
    const json = await post({
      action: previewOnly ? 'preview-email' : 'preview-email',
      caseId,
      templateKey,
      scheduleItemId,
    })
    if (!json) return
    setPreview({ subject: json.subject, html: json.html, plainText: json.plainText })
    setPreviewSubject(json.subject || '')
    setPreviewPlain(json.plainText || '')
    setPreviewTemplateKey(templateKey)
    setBodyEdited(false)
    if (!previewOnly) {
      const prepared = prepareGmailCompose({
        to: data?.candidate.email || '',
        subject: json.subject || 'Afterstem — Payment Update',
        body: json.plainText || '',
      })
      if (!prepared.ok) {
        setMessage(prepared.error)
        return
      }
      window.open(prepared.url, '_blank', 'noopener,noreferrer')
      setMessage('Gmail opened with payment email — review and send from Gmail (not auto-sent).')
    }
  }

  if (loading) return <p className="text-sm text-[#5B6B7C]">Loading financial summary…</p>
  if (!data) return <p className="text-sm text-red-700">Unable to load finance data.</p>

  const calc = data.calculator

  return (
    <div className="space-y-5">
      {/* Summary cards */}
      <div className="rounded-xl border border-[#0C2340]/15 bg-gradient-to-br from-[#0C2340] to-[#143a66] p-4 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7dd3d0]">Financial Summary</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-[11px] uppercase text-white/60">Agreed Amount</p>
            <p className="text-lg font-semibold">{formatCents(calc.quotedTotal, currency)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-white/60">Total Received</p>
            <p className="text-lg font-semibold">{formatCents(calc.totalReceived, currency)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-white/60">Remaining</p>
            <p className="text-lg font-semibold">{formatCents(calc.remainingBalance, currency)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase text-white/60">Next Payment</p>
            <p className="text-sm font-semibold">
              {data.nextDue
                ? `${data.nextDue.label} · ${formatCents(data.nextDue.remainingCents, currency)}`
                : calc.paidInFull
                  ? 'Paid in full'
                  : '—'}
            </p>
            {data.nextDue?.dueDate && (
              <p className="text-xs text-white/70">Due {new Date(data.nextDue.dueDate).toLocaleDateString()}</p>
            )}
            {data.nextDue?.dueCondition && !data.nextDue.dueDate && (
              <p className="text-xs text-white/70">{data.nextDue.dueCondition}</p>
            )}
          </div>
          <div>
            <p className="text-[11px] uppercase text-white/60">Progress</p>
            <p className="text-lg font-semibold">{calc.progressPct}%</p>
            <div className="mt-1 h-2 overflow-hidden rounded bg-white/20">
              <div className="h-full bg-[#5eead4]" style={{ width: `${Math.min(100, calc.progressPct)}%` }} />
            </div>
            <p className="mt-1 text-[11px] text-white/70">
              {formatCents(calc.totalReceived, currency)} / {formatCents(calc.quotedTotal, currency)}
            </p>
          </div>
        </div>
        {calc.overpayment > 0 && (
          <p className="mt-3 rounded bg-amber-400/20 px-3 py-2 text-sm text-amber-100">
            OVERPAYMENT · {formatCents(calc.overpayment, currency)}
          </p>
        )}
        {calc.paidInFull && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded bg-emerald-400/20 px-2 py-1 text-xs font-semibold text-emerald-100">PAID IN FULL</span>
            {canWrite && (
              <button type="button" className={btn} onClick={() => void emailAction('PAID_IN_FULL', undefined, true)}>
                Paid in Full Email
              </button>
            )}
          </div>
        )}
      </div>

      {/* Quote */}
      <section className="rounded-xl border-2 border-[#0F766E]/35 bg-[#F1FAF9] p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[#0F766E]">Agreed / Quoted Amount</h3>
        {!data.engagement?.quotedAmountCents && !quoteDollars ? (
          <p className="mt-2 text-sm text-[#5B6B7C]">No engagement amount has been recorded.</p>
        ) : null}
        {canWrite ? (
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="text-xs text-[#5B6B7C]">
              Amount (USD)
              <input className={`${input} mt-1`} value={quoteDollars} onChange={(e) => setQuoteDollars(e.target.value)} placeholder="20000" />
            </label>
            <label className="text-xs text-[#5B6B7C]">
              Change reason
              <input className={`${input} mt-1`} value={changeReason} onChange={(e) => setChangeReason(e.target.value)} placeholder="Scope changed" />
            </label>
            <div className="flex flex-wrap items-end gap-2">
              <button type="button" className={btn} disabled={busy} onClick={() => void saveQuote(false)}>
                Save Quote
              </button>
              <button type="button" className={teal} disabled={busy} onClick={() => void saveQuote(true)}>
                Save & Send Email
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-2 text-lg font-semibold">{formatCents(calc.quotedTotal, currency)}</p>
        )}
        {data.engagement && (
          <p className="mt-2 text-xs text-[#5B6B7C]">
            Status: {data.engagement.quoteStatus}
            {data.engagement.quotedBy?.fullName ? ` · By ${data.engagement.quotedBy.fullName}` : ''}
          </p>
        )}
        {data.quoteHistory.length > 1 && (
          <div className="mt-3 space-y-1 text-xs text-[#5B6B7C]">
            <p className="font-semibold text-[#0C2340]">Quote history</p>
            {data.quoteHistory.slice(0, 4).map((h) => (
              <p key={h.id}>
                {formatCents(h.amountCents, currency)} · {h.status} · {new Date(h.createdAt).toLocaleDateString()}
                {h.createdBy?.fullName ? ` · ${h.createdBy.fullName}` : ''}
                {h.changeReason ? ` · ${h.changeReason}` : ''}
              </p>
            ))}
          </div>
        )}
      </section>

      {/* Schedule builder */}
      {canWrite && (
        <section className="rounded-xl border border-[#D7DEE6] bg-white p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#0C2340]">Payment Structure</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ['SINGLE', 'Single Payment'],
                ['SPLIT', 'Split Payments'],
                ['MONTHLY', 'Monthly Installments'],
                ['CUSTOM', 'Custom Schedule'],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2 rounded-lg border border-[#D7DEE6] px-3 py-2 text-sm">
                <input type="radio" checked={structure === value} onChange={() => setStructure(value)} />
                {label}
              </label>
            ))}
          </div>

          {structure === 'MONTHLY' && (
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              <input className={input} value={monthlyCount} onChange={(e) => setMonthlyCount(e.target.value)} placeholder="# installments" />
              <input type="date" className={input} value={monthlyFirst} onChange={(e) => setMonthlyFirst(e.target.value)} />
              <select className={input} value={monthlyFreq} onChange={(e) => setMonthlyFreq(e.target.value as 'MONTHLY' | 'BIWEEKLY')}>
                <option value="MONTHLY">Monthly</option>
                <option value="BIWEEKLY">Biweekly</option>
              </select>
              <button type="button" className={btn} onClick={applyMonthly}>
                Generate Dates
              </button>
            </div>
          )}

          <div className="mt-3 space-y-2">
            {drafts.map((d, idx) => (
              <div key={idx} className="grid gap-2 rounded-lg border border-[#EEF1F4] p-2 sm:grid-cols-5">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="shrink-0 text-xs font-semibold text-[#64748B]">{idx + 1}.</span>
                  <input
                    className={input}
                    aria-label={`Payment ${idx + 1} label`}
                    value={d.label}
                    onChange={(e) => setDrafts((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))}
                  />
                </div>
                <input className={input} value={d.amount} onChange={(e) => setDrafts((prev) => prev.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))} placeholder="Amount" />
                <input type="date" className={input} value={d.dueDate} onChange={(e) => setDrafts((prev) => prev.map((x, i) => (i === idx ? { ...x, dueDate: e.target.value } : x)))} />
                <input className={input} value={d.dueCondition} onChange={(e) => setDrafts((prev) => prev.map((x, i) => (i === idx ? { ...x, dueCondition: e.target.value } : x)))} placeholder="Due condition" />
                <div className="flex items-center gap-1">
                  <button type="button" className={btn} aria-label={`Move ${d.label || `payment ${idx + 1}`} up`} title="Move up" disabled={idx === 0} onClick={() => moveDraft(idx, -1)}>
                    <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" className={btn} aria-label={`Move ${d.label || `payment ${idx + 1}`} down`} title="Move down" disabled={idx === drafts.length - 1} onClick={() => moveDraft(idx, 1)}>
                    <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <button type="button" className="px-1 text-xs text-red-700" onClick={() => removeDraft(idx)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={btn}
              onClick={addDraft}
            >
              + Add Scheduled Payment
            </button>
            <span className="text-xs text-[#5B6B7C]">
              Scheduled total: {formatCents(scheduledTotal, currency)}
              {calc.quotedTotal > 0 && scheduledTotal !== calc.quotedTotal ? ' · mismatch warning' : ''}
            </span>
            <button type="button" className={btn} disabled={busy} onClick={() => void saveSchedule(false)}>
              Save Schedule
            </button>
            <button type="button" className={teal} disabled={busy} onClick={() => void saveSchedule(true)}>
              Save &amp; Copy Payment Schedule Email
            </button>
          </div>
        </section>
      )}

      {/* Installment list */}
      <section className="rounded-xl border border-[#D7DEE6] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#0C2340]">Payment Schedule</h3>
          {canWrite && (
            <div className="flex flex-wrap gap-2">
              {data.items.length > 0 && (
                <button
                  type="button"
                  className={teal}
                  disabled={busy}
                  onClick={() => void emailAction('PAYMENT_SCHEDULE', undefined, true)}
                >
                  Send Payment Schedule Email
                </button>
              )}
              <button
                type="button"
                className={primary}
                onClick={() => openRecord({ additional: false, itemId: data.nextDue?.id ?? null })}
              >
                + Record Payment Received
              </button>
              <button
                type="button"
                className={btn}
                onClick={() => openRecord({ additional: true })}
              >
                + Additional Payment
              </button>
            </div>
          )}
        </div>

        {data.items.length === 0 ? (
          <p className="mt-3 text-sm text-[#5B6B7C]">No payment schedule has been created.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.items.map((item) => (
              <li key={item.id} className="rounded-lg border border-[#EEF1F4] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-[#0C2340]">
                      {item.sequenceNumber}. {item.label} · {formatCents(item.scheduledAmountCents, currency)}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-[#5B6B7C]">
                      <StatusBadge status={item.status} />
                      {item.dueDate && <span>Due {new Date(item.dueDate).toLocaleDateString()}</span>}
                      {item.dueCondition && <span>{item.dueCondition}</span>}
                      {item.receivedCents > 0 && (
                        <span>
                          Received {formatCents(item.receivedCents, currency)}
                          {item.remainingCents > 0 ? ` · Remaining ${formatCents(item.remainingCents, currency)}` : ''}
                        </span>
                      )}
                      {item.lastReminderAt && <span>Last reminder {new Date(item.lastReminderAt).toLocaleDateString()} ({item.reminderCount})</span>}
                      {item.lastOverdueNoticeAt && <span>Overdue notice {new Date(item.lastOverdueNoticeAt).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  {canWrite && item.status !== 'PAID' && item.status !== 'WAIVED' && (
                    <div className="flex flex-wrap gap-1">
                      <button type="button" className={btn} onClick={() => void emailAction('PAYMENT_DUE', item.id, true)}>
                        Payment Request
                      </button>
                      <button type="button" className={btn} onClick={() => void emailAction('PAYMENT_REMINDER', item.id, true)}>
                        Reminder
                      </button>
                      {item.status === 'OVERDUE' && (
                        <button type="button" className={btn} onClick={() => void emailAction('PAYMENT_OVERDUE', item.id, true)}>
                          Overdue Email
                        </button>
                      )}
                      <button
                        type="button"
                        className={teal}
                        onClick={() =>
                          openRecord({
                            additional: false,
                            itemId: item.id,
                            amountCents: item.remainingCents,
                          })
                        }
                      >
                        Record Payment
                      </button>
                      <button type="button" className={btn} onClick={() => void emailAction('PAYMENT_DUE', item.id, true)}>
                        Preview
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Calculator */}
      <section className="rounded-xl border border-[#94A3B8] bg-[#F8FAFC] p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[#475569]">Payment Calculator</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div><dt className="text-xs text-[#5B6B7C]">Quoted Total</dt><dd className="font-semibold">{formatCents(calc.quotedTotal, currency)}</dd></div>
          <div><dt className="text-xs text-[#5B6B7C]">Scheduled Received</dt><dd className="font-semibold">{formatCents(calc.scheduledReceived, currency)}</dd></div>
          <div><dt className="text-xs text-[#5B6B7C]">Additional Received</dt><dd className="font-semibold">{formatCents(calc.additionalReceived, currency)}</dd></div>
          <div><dt className="text-xs text-[#5B6B7C]">Total Received</dt><dd className="font-semibold">{formatCents(calc.totalReceived, currency)}</dd></div>
          <div><dt className="text-xs text-[#5B6B7C]">Remaining Balance</dt><dd className="font-semibold">{formatCents(calc.remainingBalance, currency)}</dd></div>
          {calc.overpayment > 0 && (
            <div><dt className="text-xs text-amber-700">Overpayment</dt><dd className="font-semibold text-amber-800">{formatCents(calc.overpayment, currency)}</dd></div>
          )}
        </dl>
      </section>

      {/* History */}
      <section className="rounded-xl border border-[#D7DEE6] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-[#0C2340]">Payment History</h3>
          <a className={btn} href="/api/admin/finance?export=csv">
            Export CSV
          </a>
        </div>
        {data.receipts.length === 0 ? (
          <p className="mt-3 text-sm text-[#5B6B7C]">No payments have been recorded.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {data.receipts.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-[#EEF1F4] pt-2 text-sm">
                <div>
                  <p className="font-medium">
                    {new Date(r.receivedDate).toLocaleDateString()} · {r.description} · {formatCents(r.amountCents, currency)}
                    {r.status !== 'ACTIVE' ? ` · ${r.status}` : ''}
                    {isManualEntryMethod(r.paymentMethod) && (
                      <span className="ml-2 inline-block rounded bg-[#EEF1F4] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#5B6B7C]">
                        Manual Entry
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-[#5B6B7C]">
                    {r.paymentMethodOther || r.paymentMethod}
                    {r.receivedByName ? ` · Recorded by ${r.receivedByName}` : ''}
                    {r.confirmedBy?.fullName ? ` · Confirmed by ${r.confirmedBy.fullName}` : ''}
                    {r.referenceNumber ? ` · Ref ${r.referenceNumber}` : ''}
                    {r.receiptType === 'ADDITIONAL' ? ' · Additional' : ''}
                  </p>
                  {r.attachmentStorageKey && (
                    <button
                      type="button"
                      className="mt-1 text-xs font-medium text-[#0F766E] hover:underline"
                      onClick={() =>
                        void post({ action: 'receipt-attachment-url', receiptId: r.id }).then((json) => {
                          if (json?.url) window.open(json.url, '_blank', 'noopener,noreferrer')
                        })
                      }
                    >
                      Download {r.attachmentFilename || 'receipt'}
                    </button>
                  )}
                </div>
                {canWrite && r.status === 'ACTIVE' && (
                  <button
                    type="button"
                    className="text-xs text-red-700"
                    onClick={async () => {
                      const reason = prompt('Void reason')
                      if (!reason) return
                      await post({ action: 'void-payment', receiptId: r.id, reason })
                      await load()
                    }}
                  >
                    Void
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {message && <p className="text-sm text-emerald-700">{message}</p>}

      {/* Record payment modal */}
      {recordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#0C2340]">
              {recordAdditional ? 'Additional Payment Received' : 'Record Payment Received'}
            </h3>
            <div className="mt-3 space-y-2">
              <input
                className={input}
                placeholder="Description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              {!recordAdditional && (
                <select
                  className={input}
                  value={recordItemId ?? ''}
                  onChange={(e) => {
                    const id = e.target.value || null
                    setRecordItemId(id)
                    const item = data.items.find((i) => i.id === id)
                    if (item) {
                      setDescription(
                        buildPaymentDescription({
                          visaType: data.visaLabel,
                          installmentNumber: item.sequenceNumber,
                          candidateNumber: data.candidate.candidateNumber,
                        }),
                      )
                      if (!amount) setAmount((item.remainingCents / 100).toFixed(2))
                    }
                  }}
                >
                  <option value="">Select installment</option>
                  {data.items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.label} · remaining {formatCents(i.remainingCents, currency)}
                    </option>
                  ))}
                </select>
              )}
              <input className={input} placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <input type="date" className={input} value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
              <select className={input} value={method} onChange={(e) => setMethod(e.target.value)}>
                {PAYMENT_METHODS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
              {method === 'Other' && (
                <input className={input} placeholder="Custom method" value={methodOther} onChange={(e) => setMethodOther(e.target.value)} />
              )}
              {isManualEntryMethod(method) && (
                <p className="rounded border border-[#EEF1F4] bg-[#F8FAFC] px-2 py-1.5 text-xs text-[#5B6B7C]">
                  Manual Entry — payment is tracked in Afterstem without Stripe.
                </p>
              )}
              <label className="block text-xs font-medium text-[#64748B]">
                Recorded By
                <input className={`${input} mt-1`} placeholder="Recorded by" value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} />
              </label>
              <p className="text-xs text-[#5B6B7C]">Confirmed by: {adminName}</p>
              <input className={input} placeholder="Reference number" value={reference} onChange={(e) => setReference(e.target.value)} />
              <textarea className={input} rows={2} placeholder="Internal note" value={note} onChange={(e) => setNote(e.target.value)} />
              <label className="block text-xs font-medium text-[#64748B]">
                Attachment (optional)
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,application/pdf,image/jpeg"
                  className="mt-1 block w-full text-sm"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
                />
              </label>
              {attachmentFile && (
                <p className="text-xs text-[#64748B]">
                  Selected: {attachmentFile.name} ({Math.round(attachmentFile.size / 1024)} KB){' '}
                  <button type="button" className="underline" onClick={() => setAttachmentFile(null)}>
                    Remove
                  </button>
                </p>
              )}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className={btn} onClick={() => setRecordOpen(false)}>
                Cancel
              </button>
              <button type="button" className={primary} disabled={busy} onClick={() => void recordPayment(false)}>
                Save Receipt
              </button>
              <button type="button" className={teal} disabled={busy} onClick={() => void recordPayment(true)}>
                Save & Send Confirmation
              </button>
            </div>
          </div>
        </div>
      )}

      {preview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[#0C2340]">
                {previewTemplateKey === 'PAYMENT_SCHEDULE'
                  ? 'Payment Schedule Email'
                  : 'Payment email'}
              </p>
              <button type="button" className={btn} onClick={() => setPreview(null)}>
                Close
              </button>
            </div>
            <p className="mb-2 text-xs text-[#5B6B7C]">
              Preferred: edit if needed → Copy Email → paste into Gmail ({data?.candidate.email}). Afterstem does not
              auto-send this email.
            </p>
            <label className="mb-2 block text-xs font-medium text-[#5B6B7C]">
              Subject
              <input
                className={`${input} mt-1`}
                value={previewSubject}
                onChange={(e) => setPreviewSubject(e.target.value)}
              />
            </label>
            <label className="mb-2 block text-xs font-medium text-[#5B6B7C]">
              Body (Copy Email uses this exact text)
              <textarea
                className={`${input} mt-1 font-sans text-[13px] leading-5`}
                rows={12}
                value={previewPlain}
                onChange={(e) => {
                  setPreviewPlain(e.target.value)
                  setBodyEdited(true)
                }}
              />
            </label>
            <iframe title="Finance email preview" srcDoc={preview.html} className="mx-auto h-[40vh] w-full max-w-[680px] rounded border border-[#EEF1F4]" />
            <div className="mt-3 space-y-2">
              <EmailCopyActions
                to={data?.candidate.email || ''}
                subject={previewSubject}
                body={previewPlain}
                htmlBody={bodyEdited ? null : preview.html}
                candidateId={data?.candidate.id}
                caseId={caseId}
                templateType={String(previewTemplateKey)}
                showMarkSent
                onCopied={() => setMessage('Payment email copied — paste into Gmail to send.')}
              />
              <button
                type="button"
                className={btn}
                onClick={() => {
                  const prepared = prepareGmailCompose({
                    to: data?.candidate.email || '',
                    subject: previewSubject,
                    body: previewPlain,
                  })
                  if (!prepared.ok) alert(prepared.error)
                  else window.open(prepared.url, '_blank', 'noopener,noreferrer')
                }}
              >
                Open Gmail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
