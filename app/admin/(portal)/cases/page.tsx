import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Cases are managed from Candidate profiles. */
export default async function CasesRedirectPage() {
  await requireAdminPage('cases:read')
  redirect('/admin/candidates')
}
