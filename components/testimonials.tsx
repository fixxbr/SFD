import { Quote } from 'lucide-react'
import { testimonials } from '@/lib/content'
import { Reveal } from '@/components/reveal'

const radii = ['sketch-radius-a', 'sketch-radius-b', 'sketch-radius-c']
const tilts = ['tilt-1', 'tilt-2', 'tilt-3', 'tilt-4']

function Card({ t, i }: { t: (typeof testimonials)[number]; i: number }) {
  return (
    <figure
      className={`paper-card ${radii[i % radii.length]} ${tilts[i % tilts.length]} flex w-[340px] shrink-0 flex-col p-6 sm:w-[380px]`}
    >
      <Quote className="h-6 w-6 text-accent/80" aria-hidden="true" />
      <blockquote className="mt-4 flex-1 text-pretty text-sm leading-relaxed text-foreground/80">
        {t.quote}
      </blockquote>
      <figcaption className="mt-5 flex items-center gap-3 border-t border-dashed border-foreground/25 pt-4">
        <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-foreground/70 bg-accent/15 font-display text-lg font-semibold text-accent">
          {t.name.charAt(0)}
        </span>
        <span className="min-w-0">
          <span className="block font-display text-base font-semibold text-foreground">{t.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{t.role}</span>
        </span>
        <span className="ml-auto shrink-0 rounded-full border border-accent/50 bg-accent/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent">
          {t.visa}
        </span>
      </figcaption>
    </figure>
  )
}

export function Testimonials() {
  const row = [...testimonials, ...testimonials]
  return (
    <section id="stories" className="overflow-hidden border-t-2 border-foreground/90 bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal variant="zoom" className="mx-auto max-w-2xl text-center">
          <span className="eyebrow justify-center">Client Success Stories</span>
          <h2 className="mt-3 text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Real people, real approvals
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Founders, researchers, and creators who found their pathway with Afterstem.ai.
          </p>
        </Reveal>
      </div>

      <div className="marquee-paused mt-14 flex w-full overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
        <div className="flex min-w-full shrink-0 animate-marquee-slow gap-6 pr-6">
          {row.map((t, i) => (
            <Card key={`${t.name}-${i}`} t={t} i={i} />
          ))}
        </div>
        <div className="flex min-w-full shrink-0 animate-marquee-slow gap-6 pr-6" aria-hidden="true">
          {row.map((t, i) => (
            <Card key={`dup-${t.name}-${i}`} t={t} i={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
