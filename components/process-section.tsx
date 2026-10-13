import Image from 'next/image'
import { ClipboardCheck, Compass, FileStack, Send } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { DoodleArrow } from '@/components/doodles'

const steps = [
  {
    icon: ClipboardCheck,
    title: 'Free Assessment',
    desc: 'Share your background. We evaluate your profile against every eligible visa and green card category — honestly.',
  },
  {
    icon: Compass,
    title: 'Strategy & Roadmap',
    desc: 'We recommend the strongest pathway and map out the evidence, timeline, and milestones for your case.',
  },
  {
    icon: FileStack,
    title: 'Evidence & Petition',
    desc: 'We help gather documentation, draft recommendation letters, and build a compelling, attorney-ready petition.',
  },
  {
    icon: Send,
    title: 'File & Track',
    desc: 'Your petition is filed and monitored through every stage — with clear updates until a decision is reached.',
  },
]

export function ProcessSection() {
  return (
    <section id="process" className="bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal variant="zoom" className="mx-auto max-w-2xl text-center">
          <span className="eyebrow justify-center">How It Works</span>
          <h2 className="mt-3 text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            A clear path from first call to approval
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            We keep the process transparent and structured so you always know exactly where your case stands — every
            step handled with a licensed attorney.
          </p>
        </Reveal>

        <Reveal variant="zoom" className="relative mx-auto mt-10 max-w-3xl">
          <div className="tape-strip left-1/2 -top-3 -translate-x-1/2 rotate-2" aria-hidden="true" />
          <div className="illustration-frame wash-corner sketch-radius-a -rotate-1 overflow-hidden p-2">
            <Image
              src="/sketch-consult-final-v2.png"
              alt="Full-scene watercolor-and-ink sketch of two professional women in an immigration strategy consultation"
              width={1024}
              height={1024}
              sizes="(max-width: 768px) 92vw, 768px"
              className="h-auto w-full rounded-[10px] object-contain"
            />
          </div>
          <p className="sketch-caption absolute -bottom-7 right-5">strategy before paperwork →</p>
        </Reveal>

        <div className="relative mt-20 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, i) => (
            <Reveal key={step.title} variant="pop" delay={i * 90} className="relative h-full">
              <div className="paper-card sketch-radius-c relative flex h-full flex-col p-6">
                <span className="font-display text-4xl font-semibold text-accent/70">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="mt-4 flex h-12 w-12 items-center justify-center rounded-full border-2 border-foreground/80 bg-accent/15 text-accent">
                  <step.icon className="h-6 w-6" />
                </span>
                <h3 className="mt-5 font-display text-xl font-semibold text-foreground">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
              </div>
              {i < steps.length - 1 && (
                <DoodleArrow className="absolute -right-8 top-10 hidden h-6 w-14 text-accent/60 lg:block" />
              )}
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
