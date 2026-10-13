'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const input = 'w-full rounded border border-[#D7DEE6] px-2 py-1.5 text-sm'
const btn = 'rounded border border-[#D7DEE6] px-3 py-1.5 text-xs font-medium hover:bg-[#F3F5F7]'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#143a66] disabled:opacity-50'

export function LawyerProfileForm({ fullName, email }: { fullName: string; email: string }) {
  const router = useRouter()
  const [name, setName] = useState(fullName)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    const res = await fetch('/api/admin/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: name }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) {
      setError(json.error ?? 'Unable to update profile')
      return
    }
    setMessage('Profile updated')
    router.refresh()
  }

  return (
    <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
      <label className="block text-xs font-medium text-[#5B6B7C]">
        Display name
        <input className={`${input} mt-1`} value={name} onChange={(e) => setName(e.target.value)} required />
      </label>
      <label className="block text-xs font-medium text-[#5B6B7C]">
        Email
        <input className={`${input} mt-1 bg-[#F8FAFC]`} value={email} disabled />
      </label>
      <p className="sm:col-span-2 text-[11px] text-[#94A3B8]">Role cannot be changed from this page. Contact an admin if needed.</p>
      {error && <p className="sm:col-span-2 text-sm text-red-700">{error}</p>}
      {message && <p className="sm:col-span-2 text-sm text-emerald-700">{message}</p>}
      <div className="sm:col-span-2 flex gap-2">
        <button type="submit" className={primary} disabled={busy || name.trim() === fullName}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button type="button" className={btn} onClick={() => setName(fullName)} disabled={busy}>
          Reset
        </button>
      </div>
    </form>
  )
}
