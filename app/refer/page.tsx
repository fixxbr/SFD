import type { Metadata } from 'next'
import { UserPlus, Handshake, Gift } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsTicker } from '@/components/news-ticker'
import { ReferralForm } from '@/components/referral-form'
import { TiltCard } from '@/components/tilt-card'
import { Reveal } from '@/components/reveal'
import { DoodleStar } from '@/components/doodles'

export const metadata: Metadata = {
  title: 'Refer & Earn $500 | Afterstem.ai',
  description:
    'Refer a friend or client to Afterstem.ai. When their immigration case begins, you earn a $500 reward — with no limit on referrals.',
}

const steps = [
  {
    icon: UserPlus,
    title: 'Refer someone',
    desc: 'Share your friend or client\u2019s details using the form below. It takes less than a minute.',
  },
  {
    icon: Handshake,
    title: 'They get started',
    desc: 'We reach out, run a free assessment, and they sign up for a paid engagement with Afterstem.ai.',
  },
  {
    icon: Gift,
    title: 'You earn $500',
    desc: 'Once their case is officially underway, we send you a $500 reward. Refer as many people as you like.',
  },
]

export default function ReferPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NewsTicker />
      <SiteHeader />
      <main className="flex-1">
        <section className="chalk-section relative overflow-hidden border-b-2 border-foreground/90 py-16 sm:py-20">
          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <Reveal>
              <span className="eyebrow justify-center text-accent">
                <Gift className="h-4 w-4" /> Referral Program
              </span>
              <h1 className="mt-5 text-balance text-4xl font-medium tracking-tight sm:text-5xl">
                Refer a friend, earn{' '}
                <span className="squiggle-underline relative font-display italic text-accent">$500</span>
              </h1>
              <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-primary-foreground/70">
                Great talent knows great talent. Introduce someone to Afterstem.ai and get rewarded when they begin
                their journey to living and working in the United States.
              </p>
            </Reveal>
          </div>
        </section>

        <section className="bg-background py-16 sm:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-6 md:grid-cols-3">
              {steps.map((s, i) => (
                <Reveal key={s.title} delay={i * 100} variant="pop">
                  <TiltCard>
                    <div className={`paper-card sketch-radius-${['a', 'b', 'c'][i % 3]} relative h-full p-6 text-center`}>
                      <span className="sticker mx-auto flex h-14 w-14 items-center justify-center">
                        <s.icon className="h-7 w-7 text-accent" />
                      </span>
                      <p className="mt-4 font-display text-sm font-bold uppercase tracking-wider text-accent/80">
                        Step {i + 1}
                      </p>
                      <h3 className="mt-1 font-display text-xl font-semibold text-foreground">{s.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
                      {i === 2 && (
                        <DoodleStar className="absolute -right-2 -top-2 h-7 w-7 text-accent animate-wobble" />
                      )}
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>

            <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-start">
              <Reveal>
                <h2 className="text-balance font-display text-3xl font-semibold tracking-tight text-foreground">
                  Submit your referral
                </h2>
                <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
                  Fill in your details and your friend&apos;s contact information. We&apos;ll handle the rest with
                  care, and keep you posted on your reward.
                </p>
                <ul className="mt-6 space-y-3 text-sm text-foreground/85">
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    No limit — refer as many qualified people as you like.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    Reward paid once the referred case is officially underway.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                    Your friend gets a free, no-obligation assessment.
                  </li>
                </ul>
              </Reveal>
              <Reveal delay={100} variant="pop">
                <ReferralForm />
              </Reveal>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
