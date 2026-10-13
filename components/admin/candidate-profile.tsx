'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { FormEvent } from 'react'
import { Paperclip } from 'lucide-react'
import type { AdminRole } from '@prisma/client'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatDateTime } from '@/lib/format'
import { CASE_STATUS_LABELS, formatVisa } from '@/lib/visa'
import { formatCents, validatePreFilingAllocation, financialSummary, expectedSplit } from '@/lib/payments'
import { questionByKey } from '@/lib/onboarding-catalog'
import { buildChecklist, type Checklist, type VisaTemplateSlot } from '@/lib/documents-checklist'
import { defsFromRequestItems, OTHER_SUPPORTING_DOCUMENT_KEY } from '@/lib/document-keys'
import { buildOnboardingOverview } from '@/lib/onboarding-overview'
import { DocumentPreviewModal } from '@/components/admin/document-preview-modal'
import { DocumentFileName } from '@/components/admin/document-file-name'
import { formatUrlForDisplay } from '@/lib/document-links'
import { countChecklist, missingChecklistItems } from '@/lib/document-counts'
import { DocumentCountsBar } from '@/components/admin/document-counts-bar'
import { LinksPanel } from '@/components/admin/links-panel'
import { can } from '@/lib/rbac'
import {
  EMAIL_TEMPLATES,
  mergeTemplate,
  buildMergeVars,
  templateByKey,
  type EmailTemplateKey,
} from '@/lib/email-templates'
import { renderCatalogEmail, hasUnresolvedMergeTokens } from '@/lib/email/catalog-html'
import { lawyerOptions, referralOptions } from '@/lib/staff-options'
import { DocRequestModal } from '@/components/admin/doc-request-modal'
import { DataPortabilityBar } from '@/components/admin/data-portability-bar'
import { DocumentRequestCenter } from '@/components/admin/document-request-center'
import { FinancialCenter } from '@/components/admin/financial-center'
import { DocumentsBlock } from '@/components/admin/documents-block'
import { LawyerAssignmentControl } from '@/components/admin/lawyer-assignment-control'
import { uploadFileToApi } from '@/lib/client-upload'
import { UPLOAD_ACCEPT, UPLOAD_TYPE_HINT } from '@/lib/upload-validation'
import { EmailCopyActions } from '@/components/admin/email-copy-actions'
import { EvidenceEntriesPanel } from '@/components/admin/evidence-entries-panel'
import { DownloadExportMenu } from '@/components/admin/download-export-menu'
import {
  CANDIDATE_PROFILE_TABS,
  HASH_TO_TAB,
  VALID_TABS,
  resolveCandidateTab,
  type CandidateProfileTab,
} from '@/lib/candidate-profile-tabs'

const HEALTH = ['ON_TRACK', 'NEEDS_ATTENTION', 'WAITING_ON_CANDIDATE', 'WAITING_ON_ATTORNEY', 'READY_FOR_NEXT_STEP'] as const
const PAY_METHODS = ['ACH', 'Wire', 'Check', 'Cash', 'Zelle', 'Bank Transfer', 'Other']
const btn = 'rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7]'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-medium text-white'
const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'

type ModalKey = 'email' | 'docs' | 'paid' | 'note' | 'edit' | 'upload' | null
type TabKey = CandidateProfileTab

const TABS = CANDIDATE_PROFILE_TABS

const MODAL_HASH: Record<string, ModalKey> = {
  mail: 'email',
  docs: 'docs',
  note: 'note',
  edit: 'edit',
}

function subscribeHash(onStoreChange: () => void) {
  window.addEventListener('hashchange', onStoreChange)
  return () => window.removeEventListener('hashchange', onStoreChange)
}

function getHashClient() {
  return window.location.hash.replace('#', '')
}

/** Empty on server + during hydration so markup matches. */
function getHashServer() {
  return ''
}

export type { CandidateProfileTab }

