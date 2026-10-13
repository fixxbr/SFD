'use client'

import { useState, type FormEvent } from 'react'
import { ExternalLink } from 'lucide-react'
import { StatusBadge } from '@/components/admin/status-badge'
import { DocumentCommentsPanel } from '@/components/admin/document-comments-panel'
import { formatDateTime } from '@/lib/format'
import { downloadAdminDocument, downloadCandidateExport } from '@/lib/admin-downloads'
import { DocumentPreviewModal } from '@/components/admin/document-preview-modal'
import { uploadFileToApi } from '@/lib/client-upload'
import { isReceivedChecklistItem } from '@/lib/documents-checklist'
import {
  extractExternalUrls,
  formatUrlForDisplay,
  isExternalLinkDocument,
} from '@/lib/document-links'
import { DocumentFileName } from '@/components/admin/document-file-name'
import { UPLOAD_ACCEPT } from '@/lib/upload-validation'

const btn = 'rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0C2340]'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-medium text-white'
const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'

async function downloadDoc(id: string) {
  try {
    await downloadAdminDocument(id)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Unable to download this document.')
  }
}

async function reviewDoc(id: string, status: string, onDone: () => void) {
  const res = await fetch(`/api/admin/documents/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!res.ok) {
    const json = await res.json().catch(() => ({}))
    alert(json.error ?? 'Unable to update document')
    return
  }
  onDone()
}

async function uploadDoc(
  candidateId: string,
  caseId: string,
  questionKey: string,
  file: File,
  opts?: { append?: boolean; replaceDocumentId?: string; description: string },
) {
  const fields: Record<string, string> = {
    candidateId,
    caseId,
    questionKey,
    description: opts?.description ?? '',
    append: '1',
  }
  if (opts?.replaceDocumentId) fields.replaceDocumentId = opts.replaceDocumentId
  await uploadFileToApi({
    endpoint: '/api/admin/documents',
    file,
    fields,
  })
}

export function DocumentsBlock({
  candidateId,
  currentCase,
  checklist,
  requestItems,
  canWrite,
  canReview,
  canComment = true,
  canUpload,
  allowDownload = true,
  uploaderNames = {},
  onDone,
}: {
  candidateId: string
  currentCase: any
  checklist: any
  requestItems?: any[]
  canWrite: boolean
  canReview: boolean
  canComment?: boolean
  /** Assigned lawyers can upload into the same candidate documents. Defaults to canWrite. */
  canUpload?: boolean
  /** Lawyers may preview only. Admin download/export stays on this flag. */
  allowDownload?: boolean
  uploaderNames?: Record<string, string>
  onDone: () => void
}) {
  const [busyId, setBusyId] = useState<string | null>(null)
  const [preview, setPreview] = useState<{ id: string; filename: string; mimeType?: string | null } | null>(null)
  const [removeTarget, setRemoveTarget] = useState<any>(null)
  const [uploadError, setUploadError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [addOpen, setAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRequired, setNewRequired] = useState(true)
  const folders = (checklist.folders ?? []).filter((folder: any) => {
    const extra = folder.id === 'profile_links' || folder.id === 'custom' || folder.id === 'extra' || folder.id === 'other_supporting'
    if (!extra) return true
    return (folder.items ?? []).some((item: any) => isReceivedChecklistItem(item))
  })

  async function handleAddFiles(questionKey: string, fileList: FileList | null) {
    if (!fileList?.length) return
    setUploadError('')
    setBusyId(questionKey)
    try {
      for (const file of Array.from(fileList)) {
        const description = window.prompt(`Description for ${file.name} (required — what is this document?)`)
        if (!description?.trim()) {
          setUploadError(`Description is required for ${file.name}. Upload cancelled for remaining files.`)
          break
        }
        await uploadDoc(candidateId, currentCase.id, questionKey, file, { description: description.trim() })
      }
      onDone()
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setBusyId(null)
    }
  }

  async function handleReplace(questionKey: string, documentId: string, file: File) {
    setUploadError('')
    setBusyId(documentId)
    try {
      const description = window.prompt(`Description for ${file.name} (required — what is this document?)`)
      if (!description?.trim()) {
        setUploadError(`Description is required for ${file.name}.`)
        return
      }
      await uploadDoc(candidateId, currentCase.id, questionKey, file, {
        replaceDocumentId: documentId,
        description: description.trim(),
      })
      onDone()
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Replace failed')
    } finally {
      setBusyId(null)
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return
    setBusyId(removeTarget.id)
    try {
      const res = await fetch(`/api/admin/documents/${removeTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmFilename: removeTarget.originalFilename }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Unable to remove document')
      setRemoveTarget(null)
      onDone()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to remove document')
    } finally {
      setBusyId(null)
    }
  }

  async function addRequirement(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    setBusyId('add')
    try {
      const key = `custom_${name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '')}_${Date.now()}`
      const res = await fetch('/api/admin/document-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add-custom-requirement',
          caseId: currentCase.id,
          documentName: name,
          required: newRequired,
          documentKey: key,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Unable to add document requirement')
      setAddOpen(false)
      setNewName('')
      onDone()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to add document')
    } finally {
      setBusyId(null)
    }
  }

  async function removeRequirement(item: any) {
    if (!item.questionKey?.startsWith('custom_')) return
    if (!confirm(`Remove requirement “${item.label}”? Uploaded files are kept in history.`)) return
    setBusyId(item.questionKey)
    try {
      const res = await fetch('/api/admin/document-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove-custom-requirement',
          caseId: currentCase.id,
          documentKey: item.questionKey,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? 'Unable to remove requirement')
      onDone()
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Unable to remove requirement')
    } finally {
      setBusyId(null)
    }
  }

  const [zipBusy, setZipBusy] = useState(false)
  const [sourceFilter, setSourceFilter] = useState<'ALL' | 'CANDIDATE' | 'LAWYER' | 'ADMIN'>('ALL')
  const allowUpload = canUpload ?? canWrite

  function uploaderLabel(doc: any) {
    const type = String(doc.uploadedByType || 'CANDIDATE')
    const name = doc.uploadedById ? uploaderNames[doc.uploadedById] : ''
    if (type === 'LAWYER') return name ? `Lawyer Upload · ${name}` : 'Lawyer Upload'
    if (type === 'ADMIN') return name ? `Admin Upload · ${name}` : 'Admin Upload'
    if (type === 'SYSTEM') return 'System'
    return 'Candidate Upload'
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <select className={`${input} w-auto`} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}>
          <option value="ALL">All uploaders</option>
          <option value="CANDIDATE">Candidate</option>
          <option value="LAWYER">Lawyer</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select className={`${input} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All received</option>
          <option value="UPLOADED">Submitted</option>
          <option value="PARTIALLY">Partially Uploaded</option>
          <option value="UNDER_REVIEW">Under Review</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="NEEDS">Needs Revision</option>
        </select>
        <div className="flex flex-wrap gap-2">
          {allowDownload && (
          <button
            type="button"
            className={btn}
            disabled={zipBusy}
            onClick={() => {
              setZipBusy(true)
              void downloadCandidateExport(candidateId, 'documents-zip')
                .catch((err) => alert(err instanceof Error ? err.message : 'Download failed'))
                .finally(() => setZipBusy(false))
            }}
          >
            {zipBusy ? 'Preparing download…' : 'Download All Documents'}
          </button>
          )}
          {allowUpload && (
            <label className={`${primary} cursor-pointer`}>
              Upload Document
              <input
                type="file"
                className="hidden"
                accept={UPLOAD_ACCEPT}
                onChange={(e) => {
                  const key = `lawyer_upload_${Date.now()}`
                  void handleAddFiles(key, e.target.files)
                  e.currentTarget.value = ''
                }}
              />
            </label>
          )}
          {canWrite && (
            <button type="button" className={primary} onClick={() => setAddOpen((v) => !v)}>
              + Add Document
            </button>
          )}
        </div>
      </div>

      {addOpen && (
        <form
          onSubmit={addRequirement}
          className="grid gap-2 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3 sm:grid-cols-[1fr_auto_auto]"
        >
          <input
            className={input}
            placeholder="Document name (e.g. Passport)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            required
          />
          <label className="flex items-center gap-2 text-xs text-[#64748B]">
            <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
            Required
          </label>
          <button className={primary} disabled={busyId === 'add'}>
            {busyId === 'add' ? 'Saving…' : 'Save'}
          </button>
        </form>
      )}

      {uploadError && <p className="text-sm text-red-700">{uploadError}</p>}

      <div className="space-y-6">
        {folders.map((folder: any) => {
          const folderItems = (folder.items ?? [])
            .filter((item: any) => isReceivedChecklistItem(item))
            .filter((item: any) =>
              statusFilter ? String(item.status).toUpperCase().includes(statusFilter.toUpperCase()) : true,
            )
          const fileCount = folderItems.reduce(
            (n: number, item: any) => n + (Array.isArray(item.files) ? item.files.length : item.current ? 1 : 0),
            0,
          )
          return (
            <section key={folder.id} className="space-y-2">
              <h3 className="border-b border-[#EEF1F4] pb-1 text-sm font-semibold text-[#0C2340]">
                {folder.title}
                <span className="ml-2 text-xs font-normal text-[#64748B]">
                  {fileCount} file{fileCount === 1 ? '' : 's'}
                </span>
              </h3>
              {folderItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#D7DEE6] bg-[#F8FAFC] px-3 py-3 text-sm text-[#64748B]">
                  No files received in this category.
                </p>
              ) : (
                folderItems.map((item: any) => {
          const files: any[] = Array.isArray(item.files) && item.files.length
            ? item.files
            : item.current
              ? [item.current]
              : []
          return (
            <div key={item.questionKey} className="rounded-lg border border-[#E2E8F0] bg-white p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words font-medium text-[#0C2340]">{item.label}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={String(item.status).replaceAll('_', ' ')} />
                  <span className="text-xs text-[#64748B]">
                    {files.length} file{files.length === 1 ? '' : 's'}
                  </span>
                  {canWrite && String(item.questionKey).startsWith('custom_') && (
                    <button
                      type="button"
                      className={btn}
                      disabled={busyId === item.questionKey}
                      onClick={() => void removeRequirement(item)}
                    >
                      Remove req.
                    </button>
                  )}
                  {canWrite && (
                    <label className={`${btn} cursor-pointer ${busyId === item.questionKey ? 'opacity-60' : ''}`}>
                      {busyId === item.questionKey ? '…' : files.length ? '+ Add More Files' : 'Choose Files'}
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        accept={UPLOAD_ACCEPT}
                        disabled={busyId === item.questionKey}
                        onChange={(e) => {
                          void handleAddFiles(item.questionKey, e.target.files)
                          e.currentTarget.value = ''
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {files.length > 0 ? (
                <ul className="mt-3 space-y-2 border-t border-[#F1F5F9] pt-3">
                  {files.map((doc: any) => {
                    const linkDoc = isExternalLinkDocument(doc)
                    const urls = linkDoc
                      ? extractExternalUrls({
                          displayName: doc.displayName,
                          description: doc.description,
                        })
                      : []
                    if (sourceFilter !== 'ALL' && String(doc.uploadedByType || 'CANDIDATE') !== sourceFilter) {
                      return null
                    }
                    const primaryUrl = urls[0]
                    const mimeLabel = linkDoc
                      ? 'External Link'
                      : (doc.mimeType?.split('/')[1] || 'file').toUpperCase()
                    const uploaded = doc.uploadedAt
                      ? formatDateTime(doc.uploadedAt).split(',')[0]
                      : '—'

                    return (
                      <li
                        key={doc.id}
                        className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-3"
                      >
                        {linkDoc && primaryUrl ? (
                          <a
                            href={primaryUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group flex items-start justify-between gap-3 rounded-md outline-none transition hover:bg-white focus-visible:ring-2 focus-visible:ring-[#0C2340]/40"
                          >
                            <div className="min-w-0">
                              <DocumentFileName displayName={doc.displayName} originalFilename={doc.originalFilename} />
                              <p className="text-[11px] font-medium text-[#0F766E]">{uploaderLabel(doc)}</p>
                              <p className="mt-0.5 flex items-center gap-1 text-xs text-[#0F766E]">
                                <span className="break-all text-xs text-[#0F766E]">{formatUrlForDisplay(primaryUrl)}</span>
                                <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                              </p>
                              <p className="mt-1 text-[11px] text-[#94A3B8]">
                                {mimeLabel} · {uploaded}
                                {doc.status ? ` · ${String(doc.status).replaceAll('_', ' ')}` : ''}
                              </p>
                            </div>
                          </a>
                        ) : (
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <DocumentFileName displayName={doc.displayName} originalFilename={doc.originalFilename} />
                              <p className="mt-0.5 text-[11px] font-medium text-[#0F766E]">{uploaderLabel(doc)}</p>
                              <p className="text-[11px] text-[#94A3B8]">
                                {mimeLabel}
                                {doc.fileSizeBytes
                                  ? ` · ${(Number(doc.fileSizeBytes) / (1024 * 1024)).toFixed(1)} MB`
                                  : ''}{' '}
                                · {uploaded}
                                {doc.status ? ` · ${String(doc.status).replaceAll('_', ' ')}` : ''}
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-1">
                              <button
                                type="button"
                                className={btn}
                                onClick={() =>
                                  setPreview({
                                    id: doc.id,
                                    filename: doc.displayName || doc.originalFilename || item.label,
                                    mimeType: doc.mimeType,
                                  })
                                }
                              >
                                Preview
                              </button>
                              {allowDownload && (
                                <button type="button" className={btn} onClick={() => void downloadDoc(doc.id)}>
                                  Download
                                </button>
                              )}
                              {canReview && (
                                <>
                                  <button
                                    type="button"
                                    className={btn}
                                    disabled={busyId === doc.id}
                                    onClick={() => reviewDoc(doc.id, 'ACCEPTED', onDone)}
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    className={btn}
                                    disabled={busyId === doc.id}
                                    onClick={() => reviewDoc(doc.id, 'NEEDS_REPLACEMENT', onDone)}
                                  >
                                    Needs revision
                                  </button>
                                </>
                              )}
                              {canWrite && (
                                <>
                                  <label
                                    className={`${btn} cursor-pointer ${busyId === doc.id ? 'opacity-60' : ''}`}
                                  >
                                    Replace
                                    <input
                                      type="file"
                                      className="hidden"
                                      accept={UPLOAD_ACCEPT}
                                      disabled={busyId === doc.id}
                                      onChange={(e) => {
                                        const f = e.target.files?.[0]
                                        if (f) void handleReplace(item.questionKey, doc.id, f)
                                        e.currentTarget.value = ''
                                      }}
                                    />
                                  </label>
                                  {doc.status !== 'ARCHIVED' && (
                                    <button
                                      type="button"
                                      className={`${btn} text-red-700`}
                                      disabled={busyId === doc.id}
                                      onClick={() => setRemoveTarget(doc)}
                                    >
                                      Delete
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        {linkDoc && urls.length > 1 && (
                          <ul className="mt-2 space-y-1">
                            {urls.slice(1).map((href) => (
                              <li key={href}>
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-xs text-[#0F766E] underline-offset-2 hover:underline"
                                >
                                  {formatUrlForDisplay(href)}
                                  <ExternalLink className="h-3 w-3" aria-hidden />
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}

                        {linkDoc && canWrite && doc.status !== 'ARCHIVED' && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <button
                              type="button"
                              className={`${btn} text-red-700`}
                              disabled={busyId === doc.id}
                              onClick={() => setRemoveTarget(doc)}
                            >
                              Delete
                            </button>
                          </div>
                        )}

                        {doc.description && !linkDoc ? (
                          <p className="mt-2 text-xs text-[#475569]">
                            <span className="font-semibold text-[#0C2340]">Description:</span>{' '}
                            {doc.description}
                          </p>
                        ) : null}

                        <DocumentCommentsPanel documentId={doc.id} canWrite={canComment} />
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[#64748B]">No files uploaded yet.</p>
              )}
            </div>
          )
        })
              )}
            </section>
          )
        })}
      </div>

      {removeTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20">
          <div className="w-full max-w-md rounded-lg border border-[#D7DEE6] bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-[#0C2340]">Remove document?</h3>
            <p className="mt-2 text-sm text-[#5B6B7C]">
              Soft-remove <strong>{removeTarget.originalFilename}</strong> from the active checklist. Other files for
              this document type stay on file.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className={btn} onClick={() => setRemoveTarget(null)}>
                Cancel
              </button>
              <button type="button" className={`${btn} text-red-700`} disabled={busyId === removeTarget.id} onClick={() => void confirmRemove()}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {preview && (
        <DocumentPreviewModal
          documentId={preview.id}
          filename={preview.filename}
          mimeType={preview.mimeType}
          downloadRestricted={!allowDownload}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  )
}
