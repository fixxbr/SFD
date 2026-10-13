'use client'

import { useCallback, useEffect, useState } from 'react'
import { formatDateTime } from '@/lib/format'

type CommentRow = {
  id: string
  authorName: string
  authorRoleLabel: string
  comment: string
  createdAt: string
}

const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60'
const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'

export function DocumentCommentsPanel({
  documentId,
  canWrite,
  defaultOpen = false,
  initialCount,
}: {
  documentId: string
  canWrite: boolean
  defaultOpen?: boolean
  initialCount?: number
}) {
  const [open, setOpen] = useState(defaultOpen)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [comments, setComments] = useState<CommentRow[]>([])
  const [count, setCount] = useState(initialCount ?? 0)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/comments`)
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Unable to load comments')
      setComments(json.comments || [])
      setCount(json.count ?? (json.comments?.length || 0))
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load comments')
    } finally {
      setLoading(false)
    }
  }, [documentId])

  useEffect(() => {
    if (open && !loaded) void load()
  }, [open, loaded, load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/documents/${documentId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: text }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Unable to add comment')
      setComments((prev) => [...prev, json.comment])
      setCount((n) => n + 1)
      setDraft('')
      setLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add comment')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-2 border-t border-[#E8EEF4] pt-2">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left text-xs font-medium text-[#0C2340]"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>
          {open ? '▾' : '▸'} Comments ({count})
          <span className="ml-1 font-normal text-[#94A3B8]">— this file only</span>
        </span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading && <p className="text-xs text-[#64748B]">Loading comments…</p>}
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
              {error}{' '}
              <button type="button" className="underline" onClick={() => void load()}>
                Retry
              </button>
            </div>
          )}
          {!loading && !error && comments.length === 0 && (
            <p className="text-xs italic text-[#94A3B8]">No comments yet.</p>
          )}
          <ul className="space-y-2">
            {comments.map((c) => (
              <li key={c.id} className="rounded border border-[#EEF1F4] bg-white px-2.5 py-2">
                <p className="text-xs font-semibold text-[#0C2340]">
                  {c.authorName}{' '}
                  <span className="font-normal text-[#64748B]">· {c.authorRoleLabel}</span>
                </p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-[#334155]">{c.comment}</p>
                <p className="mt-1 text-[11px] text-[#94A3B8]">{formatDateTime(c.createdAt)}</p>
              </li>
            ))}
          </ul>
          {canWrite && (
            <form onSubmit={submit} className="space-y-2">
              <textarea
                className={input}
                rows={2}
                placeholder="Write a comment for this document…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={5000}
              />
              <div className="flex justify-end">
                <button type="submit" className={primary} disabled={saving || !draft.trim()}>
                  {saving ? 'Saving…' : 'Comment'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
