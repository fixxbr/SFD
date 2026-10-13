'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { AdminRole, AdminStatus } from '@prisma/client'
import { TeamForm } from '@/components/admin/team-form'
import { formatDateTime } from '@/lib/format'
import { isLawyerRole } from '@/lib/staff-options'

type Member = {
  id: string
  fullName: string
  email: string
  role: string
  status: string
  lastLoginAt: Date | string | null
}

const ROLES: AdminRole[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'CASE_MANAGER',
  'ATTORNEY',
  'FINANCE',
  'READ_ONLY',
]

function roleLabel(role: string) {
  return role.replaceAll('_', ' ')
}

function MemberTable({
  title,
  subtitle,
  users,
  canWrite,
  canDelete,
  canResetPassword,
  actorRole,
  actorId,
}: {
  title: string
  subtitle: string
  users: Member[]
  canWrite: boolean
  canDelete: boolean
  canResetPassword: boolean
  actorRole: AdminRole
  actorId: string
}) {
  const router = useRouter()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [editing, setEditing] = useState<Member | null>(null)
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [editRole, setEditRole] = useState<AdminRole>('CASE_MANAGER')
  const [editStatus, setEditStatus] = useState<AdminStatus>('ACTIVE')
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [confirmEmail, setConfirmEmail] = useState('')
  const [message, setMessage] = useState('')
  const [passwordTarget, setPasswordTarget] = useState<Member | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordMode, setPasswordMode] = useState<'direct' | 'generate'>('direct')
  const [passwordResult, setPasswordResult] = useState('')

  const roleOptions = useMemo(
    () => (actorRole === 'SUPER_ADMIN' ? ROLES : ROLES.filter((r) => r !== 'SUPER_ADMIN')),
    [actorRole],
  )

  async function patch(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/team', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error ?? 'Update failed')
    return json
  }

  function openEdit(m: Member) {
    setEditing(m)
    setEditName(m.fullName)
    setEditEmail(m.email)
    setEditRole(m.role as AdminRole)
    setEditStatus(m.status as AdminStatus)
    setMessage('')
  }

  function openPasswordReset(m: Member) {
    setPasswordTarget(m)
    setNewPassword('')
    setConfirmPassword('')
    setPasswordMode('direct')
    setPasswordResult('')
    setMessage('')
  }

  async function saveEdit() {
    if (!editing) return
    setBusyId(editing.id)
    setMessage('')
    try {
      await patch({
        id: editing.id,
        fullName: editName,
        email: editEmail,
        role: editRole,
        status: editStatus,
      })
      setEditing(null)
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Unable to save')
    } finally {
      setBusyId(null)
    }
  }

  async function savePasswordReset() {
    if (!passwordTarget || !canResetPassword) return
    if (passwordMode === 'direct') {
      if (newPassword.length < 10) {
        setMessage('Password must be at least 10 characters.')
        return
      }
      if (newPassword !== confirmPassword) {
        setMessage('Passwords do not match.')
        return
      }
    }
    setBusyId(passwordTarget.id)
    setMessage('')
    try {
      const json = await patch({
        id: passwordTarget.id,
        resetPassword: true,
        ...(passwordMode === 'direct' ? { newPassword } : {}),
      })
      const shown = json.temporaryPassword || newPassword
      setPasswordResult(shown)
      setMessage(
        passwordMode === 'direct'
          ? `Password saved for ${passwordTarget.fullName}. Share it securely — it is only shown once.`
          : `Temporary password generated for ${passwordTarget.fullName}. Share it securely — it is only shown once.`,
      )
      router.refresh()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Unable to reset password')
    } finally {
      setBusyId(null)
    }
  }

  async function setStatus(m: Member, status: AdminStatus) {
    const label = status === 'ACTIVE' ? 'Activate' : 'Disable'
    if (!confirm(`${label} ${m.fullName}?`)) return
    setBusyId(m.id)
    try {
      await patch({ id: m.id, status })
      router.refresh()
    } catch (e) {
      alert(e instanceof Error ? e.message : `Unable to ${label.toLowerCase()}`)
    } finally {
      setBusyId(null)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      const res = await fetch('/api/admin/team', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: deleteTarget.id, confirmEmail }),
      })
      const json = await res.json()
      if (!res.ok) {
        alert(json.error ?? 'Unable to delete')
        return
      }
      setMessage(
        json.disabled
          ? `${deleteTarget.fullName} has history and was disabled instead of deleted.`
          : `${deleteTarget.fullName} deleted.`,
      )
      setDeleteTarget(null)
      setConfirmEmail('')
      router.refresh()
    } catch {
      alert('Unable to delete')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-lg font-semibold text-[#0C2340]">{title}</h2>
        <p className="text-sm text-[#5B6B7C]">{subtitle}</p>
      </div>
      {message && <p className="text-sm text-emerald-700">{message}</p>}
      <div className="overflow-x-auto rounded-lg border border-[#D7DEE6] bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#F3F5F7] text-xs uppercase text-[#5B6B7C]">
            <tr>
              {['Name', 'Email', 'Role', 'Status', 'Last login', ...(canWrite || canDelete ? ['Actions'] : [])].map(
                (h) => (
                  <th key={h} className="px-3 py-2">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {users.map((item) => {
              const busy = busyId === item.id
              const isSelf = item.id === actorId
              return (
                <tr key={item.id} className="border-t">
                  <td className="px-3 py-2 font-medium">{item.fullName}</td>
                  <td className="px-3 py-2">{item.email}</td>
                  <td className="px-3 py-2">{roleLabel(item.role)}</td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        item.status === 'ACTIVE' ? 'text-emerald-700' : 'text-[#5B6B7C]'
                      }
                    >
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-2">{formatDateTime(item.lastLoginAt)}</td>
                  {(canWrite || canDelete) && (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {canWrite && (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              className="rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7] disabled:opacity-60"
                              onClick={() => openEdit(item)}
                            >
                              Edit
                            </button>
                            {canResetPassword && (
                              <button
                                type="button"
                                disabled={busy}
                                className="rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7] disabled:opacity-60"
                                onClick={() => openPasswordReset(item)}
                              >
                                Reset password
                              </button>
                            )}
                            {item.status === 'ACTIVE' ? (
                              <button
                                type="button"
                                disabled={busy || isSelf}
                                className="rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7] disabled:opacity-60"
                                onClick={() => void setStatus(item, 'DISABLED')}
                              >
                                Disable
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={busy}
                                className="rounded border border-[#D7DEE6] px-2 py-1 text-xs hover:bg-[#F3F5F7] disabled:opacity-60"
                                onClick={() => void setStatus(item, 'ACTIVE')}
                              >
                                Activate
                              </button>
                            )}
                          </>
                        )}
                        {canDelete && !isSelf && (
                          <button
                            type="button"
                            disabled={busy}
                            className="rounded border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                            onClick={() => {
                              setDeleteTarget(item)
                              setConfirmEmail('')
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={canWrite || canDelete ? 6 : 5} className="px-3 py-6 text-center text-[#5B6B7C]">
                  None yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-[#0C2340]">Edit team member</h3>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Name"
            />
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              type="email"
              value={editEmail}
              onChange={(e) => setEditEmail(e.target.value)}
              placeholder="Email"
            />
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={editRole}
              onChange={(e) => setEditRole(e.target.value as AdminRole)}
            >
              {roleOptions.map((r) => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
              {editRole === 'SUPER_ADMIN' && actorRole !== 'SUPER_ADMIN' && (
                <option value="SUPER_ADMIN">SUPER ADMIN</option>
              )}
            </select>
            <select
              className="w-full rounded border px-3 py-2 text-sm"
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as AdminStatus)}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="DISABLED">DISABLED</option>
            </select>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-[#D7DEE6] px-3 py-2 text-sm"
                onClick={() => setEditing(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === editing.id}
                className="rounded bg-[#0C2340] px-3 py-2 text-sm text-white disabled:opacity-60"
                onClick={() => void saveEdit()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-[#0C2340]">Reset password</h3>
            <p className="text-sm text-[#5B6B7C]">
              Super Admin only. Set a password for{' '}
              <span className="font-medium text-[#0C2340]">{passwordTarget.fullName}</span> (
              {passwordTarget.email}). Existing sessions will be signed out.
            </p>
            <div className="flex gap-2 text-xs">
              <button
                type="button"
                className={`rounded px-2 py-1 ${passwordMode === 'direct' ? 'bg-[#0C2340] text-white' : 'border border-[#D7DEE6]'}`}
                onClick={() => {
                  setPasswordMode('direct')
                  setPasswordResult('')
                  setMessage('')
                }}
              >
                Set password
              </button>
              <button
                type="button"
                className={`rounded px-2 py-1 ${passwordMode === 'generate' ? 'bg-[#0C2340] text-white' : 'border border-[#D7DEE6]'}`}
                onClick={() => {
                  setPasswordMode('generate')
                  setPasswordResult('')
                  setMessage('')
                }}
              >
                Generate temporary
              </button>
            </div>
            {passwordMode === 'direct' && !passwordResult && (
              <>
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 10 characters)"
                />
                <input
                  className="w-full rounded border px-3 py-2 text-sm"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm password"
                />
              </>
            )}
            {passwordResult && (
              <div className="rounded-lg border border-[#D7DEE6] bg-[#F8FAFC] px-3 py-2">
                <p className="text-xs font-medium text-[#5B6B7C]">Password (copy now)</p>
                <p className="mt-1 break-all font-mono text-sm text-[#0C2340]">{passwordResult}</p>
              </div>
            )}
            {message && <p className="text-sm text-[#0C2340]">{message}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-[#D7DEE6] px-3 py-2 text-sm"
                onClick={() => {
                  setPasswordTarget(null)
                  setNewPassword('')
                  setConfirmPassword('')
                  setPasswordResult('')
                  setMessage('')
                }}
              >
                {passwordResult ? 'Done' : 'Cancel'}
              </button>
              {!passwordResult && (
                <button
                  type="button"
                  disabled={busyId === passwordTarget.id}
                  className="rounded bg-[#0C2340] px-3 py-2 text-sm text-white disabled:opacity-60"
                  onClick={() => void savePasswordReset()}
                >
                  {passwordMode === 'direct' ? 'Save password' : 'Generate & save'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md space-y-3 rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-[#0C2340]">Confirm delete</h3>
            <p className="text-sm text-[#5B6B7C]">
              Type <span className="font-medium text-[#0C2340]">{deleteTarget.email}</span> to confirm
              deleting {deleteTarget.fullName}. Members with history are disabled instead.
            </p>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              type="email"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder="Confirm email"
              autoFocus
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-[#D7DEE6] px-3 py-2 text-sm"
                onClick={() => {
                  setDeleteTarget(null)
                  setConfirmEmail('')
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === deleteTarget.id || !confirmEmail.trim()}
                className="rounded bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-60"
                onClick={() => void confirmDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export function TeamManager({
  users,
  canWrite,
  canDelete,
  actorRole,
  actorId,
}: {
  users: Member[]
  canWrite: boolean
  canDelete: boolean
  actorRole: AdminRole
  actorId: string
}) {
  const lawyers = users.filter((u) => isLawyerRole(u.role))
  const referrals = users.filter((u) => !isLawyerRole(u.role))
  const canResetPassword = actorRole === 'SUPER_ADMIN'

  return (
    <div className="space-y-8">
      {canWrite && (
        <div id="add-member" className="space-y-4 scroll-mt-24">
          <TeamForm kind="team" actorRole={actorRole} />
          <div className="grid gap-4 lg:grid-cols-2">
            <TeamForm kind="lawyer" actorRole={actorRole} />
            <TeamForm kind="referral" actorRole={actorRole} />
          </div>
        </div>
      )}

      <MemberTable
        title="Lawyers"
        subtitle="Shown only in the Assigned Lawyer field on candidates. Includes ACTIVE and DISABLED."
        users={lawyers}
        canWrite={canWrite}
        canDelete={canDelete}
        canResetPassword={canResetPassword}
        actorRole={actorRole}
        actorId={actorId}
      />

      <MemberTable
        title="Referral / team names"
        subtitle="Shown only in the Referred By field on candidates. Includes ACTIVE and DISABLED."
        users={referrals}
        canWrite={canWrite}
        canDelete={canDelete}
        canResetPassword={canResetPassword}
        actorRole={actorRole}
        actorId={actorId}
      />
    </div>
  )
}
