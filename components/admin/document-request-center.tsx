'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatVisa } from '@/lib/visa'
import { EmailCopyActions } from '@/components/admin/email-copy-actions'
import { uploadFileToApi } from '@/lib/client-upload'
import { ChevronDown, Upload } from 'lucide-react'
import { UPLOAD_ACCEPT, UPLOAD_TYPE_HINT, validateCandidateUploadFile } from '@/lib/upload-validation'
import type { DocumentCounts } from '@/lib/document-counts'
import { DocumentCountsBar } from '@/components/admin/document-counts-bar'
import {
  isLinkRequestKey,
  looksLikeLinkRequest,
  PROFILE_LINK_CATEGORY,
  PROFILE_LINK_OPTIONS,
  slugLinkKey,
  type LinkInputKind,
} from '@/lib/link-request-items'

/** File upload or URL field — chosen per item; names like LinkedIn / portfolio default to URL. */
function KindPicker({
  value,
  onChange,
}: {
  value: 'file' | 'url'
  onChange: (next: 'file' | 'url') => void
}) {
  return (
    <div className="flex flex-wrap gap-3 text-xs" role="radiogroup" aria-label="Request type">
      <label className="flex items-center gap-1.5">
        <input type="radio" checked={value === 'file'} onChange={() => onChange('file')} />
        Document file (PDF, DOC, DOCX, JPG)
      </label>
      <label className="flex items-center gap-1.5">
        <input type="radio" checked={value === 'url'} onChange={() => onChange('url')} />
        Link (URL)
      </label>
    </div>
  )
}

