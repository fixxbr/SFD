import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { O1OnboardingForm } from '@/components/onboarding/o1-onboarding-form'

export const metadata = { title: 'O-1 onboarding | Afterstem' }

export default async function OnboardingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <O1OnboardingForm token={token} />
      </main>
      <SiteFooter />
    </div>
  )
}
