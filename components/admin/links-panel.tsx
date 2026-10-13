'use client'

import { useState, type DragEvent, type FormEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import type { ChecklistItem, DocumentVersion } from '@/lib/documents-checklist'
import { formatUrlForDisplay, linkUrlsForDocument } from '@/lib/document-links'
import { LINK_ONLY_ERROR, validateHttpUrl } from '@/lib/link-request-items'
import { formatDateTime } from '@/lib/format'

const btn = 'rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7] disabled:opacity-50'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50'
const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'

function uploaderLabel(doc: DocumentVersion, names: Record<string, string>) {
  const type = String(doc.uploadedByType || 'CANDIDATE')
  const name = doc.uploadedById ? names[doc.uploadedById] : ''
  if (type === 'LAWYER') return name ? `Added by lawyer · ${name}` : 'Added by lawyer'
  if (type === 'ADMIN') return name ? `Added by admin · ${name}` : 'Added by admin'
  if (type === 'SYSTEM') return 'System'
  return 'Submitted by candidate'
}

function linkName(doc: DocumentVersion, item: ChecklistItem, href: string | undefined) {
  const display = (doc.displayName || '').trim()
  if (display && display !== href && !/^https?:\/\//i.test(display)) return display
  return item.label
}

async function readError(res: Response, fallback: string) {
  const json = (await res.json().catch(() => ({}))) as { error?: string }
  return json.error || fallback
}

/** Rejects dropped files: the Links section accepts URLs only. */
function blockFileDrop(e: DragEvent, onError: (message: string) => void) {
  if (e.dataTransfer?.files?.length) {
    e.preventDefault()
    onError(LINK_ONLY_ERROR)
  }
}

/**
 * Overview → Links. URLs only (never files). Links are listed for admins and
 * lawyers alike and never change document counts.
 */
export function LinksPanel({
  candidateId,
  caseId,
  links,
  canWrite,
  uploaderNames = {},
  onDone,
}: {
  candidateId: string
  caseId: string
  links: ChecklistItem[]
  canWrite: boolean
  uploaderNames?: Record<string, string>
  onDone: () => void
}) {
  const [url, setUrl] = useState('')
  const [label, setLabel] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string; url: string; label: string } | null>(null)
  const [editError, setEditError] = useState('')

  const saved = links.flatMap((item) => item.files.map((doc) => ({ item, doc })))
  const pending = links.filter((item) => item.requirement && !item.files.length)

  async function addLink(e: FormEvent) {
    e.preventDefault()
    const check = validateHttpUrl(url)
    if (!check.ok) {
      setError(check.error)
      return
    }
    setBusy('add')
    setError('')
    try {
      const res = await fetch('/api/admin/links', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ candidateId, caseId, url: check.href, label: label.trim() }),
      })
      if (!res.ok) throw new Error(await readError(res, 'Unable to save the link.'))
      setUrl('')
      setLabel('')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the link.')
    } finally {
      setBusy(null)
    }
  }

  async function saveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    const check = validateHttpUrl(editing.url)
    if (!check.ok) {
      setEditError(check.error)
      return
    }
    setBusy(editing.id)
    setEditError('')
    try {
      const res = await fetch(`/api/admin/links/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: check.href, label: editing.label.trim() }),
      })
      if (!res.ok) throw new Error(await readError(res, 'Unable to update the link.'))
      setEditing(null)
      onDone()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Unable to update the link.')
    } finally {
      setBusy(null)
    }
  }

  async function removeLink(id: string, name: string) {
    if (!confirm(`Remove link “${name}”? It stays in the audit history.`)) return
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/links/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' } })
      if (!res.ok) throw new Error(await readError(res, 'Unable to remove the link.'))
      onDone()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Unable to remove the link.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3" data-testid="links-panel">
      <p className="text-xs text-[#5B6B7C]">
        Web links only (https://…). Documents such as PDF, DOC, DOCX, JPG and JPEG are uploaded in the Documents
        section. Links do not change document counts.
      </p>

      {saved.length === 0 && pending.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[#D7DEE6] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
          No links saved yet.
        </p>
      ) : (
        <ul className="space-y-2">
          {saved.map(({ item, doc }) => {
            const href = linkUrlsForDocument(doc)[0]
            const name = linkName(doc, item, href)
            const isEditing = editing?.id === doc.id
            return (
              <li key={doc.id} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5 text-sm">
                {isEditing ? (
                  <form className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]" onSubmit={saveEdit} onDrop={(e) => blockFileDrop(e, setEditError)}>
                    <input
                      className={input}
                      aria-label="Link name"
                      placeholder="Link name"
                      value={editing.label}
                      onChange={(e) => setEditing({ ...editing, label: e.target.value })}
                    />
                    <input
                      className={input}
                      aria-label="URL"
                      inputMode="url"
                      placeholder="https://"
                      value={editing.url}
                      onChange={(e) => setEditing({ ...editing, url: e.target.value })}
                      required
                    />
                    <button className={primary} disabled={busy === doc.id}>
                      {busy === doc.id ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className={btn} onClick={() => setEditing(null)}>
                      Cancel
                    </button>
                    {editError && <p className="text-xs text-red-700 sm:col-span-4">{editError}</p>}
                  </form>
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-[#0C2340]">{name}</p>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 break-all text-[#0F766E] underline-offset-2 hover:underline"
                        >
                          {formatUrlForDisplay(href)}
                          <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                        </a>
                      ) : (
                        <p className="text-xs text-red-700">Saved value is not a valid link.</p>
                      )}
                      <p className="text-[11px] text-[#64748B]">
                        {uploaderLabel(doc, uploaderNames)}
                        {doc.uploadedAt ? ` · ${formatDateTime(doc.uploadedAt)}` : ''}
                      </p>
                    </div>
                    {canWrite && (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className={btn}
                          disabled={busy === doc.id}
                          onClick={() => {
                            setEditError('')
                            setEditing({ id: doc.id, url: href ?? '', label: name === item.label ? '' : name })
                          }}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className={`${btn} text-red-700`}
                          disabled={busy === doc.id}
                          onClick={() => void removeLink(doc.id, name)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
          {pending.map((item) => (
            <li key={item.questionKey} className="rounded-lg border border-dashed border-[#D7DEE6] px-3 py-2.5 text-sm">
              <p className="font-medium text-[#0C2340]">{item.label}</p>
              <p className="text-[11px] text-[#64748B]">Requested from candidate — not provided yet</p>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form
          className="grid gap-2 rounded-lg border border-[#E2E8F0] bg-white p-3 sm:grid-cols-[1fr_1.4fr_auto]"
          onSubmit={addLink}
          onDragOver={(e) => e.dataTransfer?.types?.includes('Files') && e.preventDefault()}
          onDrop={(e) => blockFileDrop(e, setError)}
        >
          <label className="text-xs font-medium text-[#5B6B7C]">
            Link name (optional)
            <input
              className={`${input} mt-1`}
              placeholder="e.g. Google Scholar profile"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-[#5B6B7C]">
            URL
            <input
              className={`${input} mt-1`}
              inputMode="url"
              autoComplete="url"
              placeholder="https://"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (error) setError('')
              }}
              required
            />
          </label>
          <button className={`${primary} self-end`} disabled={busy === 'add' || !url.trim()}>
            {busy === 'add' ? 'Saving…' : 'Add link'}
          </button>
          {error && <p className="text-xs text-red-700 sm:col-span-3">{error}</p>}
        </form>
      )}
    </div>
  )
}
