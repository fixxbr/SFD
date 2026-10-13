import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE } from '@/lib/brand'
import { getSessionUser } from '@/lib/auth'
import { LawyerShell } from '@/components/lawyer/lawyer-shell'

export const dynamic = 'force-dynamic'

export default async function LawyerPortalLayout({ children }: { children: React.ReactNode }) {
  const jar = await cookies()
  const token = jar.get(SESSION_COOKIE)?.value
  if (!token) redirect('/admin/login?next=/lawyer/candidates')
  const user = await getSessionUser()
  if (!user) redirect('/admin/login?next=/lawyer/candidates')
  if (user.role !== 'ATTORNEY') redirect('/admin')

  return <LawyerShell user={user}>{children}</LawyerShell>
}
