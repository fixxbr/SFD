'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatDate } from '@/lib/format'
import { formatVisa, CASE_STATUS_LABELS, VISA_LABELS } from '@/lib/visa'
import type { CandidateListItem } from '@/lib/admin/search-candidates'
import { formatCents } from '@/lib/payments'
import { AddNoteModal, EditCandidateModal, EmailComposer } from '@/components/admin/candidate-profile'
import { WelcomeEmailModal } from '@/components/admin/welcome-email-modal'
import { lawyerOptions, referralOptions } from '@/lib/staff-options'
import { admin } from '@/lib/admin/ui'
import { cn } from '@/lib/utils'
import { downloadBulkCandidates } from '@/lib/admin-downloads'
import { downloadCandidateFolders } from '@/lib/bulk-folders-client'
import type { VisaType } from '@prisma/client'

const btn = admin.btnGhost
const field = admin.input

type RowModal = { kind: 'mail' | 'note' | 'edit'; row: CandidateListItem } | null
type CreatedCandidate = {
  id: string
  fullLegalName: string
  email: string
  candidateNumber?: string | null
  case?: {
    id: string
    caseNumber?: string | null
    visaType?: string | null
    quotedAmountCents?: number | null
    currency?: string | null
  }
}

const VISA_OPTIONS = Object.keys(VISA_LABELS) as VisaType[]

function paymentTone(label: string) {
  if (label.includes('Paid in Full')) return 'bg-emerald-50 text-emerald-800'
  if (label.includes('Overdue')) return 'bg-red-50 text-red-800'
  if (label.includes('Partial') || label.includes('Due')) return 'bg-amber-50 text-amber-900'
  return 'bg-slate-100 text-slate-700'
}

