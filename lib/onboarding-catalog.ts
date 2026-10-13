export type QuestionType = 'text' | 'textarea' | 'url' | 'select' | 'repeater' | 'file'

export type OnboardingQuestion = {
  key: string
  label: string
  help?: string
  type: QuestionType
  required?: boolean
  options?: string[]
  fields?: { key: string; label: string; type: 'text' | 'textarea' | 'url' }[]
  documentType?: string
}

export type OnboardingCategory = {
  id: string
  number: string
  title: string
  folderTitle: string
  description: string
  questions: OnboardingQuestion[]
}

export const O1_CATEGORIES: OnboardingCategory[] = [
  {
    id: 'basic_documents',
    number: '01',
    title: 'Basic Documents',
    folderTitle: '01 Basic Documents',
    description: 'Identity, status, and education documents. Each item has its own uploader.',
    questions: [
      {
        key: 'resume',
        label: 'Updated Resume/CV',
        type: 'file',
        required: true,
        documentType: 'resume_cv',
      },
      {
        key: 'passport',
        label: 'Passport copy',
        type: 'file',
        required: true,
        documentType: 'passport',
      },
      {
        key: 'current_visa',
        label: 'Current visa copy',
        type: 'file',
        documentType: 'current_visa',
      },
      {
        key: 'i94',
        label: 'Latest I-94',
        type: 'file',
        documentType: 'i94',
      },
      {
        key: 'immigration_status_docs',
        label: 'Current immigration status documents',
        type: 'file',
        documentType: 'immigration_status',
      },
      {
        key: 'i797',
        label: 'All I-797 approval/receipt notices, if applicable',
        type: 'file',
        documentType: 'i797',
      },
      {
        key: 'ead_i20',
        label: 'EAD and I-20 copies, if applicable',
        type: 'file',
        documentType: 'ead_i20',
      },
      {
        key: 'previous_o1',
        label: 'Previous O-1 petition/approval/RFE documents, if applicable',
        type: 'file',
        documentType: 'previous_o1',
      },
      {
        key: 'degrees',
        label: "Bachelor's, Master's, Ph.D. or other degree certificates",
        type: 'file',
        required: true,
        documentType: 'degree_certificates',
      },
      {
        key: 'transcripts',
        label: 'Academic transcripts',
        type: 'file',
        documentType: 'academic_transcripts',
      },
      {
        key: 'certifications',
        label: 'Professional certifications/licenses',
        type: 'file',
        documentType: 'professional_certifications',
      },
    ],
  },
  {
    id: 'employment',
    number: '02',
    title: 'Employment Information',
    folderTitle: '02 Employment Information',
    description: 'Current and prior roles, compensation, and employment evidence.',
    questions: [
      { key: 'current_employer', label: 'Current employer / petitioner', type: 'text', required: true },
      { key: 'job_title', label: 'Current job title', type: 'text', required: true },
      { key: 'start_date', label: 'Start date', type: 'text' },
      {
        key: 'employment_type',
        label: 'Employment type',
        type: 'select',
        options: ['Full-time', 'Part-time', 'Founder / owner', 'Contractor', 'Agent petitioner', 'Other'],
      },
      { key: 'annual_compensation', label: 'Annual compensation', type: 'text' },
      { key: 'job_duties', label: 'Primary job duties', type: 'textarea', required: true },
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
      {
        key: 'offer_letter',
        label: 'Offer letter / employment verification',
        type: 'file',
        documentType: 'offer_letter',
      },
      {
        key: 'pay_evidence',
        label: 'Pay stubs, W-2, or other compensation evidence',
        type: 'file',
        documentType: 'pay_evidence',
      },
    ],
  },
  {
    id: 'awards',
    number: '03',
    title: 'Awards & Recognition',
    folderTitle: '03 Awards & Recognition',
    description: 'Nationally or internationally recognized prizes or awards for excellence.',
    questions: [
      {
        key: 'awards_list',
        label: 'Awards and prizes',
        type: 'repeater',
        fields: [
          { key: 'name', label: 'Award name', type: 'text' },
          { key: 'issuer', label: 'Issuer', type: 'text' },
          { key: 'date', label: 'Date', type: 'text' },
          { key: 'url', label: 'URL', type: 'url' },
          { key: 'description', label: 'Why it is significant', type: 'textarea' },
        ],
      },
      { key: 'award_certificates', label: 'Award certificates', type: 'file', documentType: 'award_certificates' },
      { key: 'award_evidence', label: 'Supporting files for awards', type: 'file', documentType: 'award_evidence' },
    ],
  },
  {
    id: 'judging',
    number: '04',
    title: 'Judging Experience',
    folderTitle: '04 Judging Experience',
    description: 'Participation as a judge of the work of others in the field.',
    questions: [
      {
        key: 'judging_list',
        label: 'Judging, peer review, or selection-committee work',
        type: 'repeater',
        fields: [
          { key: 'organization', label: 'Organization / venue', type: 'text' },
          { key: 'role', label: 'Role', type: 'text' },
          { key: 'dates', label: 'Dates', type: 'text' },
          { key: 'url', label: 'URL', type: 'url' },
          { key: 'description', label: 'What you judged', type: 'textarea' },
        ],
      },
      { key: 'judging_invitations', label: 'Invitation letters', type: 'file', documentType: 'judging_invitations' },
      { key: 'judging_evidence', label: 'Supporting files', type: 'file', documentType: 'judging_evidence' },
    ],
  },
  {
    id: 'publications',
    number: '05',
    title: 'Publications & Research',
    folderTitle: '05 Publications & Research',
    description: 'Scholarly articles, papers, and research output.',
    questions: [
      { key: 'scholar_url', label: 'Google Scholar / ORCID / research profile URL', type: 'url' },
      {
        key: 'publications_list',
        label: 'Publications',
        type: 'repeater',
        fields: [
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'venue', label: 'Journal / venue', type: 'text' },
          { key: 'date', label: 'Date', type: 'text' },
          { key: 'url', label: 'URL', type: 'url' },
          { key: 'citations', label: 'Citation count', type: 'text' },
        ],
      },
      { key: 'publication_pdfs', label: 'Publication PDFs', type: 'file', documentType: 'publication_pdfs' },
    ],
  },
  {
    id: 'media',
    number: '06',
    title: 'Media / Published Material About You',
    folderTitle: '06 Media & Published Material',
    description: 'Major media or professional publications about you and your work.',
    questions: [
      {
        key: 'media_list',
        label: 'Press and published material about you',
        type: 'repeater',
        fields: [
          { key: 'outlet', label: 'Outlet', type: 'text' },
          { key: 'title', label: 'Headline / title', type: 'text' },
          { key: 'date', label: 'Date', type: 'text' },
          { key: 'url', label: 'URL', type: 'url' },
        ],
      },
      { key: 'media_clippings', label: 'Clippings and supporting files', type: 'file', documentType: 'media_clippings' },
    ],
  },
  {
    id: 'contributions',
    number: '07',
    title: 'Original Contributions / Major Impact',
    folderTitle: '07 Original Contributions',
    description: 'Original scientific, scholarly, or business contributions of major significance.',
    questions: [
      {
        key: 'contributions_list',
        label: 'Original contributions',
        type: 'repeater',
        fields: [
          { key: 'title', label: 'Contribution', type: 'text' },
          { key: 'impact', label: 'Impact on the field', type: 'textarea' },
          { key: 'url', label: 'URL', type: 'url' },
        ],
      },
      {
        key: 'patents_list',
        label: 'Patents or proprietary work',
        type: 'repeater',
        fields: [
          { key: 'title', label: 'Title / number', type: 'text' },
          { key: 'status', label: 'Status', type: 'text' },
          { key: 'url', label: 'URL', type: 'url' },
        ],
      },
      { key: 'contribution_evidence', label: 'Supporting files', type: 'file', documentType: 'contribution_evidence' },
    ],
  },
  {
    id: 'critical_role',
    number: '08',
    title: 'Critical / Essential Role',
    folderTitle: '08 Critical / Essential Role',
    description: 'Leading or critical role for distinguished organizations.',
    questions: [
      { key: 'critical_organization', label: 'Organization', type: 'text' },
      { key: 'critical_role', label: 'Your role', type: 'text' },
      { key: 'why_critical', label: 'Why the role is critical / essential', type: 'textarea' },
      { key: 'org_distinction', label: 'Why the organization is distinguished', type: 'textarea' },
      { key: 'critical_role_letter', label: 'Letter or org-chart evidence', type: 'file', documentType: 'critical_role_letter' },
      { key: 'org_evidence', label: 'Organization distinction evidence', type: 'file', documentType: 'org_evidence' },
    ],
  },
  {
    id: 'memberships',
    number: '09',
    title: 'Professional Memberships',
    folderTitle: '09 Professional Memberships',
    description: 'Memberships that require outstanding achievement.',
    questions: [
      {
        key: 'memberships_list',
        label: 'Memberships',
        type: 'repeater',
        fields: [
          { key: 'organization', label: 'Organization', type: 'text' },
          { key: 'criteria', label: 'Admission criteria', type: 'textarea' },
          { key: 'dates', label: 'Dates', type: 'text' },
          { key: 'url', label: 'URL', type: 'url' },
        ],
      },
      { key: 'membership_proof', label: 'Membership proof', type: 'file', documentType: 'membership_proof' },
    ],
  },
  {
    id: 'high_salary',
    number: '10',
    title: 'High Salary / Compensation',
    folderTitle: '10 High Salary & Compensation',
    description: 'Remuneration that demonstrates extraordinary ability relative to peers.',
    questions: [
      { key: 'current_salary', label: 'Current salary / compensation', type: 'text' },
      { key: 'salary_comparables', label: 'Comparables and market context', type: 'textarea' },
      { key: 'salary_docs', label: 'Offer letter / payslips', type: 'file', documentType: 'salary_docs' },
      { key: 'salary_surveys', label: 'Salary surveys or expert letters', type: 'file', documentType: 'salary_surveys' },
    ],
  },
  {
    id: 'speaking',
    number: '11',
    title: 'Speaking & Professional Recognition',
    folderTitle: '11 Speaking & Professional Recognition',
    description: 'Invited talks, conferences, and other professional recognition.',
    questions: [
      {
        key: 'talks_list',
        label: 'Talks and appearances',
        type: 'repeater',
        fields: [
          { key: 'event', label: 'Event', type: 'text' },
          { key: 'title', label: 'Talk title', type: 'text' },
          { key: 'date', label: 'Date', type: 'text' },
          { key: 'url', label: 'URL', type: 'url' },
        ],
      },
      { key: 'speaking_urls', label: 'Program pages or recordings (URLs)', type: 'url' },
      { key: 'speaking_evidence', label: 'Programs, invitations, recordings', type: 'file', documentType: 'speaking_evidence' },
    ],
  },
  {
    id: 'recommenders',
    number: '12',
    title: 'Recommendation Letter Contacts',
    folderTitle: '12 Recommendation Letters',
    description: 'Independent and expert recommenders for the petition.',
    questions: [
      {
        key: 'recommenders_list',
        label: 'Recommender contacts',
        type: 'repeater',
        fields: [
          { key: 'name', label: 'Name', type: 'text' },
          { key: 'title', label: 'Title', type: 'text' },
          { key: 'organization', label: 'Organization', type: 'text' },
          { key: 'email', label: 'Email', type: 'text' },
          { key: 'phone', label: 'Phone', type: 'text' },
          { key: 'relationship', label: 'Relationship / independence', type: 'textarea' },
        ],
      },
      { key: 'existing_letters', label: 'Existing recommendation letters', type: 'file', documentType: 'recommendation_letters' },
    ],
  },
  {
    id: 'proposed_work',
    number: '13',
    title: 'Proposed O-1 Work',
    folderTitle: '13 Proposed O-1 Work',
    description: 'The U.S. role, petitioner, and itinerary for the O-1 petition.',
    questions: [
      { key: 'petitioner', label: 'Petitioner / U.S. employer or agent', type: 'text', required: true },
      { key: 'proposed_title', label: 'Proposed role title', type: 'text', required: true },
      { key: 'worksites', label: 'Worksites', type: 'text' },
      { key: 'itinerary', label: 'Proposed itinerary / work description', type: 'textarea', required: true },
      { key: 'support_letter', label: 'Support letter', type: 'file', documentType: 'support_letter' },
      { key: 'contract', label: 'Contract or agent agreement', type: 'file', documentType: 'contract' },
    ],
  },
  {
    id: 'additional',
    number: '14',
    title: 'Additional Evidence',
    folderTitle: '14 Additional Evidence',
    description: 'Anything else that strengthens the petition.',
    questions: [
      { key: 'additional_notes', label: 'Anything else we should know', type: 'textarea' },
      { key: 'additional_urls', label: 'Additional URLs', type: 'url' },
      { key: 'additional_files', label: 'Additional supporting files', type: 'file', documentType: 'additional_evidence' },
    ],
  },
]

export function allQuestions(): OnboardingQuestion[] {
  return O1_CATEGORIES.flatMap((c) => c.questions)
}

export function questionByKey(key: string): { category: OnboardingCategory; question: OnboardingQuestion } | null {
  for (const category of O1_CATEGORIES) {
    const question = category.questions.find((q) => q.key === key)
    if (question) return { category, question }
  }
  return null
}

export const EVIDENCE_CATEGORY_IDS = [
  'awards',
  'judging',
  'publications',
  'media',
  'contributions',
  'critical_role',
  'memberships',
  'high_salary',
  'speaking',
] as const
