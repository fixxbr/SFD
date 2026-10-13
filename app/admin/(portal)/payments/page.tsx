import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Payments live inside Candidate → Payments. */
export default async function PaymentsRedirectPage() {
  await requireAdminPage('payments:read')
  redirect('/admin/candidates')
}
