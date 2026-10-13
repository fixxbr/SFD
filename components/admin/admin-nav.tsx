'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  Activity,
  Briefcase,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  Settings,
  Users,
  Wallet,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AuthUser } from '@/lib/auth'

export type AdminNavItem = {
  href: string
  label: string
  show: boolean
  group?: string
  icon?: 'dashboard' | 'candidates' | 'cases' | 'documents' | 'payments' | 'onboarding' | 'activity' | 'team' | 'settings' | 'mail'
}

const ICONS = {
  dashboard: LayoutDashboard,
  candidates: Users,
  cases: Briefcase,
  documents: FileText,
  payments: Wallet,
  onboarding: FileText,
  activity: Activity,
  team: Users,
  settings: Settings,
  mail: Mail,
}

function iconFor(item: AdminNavItem) {
  if (item.icon && ICONS[item.icon]) return ICONS[item.icon]
  if (item.href === '/admin') return LayoutDashboard
  if (item.href.includes('candidates')) return Users
  if (item.href.includes('cases')) return Briefcase
  if (item.href.includes('documents')) return FileText
  if (item.href.includes('payments')) return Wallet
  if (item.href.includes('activity')) return Activity
  if (item.href.includes('team')) return Users
  if (item.href.includes('templates')) return Mail
  if (item.href.includes('settings') || item.href.includes('visa')) return Settings
  if (item.href.includes('onboarding')) return FileText
  return LayoutDashboard
}

function isActive(pathname: string, href: string) {
  if (href === '/admin' || href === '/lawyer') return pathname === href
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AdminNav({
  user,
  items,
  mobileOpen,
  onMobileClose,
}: {
  user: AuthUser
  items: AdminNavItem[]
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const pathname = usePathname()

  const groups = useMemo(() => {
    const map = new Map<string, AdminNavItem[]>()
    for (const item of items) {
      if (!item.show) continue
      const key = item.group || 'Main'
      const list = map.get(key) ?? []
      list.push(item)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [items])

  // Only tracks user toggles; active route groups always stay open.
  const [collapsedByUser, setCollapsedByUser] = useState<Record<string, boolean>>({})

  function isGroupExpanded(name: string, groupItems: AdminNavItem[]) {
    if (groupItems.some((item) => isActive(pathname, item.href))) return true
    return !collapsedByUser[name]
  }

  async function signOut() {
    await fetch('/api/admin/logout', { method: 'POST' })
    // Hard navigation so the cleared session cookie is applied immediately.
    window.location.assign('/admin/login')
  }

  const navBody = (
    <>
      <div className="border-b border-white/10 px-4 py-4">
        <Link href={pathname.startsWith('/lawyer') ? '/lawyer/candidates' : '/admin'} className="block" onClick={onMobileClose}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#5EEAD4]">Afterstem</p>
          <p className="mt-0.5 text-base font-semibold text-white">
            {pathname.startsWith('/lawyer') ? 'Lawyer Portal' : 'Admin'}
          </p>
        </Link>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-4">
        {groups.map(([name, groupItems]) => {
          const expanded = isGroupExpanded(name, groupItems)
          return (
            <div key={name}>
              {name !== 'Main' && name !== 'Overview' ? (
                <button
                  type="button"
                  className="mb-1 flex w-full items-center justify-between px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40 hover:text-white/70"
                  onClick={() =>
                    setCollapsedByUser((s) => ({
                      ...s,
                      [name]: expanded,
                    }))
                  }
                >
                  {name}
                  <ChevronDown className={cn('h-3.5 w-3.5 transition', expanded ? 'rotate-0' : '-rotate-90')} />
                </button>
              ) : null}
              {expanded && (
                <div className="space-y-0.5">
                  {groupItems.map((item) => {
                    const Icon = iconFor(item)
                    const active = isActive(pathname, item.href)
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={item.label}
                        onClick={onMobileClose}
                        className={cn(
                          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition',
                          active
                            ? 'bg-[#0F766E] font-medium text-white shadow-sm'
                            : 'text-white/70 hover:bg-white/10 hover:text-white',
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0 opacity-90" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <p className="truncate text-xs font-medium text-white">{user.fullName}</p>
        <p className="truncate text-[11px] text-white/50">{user.email}</p>
        <button
          type="button"
          onClick={signOut}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-[#5EEAD4] hover:underline"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop */}
      <aside className="hidden w-[240px] shrink-0 flex-col bg-[#0C2340] text-white lg:flex">{navBody}</aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={onMobileClose} />
          <aside className="absolute inset-y-0 left-0 flex w-[260px] flex-col bg-[#0C2340] text-white shadow-xl">
            <button
              type="button"
              className="absolute right-3 top-3 rounded-md p-1 text-white/70 hover:bg-white/10"
              onClick={onMobileClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
            {navBody}
          </aside>
        </div>
      )}
    </>
  )
}

export function AdminMobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2E8F0] bg-white text-[#0C2340] lg:hidden"
      aria-label="Open navigation"
    >
      <Menu className="h-4 w-4" />
    </button>
  )
}
