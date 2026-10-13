import { ClipboardCheck, Scale, Layers, FileText, Send, BadgeCheck, ArrowRight, ArrowDown } from 'lucide-react'
import { TiltCard } from '@/components/tilt-card'
import { Reveal } from '@/components/reveal'

const stages = [
  {
    icon: ClipboardCheck,
    title: 'Free Assessment',
    desc: 'We review your background and confirm the strongest visa fit for your profile.',
  },
  {
    icon: Scale,
    title: 'Attorney Profile Review',
    desc: 'Licensed immigration attorneys evaluate your case and approve the legal strategy.',
    lawyer: true,
  },
  {
    icon: Layers,
    title: 'Evidence Building',
    desc: 'We assemble awards, recommendation letters, publications, and supporting proof.',
  },
  {
    icon: FileText,
    title: 'Petition Drafting',
    desc: 'Attorneys draft and finalize your petition, legal brief, and exhibits.',
    lawyer: true,
  },
  {
    icon: Send,
    title: 'USCIS Filing',
    desc: 'We file with USCIS — premium processing available to speed up the decision.',
  },
  {
    icon: BadgeCheck,
    title: 'Decision & Approval',
    desc: 'You receive your approval, and we help you plan your next steps.',
  },
]

const radii = ['a', 'b', 'c', 'a', 'b', 'c'] as const

export function VisaJourney({ code }: { code: string }) {
  return (
    <section className="border-t-2 border-foreground/90 bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="mx-auto max-w-2xl text-center">
          <span className="eyebrow justify-center">Know where you stand</span>
          <h2 className="mt-3 text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            {`Your ${code} journey, stage by stage`}
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            A clear roadmap so you always know exactly what stage your case is in — with attorneys leading every legal
            step.
          </p>
        </Reveal>

        <ol className="mt-12 grid gap-5 md:grid-cols-3 lg:grid-cols-6">
          {stages.map((stage, i) => (
            <Reveal key={stage.title} delay={i * 80} variant="pop" as="li" className="relative flex">
              <TiltCard className="w-full">
                <div className={`paper-card sketch-radius-${radii[i]} relative flex h-full w-full flex-col p-5`}>
                  <div className="flex items-center justify-between">
                    <span className="sticker flex h-11 w-11 items-center justify-center">
                      <stage.icon className="h-5 w-5 text-accent" />
                    </span>
                    <span className="font-display text-3xl font-semibold text-accent/50">{i + 1}</span>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold text-foreground">{stage.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{stage.desc}</p>
                  {stage.lawyer && (
                    <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2.5 py-1 text-xs font-bold text-accent">
                      <Scale className="h-3.5 w-3.5" />
                      Attorney-led
                    </span>
                  )}
                </div>
              </TiltCard>

              {i < stages.length - 1 && (
                <>
                  <ArrowRight className="absolute -right-4 top-1/2 hidden h-6 w-6 -translate-y-1/2 text-foreground/40 lg:block" />
                  <ArrowDown className="mx-auto mt-1 h-5 w-5 text-foreground/40 md:hidden" />
                </>
              )}
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
