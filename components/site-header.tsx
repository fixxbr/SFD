'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronDown, CalendarDays } from 'lucide-react'
import { visas } from '@/lib/visas'
import { cn } from '@/lib/utils'
import { BrandLogo } from '@/components/brand'
import { links } from '@/lib/links'

const nonimmigrant = visas.filter((v) => !v.greenCard)
const greenCards = visas.filter((v) => v.greenCard)

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [servicesOpen, setServicesOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b-2 border-foreground/90 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex min-w-0 items-center" aria-label="Afterstem.ai home">
          <BrandLogo
            className="max-w-[172px] sm:max-w-none"
            markClassName="mix-blend-multiply"
          />
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          <div
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button className="flex items-center gap-1 rounded-md px-3 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:text-accent">
              Visa Services
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
            {servicesOpen && (
              <div className="absolute left-0 top-full w-[520px] pt-3">
                <div className="paper-card sketch-radius-a grid grid-cols-2 gap-2 p-4">
                  <div>
                    <p className="px-3 py-1 font-display text-base font-semibold text-accent">Work Visas</p>
                    {nonimmigrant.map((v) => (
                      <Link
                        key={v.slug}
                        href={`/visas/${v.slug}`}
                        className="block rounded-lg px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <span className="text-sm font-semibold text-foreground">{v.code}</span>
                        <span className="block text-xs text-muted-foreground">{v.name.replace(v.code, '').trim()}</span>
                      </Link>
                    ))}
                  </div>
                  <div>
                    <p className="px-3 py-1 font-display text-base font-semibold text-accent">Green Cards</p>
                    {greenCards.map((v) => (
                      <Link
                        key={v.slug}
                        href={`/visas/${v.slug}`}
                        className="block rounded-lg px-3 py-2 transition-colors hover:bg-muted"
                      >
                        <span className="text-sm font-semibold text-foreground">{v.code}</span>
                        <span className="block text-xs text-muted-foreground">{v.name.replace(v.code, '').trim()}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
          <Link href="/day-1-cpt" className="rounded-md px-3 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:text-accent">
            Day-1 CPT
          </Link>
          <Link href="/#process" className="rounded-md px-3 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:text-accent">
            How It Works
          </Link>
          <Link href="/#faq" className="rounded-md px-3 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:text-accent">
            FAQ
          </Link>
          <Link href="/refer" className="marker-underline-warm rounded-md px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:text-accent">
            Refer &amp; Earn $500
          </Link>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/contact"
            className="rounded-lg px-3 py-2 text-sm font-semibold text-foreground/75 transition-colors hover:text-accent"
          >
            Free Assessment
          </Link>
          <a
            href={links.calendar}
            target="_blank"
            rel="noopener noreferrer"
            className="sketch-btn sketch-btn-ink px-4 py-2.5 text-sm"
          >
            <CalendarDays className="h-4 w-4" />
            Book a Call
          </a>
        </div>

        <button
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-foreground/80 bg-card text-foreground shadow-sm lg:hidden"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      <div
        className={cn(
          'overflow-hidden border-t-2 border-foreground/90 bg-background lg:hidden',
          mobileOpen ? 'max-h-[560px] overflow-y-auto' : 'max-h-0 border-t-0',
        )}
      >
        <nav className="flex flex-col gap-1 px-4 py-4">
          <p className="px-2 pt-2 font-display text-base font-semibold text-accent">Work Visas</p>
          {nonimmigrant.map((v) => (
            <Link key={v.slug} href={`/visas/${v.slug}`} className="rounded-md px-2 py-2 text-sm font-medium" onClick={() => setMobileOpen(false)}>
              {`${v.code} — ${v.name.replace(v.code, '').trim()}`}
            </Link>
          ))}
          <p className="px-2 pt-3 font-display text-base font-semibold text-accent">Green Cards</p>
          {greenCards.map((v) => (
            <Link key={v.slug} href={`/visas/${v.slug}`} className="rounded-md px-2 py-2 text-sm font-medium" onClick={() => setMobileOpen(false)}>
              {`${v.code} — ${v.name.replace(v.code, '').trim()}`}
            </Link>
          ))}
          <Link href="/day-1-cpt" className="rounded-md px-2 py-2 text-sm font-medium" onClick={() => setMobileOpen(false)}>Day-1 CPT</Link>
          <Link href="/#process" className="rounded-md px-2 py-2 text-sm font-medium" onClick={() => setMobileOpen(false)}>How It Works</Link>
          <Link href="/#faq" className="rounded-md px-2 py-2 text-sm font-medium" onClick={() => setMobileOpen(false)}>FAQ</Link>
          <Link href="/refer" className="rounded-md px-2 py-2 text-sm font-semibold text-accent" onClick={() => setMobileOpen(false)}>Refer &amp; Earn $500</Link>
          <a
            href={links.calendar}
            target="_blank"
            rel="noopener noreferrer"
            className="sketch-btn sketch-btn-ink mt-2 justify-center px-4 py-2.5 text-sm"
            onClick={() => setMobileOpen(false)}
          >
            <CalendarDays className="h-4 w-4" />
            Book a Free Call
          </a>
          <Link
            href="/contact"
            className="sketch-btn sketch-btn-paper mt-1 justify-center px-4 py-2.5 text-sm"
            onClick={() => setMobileOpen(false)}
          >
            Free Assessment
          </Link>
        </nav>
      </div>
    </header>
  )
}
