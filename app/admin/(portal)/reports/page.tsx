import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Reports live on the Dashboard. */
export default async function ReportsRedirectPage() {
  await requireAdminPage('dashboard:read')
  redirect('/admin')
}
