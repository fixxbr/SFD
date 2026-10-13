import type { Metadata } from 'next'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { NewsTicker } from '@/components/news-ticker'

export const metadata: Metadata = {
  title: 'Terms & Conditions | Afterstem.ai',
  description:
    'Terms & Conditions, Privacy Policy, legal disclaimer, and referral program terms for Afterstem.ai immigration consulting services.',
}

const sections = [
  {
    id: 'terms',
    heading: '1. Terms of Service',
    body: [
      'These Terms & Conditions ("Terms") govern your access to and use of the Afterstem.ai website and services ("Services"). By accessing our website, requesting an assessment, or engaging our Services, you agree to be bound by these Terms.',
      'Afterstem.ai provides immigration strategy and petition-preparation consulting. We may update these Terms from time to time; continued use of the Services after changes are posted constitutes acceptance of the revised Terms.',
    ],
  },
  {
    id: 'disclaimer',
    heading: '2. Legal Disclaimer — Not a Law Firm',
    body: [
      'Afterstem.ai is a technology and consulting platform. It is NOT a law firm and does not provide legal advice or legal representation. Nothing on this website — including guides, articles, checklists, or other materials — constitutes legal advice, and no attorney-client relationship is created by your use of the Services or by any communication with Afterstem.ai.',
      'Immigration laws and USCIS policies change frequently and outcomes depend on individual circumstances. Blank immigration forms and official instructions are available for free on the U.S. Citizenship and Immigration Services (USCIS) website at uscis.gov. Where legal advice is required, we work with, or will refer you to, licensed immigration attorneys who provide legal services under a separate engagement.',
      'We make no guarantee, representation, or warranty regarding the approval, denial, or processing time of any petition or application. Past results do not guarantee future outcomes.',
    ],
  },
  {
    id: 'services',
    heading: '3. Scope of Services & Client Responsibilities',
    body: [
      'Our Services may include profile assessment, category recommendation, evidence planning, assistance organizing documentation, and preparation of petition materials for review. The specific scope of any engagement will be described in a separate service agreement.',
      'You are responsible for providing accurate, truthful, and complete information. Submitting false or misleading information to any government agency is a serious offense and is solely your responsibility. Afterstem.ai is not liable for consequences arising from inaccurate information you provide.',
    ],
  },
  {
    id: 'fees',
    heading: '4. Fees & Payments',
    body: [
      'Service fees are described in your engagement agreement and are separate from government filing fees, premium processing fees, and any attorney fees. Unless expressly stated in writing, fees are non-refundable once work has commenced. Government filing fees are set by USCIS and are subject to change.',
    ],
  },
  {
    id: 'referral',
    heading: '5. Referral Program Terms ($500 Reward)',
    body: [
      'Under the Afterstem.ai referral program, an existing or prospective client ("Referrer") may refer a new individual ("Referred Party") who is not already in contact with Afterstem.ai. To qualify, the referral must be submitted through our official Refer & Earn form before the Referred Party engages our Services.',
      'The $500 referral reward is earned only after the Referred Party signs a paid service agreement and their case is officially underway (i.e., work has commenced and any applicable initial payment has been received). There is no limit on the number of qualifying referrals a Referrer may make.',
      'Rewards are paid within a reasonable period after the qualifying condition is met, via a method determined by Afterstem.ai. Self-referrals, duplicate referrals, and referrals of parties already engaged with us do not qualify. Afterstem.ai reserves the right to modify, suspend, or terminate the referral program, or to withhold a reward in cases of suspected fraud or abuse, at its sole discretion. Referral rewards may be subject to applicable taxes, which are the Referrer\u2019s responsibility.',
    ],
  },
  {
    id: 'day1cpt',
    heading: '6. Day-1 CPT & Third-Party Programs',
    body: [
      'Afterstem.ai may highlight or promote third-party programs, including Day-1 CPT university programs. These programs are operated by independent institutions, and Afterstem.ai does not control and is not responsible for their eligibility rules, compliance, or outcomes. You should independently verify any program\u2019s legitimacy and consult qualified counsel before enrolling. Participation in any third-party program is at your own risk.',
    ],
  },
  {
    id: 'privacy',
    heading: '7. Privacy Policy',
    body: [
      'We collect information you voluntarily provide (such as your name, email, and background details) to respond to inquiries, deliver Services, and administer the referral program. We do not sell your personal information. We use reasonable administrative and technical safeguards to protect your data, though no method of transmission or storage is completely secure.',
      'When you submit a referral, you confirm that you have your referred contact\u2019s permission to share their information with us. We use that information solely to contact them about our Services. You may request access to or deletion of your personal information by emailing hello@afterstem.ai.',
    ],
  },
  {
    id: 'liability',
    heading: '8. Limitation of Liability',
    body: [
      'To the maximum extent permitted by law, Afterstem.ai and its affiliates shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of the Services. Our total aggregate liability for any claim shall not exceed the amount you paid to Afterstem.ai for the specific Service giving rise to the claim.',
    ],
  },
  {
    id: 'contact',
    heading: '9. Contact',
    body: [
      'Questions about these Terms, our Privacy Policy, or the referral program can be directed to hello@afterstem.ai.',
    ],
  },
]

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NewsTicker />
      <SiteHeader />
      <main className="flex-1">
        <section className="chalk-section border-b-2 border-foreground/90 py-14 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <h1 className="text-balance text-3xl font-medium tracking-tight sm:text-4xl">Terms &amp; Conditions</h1>
            <p className="mt-3 text-sm text-primary-foreground/60">
              Last updated {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </section>

        <section className="bg-background py-14 sm:py-16">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <nav aria-label="Sections" className="paper-card sketch-radius-a mb-10 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">On this page</p>
              <ul className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {sections.map((s) => (
                  <li key={s.id}>
                    <a href={`#${s.id}`} className="text-foreground/75 transition-colors hover:text-accent">
                      {s.heading}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <div className="space-y-10">
              {sections.map((s) => (
                <div key={s.id} id={s.id} className="scroll-mt-28">
                  <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">{s.heading}</h2>
                  <div className="mt-3 space-y-4">
                    {s.body.map((p, i) => (
                      <p key={i} className="text-pretty text-sm leading-relaxed text-muted-foreground">
                        {p}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="paper-card sketch-radius-b mt-12 p-5 text-xs leading-relaxed text-muted-foreground">
              This page is provided for general informational purposes and does not constitute legal advice. Please
              consult a licensed attorney for guidance specific to your situation.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