export function CandidateProfile({
  candidate,
  currentCase,
  limited,
  lawyerMode = false,
  userRole,
  staff,
  paymentStatus,
  adminName,
  initialTab = 'overview',
  templateItems = [],
}: {
  candidate: any
  currentCase: any
  limited: boolean
  lawyerMode?: boolean
  userRole: AdminRole
  staff: { id: string; fullName: string; role: string }[]
  paymentStatus: string
  adminName: string
  /** Must match the server-resolved tab (from `?tab=`). Never derive from `window` on first render. */
  initialTab?: TabKey
  /** The case's visa document template (same list the Request Documents center offers). */
  templateItems?: VisaTemplateSlot[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const onDone = () => router.refresh()
  const [modal, setModal] = useState<ModalKey>(null)
  const [paidId, setPaidId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [missingDocsOpenSignal, setMissingDocsOpenSignal] = useState(0)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateKey | undefined>(undefined)
  const moreRef = useRef<HTMLDivElement>(null)

  // Hash is '' during SSR/hydration; after hydration it reflects location.hash (no mismatch).
  const hash = useSyncExternalStore(subscribeHash, getHashClient, getHashServer)
  const paramTab = searchParams.get('tab')
  // Prefer ?tab= (available to the server). Fall back to initialTab, then hash after hydrate.
  const tab = resolveCandidateTab(paramTab || initialTab, paramTab ? '' : hash, lawyerMode)

  // While Overview is open, check every 20s (and on focus) whether anything changed —
  // candidate uploads, links, other staff edits — and re-render only when it did.
  // The check is one small query; a full refresh rebuilds the page (~28 queries).
  const caseIdForVersion = currentCase?.id as string | undefined
  useEffect(() => {
    if (tab !== 'overview' || !caseIdForVersion) return
    let lastVersion: string | null = null
    let stopped = false
    const check = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      try {
        const res = await fetch(`/api/admin/cases/${caseIdForVersion}/version`, { cache: 'no-store' })
        if (!res.ok || stopped) return
        const { version } = (await res.json()) as { version: string }
        if (lastVersion !== null && version !== lastVersion) router.refresh()
        lastVersion = version
      } catch {
        // Offline / transient: try again on the next tick.
      }
    }
    void check()
    const id = window.setInterval(() => void check(), 20_000)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    return () => {
      stopped = true
      window.clearInterval(id)
      window.removeEventListener('focus', onFocus)
    }
  }, [tab, router, caseIdForVersion])

  const writeC = !lawyerMode && can(userRole, 'candidates:write')
  const writeP = !lawyerMode && can(userRole, 'payments:write')
  const writeN = can(userRole, 'notes:write')
  const writeM = !lawyerMode && can(userRole, 'communications:write')
  const writeK = !lawyerMode && can(userRole, 'cases:write')
  const writeD = can(userRole, 'documents:write')
  const canReviewDocs = can(userRole, 'documents:review')
  const canDelete = !lawyerMode && can(userRole, 'candidates:archive')
  const quoted = lawyerMode
    ? 0
    : currentCase?.financialEngagement?.quotedAmountCents ?? currentCase?.quotedAmountCents ?? 0
  const currency = (currentCase?.currency || 'usd').toUpperCase()
  const receipts = lawyerMode ? [] : (currentCase?.paymentReceipts ?? []).filter((r: any) => r.status === 'ACTIVE')
  const paidFromReceipts = receipts.reduce((s: number, r: any) => s + (r.amountCents || 0), 0)
  const legacySummary = financialSummary(quoted, currentCase?.payments ?? [])
  const totalPaid = paidFromReceipts > 0 ? paidFromReceipts : legacySummary.totalPaid
  const remaining = Math.max(0, quoted - totalPaid)
  const recentlyPaid = [...receipts].sort(
    (a: any, b: any) => new Date(b.receivedDate).getTime() - new Date(a.receivedDate).getTime(),
  )[0] as any
  const scheduleItems = lawyerMode ? [] : currentCase?.paymentScheduleItems ?? []
  const nextDueItem = scheduleItems.find((item: any) => {
    const received = (item.receipts ?? []).reduce((s: number, r: any) => s + r.amountCents, 0)
    return received < item.scheduledAmountCents && !['PAID', 'WAIVED', 'CANCELLED'].includes(item.status)
  }) as any
  const labelDefs = useMemo(() => {
    const fromRequests = defsFromRequestItems(
      (currentCase?.documentRequests ?? []).flatMap(
        (request: { items?: Array<{ documentKey?: string; key?: string; documentName?: string; label?: string; category?: string | null }> }) =>
          request.items ?? [],
      ),
    )
    return [...fromRequests, ...(currentCase?.customDocumentDefs ?? [])]
  }, [currentCase?.documentRequests, currentCase?.customDocumentDefs])
  // One visa-aware checklist feeds Overview, Documents and Request Documents (lists + counts).
  const checklist = useMemo(
    () => buildChecklist(currentCase?.documents ?? [], labelDefs, { templateItems }),
    [currentCase?.documents, labelDefs, templateItems],
  )
  const missingItems = useMemo(() => missingChecklistItems(checklist), [checklist])
  const docCounts = useMemo(() => countChecklist(checklist), [checklist])
  const lawyer = currentCase?.assignedAttorney?.fullName
  const referred = currentCase?.referredByAdmin?.fullName ?? currentCase?.referredByName
  const financeStatus =
    lawyerMode
      ? '—'
      : quoted <= 0 && receipts.length === 0
        ? 'No Payment Plan'
        : remaining <= 0 && quoted > 0
          ? 'Paid in Full'
          : recentlyPaid
            ? 'Partial'
            : 'Outstanding'

  const visibleTabs = lawyerMode
    ? TABS.filter((t) => t.key === 'overview' || t.key === 'documents' || t.key === 'notes')
    : TABS

  const communications = useMemo(() => {
    const map = new Map<string, any>()
    for (const item of [...(candidate.communications ?? []), ...(currentCase?.communications ?? [])]) {
      map.set(item.id, item)
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
    )
  }, [candidate.communications, currentCase?.communications])

  const activities = useMemo(() => {
    const map = new Map<string, any>()
    for (const item of [...(currentCase?.activities ?? []), ...(candidate.activities ?? [])]) {
      map.set(item.id, item)
    }
    return [...map.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
  }, [currentCase?.activities, candidate.activities])

  function selectTab(next: TabKey, sectionHash?: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    const qs = params.toString()
    const anchor = sectionHash ? `#${sectionHash}` : ''
    router.replace(`${pathname}?${qs}${anchor}`, { scroll: false })
  }

  useEffect(() => {
    if (!hash) return
    const modalKey = MODAL_HASH[hash]
    if (modalKey) setModal(modalKey)
  }, [hash])

  useEffect(() => {
    if (!hash || !HASH_TO_TAB[hash] || HASH_TO_TAB[hash] !== tab) return
    const t = window.setTimeout(() => {
      document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => window.clearTimeout(t)
  }, [tab, hash])

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  async function archiveCandidate() {
    if (confirmName.trim() !== candidate.fullLegalName) {
      alert('Type the candidate full legal name exactly to confirm.')
      return
    }
    setDeleting(true)
    const res = await fetch(`/api/admin/candidates/${candidate.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmName }),
    })
    setDeleting(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Unable to archive candidate')
      return
    }
    router.push(lawyerMode ? '/lawyer/candidates' : '/admin/candidates')
    router.refresh()
  }

  return (
    <div className="space-y-4 pb-16">
      <header className="sticky top-14 z-20 space-y-3 rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <nav className="mb-1 flex flex-wrap items-center gap-1 text-xs text-[#64748B]" aria-label="Breadcrumb">
              {lawyerMode ? (
                <>
                  <Link href="/lawyer/candidates" className="hover:text-[#0F766E]">
                    Lawyer
                  </Link>
                  <span className="text-[#CBD5E1]">/</span>
                  <Link href="/lawyer/candidates" className="hover:text-[#0F766E]">
                    My Candidates
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/admin" className="hover:text-[#0F766E]">
                    Admin
                  </Link>
                  <span className="text-[#CBD5E1]">/</span>
                  <Link href="/admin/candidates" className="hover:text-[#0F766E]">
                    Candidates
                  </Link>
                </>
              )}
              <span className="text-[#CBD5E1]">/</span>
              <span className="text-[#0C2340]">{candidate.candidateNumber ?? 'Profile'}</span>
            </nav>
            <h1 className="text-2xl font-semibold tracking-tight text-[#0C2340]">{candidate.fullLegalName}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#64748B]">
              <span className="font-semibold text-[#0C2340]">{candidate.candidateNumber ?? '—'}</span>
              <span aria-hidden>·</span>
              <span>{currentCase ? formatVisa(currentCase.visaType) : '—'}</span>
              <span aria-hidden>·</span>
              <span>{currentCase ? CASE_STATUS_LABELS[currentCase.status] ?? currentCase.status : 'No case'}</span>
              {candidate.lifecycle === 'ARCHIVED' ? (
                <>
                  <span aria-hidden>·</span>
                  <span>Archived</span>
                </>
              ) : null}
            </p>
            <p className="mt-2 text-sm text-[#334155]">
              <span className="text-[#64748B]">Assigned Lawyer:</span>{' '}
              <strong className="text-[#0C2340]">{lawyer || 'Unassigned'}</strong>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {currentCase ? (
              writeK ? (
                <CaseStatusEditor
                  caseId={currentCase.id}
                  status={currentCase.status}
                  canWrite
                  compact
                  onDone={onDone}
                />
              ) : (
                <StatusBadge status={CASE_STATUS_LABELS[currentCase.status] ?? currentCase.status} />
              )
            ) : (
              <StatusBadge status="No case" />
            )}
            {!lawyerMode && <StatusBadge status={paymentStatus} />}
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <span>Lawyer: <strong>{lawyer || 'Unassigned'}</strong></span>
          {!lawyerMode && <span>Referred by: <strong>{referred || '—'}</strong></span>}
          {!lawyerMode && <span>Quoted: <strong>{quoted ? formatCents(quoted, currency) : '—'}</strong></span>}
          {!lawyerMode && <span>Paid: <strong>{formatCents(totalPaid, currency)}</strong></span>}
          {!lawyerMode && <span>Balance: <strong>{formatCents(remaining, currency)}</strong></span>}
          {lawyerMode && (
            <span>
              Documents: <strong>{docCounts.submitted} / {docCounts.required}</strong>
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {writeC && <button type="button" className={btn} onClick={() => setModal('edit')}>Edit</button>}
          {writeM && (
            <button
              type="button"
              className={primary}
              onClick={() => {
                setEmailTemplate(undefined)
                setModal('email')
              }}
            >
              Send Email
            </button>
          )}
          {writeM && currentCase && (
            <button type="button" className={btn} onClick={() => selectTab('documents', 'doc-requests')}>
              Request Documents
            </button>
          )}
          {writeP && currentCase && (
            <button type="button" className={btn} onClick={() => selectTab('payments', 'financial')}>
              Request Payment
            </button>
          )}
          {!lawyerMode && <DownloadExportMenu candidateId={candidate.id} />}
          <div className="relative" ref={moreRef}>
            <button type="button" className={btn} onClick={() => setMoreOpen((o) => !o)}>
              More Actions
            </button>
            {moreOpen && (
              <div className="absolute right-0 z-40 mt-1 min-w-[11rem] rounded border border-[#D7DEE6] bg-white py-1 shadow-lg">
                {writeD && currentCase && (
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[#F3F5F7]"
                    onClick={() => {
                      setMoreOpen(false)
                      setModal('upload')
                    }}
                  >
                    Add Document
                  </button>
                )}
                {writeN && currentCase && (
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-xs hover:bg-[#F3F5F7]"
                    onClick={() => {
                      setMoreOpen(false)
                      setModal('note')
                    }}
                  >
                    Add Note
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    className="block w-full px-3 py-1.5 text-left text-xs text-red-700 hover:bg-[#F3F5F7]"
                    onClick={() => {
                      setMoreOpen(false)
                      setConfirmName('')
                      setArchiveOpen(true)
                    }}
                  >
                    Archive Candidate
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
        <nav
          className="mt-1 flex flex-wrap gap-2 rounded-lg border border-[#99F6E4]/60 bg-[#F0FDFA] p-2"
          aria-label="Candidate sections"
        >
          {visibleTabs.map((t) => (
            <button
              key={t.key}
              type="button"
              className={`rounded-md px-4 py-2.5 text-sm font-bold tracking-wide transition-colors ${
                tab === t.key
                  ? 'bg-[#0F766E] text-white shadow-sm ring-2 ring-[#0F766E]/30'
                  : 'bg-white text-[#0F766E] ring-1 ring-[#99F6E4] hover:bg-[#CCFBF1] hover:text-[#0D655E]'
              }`}
              onClick={() => selectTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        {!lawyerMode && (
          <div className="pt-1">
            <DataPortabilityBar candidateId={candidate.id} />
          </div>
        )}
      </header>

      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Section id="candidate-info" title="Candidate Information">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Name" value={candidate.fullLegalName} />
                <Info label="Email" value={candidate.email} />
                <Info label="Phone" value={candidate.phone} />
                <Info label="Location" value={candidate.currentAddress} />
                <Info label="Immigration status" value={candidate.currentImmigrationStatus} />
                <Info label="Nationality" value={candidate.nationality} />
              </dl>
              {writeC && (
                <form className="mt-4 grid gap-2 border-t border-[#EEF1F4] pt-4 sm:grid-cols-2" onSubmit={(e) => saveCandidate(e, candidate.id, candidate.email, onDone)}>
                  <input name="fullLegalName" defaultValue={candidate.fullLegalName} className={input} placeholder="Full legal name" />
                  <input name="email" type="email" defaultValue={candidate.email} className={input} placeholder="Email" />
                  <input name="phone" defaultValue={candidate.phone ?? ''} className={input} placeholder="Phone" />
                  <input name="currentImmigrationStatus" defaultValue={candidate.currentImmigrationStatus ?? ''} className={input} placeholder="Immigration status" />
                  <input name="currentAddress" defaultValue={candidate.currentAddress ?? ''} className={`${input} sm:col-span-2`} placeholder="Address / location" />
                  <button className={primary}>Save profile</button>
                </form>
              )}
            </Section>

            <Section id="case-info" title="Case Information">
              {!currentCase ? (
                <p className="text-sm text-[#5B6B7C]">No case yet.</p>
              ) : (
                <>
                  <dl className="grid gap-3 text-sm sm:grid-cols-2">
                    <Info label="Visa Type" value={formatVisa(currentCase.visaType)} />
                    <Info label="Case number" value={currentCase.caseNumber} />
                    <Info label="Opened" value={formatDateTime(currentCase.openedAt)} />
                    <Info label="Lawyer" value={lawyer} />
                    {!lawyerMode && <Info label="Referred by" value={referred} />}
                    <Info label="Status" value={CASE_STATUS_LABELS[currentCase.status] ?? currentCase.status} />
                    {lawyerMode && <Info label="Last updated" value={formatDateTime(currentCase.updatedAt ?? currentCase.openedAt)} />}
                  </dl>
                  <div className="mt-4 border-t border-[#EEF1F4] pt-4">
                    <CaseStatusEditor
                      caseId={currentCase.id}
                      status={currentCase.status}
                      canWrite={writeK}
                      onDone={onDone}
                    />
                  </div>
                </>
              )}
            </Section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section id="doc-progress" title="Document Progress">
              <DocumentCountsBar
                counts={docCounts}
                onMissingClick={() => {
                  setMissingDocsOpenSignal((n) => n + 1)
                  selectTab('documents', 'missing-docs')
                }}
              />
              <p className="mt-3 text-2xl font-semibold tabular-nums text-[#0C2340]">
                {docCounts.submitted} / {docCounts.required}
                <span className="ml-2 text-sm font-normal text-[#64748B]">required documents submitted</span>
              </p>
              <button type="button" className={`${btn} mt-3`} onClick={() => selectTab('documents')}>
                Open Documents
              </button>
            </Section>

            {!lawyerMode && (
            <Section id="pay-summary" title="Payment Summary">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Info label="Quoted" value={quoted ? formatCents(quoted, currency) : '—'} />
                <Info label="Paid" value={formatCents(totalPaid, currency)} />
                <Info label="Outstanding" value={formatCents(remaining, currency)} />
                <Info label="Status" value={financeStatus} />
              </dl>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-lg border border-[#EEF1F4] bg-[#F8FAFC] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Recently Paid</p>
                  {recentlyPaid ? (
                    <dl className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#64748B]">Amount</dt>
                        <dd className="font-semibold">{formatCents(recentlyPaid.amountCents, currency)}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#64748B]">Date</dt>
                        <dd>{formatDateTime(recentlyPaid.receivedDate).split(',')[0]}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#64748B]">Description</dt>
                        <dd className="text-right">{recentlyPaid.description}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#64748B]">Recorded by</dt>
                        <dd>{recentlyPaid.receivedByName || recentlyPaid.confirmedBy?.fullName || '—'}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-2 text-sm text-[#94A3B8]">No payments recorded yet.</p>
                  )}
                </div>
                <div className="rounded-lg border border-[#EEF1F4] bg-[#F8FAFC] p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">Next Due</p>
                  {nextDueItem ? (
                    <dl className="mt-2 space-y-1 text-sm">
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#64748B]">Amount</dt>
                        <dd className="font-semibold">
                          {formatCents(
                            Math.max(
                              0,
                              nextDueItem.scheduledAmountCents -
                                (nextDueItem.receipts ?? []).reduce((s: number, r: any) => s + r.amountCents, 0),
                            ),
                            currency,
                          )}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#64748B]">Due</dt>
                        <dd>
                          {nextDueItem.dueDate
                            ? formatDateTime(nextDueItem.dueDate).split(',')[0]
                            : nextDueItem.dueCondition || '—'}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#64748B]">Description</dt>
                        <dd className="text-right">{nextDueItem.label}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt className="text-[#64748B]">Status</dt>
                        <dd>{nextDueItem.status || 'Upcoming'}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p className="mt-2 text-sm text-[#94A3B8]">No upcoming scheduled payments.</p>
                  )}
                </div>
              </div>
              <button type="button" className={`${btn} mt-3`} onClick={() => selectTab('payments')}>
                Open Payments
              </button>
            </Section>
            )}
          </div>

          <Section id="links" title="Links">
            {!currentCase ? (
              <p className="text-sm text-[#5B6B7C]">Create a case first.</p>
            ) : (
              <LinksPanel
                candidateId={candidate.id}
                caseId={currentCase.id}
                links={checklist.links}
                canWrite={writeD}
                uploaderNames={Object.fromEntries((staff || []).map((s) => [s.id, s.fullName]))}
                onDone={onDone}
              />
            )}
          </Section>

          {!limited && !lawyerMode && (
            <Section id="progress" title="Case Progress">
              {!currentCase ? <p className="text-sm text-[#5B6B7C]">No case yet.</p> : (
                <ProgressBlock currentCase={currentCase} counts={docCounts} canWrite={writeK} onDone={onDone} />
              )}
            </Section>
          )}

          {!limited && !lawyerMode && (
            <Section id="lawyer" title="Lawyer & Referral">
              {!currentCase ? (
                <p className="text-sm text-[#5B6B7C]">No case yet.</p>
              ) : (
                <div className="space-y-4">
                  <LawyerAssignmentControl
                    caseId={currentCase.id}
                    currentLawyerId={currentCase.assignedAttorneyId ?? null}
                    currentLawyerName={lawyer || null}
                    staff={staff}
                    canWrite={writeK}
                    onDone={onDone}
                  />
                  {writeK ? (
                    <form className="grid gap-2 sm:grid-cols-2" onSubmit={(e) => saveCase(e, currentCase.id, onDone)}>
                      <label className="text-xs font-medium text-[#5B6B7C] sm:col-span-2">
                        Referred by
                        <select
                          name="referredByAdminId"
                          defaultValue={currentCase.referredByAdminId ?? ''}
                          className={`${input} mt-1`}
                        >
                          <option value="">Select referral name</option>
                          {referralOptions(staff).map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.fullName}
                            </option>
                          ))}
                        </select>
                      </label>
                      <input
                        name="referredByName"
                        defaultValue={currentCase.referredByName ?? ''}
                        placeholder="Other referral name (optional)"
                        className={input}
                      />
                      <button className={primary}>Save referral</button>
                    </form>
                  ) : (
                    <p className="text-sm">Referred: {referred || '—'}</p>
                  )}
                </div>
              )}
            </Section>
          )}

          {!limited && (
            <Section id="onboarding" title="Onboarding / Submitted Information">
              <OnboardingBlock
                currentCase={currentCase}
                checklist={checklist}
                canReview={can(userRole, 'onboarding:review')}
                lawyerMode={lawyerMode}
                onDone={onDone}
              />
            </Section>
          )}
        </div>
      )}

      {tab === 'documents' && !limited && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D7DEE6] bg-white px-5 py-3 text-sm">
            <DocumentCountsBar
              counts={docCounts}
              onMissingClick={() => {
                setMissingDocsOpenSignal((n) => n + 1)
                selectTab('documents', 'missing-docs')
              }}
            />
            {writeM && docCounts.missing > 0 && (
              <button
                type="button"
                className={primary}
                onClick={() => {
                  setEmailTemplate('MISSING_DOCUMENT_REMINDER')
                  setModal('email')
                }}
              >
                Send Missing Document Reminder
              </button>
            )}
          </div>
          {missingItems.length > 0 && (
            <MissingDocumentsSection openFromHash={hash === 'missing-docs'} openSignal={missingDocsOpenSignal}>
              <ul className="space-y-1 text-sm">
                {missingItems.map((item) => (
                  <li key={item.questionKey} className="flex flex-wrap justify-between gap-2 border-t border-[#EEF1F4] py-2">
                    <span>{item.label}</span>
                    <StatusBadge status={String(item.status).replaceAll('_', ' ')} />
                  </li>
                ))}
              </ul>
            </MissingDocumentsSection>
          )}
          {currentCase && !lawyerMode && (
            <Section id="doc-requests" title="Request Documents">
              <DocumentRequestCenter
                caseId={currentCase.id}
                candidate={{
                  id: candidate.id,
                  fullLegalName: candidate.fullLegalName,
                  candidateNumber: candidate.candidateNumber,
                  email: candidate.email,
                }}
                visaType={currentCase.visaType}
                canWrite={writeM}
                canUpload={writeD}
                counts={docCounts}
                missingKeys={missingItems.map((item) => item.questionKey)}
                onChanged={onDone}
              />
            </Section>
          )}
          <Section id="evidence-entries" title="Education, transcripts, employment, licenses, and clients">
            {!currentCase ? (
              <p className="text-sm text-[#5B6B7C]">Create a case first.</p>
            ) : (
              <EvidenceEntriesPanel
                candidateId={candidate.id}
                caseId={currentCase.id}
                canWrite={writeD && !lawyerMode}
                canReview={canReviewDocs && !lawyerMode}
                canComment={writeN}
                allowDownload={!lawyerMode}
                onDone={onDone}
              />
            )}
          </Section>
          <Section id="documents" title="Received Documents">
            {!currentCase ? <p className="text-sm text-[#5B6B7C]">Create a case first.</p> : (
              <DocumentsBlock
                candidateId={candidate.id}
                currentCase={currentCase}
                checklist={checklist}
                requestItems={(currentCase?.documentRequests ?? []).flatMap((request: { items?: unknown[] }) => request.items ?? [])}
                canWrite={writeD && !lawyerMode}
                canUpload={lawyerMode && writeD}
                allowDownload={!lawyerMode}
                canReview={canReviewDocs}
                canComment={writeN}
                uploaderNames={Object.fromEntries(
                  (staff || []).map((s: { id: string; fullName: string }) => [s.id, s.fullName]),
                )}
                onDone={onDone}
              />
            )}
          </Section>
        </div>
      )}

      {tab === 'lawyer-workspace' && !lawyerMode && (
        <div className="space-y-4">
          <Section id="lawyer-assigned" title="Assigned Lawyer">
            <p className="text-sm text-[#0C2340]">
              <strong>{lawyer || 'Unassigned'}</strong>
              {lawyer ? <span className="ml-2 text-xs text-[#64748B]">Immigration Attorney</span> : null}
            </p>
            <p className="mt-1 text-xs text-[#94A3B8]">
              Lawyer uploads and notes are stored on this same candidate record. Reassignment does not copy or delete them.
            </p>
          </Section>
          <Section id="lawyer-uploads" title="Lawyer Uploads">
            {(() => {
              const files = (currentCase?.documents ?? []).filter(
                (d: any) => d.isCurrentVersion && d.status !== 'ARCHIVED' && d.uploadedByType === 'LAWYER',
              )
              if (!files.length) return <p className="text-sm text-[#64748B]">No lawyer uploads yet.</p>
              return (
                <ul className="space-y-2">
                  {files.map((doc: any) => (
                    <li key={doc.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2 text-sm">
                      <p className="font-medium text-[#0C2340]">{doc.displayName || doc.originalFilename}</p>
                      <p className="text-xs text-[#64748B]">
                        Lawyer Upload
                        {doc.uploadedById && staff.find((s) => s.id === doc.uploadedById)
                          ? ` · ${staff.find((s) => s.id === doc.uploadedById)?.fullName}`
                          : ''}{' '}
                        · {doc.uploadedAt ? formatDateTime(doc.uploadedAt) : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </Section>
          <Section id="lawyer-notes" title="Lawyer Notes">
            {(() => {
              const lawyerNotes = (currentCase?.notes ?? []).filter((n: any) => n.author?.role === 'ATTORNEY')
              if (!lawyerNotes.length) return <p className="text-sm text-[#64748B]">No lawyer notes yet.</p>
              return (
                <ul className="space-y-3">
                  {lawyerNotes.map((n: any) => (
                    <li key={n.id} className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-[#0C2340]">
                        {n.author?.fullName || 'Lawyer'} · Lawyer
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">{n.note}</p>
                      <p className="mt-1 text-[11px] text-[#94A3B8]">{formatDateTime(n.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )
            })()}
          </Section>
        </div>
      )}

      {tab === 'payments' && !lawyerMode && (
        <div className="space-y-4">
          <Section id="financial" title="Payments">
            {!currentCase ? (
              <p className="text-sm text-[#5B6B7C]">Create a case before recording quotes or payments.</p>
            ) : (
              <FinancialCenter caseId={currentCase.id} canWrite={writeP} adminName={adminName} />
            )}
          </Section>
        </div>
      )}

      {tab === 'emails' && (
        <Section id="communications" title="Communications">
          {writeM && (
            <button
              type="button"
              className={primary}
              onClick={() => {
                setEmailTemplate(undefined)
                setModal('email')
              }}
            >
              Send Email
            </button>
          )}
          <ul className="mt-3 space-y-2">
            {communications.map((item: any) => (
              <li key={item.id} className="rounded border border-[#D7DEE6] p-3 text-sm">
                <p className="font-medium">{item.subject}</p>
                <p className="text-xs text-[#5B6B7C]">
                  {item.templateType || item.type} · {item.status} · {item.recipient} · {formatDateTime(item.sentAt)}
                  {item.sentBy?.fullName ? ` · Sent by ${item.sentBy.fullName}` : ''}
                </p>
              </li>
            ))}
            {communications.length === 0 && (
              <li className="text-sm text-[#5B6B7C]">No emails sent yet.</li>
            )}
          </ul>
        </Section>
      )}

      {tab === 'notes' && !limited && (
        <Section id="notes" title={lawyerMode ? 'Notes & Attachments' : 'Internal Notes'}>
          {writeN && currentCase && (
            <form className="mb-3 space-y-2" onSubmit={(e) => addNoteWithFiles(e, candidate.id, currentCase.id, lawyerMode, onDone)}>
              <textarea
                name="note"
                required
                rows={3}
                className={input}
                placeholder={lawyerMode ? 'Add a comment for this candidate and attach supporting documents' : 'Internal note'}
              />
              {lawyerMode && (
                <label className="block text-xs font-medium text-[#5B6B7C]">
                  <span className="inline-flex items-center gap-1.5 text-[#0C2340]">
                    <Paperclip className="h-4 w-4 shrink-0" aria-hidden="true" />
                    Attach documents
                  </span>
                  <input
                    type="file"
                    name="attachments"
                    multiple
                    className="mt-1 block w-full cursor-pointer rounded border border-[#D7DEE6] bg-white px-2 py-1.5 text-sm file:mr-3 file:rounded file:border-0 file:bg-[#0C2340] file:px-2.5 file:py-1 file:text-xs file:font-medium file:text-white hover:file:bg-[#17385E]"
                    accept={UPLOAD_ACCEPT}
                  />
                </label>
              )}
              <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="isPinned" /> Pin</label>
              <button className={primary}>{lawyerMode ? 'Add note & attach' : 'Add note'}</button>
            </form>
          )}
          {[...(currentCase?.notes ?? [])].sort((a: any, b: any) => Number(b.isPinned) - Number(a.isPinned)).map((note: any) => (
            <article key={note.id} className="mb-2 rounded border border-[#D7DEE6] p-3 text-sm">
              <p className="text-xs text-[#5B6B7C]">
                {note.isPinned ? '📌 ' : ''}{note.author?.fullName} · {formatDateTime(note.createdAt)}
                {writeN && (
                  <button className="ml-2 underline" onClick={() => pinNote(candidate.id, note.id, !note.isPinned, onDone)}>
                    {note.isPinned ? 'Unpin' : 'Pin'}
                  </button>
                )}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{note.note}</p>
            </article>
          ))}
        </Section>
      )}

      {tab === 'activity' && !limited && (
        <Section id="activity" title="Activity History">
          <ol className="space-y-2">
            {activities.map((item: any) => (
              <li key={item.id} className="rounded border border-[#D7DEE6] px-3 py-2 text-sm">
                <p className="font-medium">
                  {item.type ? item.type.replaceAll('_', ' ') : 'Action'}
                  {item.message ? ` — ${item.message}` : ''}
                </p>
                <p className="mt-0.5 text-xs text-[#5B6B7C]">
                  {formatDateTime(item.createdAt)}
                  {item.actorType ? ` · ${item.actorType}` : ''}
                </p>
              </li>
            ))}
            {activities.length === 0 && (
              <li className="text-sm text-[#5B6B7C]">No activity yet.</li>
            )}
          </ol>
        </Section>
      )}

      {modal === 'email' && (
        <EmailComposer
          candidate={candidate}
          currentCase={currentCase}
          defaultTemplate={emailTemplate}
          missingDocumentLabels={missingItems.map((i) => i.label)}
          onClose={() => {
            setEmailTemplate(undefined)
            setModal(null)
          }}
          onDone={onDone}
        />
      )}
      {modal === 'docs' && currentCase && (
        <DocRequestModal
          caseId={currentCase.id}
          candidate={{
            id: candidate.id,
            fullLegalName: candidate.fullLegalName,
            candidateNumber: candidate.candidateNumber,
            email: candidate.email,
          }}
          visaLabel={formatVisa(currentCase.visaType)}
          onClose={() => setModal(null)}
          onDone={onDone}
        />
      )}
      {modal === 'paid' && paidId && <MarkPaidModal paymentId={paidId} defaultCents={currentCase?.payments?.find((p: any) => p.id === paidId)?.amountCents ?? 0} onClose={() => setModal(null)} onDone={onDone} />}
      {modal === 'note' && currentCase && <AddNoteModal candidateId={candidate.id} caseId={currentCase.id} onClose={() => setModal(null)} onDone={onDone} />}
      {modal === 'edit' && <EditCandidateModal candidate={candidate} currentCase={currentCase} staff={staff} onClose={() => setModal(null)} onDone={onDone} />}
      {modal === 'upload' && currentCase && <UploadModal candidateId={candidate.id} caseId={currentCase.id} checklist={checklist} onClose={() => setModal(null)} onDone={onDone} />}

      {archiveOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-20">
          <div className="w-full max-w-md rounded-lg border border-[#D7DEE6] bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#0C2340]">Archive candidate?</h3>
            <p className="mt-2 text-sm text-[#5B6B7C]">
              This soft-deletes the record. Payments, documents, emails, and activity history are preserved and
              recoverable by Super Admin.
            </p>
            <dl className="mt-4 space-y-1 rounded border border-[#D7DEE6] bg-[#F8FAFB] p-3 text-sm">
              <div>
                <dt className="text-xs uppercase text-[#5B6B7C]">Name</dt>
                <dd className="font-medium">{candidate.fullLegalName}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-[#5B6B7C]">Candidate ID</dt>
                <dd className="font-mono font-semibold">{candidate.candidateNumber}</dd>
              </div>
            </dl>
            <label className="mt-4 block text-xs font-medium text-[#5B6B7C]">
              Type full legal name to confirm
              <input
                value={confirmName}
                onChange={(e) => setConfirmName(e.target.value)}
                className={`${input} mt-1`}
                placeholder={candidate.fullLegalName}
              />
            </label>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                className="rounded bg-red-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                disabled={deleting}
                onClick={() => void archiveCandidate()}
              >
                {deleting ? 'Archiving…' : 'Archive Candidate'}
              </button>
              <button
                type="button"
                className={btn}
                onClick={() => {
                  setArchiveOpen(false)
                  setConfirmName('')
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <details open id={id} className="rounded-lg border border-[#D7DEE6] bg-white">
      <summary className="cursor-pointer px-5 py-3 text-sm font-semibold uppercase tracking-wide text-[#0C2340]">{title}</summary>
      <div className="border-t border-[#D7DEE6] px-5 py-4">{children}</div>
    </details>
  )
}

/** Missing Documents: always starts minimized; opens + scrolls into view on click / hash. */
function MissingDocumentsSection({
  openFromHash,
  openSignal = 0,
  children,
}: {
  openFromHash: boolean
  openSignal?: number
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDetailsElement>(null)

  useEffect(() => {
    if (!openFromHash && openSignal === 0) return
    setOpen(true)
    const t = window.setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
    return () => window.clearTimeout(t)
  }, [openFromHash, openSignal])

  return (
    <details
      ref={ref}
      id="missing-docs"
      open={open}
      className="rounded-lg border border-[#D7DEE6] bg-white"
      onToggle={(e) => {
        const next = e.currentTarget.open
        setOpen(next)
        if (next) {
          e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }}
    >
      <summary className="cursor-pointer list-none px-5 py-3 text-sm font-semibold uppercase tracking-wide text-[#0C2340] [&::-webkit-details-marker]:hidden">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="text-[#5B6B7C]">
            {open ? '▼' : '▶'}
          </span>
          Missing Documents
        </span>
      </summary>
      <div className="border-t border-[#D7DEE6] px-5 py-4">{children}</div>
    </details>
  )
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-[#5B6B7C]">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || '—'}</dd>
    </div>
  )
}

async function patchCaseStatus(caseId: string, status: string, extra?: Record<string, unknown>) {
  const res = await fetch(`/api/admin/cases/${caseId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, ...extra }),
  })
  const json = await res.json().catch(() => ({}))
  return { res, json }
}

function CaseStatusEditor({
  caseId,
  status,
  canWrite,
  onDone,
  compact = false,
}: {
  caseId: string
  status: string
  canWrite: boolean
  onDone: () => void
  compact?: boolean
}) {
  const [value, setValue] = useState(status)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setValue(status)
  }, [status])

  async function save() {
    if (!canWrite || busy || value === status) return
    setBusy(true)
    setMessage('')
    let { res, json } = await patchCaseStatus(caseId, value)
    if (!res.ok && json.error === 'PRE-FILING PAYMENT REQUIREMENT NOT MET') {
      const proceed = confirm(
        `Pre-filing payment requirement not met. Paid ${formatCents(json.paid)} / required ${formatCents(json.required)}. Override as Super Admin?`,
      )
      if (!proceed) {
        setBusy(false)
        setValue(status)
        return
      }
      const reason = prompt('Override reason (required)') ?? ''
      if (!reason.trim()) {
        alert('Override reason is required.')
        setBusy(false)
        setValue(status)
        return
      }
      ;({ res, json } = await patchCaseStatus(caseId, value, { override: true, overrideReason: reason.trim() }))
    }
    setBusy(false)
    if (!res.ok) {
      alert(json.error ?? 'Unable to update case status')
      setValue(status)
      return
    }
    setMessage('Status updated')
    onDone()
    window.setTimeout(() => setMessage(''), 2000)
  }

  if (!canWrite) {
    return <StatusBadge status={CASE_STATUS_LABELS[status] ?? status} />
  }

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <select
          value={value}
          disabled={busy}
          onChange={(e) => setValue(e.target.value)}
          className="max-w-[12rem] rounded border border-[#D7DEE6] bg-white px-2 py-1 text-xs font-medium text-[#0C2340]"
          aria-label="Case status"
        >
          {Object.keys(CASE_STATUS_LABELS).map((s) => (
            <option key={s} value={s}>
              {CASE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <button type="button" className={btn} disabled={busy || value === status} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Update'}
        </button>
        {message && <span className="text-[11px] text-emerald-700">{message}</span>}
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-[#94A3B8]">Case status</p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[14rem] flex-1 text-xs font-medium text-[#5B6B7C]">
          Status
          <select
            value={value}
            disabled={busy}
            onChange={(e) => setValue(e.target.value)}
            className={`${input} mt-1`}
            aria-label="Case status"
          >
            {Object.keys(CASE_STATUS_LABELS).map((s) => (
              <option key={s} value={s}>
                {CASE_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className={primary} disabled={busy || value === status} onClick={() => void save()}>
          {busy ? 'Saving…' : 'Update status'}
        </button>
      </div>
      {message && <p className="text-xs text-emerald-700">{message}</p>}
      <p className="text-[11px] text-[#5B6B7C]">Changes are logged in case history and activity.</p>
    </div>
  )
}

function Shell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-16">
      <div className="w-full max-w-lg rounded-lg border border-[#D7DEE6] bg-white p-5 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold text-[#0C2340]">{title}</h3>
          <button type="button" className="text-sm text-[#5B6B7C]" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function EmailComposer({
  candidate,
  currentCase,
  defaultTemplate,
  missingDocumentLabels,
  onClose,
  onDone,
}: {
  candidate: any
  currentCase: any
  defaultTemplate?: EmailTemplateKey
  missingDocumentLabels?: string[]
  onClose: () => void
  onDone?: () => void
}) {
  const next = (currentCase?.payments ?? []).find((p: any) => p.status !== 'PAID')
  const vars = buildMergeVars({
    fullLegalName: candidate.fullLegalName,
    candidateNumber: candidate.candidateNumber,
    email: candidate.email,
    visaLabel: currentCase ? formatVisa(currentCase.visaType) : '',
    caseNumber: currentCase?.caseNumber ?? '',
    quotedCents: currentCase?.quotedAmountCents ?? 0,
    paymentCents: next?.amountCents,
    paymentNumber: next?.installmentNumber,
    currency: currentCase?.currency,
    paymentLink: next?.paymentUrl,
  })
  const first = templateByKey(defaultTemplate ?? 'CUSTOM')
  const initialBody = (() => {
    let body = mergeTemplate(first.body, vars)
    if (first.key === 'MISSING_DOCUMENT_REMINDER' && missingDocumentLabels?.length) {
      body = body.replace(
        'Please upload the outstanding items using your secure',
        `Outstanding items:\n${missingDocumentLabels.map((l) => `- ${l}`).join('\n')}\n\nPlease upload the outstanding items using your secure`,
      )
    }
    return body
  })()
  const [key, setKey] = useState<EmailTemplateKey>(first.key)
  const [to, setTo] = useState(candidate.email ?? '')
  const [subject, setSubject] = useState(mergeTemplate(first.subject, vars))
  const [text, setText] = useState(initialBody)
  const [personalNote, setPersonalNote] = useState('')
  const [mode, setMode] = useState<'edit' | 'preview'>('preview')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [lastFailed, setLastFailed] = useState(false)

  const rendered = useMemo(
    () =>
      renderCatalogEmail({
        templateKey: key,
        fullLegalName: candidate.fullLegalName,
        candidateNumber: candidate.candidateNumber,
        email: to,
        visaType: currentCase?.visaType,
        caseNumber: currentCase?.caseNumber,
        quotedCents: currentCase?.quotedAmountCents,
        paymentCents: next?.amountCents,
        paymentNumber: next?.installmentNumber,
        currency: currentCase?.currency,
        paymentLink: next?.paymentUrl,
        personalNote: personalNote || null,
        missingDocumentLabels,
        subjectOverride: subject,
        textOverride: text,
      }),
    [
      key,
      candidate.fullLegalName,
      candidate.candidateNumber,
      to,
      currentCase?.visaType,
      currentCase?.caseNumber,
      currentCase?.quotedAmountCents,
      currentCase?.currency,
      next?.amountCents,
      next?.installmentNumber,
      next?.paymentUrl,
      personalNote,
      missingDocumentLabels,
      subject,
      text,
    ],
  )

  function apply(nextKey: EmailTemplateKey) {
    const t = templateByKey(nextKey)
    setKey(nextKey)
    setSubject(mergeTemplate(t.subject, vars))
    let body = mergeTemplate(t.body, vars)
    if (nextKey === 'MISSING_DOCUMENT_REMINDER' && missingDocumentLabels?.length) {
      body = body.replace(
        'Please upload the outstanding items using your secure',
        `Outstanding items:\n${missingDocumentLabels.map((l) => `- ${l}`).join('\n')}\n\nPlease upload the outstanding items using your secure`,
      )
    }
    setText(body)
    setLastFailed(false)
  }

  async function openInGmail() {
    if (busy) return
    if (!to.trim()) {
      setError('Candidate email is missing. Please add an email address before opening Gmail.')
      return
    }
    if (hasUnresolvedMergeTokens(subject) || hasUnresolvedMergeTokens(text)) {
      setError('Cannot open Gmail — unresolved template variables remain. Please edit the subject/message.')
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch('/api/admin/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'gmail',
          templateType: key,
          subject,
          text,
          to,
          candidateId: candidate.id,
          caseId: currentCase?.id,
          personalNote: personalNote || undefined,
          missingDocumentLabels,
          paymentLink: next?.paymentUrl,
          documentLink: vars.documentLink,
          paymentCents: next?.amountCents,
          paymentNumber: next?.installmentNumber,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Unable to prepare Gmail compose.')
        setBusy(false)
        return
      }
      const url = json.gmailUrl as string | undefined
      if (!url) {
        setError('Gmail compose URL was not generated.')
        setBusy(false)
        return
      }
      window.open(url, '_blank', 'noopener,noreferrer')
      setSuccess('Gmail opened with the full template. Review, edit any line, then send from Gmail.')
      onDone?.()
      setBusy(false)
    } catch {
      setError('Unable to open Gmail. Please retry.')
      setBusy(false)
    }
  }

  async function sendViaLAWFIRM(e?: FormEvent) {
    e?.preventDefault()
    if (busy) return
    if (hasUnresolvedMergeTokens(subject) || hasUnresolvedMergeTokens(text)) {
      setError('Cannot send — unresolved template variables remain. Please edit the subject/message.')
      return
    }
    if (!to.trim() || !subject.trim() || !text.trim()) {
      setError('Recipient, subject, and message are required.')
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    setLastFailed(false)
    try {
      const res = await fetch('/api/admin/communications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateType: key,
          subject,
          text,
          to,
          candidateId: candidate.id,
          caseId: currentCase?.id,
          personalNote: personalNote || undefined,
          missingDocumentLabels,
          paymentLink: next?.paymentUrl,
          paymentCents: next?.amountCents,
          paymentNumber: next?.installmentNumber,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error ?? 'Email could not be sent.')
        setLastFailed(true)
        setBusy(false)
        return
      }
      setSuccess(
        json.communication?.status === 'LOGGED'
          ? 'Email logged (delivery provider not configured).'
          : 'Email sent successfully via LAWFIRM.',
      )
      onDone?.()
      setTimeout(() => onClose(), 700)
    } catch {
      setError('Email could not be sent. Network error — please retry.')
      setLastFailed(true)
      setBusy(false)
    }
  }

  return (
    <Shell title="Send Email" onClose={onClose}>
      <div className="mb-3 rounded border border-[#EEF1F4] bg-[#F8FAFB] px-3 py-2 text-xs text-[#5B6B7C]">
        <strong className="text-[#0C2340]">{candidate.fullLegalName}</strong>
        {' · '}
        {candidate.candidateNumber ?? '—'}
        {currentCase?.visaType ? ` · ${formatVisa(currentCase.visaType)}` : ''}
        <div className="mt-0.5 truncate">{candidate.email}</div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void openInGmail()
        }}
        className="space-y-2"
      >
        <label className="block text-xs font-medium text-[#5B6B7C]">
          Template
          <select value={key} onChange={(e) => apply(e.target.value as EmailTemplateKey)} className={`${input} mt-1`} disabled={busy}>
            {EMAIL_TEMPLATES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-[#5B6B7C]">
          Recipient
          <input value={to} onChange={(e) => setTo(e.target.value)} type="email" required className={`${input} mt-1`} disabled={busy} />
        </label>
        <label className="block text-xs font-medium text-[#5B6B7C]">
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required className={`${input} mt-1`} disabled={busy} />
        </label>
        {mode === 'preview' ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#5B6B7C]">Email Preview</p>
            <iframe
              title="Email preview"
              srcDoc={rendered.html}
              className="h-[min(52vh,420px)] w-full max-w-[680px] rounded border border-[#D7DEE6] bg-white"
            />
            <details className="rounded border border-[#EEF1F4] bg-white p-2 text-xs text-[#5B6B7C]">
              <summary className="cursor-pointer font-medium text-[#0C2340]">Gmail plain-text body</summary>
              <pre className="mt-2 whitespace-pre-wrap font-sans text-[12px] leading-5 text-[#0C2340]">{rendered.plainTextForGmail}</pre>
            </details>
          </div>
        ) : (
          <label className="block text-xs font-medium text-[#5B6B7C]">
            Message
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={10} required className={`${input} mt-1`} disabled={busy} />
          </label>
        )}
        <label className="block text-xs font-medium text-[#5B6B7C]">
          Optional personal note
          <textarea
            value={personalNote}
            onChange={(e) => setPersonalNote(e.target.value)}
            rows={2}
            className={`${input} mt-1`}
            disabled={busy}
            placeholder="Added below the main message"
          />
        </label>
        {error && <p className="text-sm text-red-700">{error}</p>}
        {success && <p className="text-sm text-emerald-700">{success}</p>}
        <EmailCopyActions
          to={to}
          subject={subject}
          body={rendered.plainTextForGmail || text}
          htmlBody={rendered.html}
          candidateId={candidate.id}
          caseId={currentCase?.id}
          templateType={key}
          showMarkSent
          onCopied={() =>
            setSuccess('Email copied. Paste into Gmail, then optionally mark as sent after you send it.')
          }
          onMarkedSent={() => {
            setSuccess('Marked as sent.')
            onDone?.()
          }}
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} disabled={busy} onClick={() => setMode((m) => (m === 'preview' ? 'edit' : 'preview'))}>
            {mode === 'preview' ? 'Edit' : 'Preview'}
          </button>
          <button type="submit" className={btn} disabled={busy}>
            {busy ? 'Opening…' : 'Open Gmail'}
          </button>
          <button type="button" className={btn} disabled={busy} onClick={() => void sendViaLAWFIRM()}>
            {lastFailed ? 'Retry LAWFIRM Send' : 'Send via LAWFIRM'}
          </button>
          <button type="button" className={btn} disabled={busy} onClick={onClose}>
            Cancel
          </button>
        </div>
        <p className="text-[11px] text-[#5B6B7C]">
          Preferred: Preview → edit any line → Copy Email → paste into Gmail and send. Copy / Open Gmail are logged as prepared, not Sent.
        </p>
      </form>
    </Shell>
  )
}

function MarkPaidModal({ paymentId, defaultCents, onClose, onDone }: { paymentId: string; defaultCents: number; onClose: () => void; onDone: () => void }) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const res = await fetch(`/api/admin/payments/${paymentId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'mark-paid',
        paidAmountCents: Math.round(Number(form.get('amount')) * 100),
        paidAt: form.get('paidAt'),
        paymentMethodType: form.get('paymentMethodType'),
        referenceId: form.get('referenceId'),
        adminNote: form.get('adminNote'),
      }),
    })
    const json = await res.json()
    if (!res.ok) alert(json.error ?? 'Unable to mark paid')
    else { onDone(); onClose() }
  }
  return (
    <Shell title="Mark Paid" onClose={onClose}>
      <form onSubmit={submit} className="space-y-2">
        <input name="amount" type="number" step="0.01" defaultValue={(defaultCents / 100).toFixed(2)} className={input} required />
        <input name="paidAt" type="datetime-local" className={input} />
        <select name="paymentMethodType" className={input} required>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
        <input name="referenceId" placeholder="Reference ID" className={input} />
        <input name="adminNote" placeholder="Admin note" className={input} />
        <button className={primary}>Confirm paid</button>
      </form>
    </Shell>
  )
}

export function AddNoteModal({ candidateId, caseId, onClose, onDone }: { candidateId: string; caseId: string; onClose: () => void; onDone?: () => void }) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const res = await fetch(`/api/admin/candidates/${candidateId}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseId, note: form.get('note'), isPinned: form.get('isPinned') === 'on', visibility: 'INTERNAL' }),
    })
    if (!res.ok) alert((await res.json()).error ?? 'Unable to add note')
    else { onDone?.(); onClose() }
  }
  return (
    <Shell title="Add Note" onClose={onClose}>
      <form onSubmit={submit} className="space-y-2">
        <textarea name="note" required rows={4} className={input} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isPinned" /> Pin</label>
        <button className={primary}>Save note</button>
      </form>
    </Shell>
  )
}

export function EditCandidateModal({ candidate, currentCase, staff, onClose, onDone }: { candidate: any; currentCase: any; staff: { id: string; fullName: string; role: string }[]; onClose: () => void; onDone?: () => void }) {
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>
    const cRes = await fetch(`/api/admin/candidates/${candidate.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!cRes.ok) { alert((await cRes.json()).error ?? 'Unable to update candidate'); return }
    if (form.email && form.email !== candidate.email) {
      await fetch(`/api/admin/candidates/${candidate.id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, reason: 'Admin profile edit', confirm: true }),
      })
    }
    if (currentCase) {
      await fetch(`/api/admin/cases/${currentCase.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignedAttorneyId: form.assignedAttorneyId || null,
          referredByAdminId: form.referredByAdminId || null,
          referredByName: form.referredByName,
          status: form.caseStatus || undefined,
        }),
      })
    }
    onDone?.(); onClose()
  }
  return (
    <Shell title="Edit Candidate" onClose={onClose}>
      <form onSubmit={submit} className="grid gap-2">
        <input name="fullLegalName" defaultValue={candidate.fullLegalName} className={input} />
        <input name="email" type="email" defaultValue={candidate.email} className={input} />
        <input name="phone" defaultValue={candidate.phone ?? ''} className={input} />
        <input name="currentImmigrationStatus" defaultValue={candidate.currentImmigrationStatus ?? ''} placeholder="Immigration" className={input} />
        <input name="currentAddress" defaultValue={candidate.currentAddress ?? ''} placeholder="Address" className={input} />
        {currentCase && (
          <>
            <select name="caseStatus" defaultValue={currentCase.status} className={input}>
              {Object.keys(CASE_STATUS_LABELS).map((s) => <option key={s} value={s}>{CASE_STATUS_LABELS[s]}</option>)}
            </select>
            <select name="assignedAttorneyId" defaultValue={currentCase.assignedAttorneyId ?? ''} className={input}>
              <option value="">Unassigned</option>
              {lawyerOptions(staff).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
            <select name="referredByAdminId" defaultValue={currentCase.referredByAdminId ?? ''} className={input}>
              <option value="">Referred by</option>
              {referralOptions(staff).map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
            <input name="referredByName" defaultValue={currentCase.referredByName ?? ''} placeholder="Other referral name (optional)" className={input} />
          </>
        )}
        <button className={primary}>Save</button>
      </form>
    </Shell>
  )
}

function UploadModal({
  candidateId,
  caseId,
  checklist,
  onClose,
  onDone,
}: {
  candidateId: string
  caseId: string
  checklist: Checklist
  onClose: () => void
  onDone: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formEl = e.currentTarget
    const key = String(new FormData(formEl).get('questionKey'))
    const selected = file || (formEl.elements.namedItem('file') as HTMLInputElement).files?.[0]
    if (!selected) {
      setError('Choose a file to upload.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await uploadDoc(candidateId, caseId, key, selected)
      onDone()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell title="Add Document" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <select name="questionKey" className={input} disabled={busy}>
          {/* Same visa document slots as Documents / Request Documents. */}
          {checklist.folders
            .filter((folder) => folder.items.some((item) => item.requirement || item.questionKey === OTHER_SUPPORTING_DOCUMENT_KEY))
            .map((folder) => (
              <optgroup key={folder.id} label={folder.title}>
                {folder.items
                  .filter((item) => item.requirement || item.questionKey === OTHER_SUPPORTING_DOCUMENT_KEY)
                  .map((item) => (
                    <option key={item.questionKey} value={item.questionKey}>
                      {item.label}
                    </option>
                  ))}
              </optgroup>
            ))}
        </select>
        <label
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
            dragOver ? 'border-[#0F766E] bg-[#F0FDFA]' : 'border-[#D7DEE6] bg-[#F8FAFC]'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const dropped = e.dataTransfer.files?.[0]
            if (dropped) setFile(dropped)
          }}
        >
          <span className="text-sm font-medium text-[#0C2340]">Drag & drop files here</span>
          <span className="mt-1 text-xs text-[#64748B]">or browse {UPLOAD_TYPE_HINT}</span>
          <input
            name="file"
            type="file"
            accept={UPLOAD_ACCEPT}
            className="sr-only"
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file && (
          <div className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm">
            <p className="font-medium text-[#0C2340]">{file.name}</p>
            <p className="text-xs text-[#64748B]">
              {file.type || 'file'} · {(file.size / 1024).toFixed(1)} KB
            </p>
            <button type="button" className="mt-1 text-xs text-red-700 hover:underline" onClick={() => setFile(null)} disabled={busy}>
              Remove selection
            </button>
          </div>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button className={primary} disabled={busy}>
          {busy ? 'Uploading…' : 'Upload'}
        </button>
      </form>
    </Shell>
  )
}


function OnboardingBlock({
  currentCase,
  checklist,
  canReview,
  lawyerMode,
  onDone,
}: {
  currentCase: any
  checklist: Checklist
  canReview: boolean
  lawyerMode?: boolean
  onDone: () => void
}) {
  const [inviteUrl, setInviteUrl] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [preview, setPreview] = useState<{ id: string; filename: string; mimeType?: string | null } | null>(null)

  const overview = useMemo(() => {
    if (!currentCase) {
      return buildOnboardingOverview({})
    }
    const submission = currentCase.onboardingSubmissions?.[0]
    const answers = (submission?.answers ?? {}) as Record<string, any>
    const reviews: Record<string, { status?: string; note?: string }> = {}
    for (const [key, raw] of Object.entries(answers)) {
      if (raw && typeof raw === 'object' && (raw as any).reviewStatus) {
        reviews[key] = {
          status: (raw as any).reviewStatus,
          note: (raw as any).adminNote,
        }
      }
    }
    return buildOnboardingOverview({
      answers,
      documents: currentCase.documents ?? [],
      customDefs: [
        ...defsFromRequestItems(
          (currentCase.documentRequests ?? []).flatMap(
            (request: { items?: Array<{ documentKey?: string; key?: string; documentName?: string; label?: string; category?: string | null }> }) =>
              request.items ?? [],
          ),
        ),
        ...(currentCase.customDocumentDefs ?? []),
      ],
      submissionStatus: submission?.status ?? null,
      caseStatus: currentCase.status ?? null,
      hasInvite: Boolean(currentCase.onboardingInvites?.length),
      reviews,
      checklist,
    })
  }, [currentCase, checklist])

  if (!currentCase) return <p className="text-sm text-[#5B6B7C]">Create a case first.</p>

  const submission = currentCase.onboardingSubmissions?.[0]

  async function invite(resend = false) {
    setInviteBusy(true)
    setInviteError('')
    try {
      const res = await fetch(`/api/admin/cases/${currentCase.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'invite', sendEmail: true }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not create invite.')
      if (json.url) setInviteUrl(json.url)
      onDone()
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Could not create invite.')
    } finally {
      setInviteBusy(false)
    }
    void resend
  }

  async function downloadDoc(id: string) {
    try {
      const { downloadAdminDocument } = await import('@/lib/admin-downloads')
      await downloadAdminDocument(id)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Download failed')
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={overview.status} />
        {!lawyerMode && overview.showSendInvite && (
          <button type="button" className={primary} disabled={inviteBusy} onClick={() => void invite(false)}>
            {inviteBusy ? 'Sending…' : 'Send onboarding invite'}
          </button>
        )}
        {!lawyerMode && overview.showResendInvite && (
          <button type="button" className={btn} disabled={inviteBusy} onClick={() => void invite(true)}>
            {inviteBusy ? 'Sending…' : submission ? 'Resend onboarding invite' : 'Send onboarding invite'}
          </button>
        )}
        {inviteUrl && (
          <button type="button" className={btn} onClick={() => navigator.clipboard.writeText(inviteUrl)}>
            Copy invite URL
          </button>
        )}
        {submission?.lastSavedAt && (
          <span className="text-xs text-[#64748B]">Last saved {formatDateTime(submission.lastSavedAt)}</span>
        )}
        {submission?.submittedAt && (
          <span className="text-xs text-[#64748B]">Submitted {formatDateTime(submission.submittedAt)}</span>
        )}
      </div>
      {overview.statusHint ? <p className="text-xs text-[#5B6B7C]">{overview.statusHint}</p> : null}
      {inviteError ? <p className="text-sm text-red-700">{inviteError}</p> : null}

      {overview.sections.map((cat) => {
        const hasContent = cat.answeredCount > 0
        return (
          <details key={cat.id} className="rounded border border-[#EEF1F4]" open={hasContent ? true : undefined}>
            <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
              {cat.folderTitle}
              <span className="ml-2 text-xs font-normal text-[#64748B]">
                {cat.answeredCount}/{cat.totalCount} provided
              </span>
            </summary>
            <div className="space-y-2 px-3 pb-3">
              {cat.fields.map((q) => {
                if (!q.hasValue && q.type === 'file') {
                  // Compact empty file rows — one line, no large blank blocks.
                  return (
                    <div key={q.key} className="border-t border-[#EEF1F4] pt-2 text-sm">
                      <p className="font-medium text-[#0C2340]">{q.label}</p>
                      <p className="text-[#94A3B8]">Not provided</p>
                    </div>
                  )
                }
                return (
                  <div key={q.key} className="border-t border-[#EEF1F4] pt-2 text-sm">
                    <p className="font-medium text-[#0C2340]">{q.label}</p>
                    {q.text ? (
                      q.type === 'url' ? (
                        <a
                          href={q.text.startsWith('http') ? q.text : `https://${q.text}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="break-all text-[#0F766E] underline-offset-2 hover:underline"
                        >
                          {q.text}
                        </a>
                      ) : (
                        <p className="whitespace-pre-wrap text-[#5B6B7C]">{q.text}</p>
                      )
                    ) : q.type !== 'file' ? (
                      <p className="text-[#94A3B8]">Not provided</p>
                    ) : null}

                    {q.files.length > 0 && (
                      <ul className="mt-1.5 space-y-1">
                        {q.files.map((file) => (
                          <li
                            key={file.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded border border-[#EEF1F4] bg-[#F8FAFC] px-2 py-1.5"
                          >
                            <div className="min-w-0">
                              {file.isLink && file.urls?.[0] ? (
                                <a
                                  href={file.urls[0]}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="break-all text-[#0F766E] underline-offset-2 hover:underline"
                                >
                                  {formatUrlForDisplay(file.urls[0])}
                                </a>
                              ) : (
                                <DocumentFileName
                                  displayName={file.displayName}
                                  originalFilename={file.uploadedFilename || file.originalFilename}
                                />
                              )}
                              <p className="text-[11px] text-[#64748B]">
                                {String(file.status).replaceAll('_', ' ')}
                                {file.uploadedAt ? ` · ${formatDateTime(file.uploadedAt)}` : ''}
                              </p>
                            </div>
                            {!file.isLink && (
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className={btn}
                                  onClick={() =>
                                    setPreview({
                                      id: file.id,
                                      filename: file.originalFilename,
                                      mimeType: file.mimeType,
                                    })
                                  }
                                >
                                  Preview
                                </button>
                                {!lawyerMode && (
                                  <button type="button" className={btn} onClick={() => void downloadDoc(file.id)}>
                                    Download
                                  </button>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}

                    {canReview && submission && q.type !== 'file' && (
                      <div className="mt-1 flex gap-1">
                        <button
                          type="button"
                          className={btn}
                          onClick={() => reviewQ(submission.id, q.key, 'ACCEPTED').then(onDone)}
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          className={btn}
                          onClick={() => {
                            const note = prompt('Needed?') ?? ''
                            void reviewQ(submission.id, q.key, 'NEEDS_MORE_INFORMATION', note).then(onDone)
                          }}
                        >
                          Needs info
                        </button>
                        {q.reviewStatus ? (
                          <StatusBadge status={q.reviewStatus} />
                        ) : null}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </details>
        )
      })}

      {preview && (
        <DocumentPreviewModal
          documentId={preview.id}
          filename={preview.filename}
          mimeType={preview.mimeType}
          downloadRestricted={lawyerMode}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}

function ProgressBlock({ currentCase, counts, canWrite, onDone }: any) {
  const overviewStatus = buildOnboardingOverview({
    answers: currentCase?.onboardingSubmissions?.[0]?.answers ?? {},
    documents: currentCase?.documents ?? [],
    submissionStatus: currentCase?.onboardingSubmissions?.[0]?.status ?? null,
    caseStatus: currentCase?.status ?? null,
    hasInvite: Boolean(currentCase?.onboardingInvites?.length),
  }).status
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = Object.fromEntries(new FormData(e.currentTarget).entries())
    const res = await fetch(`/api/admin/cases/${currentCase.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const json = await res.json()
    if (!res.ok && json.error === 'PRE-FILING PAYMENT REQUIREMENT NOT MET') {
      if (!confirm(`PRE-FILING NOT MET. Paid ${formatCents(json.paid)} / required ${formatCents(json.required)}. Override?`)) return
      const reason = prompt('Override reason') ?? ''
      const retry = await fetch(`/api/admin/cases/${currentCase.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, override: true, overrideReason: reason }) })
      if (!retry.ok) alert((await retry.json()).error)
    } else if (!res.ok) alert(json.error)
    onDone()
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canWrite && (
        <form onSubmit={save} className="space-y-2">
          <select name="status" defaultValue={currentCase.status} className={input}>
            {Object.keys(CASE_STATUS_LABELS).map((s) => <option key={s} value={s}>{CASE_STATUS_LABELS[s]}</option>)}
          </select>
          <select name="caseHealth" defaultValue={currentCase.caseHealth ?? 'ON_TRACK'} className={input}>
            {HEALTH.map((h) => <option key={h} value={h}>{h.replaceAll('_', ' ')}</option>)}
          </select>
          <button className={primary}>Update progress</button>
        </form>
      )}
      <div className="text-sm">
        <p>Health: <StatusBadge status={currentCase.caseHealth} /></p>
        <p className="mt-2">
          Docs: {counts.accepted} accepted · {counts.missing} missing · {counts.required} required · {counts.files} files
        </p>
        <p className="mt-1 text-[#5B6B7C]">
          Onboarding: <StatusBadge status={overviewStatus} />
        </p>
        <ul className="mt-3 space-y-1 text-xs text-[#5B6B7C]">
          {(currentCase.statusHistory ?? []).slice(0, 8).map((item: any) => (
            <li key={item.id}>{formatDateTime(item.createdAt)} — {item.fromStatus ?? '—'} → {item.toStatus}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function PaymentPlanEditor({ currentCase, onDone }: { currentCase: any; onDone: () => void }) {
  const payments = currentCase.payments ?? []
  const quoted = currentCase.quotedAmountCents ?? 0
  const existing = Object.fromEntries(payments.map((p: any) => [p.installmentNumber, p.amountCents / 100]))
  const [total, setTotal] = useState(String((quoted || 0) / 100 || ''))
  const [p1, setP1] = useState(String(existing[1] ?? ''))
  const [p2, setP2] = useState(String(existing[2] ?? ''))
  const [p3, setP3] = useState(String(existing[3] ?? ''))
  const totalCents = Math.round(Number(total || 0) * 100)
  const p1c = Math.round(Number(p1 || 0) * 100)
  const p2c = Math.round(Number(p2 || 0) * 100)
  const p3c = Math.round(Number(p3 || 0) * 100)
  const live = validatePreFilingAllocation(totalCents, p1c, p2c, p3c)
  async function configure(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const res = await fetch(`/api/admin/cases/${currentCase.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'configure-payments', totalCents, payment1Cents: p1c, payment2Cents: p2c, payment3Cents: p3c, payment4Cents: live.payment4Cents, currency: currentCase.currency || 'usd' }),
    })
    const json = await res.json()
    if (!res.ok) alert(json.error)
    onDone()
  }
  return (
    <form onSubmit={configure} className="mt-4 space-y-2 border-t border-[#D7DEE6] pt-4">
      <h3 className="text-sm font-semibold">Payment plan editor</h3>
      <div className="grid gap-2 sm:grid-cols-4">
        <label className="text-xs">Total<input value={total} onChange={(e) => setTotal(e.target.value)} type="number" step="0.01" className={`${input} mt-1`} required /></label>
        <label className="text-xs">P1<input value={p1} onChange={(e) => setP1(e.target.value)} type="number" step="0.01" className={`${input} mt-1`} required /></label>
        <label className="text-xs">P2<input value={p2} onChange={(e) => setP2(e.target.value)} type="number" step="0.01" className={`${input} mt-1`} required /></label>
        <label className="text-xs">P3<input value={p3} onChange={(e) => setP3(e.target.value)} type="number" step="0.01" className={`${input} mt-1`} required /></label>
      </div>
      <p className="text-sm">P4 auto 25%: <strong>{formatCents(Math.max(0, live.payment4Cents))}</strong> · 1–3 {formatCents(live.allocated)} / {formatCents(live.preFilingCents)} {live.valid ? <span className="text-emerald-700">✓</span> : <span className="text-amber-700">⚠ {live.shortfallCents > 0 ? `${formatCents(live.shortfallCents)} short` : 'adjust 75/25'}</span>}</p>
      <p className="text-xs text-[#5B6B7C]">75% {formatCents(expectedSplit(totalCents).preFilingCents)} · 25% {formatCents(expectedSplit(totalCents).postApprovalCents)}</p>
      <button disabled={!live.valid} className={`${primary} disabled:opacity-40`}>Save payment schedule</button>
    </form>
  )
}

async function saveCandidate(e: FormEvent<HTMLFormElement>, id: string, currentEmail: string, onDone: () => void) {
  e.preventDefault()
  const form = Object.fromEntries(new FormData(e.currentTarget).entries()) as Record<string, string>
  await fetch(`/api/admin/candidates/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
  if (form.email && form.email !== currentEmail) {
    await fetch(`/api/admin/candidates/${id}/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, reason: 'Profile summary edit', confirm: true }),
    })
  }
  onDone()
}

async function saveCase(e: FormEvent<HTMLFormElement>, id: string, onDone: () => void) {
  e.preventDefault()
  const form = Object.fromEntries(new FormData(e.currentTarget).entries())
  await fetch(`/api/admin/cases/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
  onDone()
}

async function addNote(e: FormEvent<HTMLFormElement>, candidateId: string, caseId: string, onDone: () => void) {
  e.preventDefault()
  const form = e.currentTarget
  const data = new FormData(form)
  await fetch(`/api/admin/candidates/${candidateId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, note: data.get('note'), isPinned: data.get('isPinned') === 'on' }),
  })
  form.reset()
  onDone()
}

async function addNoteWithFiles(
  e: FormEvent<HTMLFormElement>,
  candidateId: string,
  caseId: string,
  lawyerMode: boolean,
  onDone: () => void,
) {
  e.preventDefault()
  const form = e.currentTarget
  const data = new FormData(form)
  const noteText = String(data.get('note') ?? '').trim()
  const files = Array.from(data.getAll('attachments')).filter((item): item is File => item instanceof File && item.size > 0)

  if (!noteText) {
    alert('Please enter a note before saving.')
    return
  }

  const res = await fetch(`/api/admin/candidates/${candidateId}/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseId, note: noteText, isPinned: data.get('isPinned') === 'on' }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    alert(json.error ?? 'Unable to add note')
    return
  }

  if (lawyerMode && files.length > 0) {
    const noteSummary = noteText.length > 80 ? `${noteText.slice(0, 77)}...` : noteText
    for (const file of files) {
      const description = `Lawyer note attachment: ${noteSummary}`
      try {
        await uploadFileToApi({
          endpoint: '/api/admin/documents',
          file,
          fields: {
            candidateId,
            caseId,
            questionKey: 'additional_evidence',
            append: '1',
            description,
          },
        })
      } catch (err) {
        alert(err instanceof Error ? err.message : `Unable to attach ${file.name}`)
        return
      }
    }
  }

  form.reset()
  onDone()
}

async function pinNote(candidateId: string, noteId: string, isPinned: boolean, onDone: () => void) {
  await fetch(`/api/admin/candidates/${candidateId}/notes`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noteId, isPinned }) })
  onDone()
}

async function payAction(id: string, sendEmail: boolean, onDone: () => void) {
  const res = await fetch(`/api/admin/payments/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(sendEmail ? { action: 'send-email' } : {}) })
  const json = await res.json()
  if (json.url) { await navigator.clipboard.writeText(json.clientUrl || json.url); alert(sendEmail ? 'Email sent. Link copied.' : 'Payment link copied.') }
  else alert(json.error ?? 'Unable to create checkout')
  onDone()
}

async function openDoc(id: string, download = false) {
  try {
    if (download) {
      const { downloadAdminDocument } = await import('@/lib/admin-downloads')
      await downloadAdminDocument(id)
      return
    }
    const { previewAdminDocument } = await import('@/lib/admin-downloads')
    await previewAdminDocument(id)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Unable to open document')
  }
}

async function reviewDoc(id: string, status: string, onDone: () => void) {
  const adminNote = status === 'NEEDS_REPLACEMENT' ? prompt('Revision note for the team / candidate') || '' : ''
  const res = await fetch(`/api/admin/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, adminNote }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) alert(json.error ?? 'Unable to update document')
  else onDone()
}

async function uploadDoc(candidateId: string, caseId: string, questionKey: string, file: File) {
  const mapped = questionByKey(questionKey)
  const description = window.prompt(`Description for ${file.name} (required — what is this document?)`)
  if (!description?.trim()) throw new Error(`Description is required for ${file.name}.`)
  return uploadFileToApi({
    endpoint: '/api/admin/documents',
    file,
    fields: {
      candidateId,
      caseId,
      questionKey,
      category: mapped?.category.id ?? '',
      documentType: mapped?.question.documentType ?? questionKey,
      append: '1',
      description: description.trim(),
    },
  })
}

async function reviewQ(submissionId: string, questionKey: string, reviewStatus: string, adminNote?: string) {
  await fetch(`/api/admin/onboarding/${submissionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ questionKey, reviewStatus, adminNote }) })
}
