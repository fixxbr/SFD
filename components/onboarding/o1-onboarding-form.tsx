'use client'

import { useEffect, useMemo, useState } from 'react'
import { O1_CATEGORIES, type OnboardingCategory } from '@/lib/onboarding-catalog'
import { formatTime } from '@/lib/format'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function O1OnboardingForm({ token }: { token: string }) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [documents, setDocuments] = useState<Record<string, { originalFilename: string; version: number }>>({})
  const [, setStatus] = useState('DRAFT')
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/onboarding/${token}`)
      .then(async (res) => {
        const json = await res.json()
        if (!res.ok) throw new Error(json.error ?? 'Unable to open this link')
        if (cancelled) return
        setName(json.candidate.fullLegalName)
        setAnswers(json.submission.answers ?? {})
        setStatus(json.submission.status)
        setLastSavedAt(json.submission.lastSavedAt)
        const map: Record<string, { originalFilename: string; version: number }> = {}
        for (const doc of json.documents ?? []) map[doc.questionKey] = doc
        setDocuments(map)
        if (json.submission.status === 'SUBMITTED' || json.submission.status === 'ACCEPTED') setSubmitted(true)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (loading || submitted || error) return
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
  }, [answers, loading, submitted, error, token])

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
        return
      }
      const { uploadFileToApi } = await import('@/lib/client-upload')
      const json = await uploadFileToApi({
        endpoint: `/api/onboarding/${token}/upload`,
        file,
        fields: { questionKey, description: description.trim() },
        inviteToken: token,
      })
      const document = json.document as { originalFilename: string; version: number } | undefined
      if (document) setDocuments((prev) => ({ ...prev, [questionKey]: document }))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload did not complete. Please try again.')
    }
  }

  async function submit() {
    const res = await fetch(`/api/onboarding/${token}/submit`, { method: 'POST' })
    if (res.ok) {
      setSubmitted(true)
      setStatus('SUBMITTED')
    }
  }

  if (loading) return <p className="text-sm text-muted-foreground">Loading your Afterstem onboarding…</p>
  if (error) return <p className="text-sm text-destructive">{error}</p>
  if (submitted) {
    return (
      <div className="paper-card p-8">
        <h1 className="text-2xl font-medium">Onboarding submitted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Thank you, {name}. Afterstem has stored your answers and documents. You can return to this private link if we request more information.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="eyebrow">O-1 onboarding</p>
        <h1 className="mt-2 text-3xl font-medium">Welcome, {name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your answers and files save to Afterstem automatically. This link is unique to your case.
        </p>
        <p className="mt-2 text-xs font-medium text-accent">{saveLabel}</p>
      </div>
      {O1_CATEGORIES.map((category) => (
        <Section
          key={category.id}
          category={category}
          answers={answers}
          documents={documents}
          onChange={(key, value) => setAnswers((prev) => ({ ...prev, [key]: value }))}
          onUpload={upload}
        />
      ))}
      <button type="button" onClick={submit} className="sketch-btn sketch-btn-accent px-6 py-3 text-sm">
        Submit onboarding
      </button>
    </div>
  )
}

function Section({
  category,
  answers,
  documents,
  onChange,
  onUpload,
}: {
  category: OnboardingCategory
  answers: Record<string, unknown>
  documents: Record<string, { originalFilename: string; version: number }>
  onChange: (key: string, value: unknown) => void
  onUpload: (key: string, file: File) => void
}) {
  return (
    <section className="paper-card p-5 sm:p-6">
      <h2 className="font-display text-2xl font-semibold">{category.folderTitle}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
      <div className="mt-4 space-y-4">
        {category.questions.map((q) => (
          <div key={q.key}>
            <label className="mb-1 block text-sm font-semibold">{q.label}</label>
            {q.type === 'textarea' && (
              <textarea
                className="w-full rounded-lg border-2 border-foreground/20 px-3 py-2 text-sm"
                rows={4}
                value={String((answers[q.key] as { value?: string } | undefined)?.value ?? answers[q.key] ?? '')}
                onChange={(e) => onChange(q.key, { value: e.target.value })}
              />
            )}
            {(q.type === 'text' || q.type === 'url') && (
              <input
                className="w-full rounded-lg border-2 border-foreground/20 px-3 py-2 text-sm"
                value={String((answers[q.key] as { value?: string } | undefined)?.value ?? answers[q.key] ?? '')}
                onChange={(e) => onChange(q.key, { value: e.target.value })}
              />
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
                {documents[q.key] && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Latest uploaded: {documents[q.key].originalFilename} (version {documents[q.key].version})
                  </p>
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
