'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, Send } from 'lucide-react'
import { visas } from '@/lib/visas'

type Status = 'idle' | 'submitting' | 'success' | 'error'

export function ContactForm() {
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setError('')

    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? 'Submission failed.')
      }
      setStatus('success')
      form.reset()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    }
  }

  if (status === 'success') {
    return (
      <div className="paper-card sketch-radius-a flex flex-col items-center p-10 text-center">
        <span className="sticker flex h-14 w-14 items-center justify-center rotate-2">
          <CheckCircle2 className="h-7 w-7 text-accent" />
        </span>
        <h3 className="mt-5 font-display text-2xl font-semibold text-foreground">Request received</h3>
        <p className="mt-2 max-w-sm text-sm text-muted-foreground">
          Your assessment is saved to your permanent Afterstem profile. Our team will review it and reach out within
          1–2 business days.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="paper-card sketch-radius-a p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-1">
          <label htmlFor="name" className="mb-1.5 block text-sm font-semibold text-foreground">
            Full name
          </label>
          <input
            id="name"
            name="name"
            required
            minLength={2}
            className="w-full rounded-lg border-2 border-foreground/20 bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            placeholder="Your name"
          />
        </div>
        <div className="sm:col-span-1">
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-lg border-2 border-foreground/20 bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            placeholder="you@email.com"
          />
        </div>
        <div>
          <label htmlFor="phone" className="mb-1.5 block text-sm font-semibold text-foreground">
            Phone <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="phone"
            name="phone"
            className="w-full rounded-lg border-2 border-foreground/20 bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            placeholder="+1…"
          />
        </div>
        <div>
          <label htmlFor="currentStatus" className="mb-1.5 block text-sm font-semibold text-foreground">
            Current status <span className="text-muted-foreground">(optional)</span>
          </label>
          <input
            id="currentStatus"
            name="currentStatus"
            className="w-full rounded-lg border-2 border-foreground/20 bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            placeholder="F-1, H-1B, OPT…"
          />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="visa" className="mb-1.5 block text-sm font-semibold text-foreground">
            Which pathway are you interested in?
          </label>
          <select
            id="visa"
            name="visa"
            defaultValue=""
            className="w-full rounded-lg border-2 border-foreground/20 bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
          >
            <option value="" disabled>
              Select an option
            </option>
            {visas.map((v) => (
              <option key={v.slug} value={v.code}>
                {v.code} — {v.name.replace(v.code, '').trim()}
              </option>
            ))}
            <option value="Day-1 CPT">Day-1 CPT Programs</option>
            <option value="Not sure">Not sure — help me decide</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="message" className="mb-1.5 block text-sm font-semibold text-foreground">
            Tell us about your background <span className="text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            className="w-full resize-none rounded-lg border-2 border-foreground/20 bg-card px-3.5 py-2.5 text-sm text-foreground outline-none transition focus:border-accent"
            placeholder="Degrees, publications, awards, current status, goals…"
          />
        </div>
      </div>

      {status === 'error' && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="sketch-btn sketch-btn-accent mt-6 w-full px-6 py-3 text-sm disabled:opacity-60 sm:w-auto"
      >
        {status === 'submitting' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" />
            Request Free Assessment
          </>
        )}
      </button>
      <p className="mt-3 text-xs text-muted-foreground">
        We respect your privacy. Your information is used only to prepare your assessment.
      </p>
    </form>
  )
}
