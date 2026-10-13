export type Visa = {
  slug: string
  code: string
  name: string
  tagline: string
  category: 'Nonimmigrant Visa' | 'Green Card (Immigrant Visa)'
  summary: string
  bestFor: string[]
  criteria: string[]
  benefits: string[]
  timeline: string
  timelineRegular?: string
  timelinePremium?: string
  acceptanceRate?: string
  greenCard: boolean
}

export const visas: Visa[] = [
  {
    slug: 'o-1a',
    code: 'O-1A',
    name: 'O-1A Extraordinary Ability',
    tagline: 'For individuals with extraordinary ability in the sciences, education, business, or athletics.',
    category: 'Nonimmigrant Visa',
    summary:
      'The O-1A is a work visa for people who have risen to the very top of their field in science, technology, education, business, or athletics. It is a popular next step after STEM roles and OPT for researchers, engineers, founders, and specialists. Afterstem.AI helps you package your achievements into a compelling, evidence-backed petition.',
    bestFor: [
      'STEM researchers and engineers',
      'Startup founders and tech leaders',
      'Data scientists and AI specialists',
      'Business and finance professionals',
    ],
    criteria: [
      'Nationally or internationally recognized awards',
      'Membership in associations requiring outstanding achievement',
      'Published material about you in professional or major media',
      'Original contributions of major significance to the field',
      'Authorship of scholarly articles',
      'A high salary or remuneration relative to peers',
    ],
    benefits: [
      'Initial stay of up to 3 years, renewable in 1-year increments',
      'No annual cap or lottery',
      'Premium processing available',
      'Dependents may accompany you on O-3 status',
    ],
    timeline: '8–12 months regular · 12–15 days with premium processing',
    timelineRegular: '8–12 months',
    timelinePremium: '12–15 days',
    acceptanceRate: '91–96%',
    greenCard: false,
  },
  {
    slug: 'o-1b',
    code: 'O-1B',
    name: 'O-1B Arts & Media',
    tagline: 'For individuals with extraordinary ability in the arts, film, or television industry.',
    category: 'Nonimmigrant Visa',
    summary:
      'The O-1B is designed for artists, designers, performers, and professionals in the motion picture and television industry who have a demonstrated record of extraordinary achievement or distinction in their craft. The Afterstem.AI team knows how to translate creative work into the evidence USCIS expects.',
    bestFor: [
      'Designers and creative directors',
      'Filmmakers, editors, and producers',
      'Musicians and performing artists',
      'Digital and visual artists',
    ],
    criteria: [
      'Lead or starring roles in distinguished productions',
      'National or international recognition through reviews',
      'A record of major commercial or critical success',
      'Recognition from experts and organizations in the field',
      'A high salary relative to others in the field',
    ],
    benefits: [
      'Initial stay of up to 3 years, renewable in 1-year increments',
      'No annual cap or lottery',
      'Premium processing available',
      'Dependents may accompany you on O-3 status',
    ],
    timeline: '8–12 months regular · 12–15 days with premium processing',
    timelineRegular: '8–12 months',
    timelinePremium: '12–15 days',
    acceptanceRate: '91–96%',
    greenCard: false,
  },
  {
    slug: 'o-2',
    code: 'O-2',
    name: 'O-2 Support Personnel',
    tagline: 'For essential support staff accompanying an O-1 artist or athlete.',
    category: 'Nonimmigrant Visa',
    summary:
      'The O-2 visa is for individuals who accompany and assist an O-1 artist or athlete in a specific event or performance. The support must be integral, and the person must have critical skills and experience that cannot be readily performed by a U.S. worker. Afterstem.AI coordinates O-2 filings alongside the principal O-1 petition.',
    bestFor: [
      'Technical and production crew',
      'Coaches and training staff',
      'Long-term creative collaborators',
      'Specialized assistants to O-1 talent',
    ],
    criteria: [
      'The support is an integral part of the O-1 activity',
      'Critical skills and experience with the O-1 principal',
      'A pre-existing, longstanding working relationship',
      'The role cannot be readily performed by a U.S. worker',
    ],
    benefits: [
      'Status tied to the O-1 principal\u2019s validity period',
      'No annual cap or lottery',
      'Premium processing available',
      'Dependents may accompany you on O-3 status',
    ],
    timeline: '2-4 months with premium processing',
    greenCard: false,
  },
  {
    slug: 'o-3',
    code: 'O-3',
    name: 'O-3 Dependents',
    tagline: 'For the spouse and children of O-1 and O-2 visa holders.',
    category: 'Nonimmigrant Visa',
    summary:
      'The O-3 visa lets the spouse and unmarried children under 21 of an O-1 or O-2 holder live in the United States for the same period as the principal. O-3 dependents can study full-time or part-time but cannot work. Afterstem.AI files dependent applications together with the main case so your family stays together.',
    bestFor: [
      'Spouses of O-1 / O-2 visa holders',
      'Children under 21 of O-1 / O-2 holders',
      'Families relocating to the U.S. together',
      'Dependents planning to study in the U.S.',
    ],
    criteria: [
      'A valid marriage or parent-child relationship to the O-1/O-2 principal',
      'Children must be unmarried and under 21',
      'The principal must hold valid O-1 or O-2 status',
      'Proof of the qualifying family relationship',
    ],
    benefits: [
      'Stay for the same period as the principal visa holder',
      'Attend school full-time or part-time',
      'Multiple entries into the United States',
      'Extendable as long as the principal maintains status',
    ],
    timeline: '2-4 months, aligned with the principal petition',
    greenCard: false,
  },
  {
    slug: 'eb-1a',
    code: 'EB-1A',
    name: 'EB-1A Extraordinary Ability',
    tagline: 'A first-preference green card for those at the top of their field \u2014 no employer or job offer required.',
    category: 'Green Card (Immigrant Visa)',
    summary:
      'The EB-1A is a self-petitioned green card for individuals with extraordinary ability. It requires no employer sponsorship and no labor certification, making it one of the fastest and most flexible paths to U.S. permanent residency for top talent. Afterstem.AI builds EB-1A cases that clearly demonstrate sustained acclaim.',
    bestFor: [
      'Award-winning researchers and scientists',
      'Founders and executives with proven impact',
      'Highly cited academics and inventors',
      'Recognized professionals in any field',
    ],
    criteria: [
      'Meet at least 3 of the 10 USCIS criteria, or a major one-time achievement',
      'Evidence of sustained national or international acclaim',
      'Original contributions of major significance',
      'Judging the work of others in your field',
      'Published material about your work in major media',
    ],
    benefits: [
      'Self-petition \u2014 no employer or job offer needed',
      'No labor certification (PERM) required',
      'Path to permanent residency and citizenship',
      'Include your spouse and children',
    ],
    timeline: '8-14 months (premium processing available for I-140)',
    greenCard: true,
  },
  {
    slug: 'eb-1b',
    code: 'EB-1B',
    name: 'EB-1B Outstanding Researcher',
    tagline: 'A first-preference green card for outstanding professors and researchers with employer sponsorship.',
    category: 'Green Card (Immigrant Visa)',
    summary:
      'The EB-1B is for internationally recognized outstanding professors and researchers with at least three years of experience. It requires an offer of a permanent research or tenure-track role but no labor certification. Afterstem.AI helps universities, labs, and companies document a researcher\u2019s international recognition.',
    bestFor: [
      'Tenure-track and research professors',
      'Senior researchers at labs and companies',
      'Principal investigators with strong citations',
      'Scientists with international recognition',
    ],
    criteria: [
      'International recognition as outstanding in your field',
      'At least 3 years of research or teaching experience',
      'A permanent job offer from a U.S. employer',
      'Meet at least 2 of the 6 USCIS evidentiary criteria',
    ],
    benefits: [
      'No labor certification (PERM) required',
      'Faster than most employment green card categories',
      'Path to permanent residency and citizenship',
      'Include your spouse and children',
    ],
    timeline: '8-14 months (premium processing available for I-140)',
    greenCard: true,
  },
  {
    slug: 'eb-2',
    code: 'EB-2',
    name: 'EB-2 Advanced Degree (PERM)',
    tagline: 'A second-preference green card for advanced-degree professionals with an employer sponsor.',
    category: 'Green Card (Immigrant Visa)',
    summary:
      'The standard EB-2 is an employer-sponsored green card for professionals holding an advanced degree, or a bachelor\u2019s degree plus five years of progressive experience. It requires a labor certification (PERM) confirming no qualified U.S. worker is available. Afterstem.AI guides both employers and applicants through PERM and the I-140.',
    bestFor: [
      'Advanced-degree professionals with a job offer',
      'Engineers and specialists sponsored by employers',
      'Professionals with a bachelor\u2019s + 5 years experience',
      'Candidates who do not qualify for a national interest waiver',
    ],
    criteria: [
      'A U.S. job offer requiring an advanced degree or its equivalent',
      'An approved PERM labor certification',
      'An advanced degree, or a bachelor\u2019s plus 5 years of progressive experience',
      'The employer\u2019s ability to pay the offered wage',
    ],
    benefits: [
      'Path to permanent residency and citizenship',
      'Covers a wide range of professional roles',
      'Include your spouse and children',
      'Priority date can be retained across employers',
    ],
    timeline: '14-24 months including PERM processing',
    greenCard: true,
  },
  {
    slug: 'eb-2-niw',
    code: 'EB-2 NIW',
    name: 'EB-2 National Interest Waiver',
    tagline: 'A green card for advanced-degree professionals whose work benefits the United States.',
    category: 'Green Card (Immigrant Visa)',
    summary:
      'The EB-2 NIW lets qualified professionals self-petition for a green card by demonstrating that their work has substantial merit and national importance to the United States, waiving the standard job offer and labor certification requirements. Afterstem.AI frames your endeavor around real national-interest impact.',
    bestFor: [
      'Advanced-degree STEM professionals',
      'Entrepreneurs building U.S. ventures',
      'Researchers in critical technologies',
      'Healthcare and public-interest professionals',
    ],
    criteria: [
      'An advanced degree or exceptional ability',
      'Your endeavor has substantial merit and national importance',
      'You are well positioned to advance the endeavor',
      'It benefits the U.S. to waive the job offer requirement',
    ],
    benefits: [
      'Self-petition \u2014 no employer sponsorship needed',
      'No labor certification (PERM) required',
      'Path to permanent residency and citizenship',
      'Include your spouse and children',
    ],
    timeline: '10-16 months (premium processing available for I-140)',
    greenCard: true,
  },
  {
    slug: 'eb-3',
    code: 'EB-3',
    name: 'EB-3 Skilled & Professional Workers',
    tagline: 'A third-preference green card for skilled workers, professionals, and other workers.',
    category: 'Green Card (Immigrant Visa)',
    summary:
      'The EB-3 is an employer-sponsored green card for professionals with a bachelor\u2019s degree, skilled workers with at least two years of training or experience, and certain other workers. Like the standard EB-2, it requires a PERM labor certification. Afterstem.AI supports employers and applicants from PERM through adjustment of status.',
    bestFor: [
      'Professionals with a U.S. bachelor\u2019s degree',
      'Skilled workers with 2+ years experience',
      'Employer-sponsored candidates',
      'Applicants who do not meet EB-2 requirements',
    ],
    criteria: [
      'A permanent, full-time U.S. job offer',
      'An approved PERM labor certification',
      'A bachelor\u2019s degree, or 2+ years of relevant experience/training',
      'The employer\u2019s ability to pay the offered wage',
    ],
    benefits: [
      'Path to permanent residency and citizenship',
      'Open to a broad range of occupations',
      'Include your spouse and children',
      'Priority date portability across employers',
    ],
    timeline: '18-30 months including PERM (varies by country)',
    greenCard: true,
  },
  {
    slug: 'eb-5',
    code: 'EB-5',
    name: 'EB-5 Immigrant Investor',
    tagline: 'A green card through qualifying investment that creates U.S. jobs \u2014 no employer or sponsor needed.',
    category: 'Green Card (Immigrant Visa)',
    summary:
      'The EB-5 program grants permanent residency to investors who make a qualifying investment in a new U.S. commercial enterprise that creates at least 10 full-time jobs. It is fully self-directed \u2014 no employer or job offer required. Afterstem.AI works with you and your financial advisors to structure a compliant, well-documented petition.',
    bestFor: [
      'Investors and entrepreneurs',
      'Families seeking residency together',
      'Applicants without employer sponsorship',
      'Those who want a self-directed green card path',
    ],
    criteria: [
      'Invest $1,050,000, or $800,000 in a targeted employment area',
      'Investment in a new commercial enterprise',
      'Create or preserve at least 10 full-time U.S. jobs',
      'Demonstrate the lawful source of invested funds',
    ],
    benefits: [
      'Self-petition \u2014 no employer or job offer required',
      'Green card for you, your spouse, and children under 21',
      'Live, work, and study anywhere in the U.S.',
      'Reserved visa categories can shorten wait times',
    ],
    timeline: '24-48 months (varies by investment type and country)',
    greenCard: true,
  },
]

export function getVisa(slug: string) {
  return visas.find((v) => v.slug === slug)
}
