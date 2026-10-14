'use client'

import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, ChevronDown, FileUp, Lock, ShieldCheck } from 'lucide-react'
import { FileDropzone, type PendingFile } from '@/components/client/file-dropzone'
import { BrandName } from '@/components/brand'
import { DoodleStar } from '@/components/doodles'
import { EVIDENCE_SECTIONS } from '@/lib/evidence-section-meta'
import { formatFileSize, validateCandidateUploadFile } from '@/lib/upload-validation'
import { uploadFileToApi } from '@/lib/client-upload'
import { StructuredEvidenceSection, type PortalEvidenceEntry } from '@/components/client/structured-evidence-section'
import { displayRequirementStatus } from '@/lib/document-requirement-status'

export type DocumentsPortalCategory = {
  id: string
  title: string
  questions: Array<{
    key: string
    label: string
    help?: string | null
    inputKind?: 'file' | 'url' | 'urls'
    requestStatus?: string | null
    files?: Array<{
      id: string
      originalFilename: string
      description?: string | null
      version: number
      uploadedAt?: string
      fileSizeBytes?: number
      status?: string
    }>
    current: {
      id?: string
      originalFilename: string
      description?: string | null
      version: number
      uploadedAt?: string
      fileSizeBytes?: number
    } | null
  }>
}

export type PreviousDocument = {
  id: string
  questionKey: string
  documentType: string
  originalFilename: string
  description?: string | null
  mimeType: string
  fileSizeBytes: number
  version: number
  status: string
  isCurrentVersion: boolean
  uploadedAt: string
}

export type { PortalEvidenceEntry } from '@/components/client/structured-evidence-section'

export type DocumentsPortalSession = {
  firstName: string
  visaLabel: string
  candidateNumber: string
  requestNumber?: string | null
  categories: DocumentsPortalCategory[]
  previousDocuments?: PreviousDocument[]
  evidenceEntries?: PortalEvidenceEntry[]
}

type SlotPending = Record<string, PendingFile[]>
type EntryPending = Record<string, PendingFile[]>

