'use client'

import { useState } from 'react'
import { Loader2, CheckCircle2, Send } from 'lucide-react'

export function ReferralForm() {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setStatus('submitting')
    setError('')
    const form = e.currentTarget
    const data = Object.fromEntries(new FormData(form).entries())
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, kind: 'referral' }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Unable to submit referral. Please try again.')
      setStatus('success')
      form.reset()
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unable to submit referral. Please email hello@afterstem.ai.')
    }
  }

  if (status === 'success') {
    return (
      <div className="paper-card sketch-radius-b flex flex-col items-center gap-4 p-10 text-center">
        <span className="sticker flex h-14 w-14 items-center justify-center -rotate-2">
          <CheckCircle2 className="h-7 w-7 text-accent" />
        </span>
        <h3 className="font-display text-2xl font-semibold text-foreground">Referral received. Thank you!</h3>
        <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground">
          We&apos;ll reach out to your referral shortly. Once their case officially begins, your $500 reward is on
          the way. Refer as many people as you like — there&apos;s no limit.
        </p>
        <button onClick={() => setStatus('idle')} className="sketch-btn sketch-btn-paper mt-2 px-5 py-2.5 text-sm">
          Refer someone else
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="paper-card sketch-radius-b p-6 sm:p-8">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="referrerName" placeholder="Jane Doe" required />
        <Field label="Your email" name="referrerEmail" type="email" placeholder="you@example.com" required />
        <Field label="Friend's name" name="friendName" placeholder="Their full name" required />
        <Field label="Friend's email" name="friendEmail" type="email" placeholder="their@email.com" required />
      </div>
      <div className="mt-5">
        <label htmlFor="note" className="mb-1.5 block text-sm font-semibold text-foreground">
          Anything we should know? <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="note"
          name="note"
          rows={4}
          placeholder="Tell us a little about your friend's background or which visa they're interested in."
          className="w-full rounded-lg border-2 border-foreground/20 bg-card px-4 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent"
        />
      </div>

      {status === 'error' && (
        <p className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
          {error || 'Unable to submit referral. Please try again or email hello@afterstem.ai.'}
        </p>
      )}

      <button
        type="submit"
        disabled={status === 'submitting'}
        className="sketch-btn sketch-btn-accent mt-6 w-full px-6 py-3 text-sm disabled:opacity-60"
      >
        {status === 'submitting' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Submitting...
          </>
        ) : (
          <>
            Submit Referral <Send className="h-4 w-4" />
          </>
        )}
      </button>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        By submitting, you agree to our{' '}
        <a href="/terms" className="underline hover:text-foreground">
          Terms &amp; Conditions
        </a>
        , including the referral program terms.
      </p>
    </form>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-semibold text-foreground">
        {label} {required && <span className="text-accent">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border-2 border-foreground/20 bg-card px-4 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground focus:border-accent"
      />
    </div>
  )
}
