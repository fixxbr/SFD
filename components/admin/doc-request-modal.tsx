'use client'

import { useMemo, useState } from 'react'
import { catalogFileOptions } from '@/lib/document-request-items'
import { O1_CATEGORIES } from '@/lib/onboarding-catalog'
import { EmailCopyActions } from '@/components/admin/email-copy-actions'

const btn = 'rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7]'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-medium text-white'
const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'

type RequestType = 'FULL' | 'CUSTOM' | 'SINGLE'
type CustomDraft = { label: string; instructions: string; category: string }

export function DocRequestModal({
  caseId,
  candidate,
  visaLabel,
  onClose,
  onDone,
}: {
  caseId: string
  candidate: { id?: string; fullLegalName: string; candidateNumber: string; email: string }
  visaLabel: string
  onClose: () => void
  onDone?: () => void
}) {
  const catalog = useMemo(() => catalogFileOptions(), [])
  const catalogByCategory = useMemo(() => {
    const map = new Map<string, typeof catalog>()
    for (const item of catalog) {
      const list = map.get(item.category) ?? []
      list.push(item)
      map.set(item.category, list)
    }
    return [...map.entries()]
  }, [catalog])
  const [requestType, setRequestType] = useState<RequestType>('CUSTOM')
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [customs, setCustoms] = useState<CustomDraft[]>([])
  const [singleName, setSingleName] = useState('')
  const [singleNote, setSingleNote] = useState('')
  const [singleCategory, setSingleCategory] = useState('additional')
  const [busy, setBusy] = useState(false)
  const [previewHtml, setPreviewHtml] = useState<string | null>(null)
  const [previewSubject, setPreviewSubject] = useState('')
  const [previewPlain, setPreviewPlain] = useState('')
  const [secureUrl, setSecureUrl] = useState('')
  const [bodyEdited, setBodyEdited] = useState(false)
  const [message, setMessage] = useState('')

  const selectedCount = useMemo(() => Object.values(selected).filter(Boolean).length, [selected])

  function toggle(key: string) {
    setSelected((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function selectAllCatalog() {
    const next: Record<string, boolean> = {}
    for (const item of catalog) next[item.key] = true
    setSelected(next)
  }

  function clearAllCatalog() {
    setSelected({})
  }

  function toggleCategory(category: string, checked: boolean) {
    const items = catalog.filter((i) => i.category === category)
    setSelected((prev) => {
      const next = { ...prev }
      for (const item of items) next[item.key] = checked
      return next
    })
  }

  function categoryChecked(category: string) {
    const items = catalog.filter((i) => i.category === category)
    return items.length > 0 && items.every((i) => selected[i.key])
  }

  function categoryIndeterminate(category: string) {
    const items = catalog.filter((i) => i.category === category)
    const n = items.filter((i) => selected[i.key]).length
    return n > 0 && n < items.length
  }

  function buildItems() {
    if (requestType === 'SINGLE') {
      if (!singleName.trim()) return []
      return [
        {
          key: `custom_${Date.now()}`,
          label: singleName.trim(),
          category: singleCategory || 'Additional Evidence',
          instructions: singleNote,
          required: true,
          source: 'custom' as const,
        },
      ]
    }
    // FULL and CUSTOM: only explicitly checked catalog items (+ customs). Never auto-include all.
    const keys = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k)
    const fromCatalog = catalog
      .filter((i) => keys.includes(i.key))
      .map((i) => ({
        key: i.key,
        label: i.label,
        category: i.category,
        required: true,
        source: 'template' as const,
      }))
    const customItems = customs
      .filter((c) => c.label.trim())
      .map((c, idx) => ({
        key: `custom_${Date.now()}_${idx}`,
        label: c.label.trim(),
        category: c.category || 'Additional Evidence',
        instructions: c.instructions,
        required: true,
        source: 'custom' as const,
      }))
    return [...fromCatalog, ...customItems]
  }

  async function addToRequest() {
    const items = buildItems()
    if (!items.length) {
      alert('Select at least one document')
      return
    }
    const ok = confirm(
      `You're requesting ${items.length} document${items.length === 1 ? '' : 's'} from this candidate.\n\nOnly the checked items will be added.`,
    )
    if (!ok) return
    if (!candidate.email?.trim()) {
      alert('Candidate email is missing. Please add an email address before creating a request.')
      return
    }
    setBusy(true)
    setMessage('')
    try {
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
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? 'Unable to create document request')
        return
      }
      if (!json.url || String(json.plainText || '').includes('/documents/r/preview')) {
        alert('Unable to generate candidate upload link. Please retry.')
        return
      }
      setPreviewHtml(json.html)
      setPreviewSubject(json.subject || '')
      setPreviewPlain(json.plainText || '')
      setBodyEdited(false)
      setSecureUrl(json.url)
      setMessage(`${json.documentRequest?.requestNumber ?? 'Request'} created — edit if needed, then Copy Email.`)
      onDone?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to create document request')
    } finally {
      setBusy(false)
    }
  }

  const canCopy =
    Boolean(previewPlain.trim()) &&
    Boolean(secureUrl) &&
    !previewPlain.toLowerCase().includes('/documents/r/preview')

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4">
      <div className="my-6 w-full max-w-3xl rounded-xl bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#0C2340]">Request Documents</h2>
            <p className="mt-1 text-sm text-[#5B6B7C]">
              {candidate.fullLegalName} · {candidate.candidateNumber} · {visaLabel}
            </p>
            <p className="text-xs text-[#5B6B7C]">
              Select documents → Add to Request → Copy Email → paste into Gmail ({candidate.email})
            </p>
          </div>
          <button className={btn} onClick={onClose}>
            Close
          </button>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-semibold text-[#0C2340]">Select request type</legend>
          {(
            [
              ['FULL', 'Complete O-1 Documentation'],
              ['CUSTOM', 'Custom Documents'],
              ['SINGLE', 'Single Additional Document'],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-2 text-sm">
              <input type="radio" name="requestType" checked={requestType === value} onChange={() => setRequestType(value)} />
              {label}
            </label>
          ))}
        </fieldset>

        {requestType === 'FULL' && (
          <p className="mt-4 rounded-lg border border-[#D7DEE6] bg-[#F7FAFC] p-3 text-sm text-[#5B6B7C]">
            Full package mode still requires you to choose documents below. Nothing is pre-selected.
          </p>
        )}

        {(requestType === 'CUSTOM' || requestType === 'FULL') && (
          <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-lg border border-[#D7DEE6] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#5B6B7C]">
                Available documents · Selected: {selectedCount}
              </p>
              <div className="flex gap-2">
                <button type="button" className={btn} onClick={selectAllCatalog}>
                  Select All
                </button>
                <button type="button" className={btn} onClick={clearAllCatalog}>
                  Clear All
                </button>
              </div>
            </div>
            {catalogByCategory.map(([cat, items]) => (
              <div key={cat} className="mb-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-[#0C2340]">
                  <input
                    type="checkbox"
                    checked={categoryChecked(cat)}
                    ref={(el) => {
                      if (el) el.indeterminate = categoryIndeterminate(cat)
                    }}
                    onChange={(e) => toggleCategory(cat, e.target.checked)}
                  />
                  {cat.replaceAll('_', ' ')}
                </label>
                <ul className="mt-1 space-y-1 pl-5">
                  {items.map((item) => (
                    <label key={item.key} className="flex items-start gap-2 text-sm">
                      <input type="checkbox" checked={Boolean(selected[item.key])} onChange={() => toggle(item.key)} />
                      <span className="font-medium text-[#0C2340]">{item.label}</span>
                    </label>
                  ))}
                </ul>
              </div>
            ))}
            <div className="border-t border-[#EEF1F4] pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#0F766E]">+ Add New Document</p>
              {customs.map((c, idx) => (
                <div key={idx} className="mb-2 grid gap-2 sm:grid-cols-3">
                  <input
                    className={input}
                    placeholder="Document name"
                    value={c.label}
                    onChange={(e) =>
                      setCustoms((prev) => prev.map((row, i) => (i === idx ? { ...row, label: e.target.value } : row)))
                    }
                  />
                  <input
                    className={input}
                    placeholder="Instructions"
                    value={c.instructions}
                    onChange={(e) =>
                      setCustoms((prev) =>
                        prev.map((row, i) => (i === idx ? { ...row, instructions: e.target.value } : row)),
                      )
                    }
                  />
                  <input
                    className={input}
                    placeholder="Category"
                    value={c.category}
                    onChange={(e) =>
                      setCustoms((prev) => prev.map((row, i) => (i === idx ? { ...row, category: e.target.value } : row)))
                    }
                  />
                </div>
              ))}
              <button
                type="button"
                className={btn}
                onClick={() => setCustoms((prev) => [...prev, { label: '', instructions: '', category: 'additional' }])}
              >
                + Add New Document
              </button>
            </div>
          </div>
        )}

        {requestType === 'SINGLE' && (
          <div className="mt-4 grid gap-2">
            <input
              className={input}
              placeholder="Document name (e.g. Latest I-94)"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
            />
            <textarea
              className={input}
              rows={3}
              placeholder="Instructions / note for the candidate"
              value={singleNote}
              onChange={(e) => setSingleNote(e.target.value)}
            />
            <select className={input} value={singleCategory} onChange={(e) => setSingleCategory(e.target.value)}>
              {O1_CATEGORIES.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {previewHtml && (
          <div className="mt-4 space-y-2 rounded-lg border border-[#D7DEE6] bg-[#F3F5F7] p-3">
            <p className="text-xs font-medium text-[#5B6B7C]">To: {candidate.email}</p>
            <label className="block text-xs font-medium text-[#5B6B7C]">
              Subject
              <input
                className={`${input} mt-1`}
                value={previewSubject}
                onChange={(e) => setPreviewSubject(e.target.value)}
              />
            </label>
            <label className="block text-xs font-medium text-[#5B6B7C]">
              Email body (edits are what Copy Email uses)
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
            <iframe title="Email preview" srcDoc={previewHtml} className="h-56 w-full rounded bg-white" />
            {bodyEdited && (
              <p className="text-[11px] text-amber-800">
                Body edited — Copy Email will use your wording inside the branded Afterstem layout (logo included).
              </p>
            )}
            {secureUrl && (
              <p className="break-all font-mono text-[11px] text-[#5B6B7C]">Upload link: {secureUrl}</p>
            )}
          </div>
        )}

        {message && <p className="mt-3 text-sm text-emerald-700">{message}</p>}

        <div className="mt-5 space-y-3">
          <button type="button" className={primary} disabled={busy} onClick={() => void addToRequest()}>
            {busy ? 'Creating request…' : 'Add to Request'}
          </button>
          {canCopy ? (
            <>
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
                onMarkedSent={() => onDone?.()}
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
