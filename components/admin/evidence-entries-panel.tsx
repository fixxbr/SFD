'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { StatusBadge } from '@/components/admin/status-badge'
import { formatDateTime } from '@/lib/format'
import { EVIDENCE_SECTIONS, evidenceFactLines } from '@/lib/evidence-section-meta'
import { DocumentFileName } from '@/components/admin/document-file-name'
import { DocumentPreviewModal } from '@/components/admin/document-preview-modal'
import { DocumentCommentsPanel } from '@/components/admin/document-comments-panel'
import type { EvidenceSection } from '@prisma/client'
import { uploadFileToApi } from '@/lib/client-upload'

const btn = 'rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7] disabled:opacity-50'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50'
const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'

type EntryDoc = {
  id: string
  originalFilename: string
  displayName?: string | null
  description?: string | null
  status: string
  uploadedAt: string
  fileSizeBytes: number
  mimeType: string
}

type Entry = {
  id: string
  section: EvidenceSection
  title: string
  subtitle: string | null
  description: string | null
  metadata?: unknown
  documents: EntryDoc[]
}

async function downloadDoc(id: string) {
  try {
    const { downloadAdminDocument } = await import('@/lib/admin-downloads')
    await downloadAdminDocument(id)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Unable to download this document.')
  }
}

