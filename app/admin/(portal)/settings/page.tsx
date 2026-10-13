import Link from 'next/link'
import { requireAdminPage } from '@/lib/auth'
import { storageConfigured, storageProviderName } from '@/lib/storage'
import { appUrl, brandDomainServesApp } from '@/lib/http'
import { CLIENT_FROM_EMAIL } from '@/lib/brand'
import { PageHeader, SectionCard } from '@/components/admin/ui'
import { admin } from '@/lib/admin/ui'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  await requireAdminPage('settings:read')
  const rows = [
    ['Database', process.env.DATABASE_URL ? 'Neon DATABASE_URL configured' : 'Missing DATABASE_URL'],
    ['Storage', storageConfigured() ? `Private ${storageProviderName()} (Neon BYTEA)` : 'Object storage not configured'],
    ['Email from', process.env.EMAIL_FROM || CLIENT_FROM_EMAIL],
    ['Resend', process.env.RESEND_API_KEY ? 'Configured' : 'Optional — emails log only until set'],
    ['App URL', appUrl()],
    ['Brand domain cutover', brandDomainServesApp() ? 'afterstem.ai serves this app' : 'Using Netlify host until DNS cutover'],
    ['Payments', 'Manual recording only (Stripe disabled)'],
  ]
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Settings"
        description="System configuration and templates. Secrets are never displayed."
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Settings' }]}
      />

      <SectionCard title="Templates & configuration">
        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/admin/settings/templates" className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 hover:border-[#0F766E]/40">
            <p className="text-sm font-semibold text-[#0C2340]">Email Templates</p>
            <p className="mt-1 text-xs text-[#64748B]">Preview Welcome, document, and payment emails</p>
          </Link>
          <Link href="/admin/settings/visa-templates" className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 hover:border-[#0F766E]/40">
            <p className="text-sm font-semibold text-[#0C2340]">Visa Document Templates</p>
            <p className="mt-1 text-xs text-[#64748B]">Configure document request presets by visa type</p>
          </Link>
          <Link href="/admin/team" className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3 hover:border-[#0F766E]/40">
            <p className="text-sm font-semibold text-[#0C2340]">Team</p>
            <p className="mt-1 text-xs text-[#64748B]">Members, roles, and access</p>
          </Link>
          <Link href="/admin" className={admin.btnSecondary + ' justify-center'}>
            Open Dashboard
          </Link>
        </div>
      </SectionCard>

      <SectionCard title="Integrations & environment">
        <div className="divide-y divide-[#F1F5F9]">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
              <span className="font-medium text-[#0C2340]">{label}</span>
              <span className="text-right text-[#64748B]">{value}</span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#94A3B8]">
          Create the first super admin with <code>pnpm create-super-admin</code>.
        </p>
      </SectionCard>
    </div>
  )
}
