'use client'

import { useEffect, useState } from 'react'
import { classifyPreview, type PreviewKind } from '@/lib/preview-classification'

type Props = {
  documentId: string
  filename: string
  mimeType?: string | null
  downloadRestricted?: boolean
  onClose: () => void
}

export function DocumentPreviewModal({ documentId, filename, mimeType, downloadRestricted = false, onClose }: Props) {
  const initialKind = classifyPreview(mimeType, filename)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [message, setMessage] = useState('')
  const [url, setUrl] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [html, setHtml] = useState('')
  const [resolvedKind, setResolvedKind] = useState<PreviewKind>(initialKind)

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | null = null

    async function load() {
      try {
        const res = await fetch(`/api/admin/documents/${documentId}/preview`, {
          signal: controller.signal,
          credentials: 'same-origin',
        })
        if (res.status === 403) {
          setStatus('error')
          setMessage('You do not have permission to access this document.')
          return
        }
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          setStatus('error')
          setMessage(json.error || 'Unable to preview this document.')
          return
        }
        const type = res.headers.get('Content-Type') || mimeType || ''
        const disposition = res.headers.get('Content-Disposition') || ''
        if (/attachment/i.test(disposition)) {
          setStatus('error')
          setMessage('Unable to preview this document.')
          return
        }
        const blob = await res.blob()
        const nextKind = classifyPreview(type, filename)
        setResolvedKind(nextKind)
        if (nextKind === 'html') {
          setHtml(await blob.text())
          setStatus('ready')
          return
        }
        if (nextKind === 'text') {
          setText(await blob.text())
          setStatus('ready')
          return
        }
        if (nextKind === 'unsupported') {
          setStatus('ready')
          setMessage('Preview is not available for this file type.')
          return
        }
        const typed = blob.type && blob.type !== 'application/octet-stream' ? blob : new Blob([blob], { type })
        objectUrl = URL.createObjectURL(typed)
        setUrl(objectUrl)
        setStatus('ready')
      } catch (error) {
        if (controller.signal.aborted) return
        console.error('[document-preview]', error)
        setStatus('error')
        setMessage('Unable to preview this document.')
      }
    }

    void load()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [documentId, filename, mimeType])

  const typeLabel =
    resolvedKind === 'pdf'
      ? 'PDF'
      : resolvedKind === 'image'
        ? 'Image'
        : resolvedKind === 'text'
          ? 'Text'
          : resolvedKind === 'html'
            ? 'Document'
            : mimeType || 'File'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0C2340]/50 p-4" role="presentation" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${filename}`}
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#E2E8F0] px-4 py-3">
          <div className="min-w-0">
            <p className="break-words text-sm font-semibold text-[#0C2340]">{filename}</p>
            <p className="text-[11px] uppercase tracking-wide text-[#64748B]">{typeLabel}</p>
          </div>
          <button type="button" className="rounded border border-[#D7DEE6] px-3 py-1.5 text-xs font-medium" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="min-h-[240px] flex-1 overflow-auto bg-[#F8FAFC] p-4">
          {downloadRestricted && (
            <p role="status" className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Downloads are restricted for lawyer accounts. This document is available for preview only.
            </p>
          )}
          {status === 'loading' && <p className="text-sm text-[#64748B]">Opening preview…</p>}
          {status !== 'loading' && message && <p className="text-sm text-[#334155]">{message}</p>}
          {status === 'ready' && url && resolvedKind === 'pdf' && (
            <iframe
              title={filename}
              src={downloadRestricted ? `${url}#toolbar=0` : url}
              className="h-[70vh] w-full rounded border border-[#E2E8F0] bg-white"
            />
          )}
          {status === 'ready' && url && resolvedKind === 'image' && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={filename} className="mx-auto max-h-[70vh] max-w-full object-contain" />
          )}
          {status === 'ready' && resolvedKind === 'text' && text && (
            <pre className="whitespace-pre-wrap break-words text-sm text-[#0C2340]">{text}</pre>
          )}
          {status === 'ready' && resolvedKind === 'html' && html && (
            <iframe
              title={filename}
              srcDoc={html}
              sandbox=""
              className="h-[70vh] w-full rounded border border-[#E2E8F0] bg-white"
            />
          )}
        </div>
      </div>
    </div>
  )
}
