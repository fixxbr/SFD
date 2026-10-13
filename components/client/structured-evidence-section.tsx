'use client'

import { useState } from 'react'
import { CheckCircle2, ChevronDown } from 'lucide-react'
import { FileDropzone, type PendingFile } from '@/components/client/file-dropzone'
import {
  EVIDENCE_SECTIONS,
  candidateEvidenceSections,
  evidenceFactLines,
  type EvidenceExtraFieldKey,
} from '@/lib/evidence-section-meta'
import { uploadFileToApi } from '@/lib/client-upload'

export type PortalEvidenceEntry = {
  id: string
  section: string
  title: string
  subtitle: string | null
  description: string | null
  metadata?: Record<string, string> | null
  documents: Array<{
    id: string
    originalFilename: string
    description?: string | null
    uploadedAt: string
    fileSizeBytes: number
    status: string
  }>
}

const inputClass =
  'mt-1 w-full rounded-lg border-2 border-foreground/15 bg-card px-3 py-2 text-sm text-foreground outline-none focus:border-accent'

/**
 * Always-on structured evidence. Visibility does not depend on requested document keys.
 */
export function StructuredEvidenceSection({
  entries,
  disabled,
  onChanged,
}: {
  entries: PortalEvidenceEntry[]
  disabled?: boolean
  onChanged: () => Promise<void> | void
}) {
  const sections = candidateEvidenceSections([])
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [extra, setExtra] = useState<Partial<Record<EvidenceExtraFieldKey, string>>>({})
  const [files, setFiles] = useState<PendingFile[]>([])
  const [moreFiles, setMoreFiles] = useState<Record<string, PendingFile[]>>({})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  function resetDraft() {
    setTitle('')
    setSubtitle('')
    setDescription('')
    setExtra({})
    setFiles([])
  }

  async function uploadMany(evidenceEntryId: string, list: PendingFile[]) {
    for (const item of list) {
      if (item.error) throw new Error(`${item.file.name} — ${item.error}`)
      if (item.description.trim().length < 3) {
        throw new Error(`Add a description for ${item.file.name}.`)
      }
      await uploadFileToApi({
        endpoint: '/api/documents',
        file: item.file,
        fields: {
          evidenceEntryId,
          description: item.description.trim(),
          append: '1',
        },
      })
    }
  }

  async function saveRecord(sectionKey: (typeof EVIDENCE_SECTIONS)[number]['key']) {
    const section = EVIDENCE_SECTIONS.find((item) => item.key === sectionKey)
    if (!section) return
    if (!title.trim()) {
      setError(`${section.titleLabel} is required.`)
      return
    }
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/documents/evidence', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: section.key,
          title,
          subtitle: subtitle || null,
          description: description || null,
          metadata: extra,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.entry?.id) {
        throw new Error(json.error || `Unable to save ${section.label.toLowerCase()}.`)
      }
      if (files.length) await uploadMany(json.entry.id, files)
      resetDraft()
      setOpenSection(null)
      await onChanged()
    } catch (err) {
      console.error('[structured-evidence]', err)
      setError(err instanceof Error ? err.message : `Unable to save ${section.label.toLowerCase()}.`)
    } finally {
      setBusy(false)
    }
  }

  async function addFiles(entryId: string) {
    const list = moreFiles[entryId] ?? []
    if (!list.length) return
    setBusy(true)
    setError('')
    try {
      await uploadMany(entryId, list)
      setMoreFiles((prev) => ({ ...prev, [entryId]: [] }))
      await onChanged()
    } catch (err) {
      console.error('[structured-evidence]', err)
      setError(err instanceof Error ? err.message : 'Unable to upload documents.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="paper-card sketch-radius-b p-6 sm:p-8">
      <h2 className="font-display text-2xl font-semibold text-foreground">Supporting evidence</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        These sections are always available. Add as many records as you need, and attach more than one file to each record.
        They stay on file even if they were not in the request above.
      </p>
      {error && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="mt-6 space-y-8">
        {sections.map((key) => {
          const section = EVIDENCE_SECTIONS.find((item) => item.key === key)!
          const records = entries.filter((entry) => entry.section === key)
          const drafting = openSection === key
          return (
            <div key={key}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{section.label}</h3>
                <button
                  type="button"
                  className="sketch-btn sketch-btn-accent px-3 py-1.5 text-xs"
                  disabled={disabled || busy}
                  onClick={() => {
                    setError('')
                    resetDraft()
                    setOpenSection(drafting ? null : key)
                  }}
                >
                  {section.addLabel}
                </button>
              </div>
              {drafting && (
                <div className="mt-3 space-y-3 rounded-xl border-2 border-accent/30 bg-muted/40 p-4">
                  <label className="block text-xs font-semibold text-foreground">
                    {section.titleLabel}
                    <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={section.titlePlaceholder} />
                  </label>
                  <label className="block text-xs font-semibold text-foreground">
                    {section.subtitleLabel}
                    <input className={inputClass} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder={section.subtitlePlaceholder} />
                  </label>
                  {section.extraFields.map((field) => (
                    <label key={field.key} className="block text-xs font-semibold text-foreground">
                      {field.label}
                      <input
                        type={field.input}
                        className={inputClass}
                        value={extra[field.key] ?? ''}
                        placeholder={field.placeholder}
                        onChange={(e) => setExtra((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    </label>
                  ))}
                  {section.descriptionLabel && (
                    <label className="block text-xs font-semibold text-foreground">
                      {section.descriptionLabel}
                      <textarea
                        className={inputClass}
                        rows={3}
                        value={description}
                        placeholder={section.descriptionPlaceholder}
                        onChange={(e) => setDescription(e.target.value)}
                      />
                    </label>
                  )}
                  <div>
                    <p className="text-xs font-semibold text-foreground">Documents</p>
                    <p className="mt-1 text-xs text-muted-foreground">You can attach more than one file. Each file needs a short description.</p>
                    <div className="mt-2">
                      <FileDropzone files={files} disabled={disabled || busy} onChange={setFiles} />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="sketch-btn sketch-btn-accent px-3 py-1.5 text-xs" disabled={busy} onClick={() => void saveRecord(key)}>
                      {busy ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" className="sketch-btn sketch-btn-paper px-3 py-1.5 text-xs" disabled={busy} onClick={() => setOpenSection(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {records.length === 0 && !drafting ? (
                <p className="mt-3 text-sm text-muted-foreground">{section.emptyCandidate}</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {records.map((entry) => {
                    const facts = evidenceFactLines(key, entry.metadata)
                    const isCollapsed = collapsed[entry.id] ?? false
                    return (
                      <li key={entry.id} className="rounded-xl border-2 border-foreground/10 bg-muted/40 p-4">
                        <button
                          type="button"
                          className="flex w-full items-start justify-between gap-3 text-left"
                          onClick={() => setCollapsed((prev) => ({ ...prev, [entry.id]: !isCollapsed }))}
                        >
                          <span>
                            <span className="font-semibold text-foreground">{entry.title}</span>
                            {entry.subtitle && <span className="mt-0.5 block text-sm text-muted-foreground">{entry.subtitle}</span>}
                          </span>
                          <ChevronDown className={`mt-1 h-4 w-4 shrink-0 transition ${isCollapsed ? '' : 'rotate-180'}`} />
                        </button>
                        {!isCollapsed && (
                          <div className="mt-3">
                            {facts.length > 0 && (
                              <ul className="space-y-1 text-xs text-muted-foreground">
                                {facts.map((fact) => (
                                  <li key={fact.label}>
                                    <span className="font-semibold text-foreground">{fact.label}:</span> {fact.value}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {entry.description && <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>}
                            {entry.documents.length > 0 ? (
                              <ul className="mt-3 space-y-2 border-t border-foreground/10 pt-3">
                                {entry.documents.map((doc) => (
                                  <li key={doc.id} className="text-sm text-foreground">
                                    <span className="inline-flex items-center gap-1.5 break-all">
                                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                                      {doc.originalFilename}
                                    </span>
                                    {doc.description ? (
                                      <p className="pl-5 text-xs text-muted-foreground">{doc.description}</p>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-3 text-xs text-muted-foreground">No documents on this record yet.</p>
                            )}
                            <div className="mt-3">
                              <FileDropzone
                                files={moreFiles[entry.id] ?? []}
                                disabled={disabled || busy}
                                onChange={(next) => setMoreFiles((prev) => ({ ...prev, [entry.id]: next }))}
                              />
                              {(moreFiles[entry.id] ?? []).length > 0 && (
                                <button
                                  type="button"
                                  className="sketch-btn sketch-btn-paper mt-2 px-3 py-1.5 text-xs"
                                  disabled={busy}
                                  onClick={() => void addFiles(entry.id)}
                                >
                                  {busy ? 'Uploading…' : 'Upload files'}
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