export function CandidatesTable({
  items,
  total,
  page,
  pageSize,
  staff,
  canCreate,
  canDelete,
  openCreate = false,
  visaCounts = [],
  lawyerMode = false,
}: {
  items: CandidateListItem[]
  total: number
  page: number
  pageSize: number
  staff: { id: string; fullName: string; role: string }[]
  canCreate: boolean
  canDelete: boolean
  openCreate?: boolean
  visaCounts?: Array<{ visaType: VisaType; label: string; count: number }>
  lawyerMode?: boolean
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [creating, setCreating] = useState(openCreate)
  const [showMoreFilters, setShowMoreFilters] = useState(false)
  const [createBusy, setCreateBusy] = useState(false)
  const [createError, setCreateError] = useState('')
  const [modal, setModal] = useState<RowModal>(null)
  const [moreOpenId, setMoreOpenId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CandidateListItem | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [welcomeFor, setWelcomeFor] = useState<CreatedCandidate | null>(null)
  const [successBanner, setSuccessBanner] = useState('')
  const [searchDraft, setSearchDraft] = useState(params.get('q') ?? '')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [exportBusy, setExportBusy] = useState('')
  const [exportError, setExportError] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const qParam = params.get('q') ?? ''
  useEffect(() => {
    setSearchDraft(qParam)
  }, [qParam])

  useEffect(() => {
    if (openCreate) setCreating(true)
  }, [openCreate])

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [])

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    if (key === 'create' && !value) next.delete('create')
    router.push(`/admin/candidates?${next.toString()}`)
  }

  function clearFilters() {
    router.push('/admin/candidates')
    setSearchDraft('')
  }

  function onSearchInput(value: string) {
    setSearchDraft(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setFilter('q', value.trim())
    }, 350)
  }

  function openCreateForm() {
    setCreating(true)
    const next = new URLSearchParams(params.toString())
    next.set('create', '1')
    router.replace(`/admin/candidates?${next.toString()}`)
  }

  function closeCreateForm() {
    setCreating(false)
    const next = new URLSearchParams(params.toString())
    next.delete('create')
    router.replace(`/admin/candidates?${next.toString() || ''}`)
  }

  async function createCandidate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (createBusy) return
    setCreateBusy(true)
    setCreateError('')
    const form = e.currentTarget
    const body = Object.fromEntries(new FormData(form).entries())
    const res = await fetch('/api/admin/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    setCreateBusy(false)
    if (!res.ok) {
      setCreateError(json.error ?? 'Unable to create candidate')
      return
    }
    closeCreateForm()
    form.reset()
    setSuccessBanner(
      json.created
        ? `Candidate ${json.candidate.candidateNumber} created successfully.`
        : `Existing candidate ${json.candidate.candidateNumber} opened.`,
    )
    setWelcomeFor({
      id: json.candidate.id,
      fullLegalName: json.candidate.fullLegalName,
      email: json.candidate.email,
      candidateNumber: json.candidate.candidateNumber,
      case: json.case,
    })
  }

  async function archiveCandidate() {
    if (!deleteTarget) return
    if (confirmName.trim() !== deleteTarget.fullLegalName) {
      alert('Type the candidate full legal name exactly to confirm.')
      return
    }
    setDeletingId(deleteTarget.id)
    const res = await fetch(`/api/admin/candidates/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmName }),
    })
    setDeletingId(null)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Unable to archive candidate')
      return
    }
    setDeleteTarget(null)
    setConfirmName('')
    router.refresh()
  }

  function finishWelcome() {
    const id = welcomeFor?.id
    setWelcomeFor(null)
    if (id) {
      router.push(`/admin/candidates/${id}`)
      router.refresh()
    } else {
      router.refresh()
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))
  const managers = staff.filter((s) => ['CASE_MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(s.role))
  const attorneys = lawyerOptions(staff)
  const referrers = referralOptions(staff)
  const activeVisa = params.get('visaType') ?? ''
  const hasFilters = [...params.keys()].some((k) => k !== 'page' && k !== 'create' && params.get(k))

  return (
    <div className="space-y-4">
      {successBanner && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {successBanner}
        </div>
      )}

      {visaCounts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFilter('visaType', '')}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium',
              !activeVisa ? 'border-[#0C2340] bg-[#0C2340] text-white' : 'border-[#E2E8F0] bg-white text-[#475569]',
            )}
          >
            All {total}
          </button>
          {visaCounts.slice(0, 8).map((chip) => (
            <button
              key={chip.visaType}
              type="button"
              onClick={() => setFilter('visaType', chip.visaType)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium',
                activeVisa === chip.visaType
                  ? 'border-[#0F766E] bg-[#0F766E] text-white'
                  : 'border-[#E2E8F0] bg-white text-[#475569]',
              )}
            >
              {chip.label} {chip.count}
            </button>
          ))}
        </div>
      )}

      <div className={cn(admin.card, 'p-3 sm:p-4')}>
        <div className="grid gap-2 md:grid-cols-12">
          <input
            name="q"
            value={searchDraft}
            onChange={(e) => onSearchInput(e.target.value)}
            placeholder="Search by ID, name, email, phone…"
            className={cn(field, 'md:col-span-4')}
          />
          <select
            value={params.get('visaType') ?? ''}
            onChange={(e) => setFilter('visaType', e.target.value)}
            className={cn(admin.select, 'md:col-span-2')}
          >
            <option value="">All visa types</option>
            {VISA_OPTIONS.map((v) => (
              <option key={v} value={v}>
                {VISA_LABELS[v]}
              </option>
            ))}
          </select>
          <select
            value={params.get('caseStatus') ?? ''}
            onChange={(e) => setFilter('caseStatus', e.target.value)}
            className={cn(admin.select, 'md:col-span-2')}
          >
            <option value="">All statuses</option>
            {Object.keys(CASE_STATUS_LABELS).map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
          <select
            value={params.get('paymentStatus') ?? ''}
            onChange={(e) => setFilter('paymentStatus', e.target.value)}
            className={cn(admin.select, 'md:col-span-2')}
          >
            <option value="">Payment</option>
            {['Paid in Full', 'Partial', 'Payment Due', 'Overdue', 'No Payment Plan', 'Quote Not Sent', 'Quote Sent', 'Quote Agreed'].map(
              (s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ),
            )}
          </select>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button type="button" className={admin.btnSecondary} onClick={() => setShowMoreFilters((v) => !v)}>
              {showMoreFilters ? 'Less' : 'More'}
            </button>
            {hasFilters && (
              <button type="button" className={admin.btnGhost} onClick={clearFilters}>
                Clear
              </button>
            )}
          </div>
        </div>

        {showMoreFilters && (
          <div className="mt-3 grid gap-2 border-t border-[#F1F5F9] pt-3 md:grid-cols-4 lg:grid-cols-6">
            <select
              value={params.get('onboardingStatus') ?? ''}
              onChange={(e) => setFilter('onboardingStatus', e.target.value)}
              className={admin.select}
            >
              <option value="">Onboarding</option>
              {['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'MORE_INFORMATION_REQUIRED', 'ACCEPTED'].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
            <select
              value={params.get('documentStatus') ?? ''}
              onChange={(e) => setFilter('documentStatus', e.target.value)}
              className={admin.select}
            >
              <option value="">Documents</option>
              {['UPLOADED', 'UNDER_REVIEW', 'ACCEPTED', 'NEEDS_REPLACEMENT', 'REJECTED', 'MISSING'].map((s) => (
                <option key={s} value={s}>
                  {s.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
            <select value={params.get('dueFilter') ?? ''} onChange={(e) => setFilter('dueFilter', e.target.value)} className={admin.select}>
              <option value="">Due date</option>
              <option value="due_today">Due Today</option>
              <option value="due_week">Due This Week</option>
              <option value="due_7">Due Next 7 Days</option>
              <option value="due_month">Due This Month</option>
              <option value="overdue">Overdue</option>
              <option value="overdue_30">30+ Days Overdue</option>
            </select>
            <select value={params.get('managerId') ?? ''} onChange={(e) => setFilter('managerId', e.target.value)} className={admin.select}>
              <option value="">Case manager</option>
              {managers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <select value={params.get('attorneyId') ?? ''} onChange={(e) => setFilter('attorneyId', e.target.value)} className={admin.select}>
              <option value="">Lawyer</option>
              {attorneys.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <select value={params.get('referredBy') ?? ''} onChange={(e) => setFilter('referredBy', e.target.value)} className={admin.select}>
              <option value="">Referred by</option>
              {referrers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.fullName}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={params.get('createdFrom') ?? ''}
              onChange={(e) => setFilter('createdFrom', e.target.value)}
              className={field}
              title="Created from"
            />
            <input
              type="date"
              value={params.get('activityFrom') ?? ''}
              onChange={(e) => setFilter('activityFrom', e.target.value)}
              className={field}
              title="Last activity from"
            />
          </div>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#F1F5F9] pt-3">
          <p className="text-xs text-[#64748B]">
            {total} candidate{total === 1 ? '' : 's'}
            {activeVisa ? ` · ${formatVisa(activeVisa)}` : ''}
          </p>
          {canCreate && (
            <button type="button" onClick={openCreateForm} className={admin.btnPrimary}>
              + Add Candidate
            </button>
          )}
        </div>
      </div>

      {creating && (
        <form onSubmit={createCandidate} className={cn(admin.card, 'space-y-5 p-4 sm:p-5')}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#0C2340]">Add Candidate</h2>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Candidate ID is generated automatically after saving. Created date is set by the system.
              </p>
            </div>
            <button type="button" className={admin.btnGhost} onClick={closeCreateForm}>
              Cancel
            </button>
          </div>

          <div>
            <p className={admin.label}>Candidate information</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#475569]">
                Full legal name
                <input name="fullLegalName" required className={cn(field, 'mt-1')} placeholder="Full legal name" />
              </label>
              <label className="block text-xs font-medium text-[#475569]">
                Email
                <input name="email" type="email" required className={cn(field, 'mt-1')} placeholder="email@example.com" />
              </label>
              <label className="block text-xs font-medium text-[#475569]">
                Phone
                <input name="phone" className={cn(field, 'mt-1')} placeholder="Phone" />
              </label>
              <label className="block text-xs font-medium text-[#475569]">
                Location / address
                <input name="currentAddress" className={cn(field, 'mt-1')} placeholder="City, state / address" />
              </label>
            </div>
          </div>

          <div>
            <p className={admin.label}>Case information</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#475569]">
                Visa type
                <select name="visaType" className={cn(admin.select, 'mt-1')} defaultValue="O_1A">
                  {VISA_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {VISA_LABELS[v]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[#475569]">
                Occupation / job
                <input name="occupation" className={cn(field, 'mt-1')} placeholder="Role or field" />
              </label>
              <label className="block text-xs font-medium text-[#475569]">
                Experience
                <input name="experience" className={cn(field, 'mt-1')} placeholder="Years / highlights (optional)" />
              </label>
              <label className="block text-xs font-medium text-[#475569]">
                Case status
                <select name="caseStatus" defaultValue="QUALIFIED" className={cn(admin.select, 'mt-1')}>
                  {Object.keys(CASE_STATUS_LABELS).map((s) => (
                    <option key={s} value={s}>
                      {CASE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[#475569]">
                Applied date
                <input name="appliedDate" type="date" className={cn(field, 'mt-1')} />
                <span className="mt-1 block text-[11px] font-normal text-[#94A3B8]">Optional. Created date is automatic.</span>
              </label>
            </div>
          </div>

          <div>
            <p className={admin.label}>Financial & assignment</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#475569]">
                Quoted amount (USD)
                <input name="quotedPrice" type="number" step="0.01" min="0" className={cn(field, 'mt-1')} placeholder="0.00" />
              </label>
              <input type="hidden" name="currency" value="usd" />
              <label className="block text-xs font-medium text-[#475569]">
                Lawyer
                <select name="assignedAttorneyId" className={cn(admin.select, 'mt-1')}>
                  <option value="">Unassigned</option>
                  {attorneys.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[#475569]">
                Referred by
                <select name="referredByAdminId" className={cn(admin.select, 'mt-1')}>
                  <option value="">—</option>
                  {referrers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-medium text-[#475569]">
                Other referral name
                <input name="referredByName" className={cn(field, 'mt-1')} placeholder="Optional" />
              </label>
            </div>
          </div>

          <div>
            <p className={admin.label}>Additional information</p>
            <label className="mt-2 block text-xs font-medium text-[#475569]">
              Internal notes
              <textarea name="notes" rows={3} className={cn(admin.textarea, 'mt-1')} placeholder="Optional internal notes" />
            </label>
          </div>

          {createError && <p className="text-sm text-red-700">{createError}</p>}

          <div className="flex flex-wrap gap-2">
            <button disabled={createBusy} className={admin.btnAccent}>
              {createBusy ? 'Saving…' : 'Save Candidate'}
            </button>
            <button type="button" className={admin.btnSecondary} onClick={closeCreateForm} disabled={createBusy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className={admin.tableWrap}>
        {selected.size > 0 && !lawyerMode && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <span className="text-xs font-medium text-[#0C2340]">{selected.size} selected</span>
            <button
              type="button"
              className={btn}
              disabled={Boolean(exportBusy)}
              onClick={() => setSelected(new Set(items.map((i) => i.id)))}
            >
              Select All on Page
            </button>
            <button type="button" className={btn} onClick={() => setSelected(new Set())}>
              Clear
            </button>
            <button
              type="button"
              className={btn}
              disabled={Boolean(exportBusy)}
              onClick={() => {
                setExportError('')
                setExportBusy('docs')
                void downloadBulkCandidates({
                  candidateIds: [...selected],
                  includeDocuments: true,
                  includeData: false,
                })
                  .catch((err) =>
                    setExportError(err instanceof Error ? err.message : "We couldn't prepare this download. Please try again."),
                  )
                  .finally(() => setExportBusy(''))
              }}
            >
              {exportBusy === 'docs' ? 'Preparing download…' : 'Export Selected Documents'}
            </button>
            <button
              type="button"
              className={btn}
              disabled={Boolean(exportBusy)}
              onClick={() => {
                setExportError('')
                setExportBusy('data')
                void downloadBulkCandidates({
                  candidateIds: [...selected],
                  includeDocuments: false,
                  includeData: true,
                })
                  .catch((err) =>
                    setExportError(err instanceof Error ? err.message : "We couldn't prepare this download. Please try again."),
                  )
                  .finally(() => setExportBusy(''))
              }}
            >
              {exportBusy === 'data' ? 'Preparing download…' : 'Export Selected Data'}
            </button>
            <button
              type="button"
              className={admin.btnAccent}
              disabled={Boolean(exportBusy)}
              onClick={() => {
                setExportError('')
                setExportBusy('all')
                // Same folder-per-candidate ZIP as "Download All", for the selected candidates.
                void downloadCandidateFolders({ ids: [...selected] })
                  .catch((err) =>
                    setExportError(err instanceof Error ? err.message : "We couldn't prepare this download. Please try again."),
                  )
                  .finally(() => setExportBusy(''))
              }}
            >
              {exportBusy === 'all' ? 'Preparing download…' : 'Download Selected'}
            </button>
            {exportError && <p className="w-full text-xs text-red-700">{exportError}</p>}
          </div>
        )}
        <table className={cn('w-full text-left', lawyerMode ? 'min-w-[720px]' : 'min-w-[1200px]')}>
          <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
            <tr>
              <th className={admin.th}>
                <input
                  type="checkbox"
                  aria-label="Select all candidates on this page"
                  checked={items.length > 0 && items.every((i) => selected.has(i.id))}
                  onChange={(e) => {
                    if (e.target.checked) setSelected(new Set(items.map((i) => i.id)))
                    else setSelected(new Set())
                  }}
                />
              </th>
              {(lawyerMode
                ? ['Candidate', 'Candidate ID', 'Visa', 'Documents', 'Status', 'Last Updated', 'Actions']
                : ['Candidate', 'Candidate ID', 'Visa', 'Case status', 'Docs', 'Recently Paid', 'Next Due', 'Outstanding', 'Actions']
              ).map((h) => (
                <th key={h} className={admin.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.id} className="border-t border-[#F1F5F9] hover:bg-[#F8FAFC]/70">
                <td className={admin.td}>
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.fullLegalName}`}
                    checked={selected.has(row.id)}
                    onChange={(e) => {
                      setSelected((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(row.id)
                        else next.delete(row.id)
                        return next
                      })
                    }}
                  />
                </td>
                <td className={admin.td}>
                  <Link href={`/admin/candidates/${row.id}`} className="font-medium hover:text-[#0F766E]">
                    {row.fullLegalName}
                  </Link>
                  {!lawyerMode && <p className="text-xs text-[#64748B]">{row.email}</p>}
                </td>
                <td className={cn(admin.td, 'font-mono text-xs font-semibold')}>{row.candidateNumber}</td>
                <td className={admin.td}>{row.visaType ? formatVisa(row.visaType) : '—'}</td>
                {lawyerMode ? (
                  <>
                    <td className={admin.td}>
                      <span className="tabular-nums text-sm font-medium">
                        {row.documents.accepted}/{Math.max(row.documents.uploaded, row.documents.accepted, 1)}
                      </span>
                    </td>
                    <td className={admin.td}>
                      <StatusBadge status={CASE_STATUS_LABELS[row.caseStatus ?? ''] ?? row.caseStatus ?? '—'} />
                    </td>
                    <td className={admin.td}>
                      <span className="text-xs text-[#64748B]">{formatDate(row.lastActivity)}</span>
                    </td>
                    <td className={admin.td}>
                      <Link href={`/admin/candidates/${row.id}`} className={btn}>
                        View Candidate
                      </Link>
                    </td>
                  </>
                ) : (
                  <>
                <td className={admin.td}>
                  <StatusBadge status={row.caseStatus} />
                </td>
                <td className={admin.td}>
                  <span className="tabular-nums text-sm font-medium">
                    {row.documents.accepted}/{Math.max(row.documents.uploaded, 1)}
                  </span>
                  <p className="text-[11px] text-[#94A3B8]">accepted / files</p>
                </td>
                <td className={admin.td}>
                  {row.recentlyPaid ? (
                    <>
                      <p className="text-sm font-medium tabular-nums">{formatCents(row.recentlyPaid.amountCents)}</p>
                      <p className="text-[11px] text-[#94A3B8]">{formatDate(row.recentlyPaid.date)}</p>
                    </>
                  ) : (
                    <span className="text-xs text-[#94A3B8]">—</span>
                  )}
                </td>
                <td className={admin.td}>
                  {row.nextDue ? (
                    <>
                      <p className="text-sm font-medium tabular-nums">{formatCents(row.nextDue.amountCents)}</p>
                      <p className="text-[11px] text-[#94A3B8]">
                        {row.nextDue.date ? formatDate(row.nextDue.date) : row.nextDue.label}
                      </p>
                    </>
                  ) : (
                    <span className="text-xs text-[#94A3B8]">—</span>
                  )}
                </td>
                <td className={admin.td}>
                  {row.remainingCents > 0 ? (
                    <span className="text-sm font-semibold tabular-nums text-[#B45309]">{formatCents(row.remainingCents)}</span>
                  ) : (
                    <span className="text-xs text-[#64748B]">{row.paymentStatus}</span>
                  )}
                </td>
                <td className={admin.td}>
                  <div className="relative flex flex-wrap items-center gap-1">
                    <Link href={`/admin/candidates/${row.id}`} className={btn}>
                      View
                    </Link>
                    <button type="button" className={btn} onClick={() => setModal({ kind: 'mail', row })}>
                      Email
                    </button>
                    <Link href={`/admin/candidates/${row.id}?tab=documents`} className={btn}>
                      Docs
                    </Link>
                    <Link href={`/admin/candidates/${row.id}?tab=payments`} className={btn}>
                      Payment
                    </Link>
                    <button
                      type="button"
                      className={btn}
                      onClick={() => setMoreOpenId((id) => (id === row.id ? null : row.id))}
                    >
                      ⋯
                    </button>
                    {moreOpenId === row.id && (
                      <div className="absolute right-0 top-8 z-20 min-w-[140px] rounded-lg border border-[#E2E8F0] bg-white p-1 shadow-lg">
                        <button
                          type="button"
                          className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-[#F8FAFC]"
                          onClick={() => {
                            setMoreOpenId(null)
                            setModal({ kind: 'edit', row })
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-[#F8FAFC]"
                          disabled={!row.caseId}
                          onClick={() => {
                            setMoreOpenId(null)
                            setModal({ kind: 'note', row })
                          }}
                        >
                          Add note
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="block w-full rounded px-2 py-1.5 text-left text-xs text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setMoreOpenId(null)
                              setDeleteTarget(row)
                              setConfirmName('')
                            }}
                          >
                            Archive
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </td>
                  </>
                )}
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={lawyerMode ? 7 : 9} className="px-3 py-10 text-center text-sm text-[#64748B]">
                  {lawyerMode
                    ? 'No assigned candidates match these filters.'
                    : 'No candidates match these filters.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <p className="text-[#64748B]">
          Page {page} of {pages}
        </p>
        <div className="flex gap-2">
          <button
            disabled={page <= 1}
            onClick={() => setFilter('page', String(page - 1))}
            className={cn(admin.btnSecondary, 'disabled:opacity-40')}
          >
            Previous
          </button>
          <button
            disabled={page >= pages}
            onClick={() => setFilter('page', String(page + 1))}
            className={cn(admin.btnSecondary, 'disabled:opacity-40')}
          >
            Next
          </button>
        </div>
      </div>

      {modal?.kind === 'mail' && (
        <EmailComposer
          candidate={{
            id: modal.row.id,
            email: modal.row.email,
            fullLegalName: modal.row.fullLegalName,
            phone: modal.row.phone,
            candidateNumber: modal.row.candidateNumber,
          }}
          currentCase={
            modal.row.caseId
              ? {
                  id: modal.row.caseId,
                  caseNumber: modal.row.caseNumber,
                  visaType: modal.row.visaType,
                  quotedAmountCents: modal.row.quotedCents,
                  currency: 'usd',
                }
              : null
          }
          onClose={() => setModal(null)}
          onDone={() => router.refresh()}
        />
      )}
      {modal?.kind === 'note' && modal.row.caseId && (
        <AddNoteModal
          candidateId={modal.row.id}
          caseId={modal.row.caseId}
          onClose={() => setModal(null)}
          onDone={() => router.refresh()}
        />
      )}
      {modal?.kind === 'edit' && (
        <EditCandidateModal
          candidate={{
            id: modal.row.id,
            fullLegalName: modal.row.fullLegalName,
            email: modal.row.email,
            phone: modal.row.phone,
          }}
          currentCase={
            modal.row.caseId
              ? {
                  id: modal.row.caseId,
                  status: modal.row.caseStatus,
                  assignedAttorneyId: modal.row.attorney?.id,
                  referredByName: modal.row.referredBy,
                }
              : null
          }
          staff={staff}
          onClose={() => setModal(null)}
          onDone={() => router.refresh()}
        />
      )}

      {welcomeFor && (
        <WelcomeEmailModal
          candidate={welcomeFor}
          currentCase={welcomeFor.case ?? null}
          onSkip={finishWelcome}
          onSent={finishWelcome}
        />
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-20">
          <div className="w-full max-w-md rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#0C2340]">Archive candidate?</h3>
            <p className="mt-2 text-sm text-[#64748B]">
              Soft-deletes the record. Payments, documents, emails, and activity history are preserved.
            </p>
            <dl className="mt-4 space-y-1 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 text-sm">
              <div>
                <dt className="text-xs uppercase text-[#64748B]">Name</dt>
                <dd className="font-medium">{deleteTarget.fullLegalName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#64748B]">Candidate ID</dt>
                <dd className="font-mono font-semibold">{deleteTarget.candidateNumber}</dd>
              </div>
            </dl>
            <label className="mt-4 block text-xs font-medium text-[#64748B]">
              Type full legal name to confirm
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className={cn(field, 'mt-1 w-full')}
                placeholder={deleteTarget.fullLegalName}
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                className={admin.btnDanger}
                disabled={deletingId === deleteTarget.id}
                onClick={() => void archiveCandidate()}
              >
                {deletingId === deleteTarget.id ? 'Archiving…' : 'Archive Candidate'}
              </button>
              <button className={admin.btnSecondary} onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