export function DocumentsPortal({ initialSession = null }: { initialSession?: DocumentsPortalSession | null }) {
  const [step, setStep] = useState<'verify' | 'upload'>(initialSession ? 'upload' : 'verify')
  const [candidateNumber, setCandidateNumber] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [firstName, setFirstName] = useState(initialSession?.firstName ?? '')
  const [visaLabel, setVisaLabel] = useState(initialSession?.visaLabel ?? '')
  const [idLabel, setIdLabel] = useState(initialSession?.candidateNumber ?? '')
  const [requestNumber, setRequestNumber] = useState(initialSession?.requestNumber ?? null)
  const [categories, setCategories] = useState<DocumentsPortalCategory[]>(initialSession?.categories ?? [])
  const [previousDocuments, setPreviousDocuments] = useState<PreviousDocument[]>(
    initialSession?.previousDocuments ?? [],
  )
  const [evidenceEntries, setEvidenceEntries] = useState<PortalEvidenceEntry[]>(
    initialSession?.evidenceEntries ?? [],
  )
  const [pendingByKey, setPendingByKey] = useState<SlotPending>({})
  const [pendingByEntry, setPendingByEntry] = useState<EntryPending>({})
  const [additionalPending, setAdditionalPending] = useState<PendingFile[]>([])
  const [pendingLinks, setPendingLinks] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [previousOpen, setPreviousOpen] = useState(false)

  const pendingCount = useMemo(() => {
    const slotted = Object.values(pendingByKey).reduce((s, list) => s + list.length, 0)
    const entryFiles = Object.values(pendingByEntry).reduce((s, list) => s + list.length, 0)
    const links = Object.values(pendingLinks).filter((v) => v.trim()).length
    return slotted + entryFiles + additionalPending.length + links
  }, [pendingByKey, pendingByEntry, additionalPending, pendingLinks])

  const validPendingCount = useMemo(() => {
    const lists = [...Object.values(pendingByKey), ...Object.values(pendingByEntry), additionalPending]
    const files = lists.flat().filter((f) => !f.error && f.description.trim().length >= 3).length
    const links = Object.values(pendingLinks).filter((v) => v.trim()).length
    return files + links
  }, [pendingByKey, pendingByEntry, additionalPending, pendingLinks])

  const entriesBySection = useMemo(() => {
    const map = new Map<string, PortalEvidenceEntry[]>()
    for (const entry of evidenceEntries) {
      const list = map.get(entry.section) ?? []
      list.push(entry)
      map.set(entry.section, list)
    }
    return map
  }, [evidenceEntries])

  useEffect(() => {
    if (!initialSession) return
    void loadSession({ keepOnError: true })
    // Refresh persisted evidence after a magic-link landing. Sections do not depend on requested docs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadSession(opts?: { keepOnError?: boolean }) {
    const res = await fetch('/api/documents')
    if (!res.ok) {
      if (!opts?.keepOnError) setStep('verify')
      return
    }
    const json = (await res.json()) as DocumentsPortalSession
    setFirstName(json.firstName)
    setVisaLabel(json.visaLabel)
    setIdLabel(json.candidateNumber)
    setRequestNumber(json.requestNumber ?? null)
    setCategories(json.categories)
    setPreviousDocuments(json.previousDocuments ?? [])
    setEvidenceEntries(json.evidenceEntries ?? [])
    setStep('upload')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/client/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ candidate_number: candidateNumber, email }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(
        json.error ??
          'We could not verify your Candidate ID and email address. Please check your information and try again.',
      )
      return
    }
    await loadSession()
  }

  async function viewDocument(documentId: string) {
    const res = await fetch(`/api/documents/${documentId}`)
    const json = await res.json()
    if (!res.ok) {
      alert(json.error ?? 'Unable to open document')
      return
    }
    window.open(json.url, '_blank', 'noopener,noreferrer')
  }

  async function submitDocuments() {
    setSubmitError('')
    setSuccessMessage('')
    if (validPendingCount === 0) {
      setSubmitError('Select at least one document or link, and add a description for every file.')
      return
    }

    type FileJob = {
      clientItemId: string
      questionKey?: string
      evidenceEntryId?: string
      file: File
      description: string
      source: 'slot' | 'evidence' | 'additional'
    }
    const jobs: FileJob[] = []
    for (const [questionKey, list] of Object.entries(pendingByKey)) {
      for (const item of list) {
        if (item.error) continue
        if (!item.description.trim()) {
          setSubmitError(`Add a description for ${item.file.name}.`)
          return
        }
        jobs.push({
          clientItemId: item.id,
          questionKey,
          file: item.file,
          description: item.description.trim(),
          source: 'slot',
        })
      }
    }
    for (const [evidenceEntryId, list] of Object.entries(pendingByEntry)) {
      for (const item of list) {
        if (item.error) continue
        if (!item.description.trim()) {
          setSubmitError(`Add a description for ${item.file.name}.`)
          return
        }
        jobs.push({
          clientItemId: item.id,
          evidenceEntryId,
          file: item.file,
          description: item.description.trim(),
          source: 'evidence',
        })
      }
    }
    for (const item of additionalPending) {
      if (item.error) continue
      if (!item.description.trim()) {
        setSubmitError(`Add a description for ${item.file.name}.`)
        return
      }
      jobs.push({
        clientItemId: item.id,
        questionKey: 'other_supporting_document',
        file: item.file,
        description: item.description.trim(),
        source: 'additional',
      })
    }

    const linkJobs = Object.entries(pendingLinks)
      .map(([questionKey, urls]) => ({
        questionKey,
        urls: urls.trim(),
        clientItemId: `link:${questionKey}:${urls.trim()}`,
      }))
      .filter((j) => j.urls)

    setSubmitting(true)
    let uploaded = 0
    const failures: string[] = []
    const savedFileIds = new Set<string>()
    const savedLinkKeys = new Set<string>()
    try {
      for (const job of jobs) {
        const check = validateCandidateUploadFile({
          filename: job.file.name,
          size: job.file.size,
          mimeType: job.file.type,
        })
        if (!check.ok) {
          failures.push(`${job.file.name} — ${check.error}`)
          continue
        }

        try {
          const fields: Record<string, string> = {
            description: job.description,
            clientItemId: job.clientItemId,
            clientIdempotencyKey: job.clientItemId,
          }
          if (job.evidenceEntryId) fields.evidenceEntryId = job.evidenceEntryId
          if (job.questionKey) fields.questionKey = job.questionKey
          const result = await uploadFileToApi({
            endpoint: '/api/documents',
            file: job.file,
            fields,
          })
          if (result.success === false) {
            throw new Error(String(result.error || 'Upload failed. Please try again.'))
          }
          if (!(result.document as { id?: string } | undefined)?.id) {
            throw new Error('Upload did not confirm storage. Please retry — nothing was saved.')
          }
          uploaded += 1
          savedFileIds.add(job.clientItemId)
        } catch (err) {
          failures.push(
            `${job.file.name} — ${err instanceof Error ? err.message : 'Upload failed. Please try again.'}`,
          )
        }
      }

      for (const job of linkJobs) {
        try {
          const res = await fetch('/api/documents', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              questionKey: job.questionKey,
              urls: job.urls,
              clientItemId: job.clientItemId,
              clientIdempotencyKey: job.clientItemId,
            }),
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) {
            const detail = [json.error, json.correlationId ? `(ref ${json.correlationId})` : '']
              .filter(Boolean)
              .join(' ')
            throw new Error(detail || 'Link could not be saved.')
          }
          if (!json.skipped) uploaded += 1
          savedLinkKeys.add(job.questionKey)
        } catch (err) {
          const label =
            categories.flatMap((c) => c.questions).find((q) => q.key === job.questionKey)?.label ||
            job.questionKey
          failures.push(`${label} — ${err instanceof Error ? err.message : 'Link could not be saved.'}`)
        }
      }

      // Keep failed items so the candidate can correct and retry without re-selecting successes.
      setPendingByKey((prev) => {
        const next: SlotPending = {}
        for (const [key, list] of Object.entries(prev)) {
          const remaining = list.filter((item) => !savedFileIds.has(item.id))
          if (remaining.length) next[key] = remaining
        }
        return next
      })
      setPendingByEntry((prev) => {
        const next: EntryPending = {}
        for (const [key, list] of Object.entries(prev)) {
          const remaining = list.filter((item) => !savedFileIds.has(item.id))
          if (remaining.length) next[key] = remaining
        }
        return next
      })
      setAdditionalPending((prev) => prev.filter((item) => !savedFileIds.has(item.id)))
      setPendingLinks((prev) => {
        const next = { ...prev }
        for (const key of savedLinkKeys) delete next[key]
        return next
      })

      if (uploaded > 0 && failures.length === 0) {
        setSuccessMessage(
          `${uploaded} item${uploaded === 1 ? '' : 's'} saved successfully. You may return to this same link later if you need to add more.`,
        )
      } else if (uploaded > 0) {
        setSuccessMessage(`${uploaded} item${uploaded === 1 ? '' : 's'} saved successfully. Failed items remain below so you can retry them.`)
        setSubmitError(`${failures.length} item${failures.length === 1 ? '' : 's'} failed:\n${failures.join('\n')}`)
      } else {
        setSubmitError(failures.join('\n') || 'Nothing was saved. Check each item and try again.')
      }
      await loadSession({ keepOnError: true })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Upload did not complete. Please try again.')
      await loadSession({ keepOnError: true })
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'verify') {
    return (
      <form onSubmit={verify} className="paper-card sketch-radius-b mx-auto max-w-md p-6 sm:p-8">
        <span className="eyebrow">
          <Lock className="h-4 w-4 text-accent" />
          Secure upload
        </span>
        <h1 className="mt-3 text-balance font-display text-3xl font-semibold text-foreground sm:text-4xl">
          Submit your documents
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
          Enter your Candidate ID and the email on file with <BrandName />. No password is required.
        </p>
        <label className="mt-6 block text-sm font-semibold text-foreground">
          Candidate ID
          <input
            value={candidateNumber}
            onChange={(e) => setCandidateNumber(e.target.value)}
            placeholder="ASM-1031"
            required
            className="mt-1.5 w-full rounded-lg border-2 border-foreground/20 bg-card px-4 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent"
          />
        </label>
        <label className="mt-4 block text-sm font-semibold text-foreground">
          Email Address
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            required
            className="mt-1.5 w-full rounded-lg border-2 border-foreground/20 bg-card px-4 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent"
          />
        </label>
        {error && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>
        )}
        <button type="submit" className="sketch-btn sketch-btn-accent mt-6 w-full px-6 py-3 text-sm">
          Continue
        </button>
      </form>
    )
  }

  return (
    <div className="space-y-6">
      <div className="paper-card sketch-radius-a relative p-6 sm:p-8">
        <span className="eyebrow">
          <DoodleStar className="h-4 w-4 text-accent" />
          Document request
        </span>
        <h1 className="mt-3 text-balance font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
          Upload your documents
        </h1>
        <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">
          Hi <span className="font-semibold text-foreground">{firstName}</span> — this secure{' '}
          <BrandName /> link is ready for your {visaLabel} files.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <span className="sticker -rotate-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-foreground">
            {idLabel}
          </span>
          <span className="sticker rotate-1 px-3 py-1.5 text-xs font-semibold text-foreground">{visaLabel}</span>
          {requestNumber ? (
            <span className="sticker px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              Request {requestNumber}
            </span>
          ) : null}
        </div>
        <p className="mt-5 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
          New uploads add to your file — they never erase what you already submitted. You can reopen this link anytime.
        </p>
      </div>

      <StructuredEvidenceSection entries={evidenceEntries} disabled={submitting} onChanged={loadSession} />

      {false && (
        <section className="paper-card sketch-radius-b p-6 sm:p-8">
          <h2 className="font-display text-2xl font-semibold text-foreground">
            Education · Employment · Clients · Credentials
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add files under each record. Prior files stay on file when you return later.
          </p>
          <div className="mt-6 space-y-6">
            {EVIDENCE_SECTIONS.filter((s) => (entriesBySection.get(s.key) ?? []).length > 0).map((section) => (
              <div key={section.key}>
                <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{section.label}</h3>
                <ul className="mt-3 space-y-4">
                  {(entriesBySection.get(section.key) ?? []).map((entry) => (
                    <li key={entry.id} className="rounded-xl border-2 border-foreground/10 bg-muted/40 p-4">
                      <p className="font-semibold text-foreground">{entry.title}</p>
                      {entry.subtitle && <p className="text-sm text-muted-foreground">{entry.subtitle}</p>}
                      {entry.description && <p className="mt-1 text-xs text-muted-foreground">{entry.description}</p>}
                      {entry.documents.length > 0 && (
                        <ul className="mt-3 space-y-2 border-t border-foreground/10 pt-3">
                          {entry.documents.map((doc) => (
                            <li key={doc.id} className="space-y-1 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="inline-flex min-w-0 items-center gap-1.5 break-words text-foreground">
                                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                                  {doc.originalFilename}
                                </span>
                                <button
                                  type="button"
                                  className="sketch-btn sketch-btn-paper px-3 py-1.5 text-xs"
                                  onClick={() => void viewDocument(doc.id)}
                                >
                                  View
                                </button>
                              </div>
                              {doc.description ? (
                                <p className="pl-5 text-xs text-muted-foreground">
                                  <span className="font-semibold text-foreground">Description:</span> {doc.description}
                                </p>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                      <div className="mt-3">
                        <FileDropzone
                          files={pendingByEntry[entry.id] ?? []}
                          disabled={submitting}
                          state={
                            submitting
                              ? 'uploading'
                              : (pendingByEntry[entry.id] ?? []).some((f) => f.error)
                                ? 'error'
                                : (pendingByEntry[entry.id] ?? []).length
                                  ? 'selected'
                                  : 'empty'
                          }
                          statusMessage={
                            (pendingByEntry[entry.id] ?? []).length
                              ? `${(pendingByEntry[entry.id] ?? []).length} file${(pendingByEntry[entry.id] ?? []).length === 1 ? '' : 's'} ready to upload`
                              : undefined
                          }
                          onChange={(files) => setPendingByEntry((prev) => ({ ...prev, [entry.id]: files }))}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="paper-card sketch-radius-c p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <span className="sticker flex h-11 w-11 shrink-0 -rotate-2 items-center justify-center">
            <FileUp className="h-5 w-5 text-accent" />
          </span>
          <div>
            <h2 className="font-display text-2xl font-semibold text-foreground">Requested documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You can attach multiple files to every request. Each file needs its own description of what it is.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-6">
          {categories.map((cat) => (
            <div key={cat.id}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">{cat.title}</h3>
              <ul className="mt-3 space-y-4">
                {cat.questions.map((q) => {
                  const isLink = q.inputKind === 'url' || q.inputKind === 'urls'
                  return (
                  <li key={q.key} className="rounded-xl border-2 border-foreground/10 bg-muted/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-foreground">{q.label}</p>
                      <span className="text-xs font-semibold text-accent">
                        {(q.files?.length ?? 0) > 0 ? '✓ ' : ''}
                        {displayRequirementStatus({
                          requestStatus: q.requestStatus,
                          files: q.files ?? [],
                          additional: q.key.startsWith('additional__'),
                        }).candidateLabel}
                      </span>
                    </div>
                    {q.help && <p className="mt-1 text-xs text-muted-foreground">{q.help}</p>}
                    {(q.files?.length ?? 0) > 0 ? (
                      <ul className="mt-2 space-y-2 border-t border-foreground/10 pt-2">
                        <li className="text-xs font-medium text-accent">
                          {q.files!.length} {isLink ? 'link' : 'file'}
                          {q.files!.length === 1 ? '' : isLink ? 's' : 's'} on file — you can update below
                        </li>
                        {q.files!.map((f) => (
                          <li key={f.id} className="space-y-1 text-sm">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="inline-flex min-w-0 items-center gap-1.5 break-all text-foreground">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                                {f.originalFilename}
                              </span>
                              <button
                                type="button"
                                className="sketch-btn sketch-btn-paper px-3 py-1.5 text-xs"
                                onClick={() => void viewDocument(f.id)}
                              >
                                View
                              </button>
                            </div>
                            {f.description ? (
                              <p className="pl-5 text-xs text-muted-foreground">
                                <span className="font-semibold text-foreground">Description:</span> {f.description}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : q.current ? (
                      <p className="mt-1 break-all text-xs text-accent">
                        On file: {q.current.originalFilename}
                      </p>
                    ) : null}
                    <div className="mt-3">
                      {isLink ? (
                        <>
                          <textarea
                            className="w-full rounded-lg border-2 border-foreground/15 bg-card px-3 py-2 text-sm"
                            rows={3}
                            placeholder="https://…&#10;https://…"
                            disabled={submitting}
                            value={pendingLinks[q.key] ?? ''}
                            onChange={(e) =>
                              setPendingLinks((prev) => ({ ...prev, [q.key]: e.target.value }))
                            }
                          />
                          <p className="mt-1 text-xs text-muted-foreground">Add as many links as you need, one per line.</p>
                        </>
                      ) : (
                        <FileDropzone
                          files={pendingByKey[q.key] ?? []}
                          disabled={submitting}
                          state={
                            submitting
                              ? 'uploading'
                              : (pendingByKey[q.key] ?? []).some((f) => f.error)
                                ? 'error'
                                : (pendingByKey[q.key] ?? []).length
                                  ? 'selected'
                                  : 'empty'
                          }
                          statusMessage={
                            (pendingByKey[q.key] ?? []).length
                              ? `${(pendingByKey[q.key] ?? []).length} file${(pendingByKey[q.key] ?? []).length === 1 ? '' : 's'} ready to upload`
                              : undefined
                          }
                          onChange={(files) => setPendingByKey((prev) => ({ ...prev, [q.key]: files }))}
                        />
                      )}
                    </div>
                  </li>
                  )
                })}
              </ul>
            </div>
          ))}

          <div className="rounded-xl border-2 border-foreground/10 bg-muted/40 p-4">
            <p className="font-semibold text-foreground">Additional Evidence</p>
            <p className="mt-1 text-xs text-muted-foreground">Optional files not tied to a specific checklist item.</p>
            <div className="mt-3">
              <FileDropzone
                files={additionalPending}
                disabled={submitting}
                state={
                  submitting
                    ? 'uploading'
                    : additionalPending.some((f) => f.error)
                      ? 'error'
                      : additionalPending.length
                        ? 'selected'
                        : 'empty'
                }
                statusMessage={
                  submitting
                    ? `Uploading ${validPendingCount} document${validPendingCount === 1 ? '' : 's'}...`
                    : additionalPending.length
                      ? `${additionalPending.length} file${additionalPending.length === 1 ? '' : 's'} ready to upload`
                      : undefined
                }
                onChange={setAdditionalPending}
              />
            </div>
          </div>
        </div>

        {submitError && (
          <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive whitespace-pre-wrap" role="alert">
            {submitError}
          </p>
        )}
        {successMessage && (
          <p
            className="mt-4 flex items-start gap-2 rounded-lg border-2 border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-foreground"
            role="status"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            {successMessage}
          </p>
        )}

        <button
          type="button"
          disabled={submitting || validPendingCount === 0}
          onClick={() => void submitDocuments()}
          className="sketch-btn sketch-btn-accent mt-6 w-full px-6 py-3.5 text-sm disabled:opacity-50 sm:w-auto"
        >
          {submitting ? 'Saving documents...' : `Submit Documents${pendingCount ? ` (${validPendingCount})` : ''}`}
        </button>
      </section>

      <section className="paper-card sketch-radius-b overflow-hidden">
        <button
          type="button"
          aria-expanded={previousOpen}
          onClick={() => setPreviousOpen((open) => !open)}
          className="flex w-full items-center justify-between gap-3 px-6 py-5 text-left transition hover:bg-muted/50 sm:px-8"
        >
          <div className="min-w-0">
            <span className="eyebrow">
              <DoodleStar className="h-3.5 w-3.5 text-accent" />
              History
            </span>
            <h2 className="mt-1 font-display text-2xl font-semibold text-foreground">Previously uploaded documents</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {previousDocuments.length === 0
                ? 'No documents uploaded yet'
                : `${previousDocuments.length} file${previousDocuments.length === 1 ? '' : 's'} on file`}
            </p>
          </div>
          <span
            className={`sticker flex h-10 w-10 shrink-0 items-center justify-center transition-transform duration-200 ${
              previousOpen ? 'rotate-180' : 'rotate-0'
            }`}
            aria-hidden
          >
            <ChevronDown className="h-4 w-4 text-foreground" />
          </span>
        </button>

        {previousOpen && (
          <div className="border-t-2 border-foreground/10 px-6 pb-6 pt-2 sm:px-8">
            {previousDocuments.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No documents uploaded yet.</p>
            ) : (
              <ul className="mt-2 space-y-3">
                {previousDocuments.map((doc) => (
                  <li
                    key={doc.id}
                    className="flex flex-wrap items-start justify-between gap-2 border-t border-foreground/10 pt-3 text-sm first:border-t-0 first:pt-1"
                  >
                    <div className="min-w-0 break-words">
                      <p className="inline-flex items-center gap-1.5 font-semibold text-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-accent" />
                        {doc.originalFilename}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Uploaded {new Date(doc.uploadedAt).toLocaleString()}
                        {doc.fileSizeBytes ? ` · ${formatFileSize(doc.fileSizeBytes)}` : ''}
                        {doc.version > 1 ? ` · Version ${doc.version}` : ''}
                        {!doc.isCurrentVersion ? ' · earlier upload' : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="sketch-btn sketch-btn-paper px-3 py-1.5 text-xs"
                      onClick={() => void viewDocument(doc.id)}
                    >
                      View
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
