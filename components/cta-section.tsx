import Image from 'next/image'
import { ArrowRight, CalendarDays } from 'lucide-react'
import { links } from '@/lib/links'

export function CtaSection({
  title = 'Ready to find your best pathway?',
  description = 'Get a free, no-obligation assessment of your profile and a clear recommendation on the visa or green card most likely to succeed.',
}: {
  title?: string
  description?: string
}) {
  return (
    <section className="border-t-2 border-foreground/90 bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="paper-card sketch-radius-a grid items-center gap-8 p-6 sm:p-10 md:grid-cols-[1fr_0.8fr]">
          <div className="text-center md:text-left">
            <span className="eyebrow md:justify-start justify-center">Let&apos;s begin</span>
            <h2 className="mt-3 text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
              {title}
            </h2>
            <p className="mt-4 text-pretty text-muted-foreground">{description}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row md:justify-start">
              <a
                href={links.calendar}
                target="_blank"
                rel="noopener noreferrer"
                className="sketch-btn sketch-btn-accent px-6 py-3 text-sm"
              >
                <CalendarDays className="h-4 w-4" />
                Book a Free Call
              </a>
              <a
                href={links.form}
                target="_blank"
                rel="noopener noreferrer"
                className="sketch-btn sketch-btn-paper px-6 py-3 text-sm"
              >
                Free Assessment
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
          <div className="relative">
            <div className="tape-strip -right-3 -top-3 rotate-6" aria-hidden="true" />
            <div className="illustration-frame wash-corner rotate-1 overflow-hidden rounded-[10px]">
              <Image
                src="/sketch-approved-final.png"
                alt="Watercolor-and-ink sketch celebrating an approved immigration petition"
                width={1024}
                height={1024}
                sizes="(max-width: 768px) 92vw, 34vw"
                className="aspect-[4/3] h-auto w-full object-cover object-center"
              />
            </div>
            <p className="sketch-caption mt-4 justify-end">your approval story starts here →</p>
          </div>
        </div>
      </div>
    </section>
  )
}
