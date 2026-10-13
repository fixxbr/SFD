'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import type { AuthUser } from '@/lib/auth'
import { AdminMobileMenuButton, AdminNav, type AdminNavItem } from '@/components/admin/admin-nav'
import { formatRole } from '@/lib/role-labels'

const LAWYER_NAV: AdminNavItem[] = [
  { href: '/lawyer/candidates', label: 'My Candidates', show: true, group: 'Lawyer Portal', icon: 'candidates' },
  { href: '/lawyer/profile', label: 'My Profile', show: true, group: 'Lawyer Portal', icon: 'team' },
]

export function LawyerShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)
  const title = pathname.startsWith('/lawyer/profile')
    ? 'My Profile'
    : pathname.includes('/candidates/')
      ? 'Candidate'
      : 'My Candidates'

  return (
    <div className="admin-app min-h-screen bg-[#EEF2F6] text-[#0C2340]">
      <div className="flex min-h-screen">
        <AdminNav user={user} items={LAWYER_NAV} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-[#E2E8F0] bg-white/95 px-4 backdrop-blur sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <AdminMobileMenuButton onClick={() => setMobileOpen(true)} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#0C2340]">{title}</p>
                <p className="hidden text-[11px] text-[#94A3B8] sm:block">Lawyer portal — assigned candidates only</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                href="/lawyer/profile"
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
          <main className="mx-auto w-full max-w-[1100px] flex-1 overflow-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  )
}
