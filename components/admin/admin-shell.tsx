'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import type { AuthUser } from '@/lib/auth'
import { can, type Permission } from '@/lib/rbac'
import { formatRole } from '@/lib/role-labels'
import { AdminMobileMenuButton, AdminNav, type AdminNavItem } from '@/components/admin/admin-nav'

function titleFromPath(pathname: string) {
  if (pathname === '/admin') return 'Dashboard'
  if (pathname.startsWith('/admin/candidates')) return 'Candidates'
  if (pathname.startsWith('/admin/cases')) return 'Cases'
  if (pathname.startsWith('/admin/documents')) return 'Documents'
  if (pathname.startsWith('/admin/onboarding')) return 'Onboarding'
  if (pathname.startsWith('/admin/payments')) return 'Payments'
  if (pathname.startsWith('/admin/profile')) return 'My Profile'
  if (pathname.startsWith('/admin/communications')) return 'Communications'
  if (pathname.startsWith('/admin/activity')) return 'Activity'
  if (pathname.startsWith('/admin/reports')) return 'Reports'
  if (pathname.startsWith('/admin/team')) return 'Team'
  if (pathname.startsWith('/admin/settings/templates')) return 'Email Templates'
  if (pathname.startsWith('/admin/settings/visa-templates')) return 'Visa Templates'
  if (pathname.startsWith('/admin/settings')) return 'Settings'
  return 'Admin'
}

export function AdminShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const show = (permission: Permission) => can(user.role, permission)

  const items: AdminNavItem[] = useMemo(() => {
    return [
      { href: '/admin', label: 'Dashboard', show: show('dashboard:read'), group: 'Overview', icon: 'dashboard' },
      { href: '/admin/candidates', label: 'Candidates', show: show('candidates:read'), group: 'Candidate Management', icon: 'candidates' },
      { href: '/admin/cases', label: 'Cases', show: show('cases:read'), group: 'Candidate Management', icon: 'cases' },
      { href: '/admin/documents', label: 'Documents', show: show('documents:read'), group: 'Candidate Management', icon: 'documents' },
      { href: '/admin/onboarding', label: 'Onboarding', show: show('onboarding:read'), group: 'Candidate Management', icon: 'onboarding' },
      { href: '/admin/payments', label: 'Payments', show: show('payments:read'), group: 'Finance', icon: 'payments' },
      { href: '/admin/communications', label: 'Communications', show: show('communications:read'), group: 'Communication', icon: 'mail' },
      { href: '/admin/team', label: 'Team', show: show('team:read'), group: 'Team', icon: 'team' },
      { href: '/admin/activity', label: 'Activity', show: show('activity:read'), group: 'System', icon: 'activity' },
      { href: '/admin/reports', label: 'Reports', show: show('dashboard:read'), group: 'System', icon: 'activity' },
      { href: '/admin/settings', label: 'Settings', show: show('settings:read'), group: 'System', icon: 'settings' },
      { href: '/admin/profile', label: 'My Profile', show: true, group: 'System', icon: 'team' },
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps -- role/permissions from user snapshot
  }, [user.role])

  return (
    <div className="admin-app min-h-screen bg-[#EEF2F6] text-[#0C2340]">
      <div className="flex min-h-screen">
        <AdminNav user={user} items={items} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white/95 px-4 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <AdminMobileMenuButton onClick={() => setMobileOpen(true)} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0C2340]">{titleFromPath(pathname)}</p>
                <p className="hidden text-[11px] text-[#94A3B8] sm:block">Afterstem operations</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              {can(user.role, 'candidates:write') && (
                <Link
                  href="/admin/candidates?create=1"
                  className="hidden h-9 items-center rounded-lg bg-[#0C2340] px-3 text-xs font-semibold text-white hover:bg-[#143a66] sm:inline-flex"
                >
                  + Add Candidate
                </Link>
              )}
              <Link
                href="/admin/profile"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0C2340] text-xs font-semibold text-white"
                title="My Profile"
              >
                {user.fullName
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((p) => p[0]?.toUpperCase() ?? '')
                  .join('')}
              </Link>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-[#0C2340]">{user.fullName}</p>
                <p className="text-[10px] uppercase tracking-wide text-[#94A3B8]">{formatRole(user.role)}</p>
              </div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1400px] flex-1 overflow-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
