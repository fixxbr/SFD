import Link from 'next/link'
import Image from 'next/image'
import { Gift, ArrowRight } from 'lucide-react'
import { Reveal } from '@/components/reveal'
import { DoodleStar } from '@/components/doodles'

export function ReferralBanner() {
  return (
    <section className="bg-background py-8 sm:py-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div
            className="paper-card sketch-radius-a relative grid items-center gap-6 p-6 md:grid-cols-[1.4fr_1fr] md:gap-8 md:p-8"
            style={{ background: 'var(--tape)' }}
          >
            <DoodleStar className="absolute right-4 top-4 h-6 w-6 text-accent animate-wobble sm:right-6 sm:top-6 sm:h-7 sm:w-7" />
            <div className="flex flex-col items-start gap-4">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-foreground/80 bg-accent text-accent-foreground">
                <Gift className="h-7 w-7" />
              </span>
              <span className="eyebrow">Share the good news</span>
              <h2 className="text-balance text-2xl font-medium tracking-tight text-foreground sm:text-3xl">
                Refer a friend, earn{' '}
                <span className="marker-underline-warm font-display italic text-foreground">$500</span>
              </h2>
              <p className="max-w-xl text-pretty text-sm leading-relaxed text-foreground/70">
                Know someone with extraordinary talent? Refer a friend or client to Afterstem.ai. When their case
                begins, you get a $500 reward — with no limit on how many people you refer.
              </p>
              <Link href="/refer" className="sketch-btn sketch-btn-accent px-6 py-3 text-sm">
                Refer &amp; Earn
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="relative">
              <div className="tape-strip left-1/2 -top-3 -translate-x-1/2 -rotate-3" aria-hidden="true" />
              <div className="illustration-frame wash-corner rotate-1 overflow-hidden rounded-[10px]">
                <Image
                  src="/sketch-team-final.png"
                  alt="Watercolor-and-ink sketch of friends and colleagues helping one another move forward"
                  width={1024}
                  height={1024}
                  sizes="(max-width: 768px) 92vw, 34vw"
                  className="aspect-[4/3] h-auto w-full object-cover object-center"
                />
              </div>
              <p className="sketch-caption mt-4 justify-end">good people know good people →</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
