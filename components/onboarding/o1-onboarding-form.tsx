'use client'

import { useEffect, useMemo, useState } from 'react'
import type { OnboardingCategory } from '@/lib/onboarding-catalog'
import { documentMatchesSlot } from '@/lib/documents-checklist'
import { formatTime } from '@/lib/format'
import { UPLOAD_ACCEPT } from '@/lib/upload-validation'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function O1OnboardingForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  /** Every file sent for each upload slot (a slot holds as many files as the candidate needs). */
  const [documents, setDocuments] = useState<Record<string, OnboardingFile[]>>({})
  const [status, setStatus] = useState('DRAFT')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  // The server sends the form for this candidate's own visa type.
  const [catalog, setCatalog] = useState<OnboardingCategory[]>([])
  const [visaLabel, setVisaLabel] = useState('')
  /** Links saved from URL fields, by field key. Links are kept apart from uploaded files. */
  const [links, setLinks] = useState<Record<string, string[]>>({})
  const [linkErrors, setLinkErrors] = useState<Record<string, string[]>>({})
  const [uploadedKeys, setUploadedKeys] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/onboarding/${token}`, { cache: 'no-store' })
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Unable to open this link')
        if (cancelled) return
        setName(json.candidate.fullLegalName)
        setCatalog(json.catalog ?? [])
        setVisaLabel(json.visaLabel ?? '')
        setAnswers(json.submission.answers ?? {})
        setStatus(json.submission.status)
        setLastSavedAt(json.submission.lastSavedAt)
        const map: Record<string, OnboardingFile[]> = {}
        for (const doc of (json.documents ?? []) as OnboardingFile[]) (map[doc.questionKey] ??= []).push(doc)
        setDocuments(map)
        setUploadedKeys((json.documents ?? []).map((doc: { questionKey: string }) => doc.questionKey))
        const linkMap: Record<string, string[]> = {}
        for (const link of json.links ?? []) (linkMap[link.questionKey] ??= []).push(link.url)
        setLinks(linkMap)
        if (json.submission.status === 'SUBMITTED' || json.submission.status === 'ACCEPTED') setSubmitted(true)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    return () => {
      cancelled = true
    }
  }, [token])

  // Accepted answers are locked on the server; files and links can still be sent.
  const answersLocked = status === 'ACCEPTED'

  useEffect(() => {
    if (loading || submitted || error || answersLocked) return
    const handle = setTimeout(() => {
      setSaveState('saving')
      fetch(`/api/onboarding/${token}/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
        .then(async (res) => {
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          setLastSavedAt(json.lastSavedAt)
          setSaveState('saved')
        })
        .catch(() => setSaveState('error'))
    }, 1200)
    return () => clearTimeout(handle)
  }, [answers, loading, submitted, error, answersLocked, token])

  const saveLabel = useMemo(() => {
    if (saveState === 'saving') return 'Saving…'
    if (saveState === 'saved' && lastSavedAt) return `Saved · Last saved at ${formatTime(lastSavedAt)}`
    if (saveState === 'error') return 'Could not save — retrying when you edit'
    return lastSavedAt ? `Last saved at ${formatTime(lastSavedAt)}` : ''
  }, [saveState, lastSavedAt])

  async function upload(questionKey: string, file: File) {
    try {
      const description = window.prompt(`Description for ${file.name} (required — what is this document?)`)
      if (!description?.trim()) {
        alert(`Description is required for ${file.name}.`)
        return false
      }
      const { uploadFileToApi } = await import('@/lib/client-upload')
      const json = await uploadFileToApi({
        endpoint: `/api/onboarding/${token}/upload`,
        file,
        fields: { questionKey, description: description.trim() },
        inviteToken: token,
      })
      const document = json.document as Omit<OnboardingFile, 'canReplace'> | undefined
      if (document) {
        // Not submitted yet, so the candidate can still replace or remove it.
        setDocuments((prev) => ({ ...prev, [questionKey]: [...(prev[questionKey] ?? []), { ...document, canReplace: true }] }))
        setUploadedKeys((prev) => [...prev, questionKey])
      }
      return Boolean(document)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload did not complete. Please try again.')
      return false
    }
  }

  /** Remove a file that has not been submitted yet, or one an admin or lawyer disapproved. */
  async function removeFile(questionKey: string, file: OnboardingFile, confirmFirst = true) {
    if (confirmFirst && !window.confirm(`Remove ${file.originalFilename}?`)) return false
    const res = await fetch(`/api/onboarding/${token}/upload?documentId=${encodeURIComponent(file.id)}`, { method: 'DELETE' })
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      alert(json.error ?? 'Could not remove this file.')
      return false
    }
    setDocuments((prev) => ({ ...prev, [questionKey]: (prev[questionKey] ?? []).filter((d) => d.id !== file.id) }))
    setUploadedKeys((prev) => {
      const i = prev.indexOf(questionKey)
      return i < 0 ? prev : [...prev.slice(0, i), ...prev.slice(i + 1)]
    })
    return true
  }

  /** Replace = upload the new file first, then remove the old one (nothing is lost if the upload fails). */
  async function replaceFile(questionKey: string, file: OnboardingFile, next: File) {
    if (await upload(questionKey, next)) await removeFile(questionKey, file, false)
  }

  /** Save one URL field as links when the candidate leaves it (checked on the server too). */
  async function saveLinks(questionKey: string, value: string) {
    const res = await fetch(`/api/onboarding/${token}/links`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionKey, value }),
    })
    const json = (await res.json().catch(() => ({}))) as { urls?: string[]; errors?: string[]; error?: string }
    if (json.urls) setLinks((prev) => ({ ...prev, [questionKey]: json.urls! }))
    setLinkErrors((prev) => ({
      ...prev,
      [questionKey]: json.errors?.length ? json.errors : json.error ? [json.error] : [],
    }))
  }

  async function submit() {
    // Make sure the latest URL fields are saved before submitting (the server re-checks them too).
    await fetch(`/api/onboarding/${token}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answers }),
    }).catch(() => {})
    const res = await fetch(`/api/onboarding/${token}/submit`, { method: 'POST' })
    if (res.ok) {
      const json = (await res.json().catch(() => ({}))) as { status?: string }
      // Everything sent so far is now submitted: only files staff disapproved stay changeable.
      setDocuments((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([key, files]) => [
            key,
            files.map((f) => ({ ...f, canReplace: f.status === 'NEEDS_REPLACEMENT' || f.status === 'REJECTED' })),
          ]),
        ),
      )
      setSubmitted(true)
      setStatus(json.status ?? 'SUBMITTED')
    }
  }

  // Not sent yet — shown as information only; submitting is always allowed.
  const notSent = catalog.flatMap((category) =>
    category.questions
      .filter((q) =>
        q.type === 'file'
          ? !uploadedKeys.some((key) => documentMatchesSlot(key, q.key))
          : q.type === 'url'
            ? !(links[q.key]?.length)
            : false,
      )
      .map((q) => ({ key: q.key, label: q.label, section: category.title })),
  )

  if (loading) return <p className="text-sm text-muted-foreground">Loading your Afterstem onboarding…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (submitted) {
    return (
      <div className="paper-card p-8">
        <h1 className="text-2xl font-medium">Onboarding submitted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you, {name}. Afterstem has stored your answers and documents. You can send more documents or links
          through this same link at any time, as often as you need.
        </p>
        <button type="button" className="sketch-btn mt-4 px-5 py-2 text-sm" onClick={() => setSubmitted(false)}>
          Send more documents or links
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">{visaLabel ? `${visaLabel} onboarding` : 'Onboarding'}</p>
        <h1 className="mt-2 text-3xl font-medium">Welcome, {name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your answers and files save to Afterstem automatically. This link is unique to your case.
        </p>
        {answersLocked ? (
          <p className="mt-2 text-xs font-medium text-accent">Your answers have been accepted. You can still upload files and add links.</p>
        ) : (
          <p className="mt-2 text-xs font-medium text-accent">{saveLabel}</p>
        )}
      </div>
      {catalog.map((category) => (
        <Section
          key={category.id}
          category={category}
          answers={answers}
          documents={documents}
          links={links}
          linkErrors={linkErrors}
          onChange={(key, value) => setAnswers((prev) => ({ ...prev, [key]: value }))}
          onUpload={upload}
          onRemove={removeFile}
          onReplace={replaceFile}
          onLinkBlur={saveLinks}
        />
      ))}
      <section className="paper-card p-5 sm:p-6" data-testid="not-sent">
        <h2 className="font-display text-xl font-semibold">Not sent yet</h2>
        {notSent.length ? (
          <>
            <p className="mt-1 text-sm text-muted-foreground">
              You can submit now and send these later through this same link, as many times as you need.
            </p>
            <ul className="mt-3 grid gap-1 text-sm sm:grid-cols-2">
              {notSent.map((item) => (
                <li key={item.key}>
                  {item.label} <span className="text-xs text-muted-foreground">· {item.section}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Every document and link on your list has been sent.</p>
        )}
      </section>
      <button type="button" onClick={submit} className="sketch-btn sketch-btn-accent px-6 py-3 text-sm">
        {status === 'SUBMITTED' || status === 'ACCEPTED' ? 'Submit again' : 'Submit onboarding'}
      </button>
    </div>
  )
}

type OnboardingFile = {
  id: string
  questionKey: string
  originalFilename: string
  status: string
  version: number
  uploadedAt: string
  /** Before Submit the candidate can replace or remove it; after Submit only if staff disapproved it. */
  canReplace: boolean
}

function Section({
  category,
  answers,
  documents,
  links,
  linkErrors,
  onChange,
  onUpload,
  onRemove,
  onReplace,
  onLinkBlur,
}: {
  category: OnboardingCategory
  answers: Record<string, unknown>
  documents: Record<string, OnboardingFile[]>
  links: Record<string, string[]>
  linkErrors: Record<string, string[]>
  onChange: (key: string, value: unknown) => void
  onUpload: (key: string, file: File) => Promise<boolean> | void
  onRemove: (key: string, file: OnboardingFile) => void
  onReplace: (key: string, file: OnboardingFile, next: File) => void
  onLinkBlur: (key: string, value: string) => void
}) {
  return (
    <section className="paper-card p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold">{category.folderTitle}</h2>
      {category.description ? <p className="mt-1 text-sm text-muted-foreground">{category.description}</p> : null}
      <div className="mt-4 space-y-4">
        {category.questions.map((q) => (
          <div key={q.key}>
            <label className="mb-1 block text-sm font-semibold">{q.label}</label>
            {q.help ? <p className="mb-1 text-xs text-muted-foreground">{q.help}</p> : null}
            {q.type === 'textarea' && (
              <textarea
                className="w-full rounded-lg border-2 border-foreground/20 px-3 py-2 text-sm"
                rows={4}
                value={String((answers[q.key] as { value?: string } | undefined)?.value ?? answers[q.key] ?? '')}
                onChange={(e) => onChange(q.key, { value: e.target.value })}
              />
            )}
            {q.type === 'text' && (
              <input
                className="w-full rounded-lg border-2 border-foreground/20 px-3 py-2 text-sm"
                value={String((answers[q.key] as { value?: string } | undefined)?.value ?? answers[q.key] ?? '')}
                onChange={(e) => onChange(q.key, { value: e.target.value })}
              />
            )}
            {q.type === 'url' && (
              <div>
                <textarea
                  className="w-full rounded-lg border-2 border-foreground/20 px-3 py-2 text-sm"
                  rows={2}
                  inputMode="url"
                  placeholder="https://"
                  value={String((answers[q.key] as { value?: string } | undefined)?.value ?? answers[q.key] ?? '')}
                  onChange={(e) => onChange(q.key, { value: e.target.value })}
                  onBlur={(e) => onLinkBlur(q.key, e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Web links only. Add as many links as you need, one per line. Files go in the upload fields.
                </p>
                {(linkErrors[q.key] ?? []).map((err) => (
                  <p key={err} className="mt-1 text-xs text-destructive">
                    {err}
                  </p>
                ))}
                {(links[q.key] ?? []).length > 0 && (
                  <ul className="mt-1 space-y-0.5 text-xs">
                    {links[q.key].map((href) => (
                      <li key={href}>
                        Saved as a link:{' '}
                        <a href={href} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">
                          {href}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {q.type === 'select' && (
              <select
                className="w-full rounded-lg border-2 border-foreground/20 px-3 py-2 text-sm"
                value={String((answers[q.key] as { value?: string } | undefined)?.value ?? '')}
                onChange={(e) => onChange(q.key, { value: e.target.value })}
              >
                <option value="">Select</option>
                {q.options?.map((opt) => (
                  <option key={opt}>{opt}</option>
                ))}
              </select>
            )}
            {q.type === 'repeater' && (
              <Repeater
                fields={q.fields ?? []}
                value={((answers[q.key] as { items?: Record<string, string>[] } | undefined)?.items) ?? []}
                onChange={(items) => onChange(q.key, { items })}
              />
            )}
            {q.type === 'file' && (
              <div className="rounded-lg border-2 border-dashed border-foreground/20 p-3">
                <input
                  type="file"
                  multiple
                  accept={UPLOAD_ACCEPT}
                  className="block w-full max-w-full text-sm"
                  onChange={(e) => {
                    const list = e.target.files
                    if (!list?.length) return
                    void (async () => {
                      for (const file of Array.from(list)) {
                        await onUpload(q.key, file)
                      }
                      e.target.value = ''
                    })()
                  }}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Multiple files allowed. Each file needs its own description.
                </p>
                {(documents[q.key] ?? []).length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {documents[q.key].map((doc) => (
                      <li key={doc.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="break-all">{doc.originalFilename}</span>
                        {doc.canReplace ? (
                          <>
                            <label className="cursor-pointer text-accent underline">
                              Replace
                              <input
                                type="file"
                                accept={UPLOAD_ACCEPT}
                                className="sr-only"
                                onChange={(e) => {
                                  const next = e.target.files?.[0]
                                  if (next) onReplace(q.key, doc, next)
                                  e.target.value = ''
                                }}
                              />
                            </label>
                            <button type="button" className="text-destructive underline" onClick={() => onRemove(q.key, doc)}>
                              Remove
                            </button>
                          </>
                        ) : (
                          <span className="text-muted-foreground">Submitted · kept on file</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

function Repeater({
  fields,
  value,
  onChange,
}: {
  fields: { key: string; label: string; type: string }[]
  value: Record<string, string>[]
  onChange: (items: Record<string, string>[]) => void
}) {
  return (
    <div className="space-y-3">
      {value.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-md border border-foreground/10 p-3 sm:grid-cols-2">
          {fields.map((field) => (
            <label key={field.key} className="text-xs">
              {field.label}
              {field.type === 'textarea' ? (
                <textarea
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  value={item[field.key] ?? ''}
                  onChange={(e) => {
                    const next = [...value]
                    next[index] = { ...item, [field.key]: e.target.value }
                    onChange(next)
                  }}
                />
              ) : (
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  value={item[field.key] ?? ''}
                  onChange={(e) => {
                    const next = [...value]
                    next[index] = { ...item, [field.key]: e.target.value }
                    onChange(next)
                  }}
                />
              )}
            </label>
          ))}
        </div>
      ))}
      <button
        type="button"
        className="text-sm font-semibold text-accent"
        onClick={() => onChange([...value, {}])}
      >
        Add another
      </button>
    </div>
  )
}
