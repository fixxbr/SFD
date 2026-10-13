import type { Metadata } from 'next'
import { Mail, Clock, ShieldCheck, MessageSquare } from 'lucide-react'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsTicker } from '@/components/news-ticker'
import { ContactForm } from '@/components/contact-form'
import { Reveal } from '@/components/reveal'
import { DoodleStar } from '@/components/doodles'

export const metadata: Metadata = {
  title: 'Free Assessment | Afterstem.ai',
  description:
    'Request a free assessment of your profile for O-1, EB-1A, EB-2 NIW, and Day-1 CPT pathways. Our team responds within 1–2 business days.',
}

const points = [
  { icon: Clock, title: 'Fast response', desc: 'We reply within 1–2 business days with next steps.' },
  { icon: ShieldCheck, title: 'Honest evaluation', desc: 'We only recommend a path if it genuinely fits you.' },
  { icon: MessageSquare, title: 'No obligation', desc: 'Your first assessment is free and confidential.' },
]

export default function ContactPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NewsTicker />
      <SiteHeader />
      <main className="relative flex-1 bg-background">
        <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
            <Reveal>
              <span className="eyebrow">
                <DoodleStar className="h-4 w-4 text-accent" />
                Free Assessment
              </span>
              <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.08] tracking-tight text-foreground sm:text-5xl">
                Let&apos;s find your best path to the U.S.
              </h1>
              <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
                Tell us about your background and goals. We&apos;ll review your profile and recommend the visa or
                green card category most likely to succeed — at no cost.
              </p>

              <ul className="mt-8 space-y-5">
                {points.map((p, i) => (
                  <li key={p.title} className="flex items-start gap-4">
                    <span
                      className={`sticker flex h-11 w-11 shrink-0 items-center justify-center ${
                        i % 2 === 0 ? '-rotate-2' : 'rotate-2'
                      }`}
                    >
                      <p.icon className="h-5 w-5 text-accent" />
                    </span>
                    <div>
                      <p className="font-display text-xl font-semibold text-foreground">{p.title}</p>
                      <p className="text-sm text-muted-foreground">{p.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="paper-card sketch-radius-b mt-8 flex items-center gap-2 p-4 text-sm">
                <Mail className="h-5 w-5 text-accent" />
                <span className="text-muted-foreground">Prefer email?</span>
                <a href="mailto:admin@afterstem.ai" className="font-semibold text-foreground hover:underline">
                  admin@afterstem.ai
                </a>
              </div>
            </Reveal>

            <Reveal delay={100} variant="pop">
              <ContactForm />
            </Reveal>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
