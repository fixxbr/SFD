import Image from 'next/image'

const companies = [
  'google',
  'microsoft',
  'amazon',
  'meta',
  'nvidia',
  'apple',
  'openai',
  'netflix',
  'ibm',
  'intel',
  'adobe',
  'oracle',
  'salesforce',
  'uber',
  'airbnb',
  'spotify',
  'stripe',
  'samsung',
  'tesla',
  'linkedin',
]

const labels: Record<string, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  amazon: 'Amazon',
  meta: 'Meta',
  nvidia: 'NVIDIA',
  apple: 'Apple',
  openai: 'OpenAI',
  netflix: 'Netflix',
  ibm: 'IBM',
  intel: 'Intel',
  adobe: 'Adobe',
  oracle: 'Oracle',
  salesforce: 'Salesforce',
  uber: 'Uber',
  airbnb: 'Airbnb',
  spotify: 'Spotify',
  stripe: 'Stripe',
  samsung: 'Samsung',
  tesla: 'Tesla',
  linkedin: 'LinkedIn',
}

// Deterministic pseudo-random tilt so the wall reads as hand-placed, not gridded.
function tiltFor(i: number) {
  const seed = (i * 47) % 13
  return (seed - 6) * 0.45
}

function Tile({ slug, index }: { slug: string; index: number }) {
  const rotate = tiltFor(index)
  return (
    <div
      className="paper-card sketch-radius-a flex h-16 w-36 shrink-0 items-center justify-center px-6 sm:w-40"
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      <Image
        src={`/logos/${slug}.svg`}
        alt={labels[slug]}
        width={120}
        height={36}
        className="h-7 w-auto object-contain opacity-80 sm:h-8"
      />
    </div>
  )
}

export function TrustedBy() {
  const rows = [companies.slice(0, 7), companies.slice(7, 14), companies.slice(14, 20)]

  return (
    <section className="relative overflow-hidden border-y-2 border-foreground/90 bg-background py-16 sm:py-20">
      <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
        <span className="eyebrow justify-center">Trusted by exceptional talent</span>
        <p className="mt-3 text-pretty text-lg text-foreground/90">
          Our clients build, research, and lead at the world&apos;s most admired companies.
        </p>
      </div>

      <div className="mx-auto mt-12 flex max-w-5xl flex-col items-center gap-5 px-4">
        {rows.map((row, ri) => (
          <div key={ri} className="flex flex-wrap items-center justify-center gap-4 sm:gap-5">
            {row.map((slug, i) => (
              <Tile key={slug} slug={slug} index={ri * 7 + i} />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
