import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CheckCircle2, Clock, Sparkles, Users2, ArrowLeft, Star, Gauge, Zap } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsTicker } from '@/components/news-ticker'
import { CtaSection } from '@/components/cta-section'
import { VisaJourney } from '@/components/visa-journey'
import { Reveal } from '@/components/reveal'
import { visas, getVisa } from '@/lib/visas'

export function generateStaticParams() {
  return visas.map((v) => ({ slug: v.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const visa = getVisa(slug)
  if (!visa) return { title: 'Visa Not Found | Afterstem.ai' }
  return {
    title: `${visa.name} | Afterstem.ai`,
    description: visa.summary,
  }
}

export default async function VisaPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const visa = getVisa(slug)
  if (!visa) notFound()

  return (
    <div className="flex min-h-screen flex-col">
      <NewsTicker />
      <SiteHeader />
      <main className="flex-1">
        <section className="chalk-section border-b-2 border-foreground/90">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <Link
              href="/#services"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-foreground/70 transition-colors hover:text-primary-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              All visa services
            </Link>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <span className="rounded-full border-2 border-accent bg-accent px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent-foreground">
                {visa.category}
              </span>
              <span className="font-display text-lg font-semibold text-primary-foreground/60">{visa.code}</span>
            </div>
            <h1 className="mt-4 max-w-3xl text-balance text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              {visa.name}
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-primary-foreground/80">
              {visa.tagline}
            </p>

            <div className="chalk-card mt-6 flex max-w-2xl items-start gap-3 p-4">
              <Star className="mt-0.5 h-5 w-5 shrink-0 fill-accent text-accent" />
              <p className="text-sm font-medium leading-relaxed text-primary-foreground/90">
                Every profile-building and approval step is handled{' '}
                <span className="font-semibold text-accent">exclusively through licensed immigration attorneys.</span>
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/contact" className="sketch-btn sketch-btn-accent px-6 py-3 text-sm">
                Check My Eligibility
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/#process"
                className="sketch-btn px-6 py-3 text-sm"
                style={{ background: 'transparent', color: 'var(--chalk-fg)', borderColor: 'var(--chalk-fg)', boxShadow: 'none' }}
              >
                See Our Process
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-background py-16 sm:py-20">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-3 lg:gap-10 lg:px-8">
            <Reveal className="lg:col-span-2">
              <h2 className="font-display text-2xl font-bold text-foreground">Overview</h2>
              <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">{visa.summary}</p>

              <h2 className="mt-12 font-display text-2xl font-bold text-foreground">
                {visa.greenCard ? 'What you need to qualify' : 'Evidence categories'}
              </h2>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {visa.criteria.map((c) => (
                  <li
                    key={c}
                    className="flex items-start gap-3 rounded-xl border-2 border-foreground/15 bg-card p-4 text-sm leading-relaxed text-foreground"
                  >
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    {c}
                  </li>
                ))}
              </ul>

              <h2 className="mt-12 font-display text-2xl font-bold text-foreground">Key benefits</h2>
              <ul className="mt-5 space-y-3">
                {visa.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-3 text-sm leading-relaxed text-foreground">
                    <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    {b}
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={100} className="lg:col-span-1">
              <aside className="sticky top-24 space-y-5">
                {visa.acceptanceRate && (
                  <div className="paper-card sketch-radius-a p-6">
                    <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Gauge className="h-5 w-5 text-accent" />
                      Approval rate
                    </div>
                    <p className="mt-2 font-display text-5xl font-semibold text-accent">{visa.acceptanceRate}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Historical USCIS approval range for well-prepared {visa.code} petitions.
                    </p>
                  </div>
                )}

                <div className="paper-card sketch-radius-b p-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Clock className="h-5 w-5 text-accent" />
                    Typical timeline
                  </div>
                  {visa.timelineRegular || visa.timelinePremium ? (
                    <div className="mt-3 space-y-2">
                      {visa.timelineRegular && (
                        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
                          <span className="text-sm text-muted-foreground">Regular processing</span>
                          <span className="text-sm font-bold text-foreground">{visa.timelineRegular}</span>
                        </div>
                      )}
                      {visa.timelinePremium && (
                        <div className="flex items-center justify-between rounded-lg bg-accent/10 px-3 py-2">
                          <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <Zap className="h-4 w-4 text-accent" />
                            Premium processing
                          </span>
                          <span className="text-sm font-bold text-accent">{visa.timelinePremium}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">{visa.timeline}</p>
                  )}
                </div>

                <div className="paper-card sketch-radius-c p-6">
                  <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Users2 className="h-5 w-5 text-accent" />
                    Best suited for
                  </div>
                  <ul className="mt-3 space-y-2">
                    {visa.bestFor.map((p) => (
                      <li key={p} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="chalk-section sketch-radius-a p-6">
                  <p className="font-display text-xl font-semibold">Not sure if you qualify?</p>
                  <p className="mt-2 text-sm text-primary-foreground/70">
                    Get a free profile review and an honest assessment of your chances.
                  </p>
                  <Link href="/contact" className="sketch-btn sketch-btn-accent mt-4 w-full justify-center px-4 py-2.5 text-sm">
                    Free Assessment
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </aside>
            </Reveal>
          </div>
        </section>

        <VisaJourney code={visa.code} />

        <section className="border-t-2 border-foreground/90 bg-background py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="font-display text-xl font-semibold text-foreground">Explore other pathways</h2>
            <div className="mt-6 flex flex-wrap gap-3">
              {visas
                .filter((v) => v.slug !== visa.slug)
                .map((v) => (
                  <Link
                    key={v.slug}
                    href={`/visas/${v.slug}`}
                    className="rounded-full border-2 border-foreground/20 bg-card px-4 py-2 text-sm font-bold text-foreground transition-colors hover:border-accent hover:text-accent"
                  >
                    {v.code}
                  </Link>
                ))}
            </div>
          </div>
        </section>

        <CtaSection />
      </main>
      <SiteFooter />
    </div>
  )
}
