import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Documents live inside Candidate → Documents. */
export default async function DocumentsRedirectPage() {
  await requireAdminPage('documents:read')
  redirect('/admin/candidates')
}
