import Image from 'next/image'
import { ShieldCheck, Target, HeartHandshake, LineChart } from 'lucide-react'
import { BrandName } from '@/components/brand'

const reasons = [
  {
    icon: Target,
    title: 'The right category, first',
    desc: 'We do not push a one-size-fits-all visa. We assess every option and recommend what actually fits your profile.',
  },
  {
    icon: ShieldCheck,
    title: 'Attorney-ready petitions',
    desc: 'Every case is built to a high evidentiary standard and reviewed with immigration counsel before filing.',
  },
  {
    icon: LineChart,
    title: 'Data-driven strategy',
    desc: 'Recommendations grounded in current USCIS trends, adjudication patterns, and real approved cases.',
  },
  {
    icon: HeartHandshake,
    title: 'Support that stays',
    desc: 'From the first assessment to your approval notice, you work with a team that answers and follows through.',
  },
]

export function WhySection() {
  return (
    <section id="about" className="chalk-section border-y-2 border-foreground/90 py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div>
            <span className="eyebrow">Why choose us</span>
            <h2 className="mt-3 text-balance text-3xl font-medium tracking-tight text-primary-foreground sm:text-4xl">
              Built by people who understand the journey after STEM
            </h2>
            <p className="mt-5 text-pretty leading-relaxed text-primary-foreground/70">
              We know the pressure of OPT deadlines, the lottery, and the uncertainty of what comes next.{' '}
              <BrandName className="text-primary-foreground hover:text-accent" /> exists to give ambitious talent a
              confident, evidence-backed path to living and working in the United States on your own terms.
            </p>
            <div className="mt-8 grid grid-cols-3 gap-4">
              {[
                { value: '10+', label: 'Visa & GC categories' },
                { value: '360°', label: 'End-to-end support' },
                { value: '100%', label: 'Tailored strategy' },
              ].map((stat) => (
                <div key={stat.label} className="chalk-card p-4">
                  <p className="font-display text-3xl font-semibold text-accent">{stat.value}</p>
                  <p className="mt-1 text-xs text-primary-foreground/60">{stat.label}</p>
                </div>
              ))}
            </div>
            <div className="relative mt-8">
              <div className="tape-strip -left-3 -top-3 -rotate-12" aria-hidden="true" />
              <div className="illustration-frame rotate-1 overflow-hidden rounded-[10px]">
                <Image
                  src="/sketch-buildings-final.png"
                  alt="Watercolor-and-ink sketch of an American city skyline and the journey ahead"
                  width={1024}
                  height={1024}
                  sizes="(max-width: 1024px) 92vw, 40vw"
                  className="aspect-[16/10] h-auto w-full object-cover object-center"
                />
              </div>
              <p className="sketch-caption mt-4 justify-end text-primary-foreground/80">built for the road ahead →</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {reasons.map((r) => (
              <div key={r.title} className="chalk-card p-6 transition-colors hover:border-accent/60">
                <span className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-accent bg-accent text-accent-foreground">
                  <r.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-xl font-semibold text-primary-foreground">{r.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-primary-foreground/70">{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
