import type { Metadata } from 'next'
import Link from 'next/link'
import { GraduationCap, Briefcase, CalendarClock, ShieldCheck, ArrowRight, ExternalLink, CheckCircle2 } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsTicker } from '@/components/news-ticker'
import { CtaSection } from '@/components/cta-section'
import { TiltCard } from '@/components/tilt-card'
import { Reveal } from '@/components/reveal'
import { DoodleCircle } from '@/components/doodles'

export const metadata: Metadata = {
  title: 'Day-1 CPT Programs | Afterstem.ai',
  description:
    'Explore trusted Day-1 CPT university programs that let you work while you study. Afterstem helps you use Day-1 CPT as part of a long-term O-1 or green card strategy.',
}

const benefits = [
  {
    icon: Briefcase,
    title: 'Work from day one',
    desc: 'Approved Day-1 CPT programs authorize employment from your first term, so you keep earning and building experience.',
  },
  {
    icon: CalendarClock,
    title: 'Bridge the gap',
    desc: 'Stay in valid status while you prepare a stronger O-1, EB-1A, or EB-2 NIW petition down the line.',
  },
  {
    icon: GraduationCap,
    title: 'Keep advancing',
    desc: 'Earn a graduate degree that can strengthen an EB-2 NIW case and expand your long-term options.',
  },
  {
    icon: ShieldCheck,
    title: 'Compliance first',
    desc: 'We only point you toward reputable, accredited institutions and help you understand the rules.',
  },
]

const partners = [
  {
    name: 'Partner University Programs',
    focus: 'STEM & Business Master\u2019s',
    note: 'Accredited institutions offering Day-1 CPT for graduate students.',
  },
  {
    name: 'Tech & Analytics Tracks',
    focus: 'Data, AI & Software',
    note: 'Programs aligned with high-demand roles for future O-1 and NIW cases.',
  },
  {
    name: 'Management & MBA Tracks',
    focus: 'Business & Leadership',
    note: 'Options for professionals building toward executive extraordinary-ability profiles.',
  },
]

export default function Day1CptPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NewsTicker />
      <SiteHeader />
      <main className="flex-1">
        <section className="chalk-section relative overflow-hidden border-b-2 border-foreground/90 py-16 sm:py-20">
          <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <span className="eyebrow text-accent">
                <DoodleCircle className="h-4 w-8" />
                Partner Programs
              </span>
              <h1 className="mt-5 max-w-3xl text-balance text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl">
                Day-1 CPT programs that keep you working and moving forward
              </h1>
              <p className="mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-primary-foreground/70">
                Day-1 CPT lets eligible graduate students work from the start of their program. We help you choose
                reputable programs and fit them into a long-term visa and green card strategy — not just a quick fix.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/contact" className="sketch-btn sketch-btn-accent px-6 py-3 text-sm">
                  Talk to an Advisor
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="bg-background py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal>
              <h2 className="font-display text-3xl font-semibold text-foreground">Why students choose Day-1 CPT</h2>
            </Reveal>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {benefits.map((b, i) => (
                <Reveal key={b.title} delay={i * 80} variant="pop">
                  <TiltCard>
                    <div className={`paper-card sketch-radius-${['a', 'b', 'c', 'a'][i % 4]} h-full p-6`}>
                      <span className="sticker flex h-11 w-11 items-center justify-center">
                        <b.icon className="h-5 w-5 text-accent" />
                      </span>
                      <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{b.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.desc}</p>
                    </div>
                  </TiltCard>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t-2 border-foreground/90 bg-background py-16 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <Reveal className="max-w-2xl">
              <h2 className="font-display text-3xl font-semibold text-foreground">Program categories we work with</h2>
              <p className="mt-3 text-muted-foreground">
                Contact us for a personalized list of current programs that match your background and goals.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {partners.map((p, i) => (
                <Reveal key={p.name} delay={i * 100}>
                  <div className={`paper-card sketch-radius-${['b', 'c', 'a'][i % 3]} flex h-full flex-col p-6`}>
                    <span className="text-xs font-bold uppercase tracking-wider text-accent">{p.focus}</span>
                    <h3 className="mt-2 font-display text-lg font-semibold text-foreground">{p.name}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{p.note}</p>
                    <Link
                      href="/contact"
                      className="mt-5 inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:underline"
                    >
                      Request program list
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>
                </Reveal>
              ))}
            </div>

            <Reveal delay={150}>
              <div className="paper-card sketch-radius-a mt-10 p-6">
                <h3 className="font-display text-xl font-semibold text-foreground">Important to know</h3>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    'Always verify a program\u2019s accreditation and CPT policy',
                    'Day-1 CPT should support a real academic program',
                    'Keep clean records to protect future petitions',
                    'We help you plan the transition to O-1 or a green card',
                  ].map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>
        </section>

        <CtaSection
          title="Plan your Day-1 CPT the smart way"
          description="Get guidance on choosing a reputable program and turning it into a long-term path to an O-1 visa or green card."
        />
      </main>
      <SiteFooter />
    </div>
  )
}
