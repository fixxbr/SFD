'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

/** Only allow same-origin admin/lawyer paths; never bounce back to login. */
function safeAdminDestination(raw: string | null, fallback: string) {
  if (!raw) return fallback
  if (!(raw.startsWith('/admin') || raw.startsWith('/lawyer'))) return fallback
  if (raw.startsWith('//') || raw.includes('://')) return fallback
  if (raw === '/admin/login' || raw.startsWith('/admin/login?')) return fallback
  return raw
}

export function AdminLoginForm() {
  const params = useSearchParams()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setPending(true)
    setError('')
    const form = new FormData(e.currentTarget)
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setError(json.error ?? 'Unable to sign in.')
      setPending(false)
      return
    }
    const role = json.user?.role as string | undefined
    const defaultHome = role === 'ATTORNEY' ? '/lawyer/candidates' : '/admin'
    const dest = safeAdminDestination(params.get('next'), defaultHome)
    // Full page load so the session cookie is always sent — soft router.push races Set-Cookie
    // and can soft-redirect forever (history.replaceState flood in the browser).
    window.location.assign(dest)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-[#0C2340]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          className="w-full rounded-md border border-[#D7DEE6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0F766E]"
        />
      </div>
      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-[#0C2340]">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-md border border-[#D7DEE6] bg-white px-3 py-2 text-sm outline-none focus:border-[#0F766E]"
        />
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-[#0C2340] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#153A5F] disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  )
}
