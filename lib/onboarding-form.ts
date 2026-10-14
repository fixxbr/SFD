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

/** Personal and immigration details — asked on every visa's form, O-1A included. */
export const PERSONAL_SECTION: OnboardingCategory = {
  id: 'personal',
  number: '',
  title: 'Personal & Immigration Information',
  folderTitle: 'Personal & Immigration Information',
  description: 'Your personal details and current U.S. immigration status.',
  questions: [
    { key: 'date_of_birth', label: 'Date of birth', type: 'text' },
    { key: 'country_of_birth', label: 'Country of birth', type: 'text' },
    { key: 'nationality', label: 'Nationality / citizenship', type: 'text' },
    { key: 'current_address', label: 'Current residential address', type: 'textarea' },
    { key: 'phone', label: 'Phone number', type: 'text' },
    { key: 'passport_number', label: 'Passport number', type: 'text' },
    { key: 'passport_expiry', label: 'Passport expiry date', type: 'text' },
    { key: 'in_us', label: 'Are you currently in the United States?', type: 'select', options: ['Yes', 'No'] },
    {
      key: 'current_immigration_status',
      label: 'Current immigration status',
      type: 'select',
      options: [
        'H-1B', 'F-1', 'F-1 OPT / STEM OPT', 'L-1', 'O-1', 'J-1', 'TN', 'E-2', 'B-1 / B-2',
        'H-4 / L-2 / dependent', 'Green card in process', 'Outside the U.S.', 'Other',
      ],
    },
    { key: 'status_expiry', label: 'Status / I-94 expiry date', type: 'text' },
    { key: 'last_us_entry', label: 'Date of last entry to the U.S.', type: 'text' },
    {
      key: 'prior_visa_refusals',
      label: 'Have you ever been refused a U.S. visa, entry or immigration benefit?',
      type: 'select',
      options: ['No', 'Yes'],
    },
    { key: 'prior_visa_refusals_details', label: 'If yes, please explain', type: 'textarea' },
  ],
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
  if (!templateItems.length) return [PERSONAL_SECTION, ...O1_CATEGORIES]
  const ordered = [...templateItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const asQuestion = (item: OnboardingTemplateItem): OnboardingQuestion => ({
    key: item.documentKey.trim(),
    label: item.documentName,
    help: item.instructions ?? undefined,
    type: isLinkRequestKey(item.documentKey) ? 'url' : 'file',
    documentType: item.documentKey.trim(),
  })

  if (String(visaType) === 'O_1A') {
    // O-1A keeps its questionnaire (lists of awards, judging, …), but its upload slots are the
    // visa list's own items, matched by section number, so names match Documents everywhere.
    const used = new Set<string>()
    const sections = O1_CATEGORIES.map((cat) => {
      const docs = ordered.filter((i) => i.category.trim().startsWith(`${cat.number} `))
      docs.forEach((i) => used.add(i.documentKey))
      return { ...cat, questions: [...cat.questions.filter((q) => q.type !== 'file'), ...docs.map(asQuestion)] }
    })
    const rest = ordered.filter((i) => !used.has(i.documentKey))
    if (rest.length) {
      sections.push({ id: 'more_documents', number: '', title: 'More Documents', folderTitle: 'More Documents', description: '', questions: rest.map(asQuestion) })
    }
    return [PERSONAL_SECTION, ...sections]
  }

  const sections: OnboardingCategory[] = [
    PERSONAL_SECTION,
    {
      id: 'profile',
      number: '01',
      title: 'Candidate Information',
      folderTitle: '01 Candidate Information',
      description: 'Your current role and background.',
      questions: PROFILE_QUESTIONS,
    },
  ]
  const seen = new Set<string>()
  let catchAll: OnboardingTemplateItem | null = null
  for (const item of ordered) {
    const key = item.documentKey.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    if (isAdditionalEvidenceKey(key)) {
      catchAll = item
      continue
    }
    const title = item.category.trim().replace(/^\d+\s+/, '') || 'Documents'
    let section = sections.find((s) => s.title === title)
    if (!section) {
      const number = String(sections.length).padStart(2, '0')
      section = { id: `docs_${sections.length}`, number, title, folderTitle: `${number} ${title}`, description: '', questions: [] }
      sections.push(section)
    }
    section.questions.push(asQuestion(item))
  }
  const number = String(sections.length).padStart(2, '0')
  sections.push({
    id: 'additional',
    number,
    title: 'Additional Information',
    folderTitle: `${number} Additional Information`,
    description: 'Anything else that supports your case.',
    questions: [
      { key: 'additional_notes', label: 'Anything else we should know', type: 'textarea' },
      { key: 'additional_urls', label: 'Additional URLs', type: 'url' },
      // Same name and key as the visa list's "additional" item.
      catchAll
        ? asQuestion(catchAll)
        : { key: 'additional_files', label: 'Additional supporting files', type: 'file', documentType: 'additional_evidence' },
    ],
  })
  return sections
}

/** File upload keys the form offers (used to validate onboarding uploads). */
export function onboardingFileKeys(catalog: OnboardingCategory[]): Set<string> {
  return new Set(catalog.flatMap((c) => c.questions.filter((q) => q.type === 'file').map((q) => q.key)))
}
