import { Plus } from 'lucide-react'
import { faqs } from '@/lib/content'
import { Reveal } from '@/components/reveal'

export function FaqSection() {
  return (
    <section id="faq" className="border-t-2 border-foreground/90 bg-background py-20 sm:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal className="text-center">
          <span className="eyebrow justify-center">Questions, Answered</span>
          <h2 className="mt-3 text-balance text-3xl font-medium tracking-tight text-foreground sm:text-4xl">
            Frequently asked questions
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground">
            Clear, plain-language answers to the questions we hear most. Still unsure? A free assessment is the fastest
            way to get specifics for your case.
          </p>
        </Reveal>

        <div className="paper-card sketch-radius-b mt-12 divide-y divide-dashed divide-foreground/25">
          {faqs.map((f, i) => (
            <Reveal key={f.q} delay={i * 40}>
              <details className="group px-5 py-1 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-left font-display text-lg font-semibold text-foreground">
                  {f.q}
                  <Plus className="h-5 w-5 shrink-0 text-accent transition-transform duration-300 group-open:rotate-45" />
                </summary>
                <p className="pb-5 pr-8 text-pretty text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
