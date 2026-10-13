import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** Onboarding is managed from Candidate profiles. */
export default async function OnboardingRedirectPage() {
  await requireAdminPage('onboarding:read')
  redirect('/admin/candidates')
}
