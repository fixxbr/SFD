export type NewsItem = {
  title: string
  link: string
  source: string
  pubDate: string | null
  alert?: boolean
}

type Feed = { url: string; source: string }

// Official U.S. government RSS feeds.
const FEEDS: Feed[] = [
  { url: 'https://www.uscis.gov/news/rss-feed/13707', source: 'USCIS' },
  { url: 'https://www.dhs.gov/news-releases/all/rss.xml', source: 'DHS' },
  { url: 'https://www.state.gov/rss-feed/press-releases/feed/', source: 'State Dept.' },
]

// Curated fallback so the ticker always shows something relevant.
export const CURATED_NEWS: readonly NewsItem[] = [
  {
    title: 'USCIS continues premium processing for eligible I-140 and I-129 petitions',
    link: 'https://www.uscis.gov/newsroom',
    source: 'USCIS',
    pubDate: null,
  },
  {
    title: 'Department of State releases the latest monthly Visa Bulletin',
    link: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html',
    source: 'State Dept.',
    pubDate: null,
    alert: true,
  },
  {
    title: 'USCIS updates policy guidance on evidence for O-1 extraordinary ability petitions',
    link: 'https://www.uscis.gov/policy-manual',
    source: 'USCIS',
    pubDate: null,
  },
  {
    title: 'EB-1 and EB-2 employment-based categories: check current priority dates',
    link: 'https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html',
    source: 'State Dept.',
    pubDate: null,
  },
  {
    title: 'DHS announces measures to support STEM talent and highly skilled workers',
    link: 'https://www.dhs.gov/news',
    source: 'DHS',
    pubDate: null,
  },
]

function decode(str: string) {
  return str
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/<[^>]+>/g, '')
    .trim()
}

function parseFeed(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = []
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? []
  for (const block of itemBlocks.slice(0, 6)) {
    const title = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]
    const link = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]
    if (!title) continue
    const text = decode(title)
    items.push({
      title: text,
      link: link ? decode(link) : '#',
      source,
      pubDate: pubDate ? decode(pubDate) : null,
      alert: /alert|bulletin|deadline|final rule|effective|suspend/i.test(text),
    })
  }
  return items
}

export async function getGovNews(): Promise<NewsItem[]> {
  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const res = await fetch(feed.url, {
        headers: { 'User-Agent': 'AfterstemBot/1.0', Accept: 'application/rss+xml, application/xml, text/xml' },
        next: { revalidate: 1800 },
      })
      if (!res.ok) throw new Error(`${feed.source} ${res.status}`)
      const xml = await res.text()
      return parseFeed(xml, feed.source)
    }),
  )

  const items = results
    .filter((r): r is PromiseFulfilledResult<NewsItem[]> => r.status === 'fulfilled')
    .flatMap((r) => r.value)

  if (items.length === 0) return [...CURATED_NEWS]

  // Interleave sources so one feed doesn't dominate.
  const bySource = new Map<string, NewsItem[]>()
  for (const item of items) {
    const arr = bySource.get(item.source) ?? []
    arr.push(item)
    bySource.set(item.source, arr)
  }
  const interleaved: NewsItem[] = []
  const lists = [...bySource.values()]
  const max = Math.max(...lists.map((l) => l.length))
  for (let i = 0; i < max; i++) {
    for (const list of lists) {
      if (list[i]) interleaved.push(list[i])
    }
  }
  return interleaved.slice(0, 12)
}