export function EvidenceEntriesPanel({
  candidateId,
  caseId,
  canWrite,
  canReview,
  canComment = false,
  allowDownload = true,
  onDone,
}: {
  candidateId: string
  caseId: string
  canWrite: boolean
  canReview: boolean
  canComment?: boolean
  allowDownload?: boolean
  onDone: () => void
}) {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [draftSection, setDraftSection] = useState<EvidenceSection | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<FileList | null>(null)
  const [preview, setPreview] = useState<{ id: string; filename: string; mimeType?: string | null } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/evidence-entries?caseId=${encodeURIComponent(caseId)}`)
    const json = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(json.error ?? 'Unable to load evidence records.')
      setEntries([])
      return
    }
    setError('')
    setEntries(json.entries ?? [])
  }, [caseId])

  useEffect(() => {
    void load()
  }, [load])

  const bySection = useMemo(() => {
    const map = new Map<EvidenceSection, Entry[]>()
    for (const s of EVIDENCE_SECTIONS) map.set(s.key, [])
    for (const e of entries) {
      const list = map.get(e.section) ?? []
      list.push(e)
      map.set(e.section, list)
    }
    return map
  }, [entries])

  async function createEntry(section: EvidenceSection) {
    if (!title.trim()) {
      alert('Title is required')
      return
    }
    setBusy(true)
    setError('')
    const res = await fetch('/api/admin/evidence-entries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        candidateId,
        caseId,
        section,
        title,
        subtitle: subtitle || null,
        description: description || null,
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setBusy(false)
      setError(json.error ?? 'Unable to create entry')
      return
    }
    const entryId = json.entry?.id as string
    if (files?.length && entryId) {
      for (const file of Array.from(files)) {
        try {
          const fileDescription =
            window.prompt(`Description for ${file.name} (required — what is this document?)`) || ''
          if (!fileDescription.trim()) {
            setError(`Description is required for ${file.name}.`)
            continue
          }
          await uploadFileToApi({
            endpoint: '/api/admin/documents',
            file,
            fields: {
              candidateId,
              caseId,
              evidenceEntryId: entryId,
              append: '1',
              description: fileDescription.trim(),
            },
          })
        } catch (err) {
          setError(err instanceof Error ? err.message : `Failed to upload ${file.name}`)
        }
      }
    }
    setBusy(false)
    setDraftSection(null)
    setTitle('')
    setSubtitle('')
    setDescription('')
    setFiles(null)
    await load()
    onDone()
  }

  async function uploadMore(entryId: string, list: FileList | null) {
    if (!list?.length) return
    setBusy(true)
    for (const file of Array.from(list)) {
      try {
        const fileDescription =
          window.prompt(`Description for ${file.name} (required — what is this document?)`) || ''
        if (!fileDescription.trim()) {
          alert(`Description is required for ${file.name}.`)
          continue
        }
        await uploadFileToApi({
          endpoint: '/api/admin/documents',
          file,
          fields: {
            candidateId,
            caseId,
            evidenceEntryId: entryId,
            append: '1',
            description: fileDescription.trim(),
          },
        })
      } catch (err) {
        alert(err instanceof Error ? err.message : `Failed to upload ${file.name}`)
      }
    }
    setBusy(false)
    await load()
    onDone()
  }

  async function replaceFile(entryId: string, documentId: string, file: File) {
    const fileDescription =
      window.prompt(`Description for ${file.name} (required — what is this document?)`) || ''
    if (!fileDescription.trim()) {
      alert(`Description is required for ${file.name}.`)
      return
    }
    setBusy(true)
    try {
      await uploadFileToApi({
        endpoint: '/api/admin/documents',
        file,
        fields: {
          candidateId,
          caseId,
          evidenceEntryId: entryId,
          replaceDocumentId: documentId,
          append: '1',
          description: fileDescription.trim(),
        },
      })
    } catch (err) {
      setBusy(false)
      alert(err instanceof Error ? err.message : 'Replace failed')
      return
    }
    setBusy(false)
    await load()
    onDone()
  }

  async function renameFile(documentId: string) {
    const name = prompt('Display name for this file')
    if (name === null) return
    const res = await fetch(`/api/admin/documents/${documentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ displayName: name, renameOnly: true }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Unable to rename')
      return
    }
    await load()
    onDone()
  }

  async function removeFile(doc: EntryDoc) {
    if (!confirm(`Remove file “${doc.displayName || doc.originalFilename}”? The entry will remain.`)) return
    setBusy(true)
    const res = await fetch(`/api/admin/documents/${doc.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmFilename: doc.originalFilename }),
    })
    setBusy(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Unable to remove file')
      return
    }
    await load()
    onDone()
  }

  async function reviewFile(id: string, status: string) {
    const note =
      status === 'NEEDS_REPLACEMENT' ? prompt('Revision reason / note (optional)') ?? undefined : undefined
    const res = await fetch(`/api/admin/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, adminNote: note }),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Unable to update status')
      return
    }
    await load()
    onDone()
  }

  async function removeEntry(entry: Entry) {
    if (!confirm(`Delete “${entry.title}” and archive its files?`)) return
    setBusy(true)
    const res = await fetch('/api/admin/evidence-entries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entryId: entry.id }),
    })
    setBusy(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      alert(json.error ?? 'Unable to delete entry')
      return
    }
    await load()
    onDone()
  }

  if (loading) return <p className="text-sm text-[#5B6B7C]">Loading evidence entries…</p>

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-red-700">{error}</p>}
      {EVIDENCE_SECTIONS.map((section) => {
        const list = bySection.get(section.key) ?? []
        const drafting = draftSection === section.key
        return (
          <section key={section.key} className="rounded-xl border border-[#E2E8F0] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wide text-[#0C2340]">{section.label}</h3>
                <p className="text-xs text-[#64748B]">
                  Multiple documents per record — grouped under each {section.titleLabel.toLowerCase()}.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {allowDownload && list.some((e) => e.documents.length > 0) && (
                  <button
                    type="button"
                    className={btn}
                    disabled={busy}
                    onClick={() => {
                      setBusy(true)
                      void import('@/lib/admin-downloads')
                        .then(({ downloadCandidateExport }) =>
                          downloadCandidateExport(candidateId, 'documents-zip', { section: section.key }),
                        )
                        .catch((err) =>
                          alert(err instanceof Error ? err.message : "We couldn't prepare this download. Please try again."),
                        )
                        .finally(() => setBusy(false))
                    }}
                  >
                    Download All {section.label}
                  </button>
                )}
                {canWrite && (
                  <button
                    type="button"
                    className={primary}
                    disabled={busy}
                    onClick={() => {
                      setDraftSection(section.key)
                      setTitle('')
                      setSubtitle('')
                      setDescription('')
                      setFiles(null)
                    }}
                  >
                    {section.addLabel}
                  </button>
                )}
              </div>
            </div>

            {drafting && (
              <div className="mt-4 space-y-2 rounded-lg border border-[#0F766E]/30 bg-[#F1FAF9] p-3">
                <label className="block text-xs font-medium text-[#5B6B7C]">
                  {section.titleLabel}
                  <input
                    className={`${input} mt-1`}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={section.titlePlaceholder}
                  />
                </label>
                <label className="block text-xs font-medium text-[#5B6B7C]">
                  {section.subtitleLabel}
                  <input
                    className={`${input} mt-1`}
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder={section.subtitlePlaceholder}
                  />
                </label>
                {section.descriptionLabel && (
                  <label className="block text-xs font-medium text-[#5B6B7C]">
                    {section.descriptionLabel}
                    <textarea
                      className={`${input} mt-1`}
                      rows={3}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={section.descriptionPlaceholder}
                    />
                  </label>
                )}
                <label className="block text-xs font-medium text-[#5B6B7C]">
                  Documents (multiple)
                  <input
                    type="file"
                    multiple
                    className="mt-1 block w-full text-sm"
                    onChange={(e) => setFiles(e.target.files)}
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={primary} disabled={busy} onClick={() => void createEntry(section.key)}>
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                  <button type="button" className={btn} disabled={busy} onClick={() => setDraftSection(null)}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {list.length === 0 && !drafting && (
              <p className="mt-3 text-sm text-[#64748B]">No records uploaded yet.</p>
            )}
            <ul className="mt-4 space-y-3">
              {list.map((entry) => {
                const facts = evidenceFactLines(entry.section, entry.metadata)
                return (
                <li key={entry.id} className="rounded-lg border border-[#EEF1F4] p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[#0C2340]">{entry.title}</p>
                      {entry.subtitle && <p className="text-sm text-[#64748B]">{entry.subtitle}</p>}
                      {facts.map((fact) => (
                        <p key={fact.label} className="text-xs text-[#64748B]">
                          <span className="font-semibold text-[#0C2340]">{fact.label}:</span> {fact.value}
                        </p>
                      ))}
                      {entry.description && (
                        <p className="mt-1 text-sm leading-5 text-[#475569]">{entry.description}</p>
                      )}
                    </div>
                    {canWrite && (
                      <button type="button" className={btn} disabled={busy} onClick={() => void removeEntry(entry)}>
                        Delete record
                      </button>
                    )}
                  </div>

                  <div className="mt-3 overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-[#EEF1F4] text-[11px] uppercase tracking-wide text-[#94A3B8]">
                          <th className="py-1.5 pr-3 font-medium">Document</th>
                          <th className="py-1.5 pr-3 font-medium">Status</th>
                          <th className="py-1.5 pr-3 font-medium">Uploaded</th>
                          <th className="py-1.5 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entry.documents.map((doc) => (
                          <tr key={doc.id} className="border-b border-[#F8FAFC]">
                            <td className="py-2 pr-3">
                              <DocumentFileName displayName={doc.displayName} originalFilename={doc.originalFilename} />
                              {doc.description ? (
                                <p className="mt-1 text-xs text-[#475569]">
                                  <span className="font-semibold text-[#0C2340]">Description:</span> {doc.description}
                                </p>
                              ) : (
                                <p className="mt-1 text-[11px] italic text-[#94A3B8]">No description provided</p>
                              )}
                            </td>
                            <td className="py-2 pr-3">
                              <StatusBadge status={doc.status.replaceAll('_', ' ')} />
                            </td>
                            <td className="py-2 pr-3 text-xs text-[#64748B]">{formatDateTime(doc.uploadedAt)}</td>
                            <td className="py-2">
                              <div className="flex flex-wrap gap-1">
                                <button
                                  type="button"
                                  className={btn}
                                  onClick={() =>
                                    setPreview({
                                      id: doc.id,
                                      filename: doc.displayName || doc.originalFilename,
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
                                {canWrite && (
                                  <>
                                    <button type="button" className={btn} onClick={() => void renameFile(doc.id)}>
                                      Rename
                                    </button>
                                    <label className={btn + ' cursor-pointer'}>
                                      Replace
                                      <input
                                        type="file"
                                        className="hidden"
                                        onChange={(e) => {
                                          const f = e.target.files?.[0]
                                          if (f) void replaceFile(entry.id, doc.id, f)
                                          e.target.value = ''
                                        }}
                                      />
                                    </label>
                                    <button type="button" className={btn} onClick={() => void removeFile(doc)}>
                                      Delete file
                                    </button>
                                  </>
                                )}
                                {canReview && (
                                  <>
                                    <button type="button" className={btn} onClick={() => void reviewFile(doc.id, 'ACCEPTED')}>
                                      Accept
                                    </button>
                                    <button
                                      type="button"
                                      className={btn}
                                      onClick={() => void reviewFile(doc.id, 'NEEDS_REPLACEMENT')}
                                    >
                                      Needs revision
                                    </button>
                                    <button
                                      type="button"
                                      className={btn}
                                      onClick={() => void reviewFile(doc.id, 'UNDER_REVIEW')}
                                    >
                                      Under review
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                        {entry.documents.length === 0 && (
                          <tr>
                            <td colSpan={4} className="py-3 text-xs text-[#94A3B8]">
                              No documents yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {entry.documents.map((doc) => (
                    <DocumentCommentsPanel key={`comments-${doc.id}`} documentId={doc.id} canWrite={canComment} />
                  ))}
                  {canWrite && (
                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-[#0F766E]">
                      + Add more files
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          void uploadMore(entry.id, e.target.files)
                          e.target.value = ''
                        }}
                      />
                    </label>
                  )}
                </li>
              )
              })}
            </ul>
          </section>
        )
      })}
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
