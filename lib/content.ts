export type Testimonial = {
  quote: string
  name: string
  role: string
  visa: string
}

export const testimonials: Testimonial[] = [
  {
    quote:
      'I always thought a green card meant waiting a decade in a backlog. Afterstem showed me I qualified for EB-1A and built a petition around work I did not even realize was "extraordinary." Approved on the first try.',
    name: 'Priya N.',
    role: 'Machine Learning Researcher',
    visa: 'EB-1A Approved',
  },
  {
    quote:
      'As a founder on OPT, the clock was terrifying. The team mapped an O-1A around my startup traction and my patents. Every question got an answer the same day. It genuinely felt like they cared about my case.',
    name: 'Daniel R.',
    role: 'Startup Founder',
    visa: 'O-1A Approved',
  },
  {
    quote:
      'The EB-2 NIW felt out of reach until Afterstem framed my research impact in plain, compelling language. The evidence plan they gave me was a checklist I could actually follow.',
    name: 'Wei L.',
    role: 'Biomedical Engineer',
    visa: 'EB-2 NIW Approved',
  },
  {
    quote:
      'What stood out was the honesty. They told me I was not ready for EB-1A yet and gave me a 12-month plan to get there instead of just taking my money. That built total trust.',
    name: 'Ahmed K.',
    role: 'Data Scientist',
    visa: 'Strategy Client',
  },
  {
    quote:
      'From the free assessment to the approval notice, I always knew exactly where my case stood. The recommendation letters they helped draft were the strongest part of my petition.',
    name: 'Sofia M.',
    role: 'Product Designer',
    visa: 'O-1B Approved',
  },
  {
    quote:
      'I referred two friends after my own approval — the process was that smooth, and the referral bonus was a nice thank-you. Both of them are now in the process too.',
    name: 'Carlos V.',
    role: 'Cloud Architect',
    visa: 'O-1A Approved',
  },
]

export type Faq = {
  q: string
  a: string
}

export const faqs: Faq[] = [
  {
    q: 'How do I know which visa or green card category is right for me?',
    a: 'It depends on your achievements, your field, and your goals. During your free assessment we review your full profile — publications, awards, salary, leadership, patents, press, and more — against every eligible category (O-1A, O-1B, O-2, O-3, EB-1A, EB-1B, EB-2, EB-2 NIW, EB-3, and EB-5). We then recommend the pathway with the strongest chance of approval, and explain honestly if you are not yet ready for a particular one.',
  },
  {
    q: 'Do I need a job offer or an employer to sponsor me?',
    a: 'Not for every category. O-1 requires a U.S. employer or agent, but the EB-1A and EB-2 NIW green cards are self-petitioned — meaning you can file for yourself without any employer sponsorship or the H-1B lottery. This is one of the biggest advantages we help talented individuals unlock.',
  },
  {
    q: 'What is the difference between the O-1 visa and an EB-1A green card?',
    a: 'The O-1 is a temporary work visa (renewable), while the EB-1A is a permanent green card. Both are for individuals with extraordinary ability, but the EB-1A has a higher evidentiary bar because it grants permanent residence. Many clients start on an O-1 to live and work in the U.S. now, then transition to an EB-1A or EB-2 NIW for permanent status.',
  },
  {
    q: 'How long does the whole process take?',
    a: 'Petition preparation typically takes 4–12 weeks depending on how quickly evidence and recommendation letters come together. After filing, USCIS processing times vary by category, and premium processing (15 calendar days for eligible petitions) can dramatically speed up the decision. We give you a realistic timeline for your specific case up front.',
  },
  {
    q: 'What does Afterstem.ai actually do for me?',
    a: 'We handle strategy and petition-building end to end: choosing the right category, mapping the exact evidence you need, helping draft and structure recommendation letters, organizing exhibits, and preparing an attorney-ready petition reviewed with immigration counsel before filing. You focus on your work; we build the case.',
  },
  {
    q: 'Are you a law firm, and is this legal advice?',
    a: 'Afterstem.ai is a technology and consulting platform, not a law firm, and nothing on this site is legal advice. We partner with licensed immigration attorneys who review petitions, and we always recommend consulting counsel for advice specific to your situation. Blank immigration forms are available for free on the official USCIS website.',
  },
  {
    q: 'How does the $500 referral bonus work?',
    a: 'Simple: refer a friend or client who signs up for a paid Afterstem.ai engagement, and once their case is officially underway, you receive a $500 reward. There is no limit — refer as many qualified people as you like. Share your details on our Refer & Earn page to get started.',
  },
  {
    q: 'What are Day-1 CPT programs and why do you promote them?',
    a: 'Day-1 CPT programs are graduate programs that authorize Curricular Practical Training from your first day of enrollment, letting eligible students work while they study. For some people they are a useful bridge while building toward a long-term visa. We highlight trusted programs so you can weigh every option — always alongside a compliant, well-planned immigration strategy.',
  },
]
