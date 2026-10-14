import { O1_CATEGORIES, type OnboardingCategory, type OnboardingQuestion } from '@/lib/onboarding-catalog'
import { isAdditionalEvidenceKey } from '@/lib/document-keys'
import { isLinkRequestKey } from '@/lib/link-request-items'

/** One template row: the case's visa document list (Settings list, or built-in list). */
export type OnboardingTemplateItem = {
  documentKey: string
  documentName: string
  category: string
  instructions?: string | null
  sortOrder?: number | null
}

/** General questions every candidate answers, whatever the visa. Keys match the O-1A form so answers stay comparable. */
const PROFILE_QUESTIONS: OnboardingQuestion[] = [
  { key: 'current_employer', label: 'Current employer / organization', type: 'text' },
  { key: 'job_title', label: 'Current job title / role', type: 'text' },
  { key: 'start_date', label: 'Start date', type: 'text' },
  {
    key: 'employment_type',
    label: 'Employment type',
    type: 'select',
    options: ['Full-time', 'Part-time', 'Founder / owner', 'Contractor', 'Investor', 'Student', 'Other'],
  },
  { key: 'annual_compensation', label: 'Annual compensation', type: 'text' },
  { key: 'job_duties', label: 'Primary duties / current work', type: 'textarea' },
  { key: 'linkedin_url', label: 'LinkedIn profile URL', type: 'url' },
  {
    key: 'employment_history',
    label: 'Employment history',
    type: 'repeater',
    fields: [
      { key: 'employer', label: 'Employer', type: 'text' },
      { key: 'title', label: 'Title', type: 'text' },
      { key: 'dates', label: 'Dates', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
]

/**
 * The onboarding form for a case. Every visa type gets a form for its own visa:
 * O-1A keeps its established questionnaire; every other visa gets general
 * candidate questions plus one upload slot per document on that visa's list,
 * so files land directly in the matching checklist items.
 */
export function onboardingCatalogFor(
  visaType: string | null | undefined,
  templateItems: OnboardingTemplateItem[],
): OnboardingCategory[] {
  if (String(visaType) === 'O_1A' || !templateItems.length) return O1_CATEGORIES

  const sections: OnboardingCategory[] = [
    {
      id: 'profile',
      number: '01',
      title: 'Candidate Information',
      folderTitle: '01 Candidate Information',
      description: 'Your current role and background.',
      questions: PROFILE_QUESTIONS,
    },
  ]
  const ordered = [...templateItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const seen = new Set<string>()
  for (const item of ordered) {
    const key = item.documentKey.trim()
    if (!key || seen.has(key) || isAdditionalEvidenceKey(key)) continue
    seen.add(key)
    const title = item.category.trim().replace(/^\d+\s+/, '') || 'Documents'
    let section = sections.find((s) => s.title === title)
    if (!section) {
      const number = String(sections.length + 1).padStart(2, '0')
      section = { id: `docs_${sections.length}`, number, title, folderTitle: `${number} ${title}`, description: '', questions: [] }
      sections.push(section)
    }
    section.questions.push({
      key,
      label: item.documentName,
      help: item.instructions ?? undefined,
      type: isLinkRequestKey(key) ? 'url' : 'file',
      documentType: key,
    })
  }
  const number = String(sections.length + 1).padStart(2, '0')
  sections.push({
    id: 'additional',
    number,
    title: 'Additional Information',
    folderTitle: `${number} Additional Information`,
    description: 'Anything else that supports your case.',
    questions: [
      { key: 'additional_notes', label: 'Anything else we should know', type: 'textarea' },
      { key: 'additional_urls', label: 'Additional URLs', type: 'url' },
      { key: 'additional_files', label: 'Additional supporting files', type: 'file', documentType: 'additional_evidence' },
    ],
  })
  return sections
}

/** File upload keys the form offers (used to validate onboarding uploads). */
export function onboardingFileKeys(catalog: OnboardingCategory[]): Set<string> {
  return new Set(catalog.flatMap((c) => c.questions.filter((q) => q.type === 'file').map((q) => q.key)))
}
