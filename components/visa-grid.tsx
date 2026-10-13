import Link from 'next/link'
import { ArrowUpRight, Award, Palette, Users, Globe2, Lightbulb, HeartHandshake, Microscope, Building2, GraduationCap, TrendingUp } from 'lucide-react'
import { visas } from '@/lib/visas'
import { Reveal } from '@/components/reveal'

const icons: Record<string, typeof Award> = {
  'o-1a': Award,
  'o-1b': Palette,
  'o-2': Users,
  'o-3': HeartHandshake,
  'eb-1a': Globe2,
  'eb-1b': Microscope,
  'eb-2': Building2,
  'eb-2-niw': Lightbulb,
  'eb-3': GraduationCap,
  'eb-5': TrendingUp,
}

const radii = ['sketch-radius-a', 'sketch-radius-b', 'sketch-radius-c']
const tilts = ['tilt-1', 'tilt-2', 'tilt-3', 'tilt-4']

export function VisaGrid() {
  return (
    <section id="services" className="border-t-2 border-foreground/90 bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal variant="zoom" className="mx-auto max-w-2xl text-center">
          <span className="eyebrow justify-center">Visa &amp; Green Card Services</span>
          <h2 className="mt-3 text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Find the pathway that fits your profile
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            From temporary work visas to self-petitioned green cards, we match your achievements to the strongest
            available category.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
          {visas.map((v, i) => {
            const Icon = icons[v.slug] ?? Award
            return (
              <Reveal key={v.slug} variant="pop" delay={(i % 3) * 80} className="h-full">
                <Link
                  href={`/visas/${v.slug}`}
                  className={`paper-card ${radii[i % radii.length]} ${tilts[i % tilts.length]} group flex h-full flex-col p-7`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-foreground/80 bg-accent/15 text-accent">
                      <Icon className="h-6 w-6" />
                    </span>
                    <ArrowUpRight className="h-5 w-5 text-muted-foreground transition-colors group-hover:text-accent" />
                  </div>
                  <div className="mt-5 flex items-center gap-2">
                    <h3 className="font-display text-2xl font-semibold text-foreground">{v.code}</h3>
                    <span className="rounded-full border border-foreground/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {v.greenCard ? 'Green Card' : 'Work Visa'}
                    </span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground/75">{v.name.replace(v.code, '').trim()}</p>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{v.tagline}</p>
                  <span className="marker-underline mt-5 text-sm font-semibold text-foreground">
                    Learn more →
                  </span>
                </Link>
              </Reveal>
            )
          })}

          <Link
            href="/day-1-cpt"
            className="paper-card sketch-radius-b tilt-2 group flex h-full flex-col justify-between p-7"
            style={{ background: 'var(--accent)', borderColor: 'var(--ink)' }}
          >
            <div>
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-foreground/80 bg-accent-foreground/20 text-accent-foreground">
                <ArrowUpRight className="h-6 w-6" />
              </span>
              <h3 className="mt-5 font-display text-2xl font-semibold text-accent-foreground">Day-1 CPT Programs</h3>
              <p className="mt-3 text-sm leading-relaxed text-accent-foreground/85">
                Explore trusted university programs that let you work from day one while you study — a smart bridge to
                your long-term visa strategy.
              </p>
            </div>
            <span className="mt-5 text-sm font-bold text-accent-foreground underline">
              View partner programs →
            </span>
          </Link>
        </div>
      </div>
    </section>
  )
}
