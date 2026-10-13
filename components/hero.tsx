import Image from 'next/image'
import { ArrowRight, CheckCircle2, Star, CalendarDays, FileText } from 'lucide-react'
import { BrandName } from '@/components/brand'
import { links } from '@/lib/links'
import { DoodleStar } from '@/components/doodles'

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:py-24 lg:px-8">
        <div>
          <span className="eyebrow">
            <span className="h-2 w-2 animate-pulse-ring rounded-full bg-accent" />
            Your journey after STEM
          </span>
          <h1 className="mt-3 text-balance text-4xl font-medium leading-[1.1] tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            The U.S. visa built for{' '}
            <span className="squiggle-underline relative font-display italic text-accent">
              exceptional talent.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
            <BrandName /> helps researchers, engineers, founders, investors, and creators secure O-1, EB-1, EB-2 NIW,
            and EB-5 approvals. We build the strategy, the evidence, and the petition — you focus on your work.
          </p>

          <div className="paper-card sketch-radius-b relative mt-7 flex items-start gap-3 p-4">
            <Star className="mt-0.5 h-5 w-5 shrink-0 fill-accent text-accent" />
            <p className="text-sm font-medium leading-relaxed text-foreground/90">
              Every profile-building and approval step is carried out{' '}
              <span className="font-semibold text-accent">exclusively through licensed immigration attorneys</span>{' '}
              — never guesswork.
            </p>
          </div>

          <ul className="mt-7 grid gap-3 sm:grid-cols-2">
            {[
              'No lottery, no sponsorship needed',
              'Self-petition green card paths',
              'End-to-end petition building',
              'Strategy from real case data',
            ].map((point) => (
              <li key={point} className="flex items-center gap-2 text-sm font-medium text-foreground/90">
                <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-accent" />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <a
              href={links.calendar}
              target="_blank"
              rel="noopener noreferrer"
              className="sketch-btn sketch-btn-accent px-6 py-3.5 text-sm"
            >
              <CalendarDays className="h-4 w-4" />
              Book a Free Call
            </a>
            <a
              href={links.form}
              target="_blank"
              rel="noopener noreferrer"
              className="sketch-btn sketch-btn-paper px-6 py-3.5 text-sm"
            >
              <FileText className="h-4 w-4" />
              Free Assessment
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="tape-strip left-8 -top-3 -rotate-6" aria-hidden="true" />
          <div className="tape-strip right-4 top-1/3 rotate-[8deg]" aria-hidden="true" />
          <div className="illustration-frame wash-corner sketch-radius-c relative overflow-hidden rotate-1 p-2">
            <div className="overflow-hidden rounded-[10px]">
              <Image
                src="/sketch-hero-final.png"
                alt="Watercolor-and-ink sketch of a talented professional beginning a U.S. immigration journey"
                width={1024}
                height={1024}
                sizes="(max-width: 1024px) 92vw, 44vw"
                className="aspect-[4/5] h-auto w-full object-cover object-center"
                priority
              />
            </div>
          </div>
          <div className="sticker absolute -bottom-7 left-2 max-w-[210px] -rotate-2 px-4 py-2.5 sm:-left-5 sm:px-5 sm:py-3">
            <p className="font-display text-base font-semibold leading-none text-foreground sm:text-lg">O · EB-1 · NIW · EB-5</p>
            <p className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-accent sm:text-[10px]">
              Every pathway, guided
            </p>
          </div>
          <DoodleStar className="absolute -right-4 -top-6 h-8 w-8 text-accent animate-wobble" />
        </div>
      </div>
    </section>
  )
}
