'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

const btn = 'rounded border border-[#D7DEE6] px-3 py-1.5 text-xs hover:bg-[#F3F5F7]'
const primary = 'rounded bg-[#0C2340] px-3 py-1.5 text-xs font-medium text-white'

export function DataPortabilityBar({ candidateId }: { candidateId?: string }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function exportUrl() {
    const q = candidateId ? `?candidateId=${candidateId}` : ''
    return `/api/admin/data${q}`
  }

  async function onImport(file: File) {
    setBusy(true)
    setMessage('')
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      const res = await fetch('/api/admin/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(json),
      })
      const body = await res.json()
      if (!res.ok) {
        alert(body.error ?? 'Import failed')
        return
      }
      setMessage(`Imported ${body.createdCount} new · reused ${body.reusedCount}`)
      router.refresh()
    } catch {
      alert('Invalid JSON file')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-[#5B6B7C]">Data</span>
      <a className={primary} href={exportUrl()} download>
        Export {candidateId ? 'candidate' : 'all'} JSON
      </a>
      <button type="button" className={btn} disabled={busy} onClick={() => fileRef.current?.click()}>
        Import JSON
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void onImport(file)
          e.currentTarget.value = ''
        }}
      />
      {message && <span className="text-xs text-emerald-700">{message}</span>}
    </div>
  )
}
