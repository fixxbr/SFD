'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { AdminRole, AdminStatus } from '@prisma/client'
import { TEAM_CREATE_ROLES, formatRole } from '@/lib/role-labels'

type Kind = 'lawyer' | 'referral' | 'team'

export function TeamForm({
  kind,
  actorRole = 'ADMIN',
}: {
  kind: Kind
  actorRole?: AdminRole
}) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const isLawyer = kind === 'lawyer'
  const isTeam = kind === 'team'
  const isReferral = kind === 'referral'

  const roleOptions = useMemo(
    () =>
      (actorRole === 'SUPER_ADMIN' ? TEAM_CREATE_ROLES : TEAM_CREATE_ROLES.filter((r) => r !== 'SUPER_ADMIN')),
    [actorRole],
  )

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setBusy(true)
    setMessage('')
    const form = e.currentTarget
    const fd = new FormData(form)
    const raw = Object.fromEntries(fd.entries()) as Record<string, string>
    const sendInvite = fd.get('sendInvite') === 'on'

    const body: Record<string, unknown> = {
      fullName: raw.fullName,
      email: raw.email || undefined,
      password: raw.password || undefined,
      phone: raw.phone || undefined,
      kind,
      sendInvite,
    }
    if (isTeam || isReferral) {
      if (raw.role) body.role = raw.role
      if (raw.status) body.status = raw.status
    }
    if (isTeam && raw.status) body.status = raw.status as AdminStatus

    const res = await fetch('/api/admin/team', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    setBusy(false)
    if (!res.ok) {
      alert(json.error ?? 'Unable to add')
      return
    }
    form.reset()
    const where = isLawyer
      ? 'Lawyer dropdowns on candidates'
      : isReferral
        ? 'Referred By dropdowns on candidates'
        : 'the team'
    const temp = json.temporaryPassword ? ` Temporary password: ${json.temporaryPassword}` : ''
    const invite =
      json.inviteStatus === 'SENT'
        ? ' Invitation email sent.'
        : json.inviteStatus === 'FAILED'
          ? ' Invitation email failed to send.'
          : json.inviteStatus === 'LOGGED'
            ? ' Invitation logged (email provider not configured).'
            : ''
    setMessage(`${json.user.fullName} added to ${where}.${temp}${invite}`)
    router.refresh()
  }

  const title = isLawyer ? 'Add Lawyer' : isReferral ? 'Add referral name' : 'Add Team Member'
  const help = isLawyer
    ? 'Creates a Lawyer portal account. They only see candidates assigned to them.'
    : isReferral
      ? 'Referral / team names only appear under Referred By — not under Lawyer.'
      : 'Roles: Super Admin, Admin, Lawyer, Staff, Read Only. Super Admin can only be assigned by a Super Admin.'

  return (
    <div className="space-y-2 rounded-lg border border-[#D7DEE6] bg-white p-4">
      <div>
        <h2 className="text-sm font-semibold text-[#0C2340]">{title}</h2>
        <p className="mt-1 text-xs text-[#5B6B7C]">{help}</p>
      </div>
      <form
        onSubmit={onSubmit}
        className={`grid gap-2 ${isTeam ? 'md:grid-cols-3' : isLawyer ? 'md:grid-cols-4' : 'md:grid-cols-3'}`}
      >
        <input
          name="fullName"
          required
          placeholder={isLawyer ? 'Lawyer full name' : isTeam ? 'Full name' : 'Referral / team name'}
          className="rounded border px-3 py-2 text-sm"
        />
        <input
          name="email"
          type="email"
          required={isLawyer || isTeam}
          placeholder={isLawyer ? 'Lawyer email' : isTeam ? 'Email' : 'Email (optional)'}
          className="rounded border px-3 py-2 text-sm"
        />
        {(isLawyer || isTeam) && (
          <input name="phone" placeholder="Phone (optional)" className="rounded border px-3 py-2 text-sm" />
        )}
        {isTeam && (
          <>
            <select name="role" defaultValue="CASE_MANAGER" className="rounded border px-3 py-2 text-sm">
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {formatRole(r)}
                </option>
              ))}
            </select>
            <select name="status" defaultValue="ACTIVE" className="rounded border px-3 py-2 text-sm">
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
            </select>
          </>
        )}
        {isLawyer && (
          <input
            name="password"
            type="password"
            minLength={10}
            placeholder="Password (optional)"
            className="rounded border px-3 py-2 text-sm"
          />
        )}
        {(isTeam || isLawyer) && (
          <label className="flex items-center gap-2 text-sm text-[#0C2340] md:col-span-1">
            <input name="sendInvite" type="checkbox" className="rounded border" />
            Send invitation email
          </label>
        )}
        <button disabled={busy} className="rounded bg-[#0C2340] px-3 py-2 text-sm text-white disabled:opacity-60">
          {busy ? 'Adding…' : title}
        </button>
      </form>
      {message && <p className="text-sm text-emerald-700">{message}</p>}
    </div>
  )
}
