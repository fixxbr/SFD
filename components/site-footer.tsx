import Link from 'next/link'
import { visas } from '@/lib/visas'
import { Mail, MapPin, Globe } from 'lucide-react'
import { BrandLogo, BrandName } from '@/components/brand'

export function SiteFooter() {
  return (
    <footer className="chalk-section border-t-2 border-foreground/90">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <span className="inline-flex rounded-xl bg-paper px-3 py-2 shadow-sm">
              <BrandLogo />
            </span>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-primary-foreground/70">
              <BrandName className="text-primary-foreground hover:text-accent" /> guides exceptional talent through every
              U.S. work visa and green card pathway — from O-1 and EB-1 to EB-2 NIW and EB-5. Your journey after STEM,
              made clear.
            </p>
          </div>

          <div>
            <h3 className="font-display text-xl font-semibold text-accent">Work Visas</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {visas.filter((v) => !v.greenCard).map((v) => (
                <li key={v.slug}>
                  <Link href={`/visas/${v.slug}`} className="text-primary-foreground/80 transition-colors hover:text-primary-foreground">
                    {v.code}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/day-1-cpt" className="text-primary-foreground/80 transition-colors hover:text-primary-foreground">
                  Day-1 CPT Programs
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-xl font-semibold text-accent">Green Cards</h3>
            <ul className="mt-4 space-y-2 text-sm">
              {visas.filter((v) => v.greenCard).map((v) => (
                <li key={v.slug}>
                  <Link href={`/visas/${v.slug}`} className="text-primary-foreground/80 transition-colors hover:text-primary-foreground">
                    {v.code}
                  </Link>
                </li>
              ))}
              <li>
                <Link href="/refer" className="font-semibold text-accent transition-colors hover:text-primary-foreground">
                  Refer &amp; Earn $500
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-display text-xl font-semibold text-accent">Get in Touch</h3>
            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-2 text-primary-foreground/80">
                <Mail className="h-4 w-4 text-accent" />
                <a href="mailto:admin@afterstem.ai" className="hover:text-primary-foreground">admin@afterstem.ai</a>
              </li>
              <li className="flex items-center gap-2 text-primary-foreground/80">
                <MapPin className="h-4 w-4 text-accent" />
                United States
              </li>
              <li className="flex items-center gap-2 text-primary-foreground/80">
                <Globe className="h-4 w-4 text-accent" />
                <Link href="/contact" className="hover:text-primary-foreground">Book a free consultation</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-dashed border-primary-foreground/25 pt-6 text-xs text-primary-foreground/60 md:flex-row md:items-center md:justify-between">
          <p>© {new Date().getFullYear()} Afterstem.ai. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Link href="/terms" className="hover:text-primary-foreground">Terms &amp; Conditions</Link>
            <Link href="/terms#privacy" className="hover:text-primary-foreground">Privacy</Link>
            <Link href="/contact" className="hover:text-primary-foreground">Contact</Link>
            <Link href="/terms#disclaimer" className="hover:text-primary-foreground">Legal Disclaimer</Link>
            <Link href="/admin" className="text-primary-foreground/40 hover:text-primary-foreground/70">
              Admin
            </Link>
          </div>
        </div>
        <p className="mt-4 max-w-3xl text-pretty text-xs leading-relaxed text-primary-foreground/45">
          Afterstem.ai is a technology and consulting platform, not a law firm, and does not provide legal advice.
          Information on this site is for general guidance only and does not create an attorney-client relationship.
          Blank immigration forms and instructions are available for free on the official USCIS website. Consult a
          licensed attorney for advice specific to your situation.
        </p>
      </div>
    </footer>
  )
}