function KindBadge({ link }: { link: boolean }) {
  return (
    <span
      className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
        link ? 'bg-[#CCFBF1] text-[#0F766E]' : 'bg-[#F1F5F9] text-[#475569]'
      }`}
    >
      {link ? 'URL' : 'File'}
    </span>
  )
}

type TemplateItem = {
  id: string
  category: string
  documentKey: string
  documentName: string
  instructions: string | null
  defaultRequired: boolean
  allowsMultipleFiles: boolean
  sortOrder: number
}

type CustomDocumentOption = { key: string; label: string; category: string }

type RequestItem = {
  key: string
  label: string
  category: string
  instructions?: string | null
  required?: boolean
  allowsMultipleFiles?: boolean
  templateItemId?: string | null
  source?: 'template' | 'custom' | 'link'
  inputKind?: 'file' | LinkInputKind
}

type RecentRequest = {
  id: string
  requestNumber: string
  requestType: string
  status: string
  secureUrl: string | null
  sentAt: string
  sentBy?: { fullName: string } | null
  items: Array<{ id: string; documentKey?: string; documentName: string; status: string; category: string }>
}

const btn = 'rounded border border-[#D7DEE6] px-3 py-1.5 text-xs font-medium hover:bg-white'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#143a66]'
const teal = 'rounded bg-[#0F766E] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#0d655e]'
const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'

export function DocumentRequestCenter({
  caseId,
  candidate,
  visaType,
  canWrite,
  canUpload,
  counts,
  missingKeys = [],
  onChanged,
}: {
  caseId: string
  candidate: { id: string; fullLegalName: string; candidateNumber: string; email: string }
  visaType: string
  canWrite: boolean
  canUpload: boolean
  /** Same counts Overview and Documents show (one shared checklist). */
  counts?: DocumentCounts
  /** Checklist slots with no file yet (alias-aware), so “Request Missing” matches the Missing count. */
  missingKeys?: string[]
  /** Refresh the whole profile so Overview / Documents update after any change here. */
  onChanged?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [templateItems, setTemplateItems] = useState<TemplateItem[]>([])
  const [customDocumentDefs, setCustomDocumentDefs] = useState<CustomDocumentOption[]>([])
  const [recent, setRecent] = useState<RecentRequest[]>([])
  const [requestType, setRequestType] = useState<'FULL' | 'SELECTED' | 'CUSTOM' | 'SINGLE'>('SELECTED')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [current, setCurrent] = useState<RequestItem[]>([])
  const [singleName, setSingleName] = useState('')
  const [singleNote, setSingleNote] = useState('')
  const [customName, setCustomName] = useState('')
  const [customCategory, setCustomCategory] = useState('Additional Evidence')
  const [customInstructions, setCustomInstructions] = useState('')
  // null = follow the name; LinkedIn / portfolio / website… default to a URL field.
  const [customKind, setCustomKind] = useState<'file' | 'url' | null>(null)
  const [singleKind, setSingleKind] = useState<'file' | 'url' | null>(null)
  const customKindValue = customKind ?? (looksLikeLinkRequest(customName) ? 'url' : 'file')
  const singleKindValue = singleKind ?? (looksLikeLinkRequest(singleName) ? 'url' : 'file')
  const [saveToTemplate, setSaveToTemplate] = useState(false)
  const [linkSelected, setLinkSelected] = useState<Record<string, boolean>>({})
  const [extraLinkLabel, setExtraLinkLabel] = useState('')
  const [extraLinkNote, setExtraLinkNote] = useState('')
  const [extraLinkItems, setExtraLinkItems] = useState<RequestItem[]>([])
  const [templateId, setTemplateId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [lastUrl, setLastUrl] = useState('')
  const [lastRequestId, setLastRequestId] = useState('')
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewPlain, setPreviewPlain] = useState('')
  const [bodyEdited, setBodyEdited] = useState(false)
  const [message, setMessage] = useState('')
  const [adminFile, setAdminFile] = useState<File | null>(null)
  const [adminFiles, setAdminFiles] = useState<File[]>([])
  const [adminCategory, setAdminCategory] = useState('Additional Evidence')
  const [adminType, setAdminType] = useState('')
  const [adminCustomTypeName, setAdminCustomTypeName] = useState('')
  const [adminNote, setAdminNote] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/document-requests?caseId=${caseId}`)
    const json = await res.json()
    setLoading(false)
    if (!res.ok) return
    const items = (json.template?.items ?? []) as TemplateItem[]
    setTemplateItems(items)
    setCustomDocumentDefs((json.customDocumentDefs ?? []) as CustomDocumentOption[])
    setTemplateId(json.template?.id ?? null)
    setRecent(json.recent ?? [])
    // Brand-new request: never auto-select template items (server + client agree on empty).
  }, [caseId])

  useEffect(() => {
    void load()
  }, [load])

  /** Reload this panel and the rest of the profile (Overview, Documents, counts). */
  async function reloadAll() {
    await load()
    onChanged?.()
  }

  const categories = useMemo(() => {
    const map = new Map<string, TemplateItem[]>()
    for (const item of templateItems) {
      if (!map.has(item.category)) map.set(item.category, [])
      map.get(item.category)!.push(item)
    }
    return [...map.entries()]
  }, [templateItems])

  const selectedCount = useMemo(() => {
    const docs =
      Object.values(selected).filter(Boolean).length + current.filter((c) => c.source === 'custom').length
    const links =
      Object.values(linkSelected).filter(Boolean).length + extraLinkItems.length
    return docs + links
  }, [selected, current, linkSelected, extraLinkItems])

  const linkItems = useMemo(() => {
    const fromProfile = PROFILE_LINK_OPTIONS.filter((o) => linkSelected[o.key]).map((o) => ({
      key: o.key,
      label: o.label,
      category: o.category,
      instructions: o.instructions,
      required: false,
      allowsMultipleFiles: true,
      source: 'link' as const,
      inputKind: o.inputKind,
    }))
    return [...fromProfile, ...extraLinkItems]
  }, [linkSelected, extraLinkItems])

  function selectAll() {
    const next: Record<string, boolean> = {}
    for (const item of templateItems) next[item.documentKey] = true
    setSelected(next)
    setLinkSelected(Object.fromEntries(PROFILE_LINK_OPTIONS.map(({ key }) => [key, true])))
  }

  function clearAll() {
    setSelected({})
    setCurrent([])
    setLinkSelected({})
    setExtraLinkItems([])
  }

  function toggleCategory(category: string, checked: boolean) {
    const items = templateItems.filter((i) => i.category === category)
    setSelected((prev) => {
      const next = { ...prev }
      for (const item of items) next[item.documentKey] = checked
      return next
    })
  }

  function categoryChecked(category: string) {
    const items = templateItems.filter((i) => i.category === category)
    return items.length > 0 && items.every((i) => selected[i.documentKey])
  }

  function categoryIndeterminate(category: string) {
    const items = templateItems.filter((i) => i.category === category)
    const n = items.filter((i) => selected[i.documentKey]).length
    return n > 0 && n < items.length
  }

  function loadRequestSelections(req: RecentRequest) {
    const next: Record<string, boolean> = {}
    const customs: RequestItem[] = []
    for (const item of req.items) {
      const tmpl = templateItems.find((t) => t.documentName === item.documentName || t.documentKey === item.documentName)
      if (tmpl) next[tmpl.documentKey] = true
      else {
        const link = Boolean(item.documentKey && isLinkRequestKey(item.documentKey))
        customs.push({
          key: link ? item.documentKey! : `custom_${item.id}`,
          label: item.documentName,
          category: item.category,
          source: 'custom',
          inputKind: link ? 'url' : 'file',
        })
      }
    }
    setSelected(next)
    setCurrent(customs)
    setRequestType('SELECTED')
    setMessage(`Loaded ${req.items.length} item(s) from ${req.requestNumber}`)
  }

  function buildItems(): RequestItem[] {
    if (requestType === 'SINGLE') {
      if (!singleName.trim()) return [...linkItems]
      const link = singleKindValue === 'url'
      return [
        {
          key: link ? slugLinkKey(singleName.trim()) : `custom_${crypto.randomUUID().slice(0, 12)}`,
          label: singleName.trim(),
          category: link ? PROFILE_LINK_CATEGORY : customCategory || 'Additional Evidence',
          instructions: singleNote || (link ? `Paste the full URL for: ${singleName.trim()}` : ''),
          required: true,
          allowsMultipleFiles: true,
          source: link ? 'link' : 'custom',
          inputKind: link ? 'url' : 'file',
        },
        ...linkItems,
      ]
    }
    if (requestType === 'CUSTOM') {
      return [...current, ...linkItems]
    }
    const keys = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k)
    const fromTemplate = templateItems
      .filter((i) => keys.includes(i.documentKey))
      .map((i) => ({
        key: i.documentKey,
        label: i.documentName,
        category: i.category,
        instructions: i.instructions,
        required: i.defaultRequired,
        allowsMultipleFiles: true,
        templateItemId: i.id.startsWith('seed:') ? null : i.id,
        source: 'template' as const,
        inputKind: isLinkRequestKey(i.documentKey) ? ('url' as const) : ('file' as const),
      }))
    return [...fromTemplate, ...current.filter((c) => c.source === 'custom'), ...linkItems]
  }

  function addExtraLinkRequest() {
    if (!extraLinkLabel.trim()) return
    const label = extraLinkLabel.trim()
    setExtraLinkItems((prev) => [
      ...prev,
      {
        key: slugLinkKey(label),
        label,
        category: PROFILE_LINK_CATEGORY,
        instructions:
          extraLinkNote.trim() || `Paste the full URL for: ${label}`,
        required: false,
        allowsMultipleFiles: true,
        source: 'link',
        inputKind: 'url',
      },
    ])
    setExtraLinkLabel('')
    setExtraLinkNote('')
  }

  function addCustomToRequest() {
    if (!customName.trim()) return
    const label = customName.trim()
    const link = customKindValue === 'url'
    setCurrent((prev) => [
      ...prev,
      {
        key: link ? slugLinkKey(label) : `custom_${Date.now()}`,
        label,
        category: link ? PROFILE_LINK_CATEGORY : customCategory || 'Additional Evidence',
        instructions: customInstructions || (link ? `Paste the full URL for: ${label}` : ''),
        required: false,
        allowsMultipleFiles: true,
        source: 'custom',
        inputKind: link ? 'url' : 'file',
      },
    ])
    setCustomName('')
    setCustomInstructions('')
    setCustomKind(null)
  }

  async function maybeSaveCustomToTemplate(items: RequestItem[]) {
    if (!saveToTemplate || !templateId) return
    for (const item of items.filter((i) => i.source === 'custom')) {
      await fetch('/api/admin/visa-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-item',
          templateId,
          category: item.category,
          documentName: item.label,
          instructions: item.instructions,
          inputKind: item.inputKind === 'url' || item.inputKind === 'urls' ? 'url' : 'file',
        }),
      })
    }
  }

  /** Create request + secure upload link + editable email in one step. Never auto-sends. */
  async function addToRequest(opts?: { isReplacement?: boolean }) {
    const items = buildItems()
    if (!items.length) {
      alert('Select at least one document or link')
      return
    }
    if (!opts?.isReplacement) {
      const ok = confirm(
        `You're requesting ${items.length} item${items.length === 1 ? '' : 's'} from this candidate.\n\nOnly the checked documents and links will be added to the request.`,
      )
      if (!ok) return
    }
    if (!candidate.email?.trim()) {
      alert('Candidate email is missing. Please add an email address before creating a request.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
      await maybeSaveCustomToTemplate(items)
      const res = await fetch('/api/admin/document-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          requestType,
          items,
          documentName: requestType === 'SINGLE' ? singleName : undefined,
          documentNote: requestType === 'SINGLE' ? singleNote : undefined,
          sendEmail: false,
          isReplacement: Boolean(opts?.isReplacement),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? 'Unable to create request')
        return
      }
      setLastUrl(json.url ?? '')
      setLastRequestId(json.documentRequest?.id ?? '')
      setPreviewHtml(json.html || null)
      setPreviewSubject(json.subject || '')
      setPreviewPlain(json.plainText || '')
      setBodyEdited(false)
      setMessage(`${json.documentRequest?.requestNumber} created — edit if needed, then Copy Email`)
      await reloadAll()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to create request')
    } finally {
      setBusy(false)
    }
  }

  async function openExistingEmail(req: RecentRequest) {
    if (!req.secureUrl) {
      alert('This request has no upload link.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/document-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'email-copy', documentRequestId: req.id }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? 'Unable to load email')
        return
      }
      setLastUrl(json.url ?? req.secureUrl)
      setLastRequestId(req.id)
      setPreviewHtml(json.html || null)
      setPreviewSubject(json.subject || '')
      setPreviewPlain(json.plainText || '')
      setBodyEdited(false)
      setMessage(`${req.requestNumber} email ready — edit if needed, then Copy Email`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to load email')
    } finally {
      setBusy(false)
    }
  }

  async function requestReplacement(item: { documentKey?: string; documentName: string; category: string }) {
    const link = Boolean(item.documentKey && isLinkRequestKey(item.documentKey))
    const reason = prompt(`Replacement reason for ${item.documentName}`)
    if (reason === null) return
    if (!candidate.email?.trim()) {
      alert('Candidate email is missing.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/admin/document-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId,
          requestType: 'SINGLE',
          items: [
            {
              key: link ? item.documentKey! : `custom_${crypto.randomUUID().slice(0, 12)}`,
              label: item.documentName,
              category: item.category || 'Additional Evidence',
              instructions:
                reason || (link ? 'Please send an updated link.' : 'Please upload a clearer or complete replacement copy.'),
              required: true,
              source: link ? 'link' : 'custom',
              inputKind: link ? 'url' : 'file',
            },
          ],
          documentName: item.documentName,
          documentNote: reason || 'Please upload a clearer or complete replacement copy.',
          sendEmail: false,
          isReplacement: true,
        }),
      })
      const json = await res.json()
      if (!res.ok) alert(json.error ?? 'Unable to request replacement')
      else {
        setLastUrl(json.url ?? '')
        setLastRequestId(json.documentRequest?.id ?? '')
        setPreviewHtml(json.html || null)
        setPreviewSubject(json.subject || `Afterstem.ai — Document Request: ${item.documentName}`)
        setPreviewPlain(json.plainText || '')
        setBodyEdited(false)
        setMessage(`Replacement request ready: ${json.documentRequest?.requestNumber}`)
        await reloadAll()
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to create replacement request')
    } finally {
      setBusy(false)
    }
  }

  async function cancel(id: string) {
    await fetch('/api/admin/document-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'cancel', documentRequestId: id }),
    })
    if (lastRequestId === id) {
      setLastRequestId('')
      setLastUrl('')
      setPreviewHtml(null)
      setPreviewPlain('')
      setPreviewSubject('')
    }
    setMessage('Request cancelled')
    await reloadAll()
  }

  async function adminUpload() {
    const files = adminFiles.length ? adminFiles : adminFile ? [adminFile] : []
    const templateItem = templateItems.find((item) => item.documentKey === adminType)
    const customItem = customDocumentDefs.find((item) => item.key === adminType)
    const documentType =
      templateItem?.documentName ||
      customItem?.label ||
      (adminType === '__custom__' ? adminCustomTypeName.trim() : '')
    const category = templateItem?.category || customItem?.category || adminCategory
    if (!files.length || !documentType) {
      alert('Choose file(s) and select or enter a document type.')
      return
    }
    const slug = documentType.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
    const questionKey = templateItem?.documentKey || customItem?.key || `custom_${slug}`
    if (adminType === '__custom__') {
      const res = await fetch('/api/admin/document-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-custom-requirement',
          caseId,
          documentKey: questionKey,
          documentName: documentType,
          category,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'Unable to save the new document type.')
        return
      }
    }
    for (const file of files) {
      try {
        const description =
          window.prompt(`Description for ${file.name} (required — what is this document?)`) || ''
        if (!description.trim()) {
          alert(`Description is required for ${file.name}.`)
          return
        }
        await uploadFileToApi({
          endpoint: '/api/admin/documents',
          file,
          fields: {
            questionKey,
            category,
            documentType,
            adminNote,
            caseId,
            candidateId: candidate.id,
            append: '1',
            description: description.trim(),
          },
        })
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Upload failed')
        return
      }
    }
    setAdminFile(null)
    setAdminFiles([])
    setAdminType('')
    setAdminCustomTypeName('')
    setAdminNote('')
    setMessage(`${files.length} file(s) uploaded (previous files kept)`)
    await reloadAll()
  }

  function requestMissing() {
    // Same “missing” slots the Missing count uses (alias-aware), so the selection matches the number.
    const missing = new Set(missingKeys)
    const keys = templateItems.filter((item) => missing.has(item.documentKey)).map((i) => i.documentKey)
    const next: Record<string, boolean> = {}
    for (const key of keys) next[key] = true
    setSelected(next)
    setRequestType('SELECTED')
    setMessage(`${keys.length} missing item${keys.length === 1 ? '' : 's'} selected`)
  }

  if (loading) return <p className="text-sm text-[#5B6B7C]">Loading document request center…</p>

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#0C2340]/15 bg-gradient-to-br from-[#0C2340] to-[#143a66] p-4 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7dd3d0]">Document Request Center</p>
        <div className="mt-2 grid gap-1 text-sm sm:grid-cols-3">
          <p>
            Candidate: <strong>{candidate.fullLegalName}</strong>
          </p>
          <p>
            Candidate ID: <strong>{candidate.candidateNumber}</strong>
          </p>
          <p>
            Visa: <strong>{formatVisa(visaType as never)}</strong>
          </p>
        </div>
        {counts && (
          <div className="mt-3 rounded-lg bg-white/95 px-3 py-2 text-[#0C2340]">
            <DocumentCountsBar counts={counts} />
          </div>
        )}
      </div>

      {/* CARD A — Request Documents */}
      <section className="rounded-xl border-2 border-[#0F766E]/40 bg-[#F1FAF9] p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[#0F766E]">Request Documents</h3>
            <p className="mt-1 text-xs text-[#5B6B7C]">
              Nothing is pre-selected. Choose only what this candidate must upload.
            </p>
          </div>
          {canWrite && (
            <button type="button" className={btn} onClick={requestMissing}>
              Request Missing Documents
            </button>
          )}
        </div>

        <fieldset className="mt-4 grid gap-2 sm:grid-cols-2">
          {(
            [
              ['SELECTED', 'Select Documents'],
              ['FULL', 'Full Visa Document Package'],
              ['CUSTOM', 'Custom Document Request'],
              ['SINGLE', 'Single Additional Document'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm">
              <input type="radio" checked={requestType === value} onChange={() => setRequestType(value)} />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="max-h-[42rem] space-y-4 overflow-y-auto rounded-lg border border-[#D7DEE6] bg-white p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6B7C]">
                Available documents · Selected: {selectedCount}
              </p>
              {(requestType === 'FULL' || requestType === 'SELECTED') && (
                <div className="flex gap-2">
                  <button type="button" className={btn} onClick={selectAll}>
                    Select All
                  </button>
                  <button type="button" className={btn} onClick={clearAll}>
                    Clear All
                  </button>
                </div>
              )}
            </div>
            {(requestType === 'FULL' || requestType === 'SELECTED') &&
              categories.map(([cat, items]) => (
                <details key={cat} className="group rounded-lg border border-[#D7DEE6] bg-white">
                  <summary className="flex cursor-pointer list-none items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold text-[#0C2340] hover:bg-[#F8FAFC] [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">{cat}</span>
                    <span className="text-xs font-normal text-[#64748B]">
                      {items.filter((item) => selected[item.documentKey]).length}/{items.length} selected
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
                  </summary>
                  <div className="border-t border-[#EEF1F4] p-3">
                    <label className="mb-3 flex items-center gap-2 rounded bg-[#F8FAFC] px-3 py-2 text-xs font-semibold text-[#0C2340]">
                      <input
                        type="checkbox"
                        checked={categoryChecked(cat)}
                        ref={(el) => {
                          if (el) el.indeterminate = categoryIndeterminate(cat)
                        }}
                        onChange={(e) => toggleCategory(cat, e.target.checked)}
                      />
                      Select all in {cat}
                    </label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((item) => (
                        <label key={item.id} className="flex min-h-11 items-start gap-2 rounded border border-[#EEF1F4] px-3 py-2 text-sm hover:bg-[#F8FAFC]">
                          <input
                            type="checkbox"
                            checked={Boolean(selected[item.documentKey])}
                            onChange={() =>
                              setSelected((prev) => ({ ...prev, [item.documentKey]: !prev[item.documentKey] }))
                            }
                          />
                          <span>
                            {item.documentName}
                            <KindBadge link={isLinkRequestKey(item.documentKey)} />
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            {requestType === 'SINGLE' && (
              <div className="space-y-2">
                <input className={input} placeholder="Document or link name" value={singleName} onChange={(e) => setSingleName(e.target.value)} />
                <KindPicker value={singleKindValue} onChange={setSingleKind} />
                <textarea className={input} rows={3} placeholder="Instructions" value={singleNote} onChange={(e) => setSingleNote(e.target.value)} />
              </div>
            )}
            {(requestType === 'CUSTOM' || requestType === 'SELECTED' || requestType === 'FULL') && (
              <div className="rounded-lg border border-dashed border-[#94A3B8] bg-[#F8FAFC] p-4">
                <p className="mb-3 text-sm font-semibold text-[#0F766E]">Add a new document or link request</p>
                <div className="space-y-2">
                  <input className={input} placeholder="Document or link name *" value={customName} onChange={(e) => setCustomName(e.target.value)} />
                  <KindPicker value={customKindValue} onChange={setCustomKind} />
                  <input className={input} placeholder="Category" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} />
                  <textarea className={input} rows={2} placeholder="Instructions" value={customInstructions} onChange={(e) => setCustomInstructions(e.target.value)} />
                  <label className="flex items-center gap-2 text-xs">
                    <input type="checkbox" checked={saveToTemplate} onChange={(e) => setSaveToTemplate(e.target.checked)} />
                    Save to {formatVisa(visaType as never)} template
                  </label>
                  <button type="button" className={btn} onClick={addCustomToRequest}>
                    Add custom item
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-[#0F766E]/30 bg-[#F1FAF9] p-4">
              <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-[#0F766E]">
                Profile &amp; online links
              </p>
              <p className="mb-2 text-[11px] text-[#5B6B7C]">
                Request profile URLs instead of files. Candidates paste links on the upload page.
              </p>
              <ul className="space-y-1.5">
                {PROFILE_LINK_OPTIONS.filter((o) => o.key !== 'other_links').map((opt) => (
                  <label key={opt.key} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(linkSelected[opt.key])}
                      onChange={() =>
                        setLinkSelected((prev) => ({ ...prev, [opt.key]: !prev[opt.key] }))
                      }
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </ul>

              <div className="mt-3 rounded-lg border border-dashed border-[#0F766E]/35 bg-[#F8FFFE] p-3">
                <p className="text-xs font-semibold text-[#0F766E]">Other links to request</p>
                <p className="mt-1 text-[11px] text-[#5B6B7C]">
                  Ask for any other URLs they should share (portfolio, publications, press, etc.).
                </p>
                <label className="mt-2 flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(linkSelected.other_links)}
                    onChange={() =>
                      setLinkSelected((prev) => ({ ...prev, other_links: !prev.other_links }))
                    }
                  />
                  <span>Other / additional links (candidate can paste several)</span>
                </label>
                <div className="mt-2 space-y-2">
                  <input
                    className={input}
                    placeholder="Specific link name (e.g. Personal website)"
                    value={extraLinkLabel}
                    onChange={(e) => setExtraLinkLabel(e.target.value)}
                  />
                  <input
                    className={input}
                    placeholder="Optional instructions"
                    value={extraLinkNote}
                    onChange={(e) => setExtraLinkNote(e.target.value)}
                  />
                  <button type="button" className={btn} onClick={addExtraLinkRequest}>
                    Add link request
                  </button>
                </div>
                {extraLinkItems.length > 0 && (
                  <ul className="mt-2 space-y-1 text-sm">
                    {extraLinkItems.map((item) => (
                      <li key={item.key} className="flex items-center justify-between gap-2">
                        <span>✓ {item.label}</span>
                        <button
                          type="button"
                          className="text-[11px] text-red-700"
                          onClick={() => setExtraLinkItems((prev) => prev.filter((x) => x.key !== item.key))}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-[#D7DEE6] bg-white p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#5B6B7C]">
              Current request · {buildItems().length} document{buildItems().length === 1 ? '' : 's'}
            </p>
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
              {buildItems().map((item) => (
                <li key={item.key} className="flex items-center justify-between gap-2 border-b border-[#EEF1F4] py-1">
                  <span>
                    ✓ {item.label}
                    <KindBadge link={item.inputKind === 'url' || item.inputKind === 'urls'} />
                    <span className="ml-2 text-[10px] uppercase text-[#5B6B7C]">{item.category}</span>
                  </span>
                  {(item.source === 'custom' || item.source === 'link') && (
                    <button
                      type="button"
                      className="text-[11px] text-red-700"
                      onClick={() => {
                        if (item.source === 'link') {
                          if (PROFILE_LINK_OPTIONS.some((o) => o.key === item.key)) {
                            setLinkSelected((prev) => ({ ...prev, [item.key]: false }))
                          } else {
                            setExtraLinkItems((prev) => prev.filter((x) => x.key !== item.key))
                          }
                        } else {
                          setCurrent((prev) => prev.filter((x) => x.key !== item.key))
                        }
                      }}
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
              {buildItems().length === 0 && <li className="text-[#5B6B7C]">No documents or links selected.</li>}
            </ul>

            {canWrite && (
              <button
                type="button"
                className={`${teal} mt-3 w-full`}
                disabled={busy || buildItems().length === 0}
                onClick={() => void addToRequest()}
              >
                {busy ? 'Creating request…' : 'Add to Request'}
              </button>
            )}

            <div className="mt-4 rounded-lg border border-[#0C2340]/20 bg-[#F7FAFC] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#0C2340]">Request Actions</p>
              <p className="mt-2 text-xs text-[#5B6B7C]">To: {candidate.email || '—'}</p>

              {lastUrl ? (
                <div className="mt-2">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-[#5B6B7C]">Candidate upload link</p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-[#0C2340]">{lastUrl}</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[#5B6B7C]">
                  Select documents and click Add to Request. The upload link and email appear here automatically.
                </p>
              )}

              {lastUrl && previewPlain && !previewPlain.toLowerCase().includes('/documents/r/preview') ? (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs font-medium text-[#5B6B7C]">
                    Subject
                    <input
                      className={`${input} mt-1`}
                      value={previewSubject}
                      onChange={(e) => setPreviewSubject(e.target.value)}
                    />
                  </label>
                  <label className="block text-xs font-medium text-[#5B6B7C]">
                    Email
                    <textarea
                      className={`${input} mt-1 font-sans text-[13px] leading-5`}
                      rows={14}
                      value={previewPlain}
                      onChange={(e) => {
                        setPreviewPlain(e.target.value)
                        setBodyEdited(true)
                      }}
                    />
                  </label>
                  <p className="text-[11px] text-[#5B6B7C]">Edit if needed, then copy and paste into Gmail.</p>
                  <EmailCopyActions
                    to={candidate.email}
                    subject={previewSubject}
                    body={previewPlain}
                    htmlBody={bodyEdited ? null : previewHtml}
                    candidateId={candidate.id}
                    caseId={caseId}
                    templateType="DOCUMENTATION_REQUEST"
                    showMarkSent
                    onCopied={() => setMessage('Email copied')}
                  />
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-2">
                {canWrite && lastRequestId && (
                  <button type="button" className={btn} disabled={busy} onClick={() => void cancel(lastRequestId)}>
                    Cancel Request
                  </button>
                )}
              </div>
              {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}
            </div>
          </div>
        </div>
      </section>

      {/* CARD B — Manual admin upload */}
      <section className="rounded-xl border-2 border-[#0C2340]/15 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[#0C2340]">Admin Document Upload</h3>
        <p className="mt-1 text-xs text-[#5B6B7C]">Upload a document already received by Afterstem.ai. This is not a candidate request.</p>
        {canUpload ? (
          <div className="mt-4 space-y-4">
            <label className="flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#94A3B8] bg-[#F8FAFC] p-6 text-center transition-colors hover:border-[#0F766E] hover:bg-[#F1FAF9]">
              <Upload className="mb-2 h-7 w-7 text-[#0F766E]" aria-hidden="true" />
              <span className="text-sm font-semibold text-[#0C2340]">Choose received document files</span>
              <span className="mt-1 text-xs text-[#64748B]">{UPLOAD_TYPE_HINT}. Select one or more files; previous uploads for this type are kept.</span>
              <input
                type="file"
                multiple
                accept={UPLOAD_ACCEPT}
                className="mt-4 block w-full max-w-xl cursor-pointer text-sm"
                onChange={(e) => {
                  const list = e.target.files ? Array.from(e.target.files) : []
                  const rejected = list
                    .map((file) => validateCandidateUploadFile({ filename: file.name, size: file.size, mimeType: file.type }))
                    .filter((check): check is { ok: false; error: string } => !check.ok)
                  if (rejected.length) {
                    alert(rejected.map((check) => check.error).join('\n'))
                    e.currentTarget.value = ''
                    setAdminFiles([])
                    setAdminFile(null)
                    return
                  }
                  setAdminFiles(list)
                  setAdminFile(list[0] ?? null)
                }}
              />
            </label>
            <div className="rounded-lg border border-[#EEF1F4] bg-[#F8FAFC] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#475569]">
                Selected files · {adminFiles.length}
              </p>
              {adminFiles.length ? (
                <ul className="space-y-1">
                  {adminFiles.map((file) => (
                    <li key={`${file.name}-${file.size}-${file.lastModified}`} className="break-all rounded bg-white px-3 py-2 text-sm text-[#0C2340]">
                      {file.name}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#64748B]">No files selected yet.</p>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-medium text-[#5B6B7C]">
                Document type
                <select className={`${input} mt-1`} value={adminType} onChange={(e) => {
                  setAdminType(e.target.value)
                  const item = templateItems.find((templateItem) => templateItem.documentKey === e.target.value)
                  const customItem = customDocumentDefs.find((option) => option.key === e.target.value)
                  if (item || customItem) setAdminCategory(item?.category || customItem?.category || 'Additional Evidence')
                }}>
                  <option value="">Choose a document type</option>
                  {/* Link items are URLs, not files — they are added in Overview → Links. */}
                  {categories
                    .map(([category, items]) => [category, items.filter((item) => !isLinkRequestKey(item.documentKey))] as const)
                    .filter(([, items]) => items.length > 0)
                    .map(([category, items]) => (
                      <optgroup key={category} label={category}>
                        {items.map((item) => <option key={item.id} value={item.documentKey}>{item.documentName}</option>)}
                      </optgroup>
                    ))}
                  {customDocumentDefs.length > 0 && (
                    <optgroup label="Custom document types">
                      {customDocumentDefs
                        .filter((item) => !isLinkRequestKey(item.key))
                        .map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
                    </optgroup>
                  )}
                  <option value="__custom__">New document type…</option>
                </select>
              </label>
              {adminType === '__custom__' ? (
                <>
                  <label className="block text-xs font-medium text-[#5B6B7C]">
                    New document name
                    <input className={`${input} mt-1`} placeholder="Enter a document name" value={adminCustomTypeName} onChange={(e) => setAdminCustomTypeName(e.target.value)} />
                  </label>
                  <label className="block text-xs font-medium text-[#5B6B7C]">
                    Category
                    <input className={`${input} mt-1`} value={adminCategory} onChange={(e) => setAdminCategory(e.target.value)} />
                  </label>
                </>
              ) : (
                <label className="block text-xs font-medium text-[#5B6B7C]">
                  Category
                  <input className={`${input} mt-1`} value={templateItems.find((item) => item.documentKey === adminType)?.category || customDocumentDefs.find((item) => item.key === adminType)?.category || adminCategory} readOnly={Boolean(adminType)} onChange={(e) => setAdminCategory(e.target.value)} />
                </label>
              )}
              <label className="block text-xs font-medium text-[#5B6B7C] sm:col-span-2">
                Internal note (optional)
                <input className={`${input} mt-1`} placeholder="Add an internal note" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
              </label>
            </div>
            <p className="text-xs text-[#64748B]">
              Files only ({UPLOAD_TYPE_HINT}). To save a URL, use Overview → Links; to ask the candidate for a URL, use
              Profile &amp; online links above.
            </p>
            <button
              type="button"
              className={primary}
              disabled={busy || !adminFiles.length || (adminType === '__custom__' ? !adminCustomTypeName.trim() : !adminType)}
              onClick={() => void adminUpload()}
            >
              Upload to Candidate
            </button>
          </div>
        ) : (
          <p className="mt-2 text-sm text-[#5B6B7C]">No upload permission.</p>
        )}
      </section>

      {/* CARD C — Status / history */}
      <section className="rounded-xl border border-[#D7DEE6] bg-white p-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[#0C2340]">Document Status & Request History</h3>
        <div className="mt-3 space-y-3">
          {recent.map((req) => (
            <article key={req.id} className="rounded-lg border border-[#EEF1F4] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold">
                    {req.requestNumber} · {req.requestType}
                  </p>
                  <p className="text-xs text-[#5B6B7C]">
                    {new Date(req.sentAt).toLocaleString()} · {req.sentBy?.fullName ?? 'System'} · {req.status}
                    {' · '}
                    {req.items.filter((i) => i.status === 'UPLOADED' || i.status === 'ACCEPTED').length}/{req.items.length} uploaded
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {canWrite && (
                    <>
                      <button type="button" className={btn} onClick={() => loadRequestSelections(req)}>
                        Load Selection
                      </button>
                      <button
                        type="button"
                        className={teal}
                        disabled={busy || !req.secureUrl}
                        onClick={() => void openExistingEmail(req)}
                      >
                        Copy Email
                      </button>
                      {req.status !== 'CANCELLED' && (
                        <button type="button" className={btn} onClick={() => void cancel(req.id)}>
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
              <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                {req.items.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 rounded bg-[#F8FAFC] px-2 py-1">
                    <span>
                      {item.documentName}
                      <KindBadge link={Boolean(item.documentKey && isLinkRequestKey(item.documentKey))} /> ·{' '}
                      <span className="font-semibold">{item.status}</span>
                    </span>
                    {canWrite && (item.status === 'UPLOADED' || item.status === 'NEEDS_REPLACEMENT') && (
                      <button
                        type="button"
                        className="text-[11px] text-[#0F766E] underline"
                        onClick={() =>
                          void requestReplacement({
                            documentKey: item.documentKey,
                            documentName: item.documentName,
                            category: item.category,
                          })
                        }
                      >
                        Request Replacement
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </article>
          ))}
          {recent.length === 0 && <p className="text-sm text-[#5B6B7C]">No document requests yet.</p>}
        </div>
      </section>
    </div>
  )
}
