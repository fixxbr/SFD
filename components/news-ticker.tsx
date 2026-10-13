import { AlertTriangle, Pin } from 'lucide-react'
import { CURATED_NEWS, type NewsItem } from '@/lib/news'

function TickerItem({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group inline-flex items-center gap-2 whitespace-nowrap px-6 text-sm"
    >
      {item.alert ? (
        <span className="inline-flex items-center gap-1 rounded-full border border-primary-foreground/70 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
          <AlertTriangle className="h-3 w-3" />
          Alert
        </span>
      ) : (
        <span className="font-display text-sm font-semibold text-primary-foreground/80">{item.source}</span>
      )}
      <span className="text-primary-foreground/90 transition-colors group-hover:text-primary-foreground group-hover:underline">
        {item.title}
      </span>
      <span aria-hidden className="text-primary-foreground/30">•</span>
    </a>
  )
}

export function NewsTicker() {
  // Keep the initial server and client trees deterministic. Fetching mutable
  // RSS feeds during the initial render can resolve differently across an HMR
  // boundary and make React hydrate against a different streamed tree.
  const loop = [...CURATED_NEWS, ...CURATED_NEWS]

  return (
    <div className="marquee-paused relative flex items-stretch overflow-hidden border-b-2 border-foreground/90 bg-primary text-primary-foreground">
      <div className="z-10 flex shrink-0 items-center gap-2 border-r-2 border-primary-foreground/30 px-4 py-2 font-display text-base font-semibold">
        <Pin className="h-3.5 w-3.5 -rotate-45" />
        <span className="hidden sm:inline">Immigration Updates</span>
        <span className="sm:hidden">Live</span>
      </div>
      <div className="relative flex flex-1 items-center overflow-hidden py-2">
        <div className="animate-marquee flex min-w-full shrink-0 items-center">
          {loop.map((item, i) => (
            <TickerItem key={`${item.link}-${i}`} item={item} />
          ))}
        </div>
      </div>
    </div>
  )
}
