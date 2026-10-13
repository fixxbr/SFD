import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsTicker } from '@/components/news-ticker'
import { Hero } from '@/components/hero'
import { TrustedBy } from '@/components/trusted-by'
import { StatsStrip } from '@/components/stats-strip'
import { VisaGrid } from '@/components/visa-grid'
import { ProcessSection } from '@/components/process-section'
import { WhySection } from '@/components/why-section'
import { Testimonials } from '@/components/testimonials'
import { ReferralBanner } from '@/components/referral-banner'
import { FaqSection } from '@/components/faq-section'
import { CtaSection } from '@/components/cta-section'

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NewsTicker />
      <SiteHeader />
      <main className="flex-1">
        <Hero />
        <TrustedBy />
        <StatsStrip />
        <VisaGrid />
        <ProcessSection />
        <WhySection />
        <Testimonials />
        <ReferralBanner />
        <FaqSection />
        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  )
}
