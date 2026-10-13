import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE } from '@/lib/brand'
import { getSessionUser } from '@/lib/auth'
import { AdminShell } from '@/components/admin/admin-shell'

export const dynamic = 'force-dynamic'

export default async function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) redirect('/admin/login')
  const user = await getSessionUser()
  if (!user) redirect('/admin/login')
  if (user.role === 'ATTORNEY') redirect('/lawyer/candidates')

  return <AdminShell user={user}>{children}</AdminShell>
}
