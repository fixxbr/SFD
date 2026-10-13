'use client'

import { useEffect, useRef, useState } from 'react'
import { Layers, Hourglass, Zap, HeartHandshake, Gift } from 'lucide-react'

type Stat = {
  value: number
  decimals?: number
  suffix?: string
  prefix?: string
  label: string
  description: string
  icon: typeof Layers
  accent?: boolean
}

const stats: Stat[] = [
  {
    value: 10,
    suffix: '+',
    label: 'Visa & green card categories',
    description: 'From O-1 extraordinary ability to EB-5 investment — we map the full spectrum of pathways.',
    icon: Layers,
  },
  {
    value: 12,
    suffix: '–15 mo',
    label: 'Regular processing',
    description: 'Standard USCIS review time for a well-prepared petition, no expedite fee required.',
    icon: Hourglass,
  },
  {
    value: 8,
    suffix: '–12 mo',
    label: 'Premium processing',
    description: 'Eligible petitions get a guaranteed USCIS decision in as little as two weeks.',
    icon: Zap,
    accent: true,
  },
  {
    value: 100,
    suffix: '%',
    label: 'Tailored, honest strategy',
    description: 'No cookie-cutter filings — every case is built around your evidence, and we tell you the truth about your odds.',
    icon: HeartHandshake,
  },
  {
    value: 500,
    prefix: '$',
    label: 'Referral reward per friend',
    description: 'Refer anyone who signs on with Afterstem.ai and get rewarded once their case is underway.',
    icon: Gift,
  },
]

function useCountUp(target: number, active: boolean, duration = 1400) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setN(Math.round(target * eased))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, active, duration])
  return n
}

function StatItem({ stat, active }: { stat: Stat; active: boolean }) {
  const n = useCountUp(stat.value, active)
  const Icon = stat.icon

  return (
    <div
      className={`chalk-card flex flex-col items-center gap-3 p-6 text-center transition-transform duration-300 hover:-translate-y-1 ${
        stat.accent ? 'border-accent/60' : ''
      }`}
    >
      <span
        className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 ${
          stat.accent ? 'border-accent bg-accent text-accent-foreground' : 'border-primary-foreground/30 text-accent'
        }`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p className="font-display text-4xl font-semibold tracking-tight text-primary-foreground">
        {stat.prefix}
        {n}
        {stat.suffix}
      </p>
      <p className="text-sm font-semibold text-primary-foreground/90">{stat.label}</p>
      <p className="text-xs leading-relaxed text-primary-foreground/55">{stat.description}</p>
    </div>
  )
}

export function StatsStrip() {
  const ref = useRef<HTMLDivElement | null>(null)
  const [active, setActive] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setActive(true)
          obs.disconnect()
        }
      },
      { threshold: 0.4 },
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  return (
    <section className="chalk-section border-y-2 border-foreground/90 py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="eyebrow justify-center">The numbers behind the strategy</span>
          <h2 className="mt-3 text-balance text-2xl font-medium tracking-tight text-primary-foreground sm:text-3xl">
            What working with Afterstem.ai actually looks like
          </h2>
        </div>

        <div ref={ref} className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {stats.map((s) => (
            <StatItem key={s.label} stat={s} active={active} />
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-2xl text-center text-xs leading-relaxed text-primary-foreground/50">
          Processing times reflect typical USCIS ranges and vary by category, service center, and case complexity.
          Premium processing is available for eligible petition types for an additional government filing fee.
        </p>
      </div>
    </section>
  )
}
