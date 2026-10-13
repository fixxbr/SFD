/** Starting operational checklists — admin-editable, not legal advice. */

export type SeedItem = {
  category: string
  documentKey: string
  documentName: string
  instructions?: string
  defaultRequired?: boolean
  sortOrder: number
}

export type SeedTemplate = {
  visaTypeCode: string
  name: string
  description: string
  items: SeedItem[]
}

export const SEED_VISA_TYPES: Array<{ code: string; name: string }> = [
  { code: 'O_1A', name: 'O-1A' },
  { code: 'O_1B', name: 'O-1B' },
  { code: 'EB_1A', name: 'EB-1A' },
  { code: 'EB_2_NIW', name: 'EB-2 NIW' },
  { code: 'H_1B', name: 'H-1B' },
  { code: 'L_1A', name: 'L-1A' },
  { code: 'L_1B', name: 'L-1B' },
  { code: 'EB_5', name: 'EB-5' },
  { code: 'OTHER', name: 'Other' },
]

function items(category: string, docs: Array<[string, string, boolean?]>, start = 0): SeedItem[] {
  return docs.map(([documentKey, documentName, defaultRequired], i) => ({
    category,
    documentKey,
    documentName,
    defaultRequired: Boolean(defaultRequired),
    sortOrder: start + i,
  }))
}

export const SEED_VISA_TEMPLATES: SeedTemplate[] = [
  {
    visaTypeCode: 'O_1A',
    name: 'O-1A Documentation Package',
    description: 'Operational O-1A evidence checklist. Customize per case.',
    items: [
      ...items('01 Basic Documents', [
        ['resume', 'Updated Resume/CV', true],
        ['passport', 'Passport copy', true],
        ['current_visa', 'Current visa copy'],
        ['i94', 'Latest I-94'],
        ['immigration_status_docs', 'Current immigration status documents'],
        ['i797', 'All I-797 approval/receipt notices, if applicable'],
        ['ead_i20', 'EAD and I-20 copies, if applicable'],
        ['previous_o1', 'Previous O-1 petition/approval/RFE documents, if applicable'],
        ['degrees', "Bachelor's, Master's, Ph.D. or other degree certificates", true],
        ['transcripts', 'Academic transcripts'],
        ['certifications', 'Professional certifications/licenses'],
      ], 10),
      ...items('02 Employment Information', [
        ['employment_letter', 'Employment / offer letter'],
        ['job_description', 'Job description / duties'],
        ['pay_evidence', 'Pay stubs / compensation evidence'],
      ], 100),
      ...items('03 Awards & Recognition', [['awards_evidence', 'Awards & recognition evidence']], 200),
      ...items('04 Judging Experience', [['judging_evidence', 'Judging experience evidence']], 300),
      ...items('05 Publications & Research', [['publications_evidence', 'Publications & research evidence']], 400),
      ...items('06 Media / Published Material About Candidate', [['media_evidence', 'Media / published material about you']], 500),
      ...items('07 Original Contributions / Major Impact', [['contributions_evidence', 'Original contributions / major impact evidence']], 600),
      ...items('08 Critical / Essential Role', [['critical_role_evidence', 'Critical / essential role evidence']], 700),
      ...items('09 Professional Memberships', [['memberships_evidence', 'Professional memberships evidence']], 800),
      ...items('10 High Salary / Compensation', [['high_salary_evidence', 'High salary / compensation evidence']], 900),
      ...items('11 Speaking & Professional Recognition', [['speaking_evidence', 'Speaking & professional recognition']], 1000),
      ...items('12 Recommendation Letter Contacts', [['recommender_contacts', 'Recommendation letter contacts']], 1100),
      ...items('13 Proposed O-1 Work', [['proposed_work', 'Proposed O-1 work description']], 1200),
      ...items('14 Additional Evidence', [['additional_evidence', 'Additional supporting evidence']], 1300),
    ],
  },
  {
    visaTypeCode: 'O_1B',
    name: 'O-1B Documentation Package',
    description: 'Operational O-1B arts/entertainment checklist.',
    items: [
      ...items('01 Basic Documents', [
        ['resume', 'Updated Resume/CV / credits', true],
        ['passport', 'Passport copy', true],
        ['current_visa', 'Current visa copy'],
        ['i94', 'Latest I-94'],
        ['i797', 'I-797 notices if applicable'],
        ['portfolio', 'Portfolio / demo reel'],
      ], 10),
      ...items('02 Achievements', [
        ['awards', 'Awards & nominations'],
        ['critical_reviews', 'Critical reviews / press'],
        ['lead_roles', 'Lead / starring role evidence'],
        ['commercial_success', 'Commercial success evidence'],
      ], 100),
      ...items('03 Additional Evidence', [['additional_evidence', 'Additional supporting evidence']], 200),
    ],
  },
  {
    visaTypeCode: 'EB_1A',
    name: 'EB-1A Documentation Package',
    description: 'Operational EB-1A extraordinary ability checklist.',
    items: [
      ...items('Basic immigration documents', [
        ['passport', 'Passport', true],
        ['i94', 'I-94'],
        ['status_docs', 'Current status documents'],
      ], 10),
      ...items('Resume/CV', [['resume', 'Updated Resume/CV', true]], 50),
      ...items('Education', [['degrees', 'Degree certificates'], ['transcripts', 'Transcripts']], 100),
      ...items('Awards', [['awards', 'Awards evidence']], 150),
      ...items('Published material', [['media', 'Published material about you']], 200),
      ...items('Judging', [['judging', 'Judging evidence']], 250),
      ...items('Original contributions', [['contributions', 'Original contributions']], 300),
      ...items('Scholarly authorship', [['publications', 'Scholarly publications']], 350),
      ...items('Critical/leading role', [['critical_role', 'Critical / leading role']], 400),
      ...items('High remuneration', [['high_salary', 'High remuneration evidence']], 450),
      ...items('Professional memberships', [['memberships', 'Professional memberships']], 500),
      ...items('Recommendation contacts', [['recommenders', 'Recommendation contacts']], 550),
      ...items('Additional evidence', [['additional', 'Additional evidence']], 600),
    ],
  },
  {
    visaTypeCode: 'EB_2_NIW',
    name: 'EB-2 NIW Documentation Package',
    description: 'Operational NIW checklist.',
    items: [
      ...items('Basic immigration documents', [
        ['passport', 'Passport', true],
        ['i94', 'I-94'],
        ['status_docs', 'Current status documents'],
      ], 10),
      ...items('Resume/CV', [['resume', 'Updated Resume/CV', true]], 40),
      ...items('Education and advanced degree evidence', [
        ['degrees', 'Advanced degree evidence', true],
        ['transcripts', 'Transcripts'],
        ['credential_eval', 'Credential evaluation if applicable'],
      ], 80),
      ...items('Employment history', [['employment_history', 'Employment history evidence']], 120),
      ...items('Research/publications', [['publications', 'Research / publications']], 160),
      ...items('Citation information', [['citations', 'Citation information']], 200),
      ...items('Patents/innovations', [['patents', 'Patents / innovations']], 240),
      ...items('Projects', [['projects', 'Key projects']], 280),
      ...items('National importance evidence', [['national_importance', 'National importance evidence']], 320),
      ...items('Future endeavor', [['future_endeavor', 'Proposed future endeavor']], 360),
      ...items('Recommendation contacts', [['recommenders', 'Recommendation contacts']], 400),
      ...items('Independent expert letters', [['expert_letters', 'Independent expert letters']], 440),
      ...items('Industry impact', [['industry_impact', 'Industry impact evidence']], 480),
      ...items('Additional supporting evidence', [['additional', 'Additional supporting evidence']], 520),
    ],
  },
  {
    visaTypeCode: 'H_1B',
    name: 'H-1B Documentation Package',
    description: 'Operational H-1B checklist.',
    items: [
      ...items('Identity & status', [
        ['passport', 'Passport', true],
        ['current_visa', 'Current visa/status documents'],
        ['i94', 'I-94'],
        ['ead_i20', 'I-20/EAD if applicable'],
      ], 10),
      ...items('Education', [
        ['degrees', 'Degrees', true],
        ['transcripts', 'Transcripts'],
        ['credential_eval', 'Credential evaluation if applicable'],
      ], 80),
      ...items('Employment', [
        ['resume', 'Resume', true],
        ['offer_letter', 'Offer letter'],
        ['job_description', 'Job description'],
        ['worksite', 'Worksite information'],
        ['pay_records', 'Pay records if applicable'],
      ], 150),
      ...items('Prior approvals', [['prior_h1b', 'Prior H-1B approvals']], 220),
      ...items('Employer documents', [['employer_docs', 'Employer supporting documents']], 260),
      ...items('Additional documents', [['additional', 'Additional documents']], 300),
    ],
  },
  {
    visaTypeCode: 'L_1A',
    name: 'L-1A Documentation Package',
    description: 'Operational L-1A managerial/executive checklist.',
    items: [
      ...items('Identity & status', [
        ['passport', 'Passport', true],
        ['status_docs', 'Current immigration documents'],
        ['resume', 'Resume', true],
      ], 10),
      ...items('Corporate relationship', [
        ['foreign_employer', 'Foreign employer evidence'],
        ['us_employer', 'U.S. employer evidence'],
        ['corporate_relationship', 'Corporate relationship documents'],
      ], 80),
      ...items('Employment', [
        ['employment_history', 'Employment history'],
        ['foreign_payroll', 'Foreign payroll/employment evidence'],
        ['managerial_evidence', 'Managerial/executive evidence'],
        ['org_charts', 'Organizational charts'],
        ['job_descriptions', 'Job descriptions'],
      ], 150),
      ...items('Company documentation', [['company_docs', 'Company documentation']], 220),
      ...items('Additional evidence', [['additional', 'Additional evidence']], 260),
    ],
  },
  {
    visaTypeCode: 'L_1B',
    name: 'L-1B Documentation Package',
    description: 'Operational L-1B specialized knowledge checklist.',
    items: [
      ...items('Identity & status', [
        ['passport', 'Passport', true],
        ['status_docs', 'Current immigration documents'],
        ['resume', 'Resume', true],
      ], 10),
      ...items('Corporate relationship', [
        ['foreign_employer', 'Foreign employer evidence'],
        ['us_employer', 'U.S. employer evidence'],
        ['corporate_relationship', 'Corporate relationship documents'],
      ], 80),
      ...items('Employment', [
        ['employment_history', 'Employment history'],
        ['foreign_payroll', 'Foreign payroll/employment evidence'],
        ['specialized_knowledge', 'Specialized knowledge evidence'],
        ['org_charts', 'Organizational charts'],
        ['job_descriptions', 'Job descriptions'],
      ], 150),
      ...items('Company documentation', [['company_docs', 'Company documentation']], 220),
      ...items('Additional evidence', [['additional', 'Additional evidence']], 260),
    ],
  },
  {
    visaTypeCode: 'EB_5',
    name: 'EB-5 Documentation Package',
    description: 'Operational EB-5 checklist.',
    items: [
      ...items('Identity documents', [['passport', 'Passport / identity', true]], 10),
      ...items('Immigration documents', [['status_docs', 'Immigration documents']], 40),
      ...items('Investment information', [['investment_info', 'Investment information']], 80),
      ...items('Source of funds', [['source_of_funds', 'Source of funds']], 120),
      ...items('Path of funds', [['path_of_funds', 'Path of funds']], 160),
      ...items('Tax returns', [['tax_returns', 'Tax returns']], 200),
      ...items('Bank statements', [['bank_statements', 'Bank statements']], 240),
      ...items('Business ownership records', [['business_ownership', 'Business ownership records']], 280),
      ...items('Loan/gift/inheritance evidence', [['funds_support', 'Loan/gift/inheritance evidence where applicable']], 320),
      ...items('Investment entity documents', [['investment_entity', 'Investment entity documents']], 360),
      ...items('Project documentation', [['project_docs', 'Project documentation']], 400),
      ...items('Employment/job creation records', [['job_creation', 'Employment/job creation records']], 440),
      ...items('Family/dependent documents', [['dependents', 'Family/dependent documents']], 480),
      ...items('Additional evidence', [['additional', 'Additional evidence']], 520),
    ],
  },
  {
    visaTypeCode: 'OTHER',
    name: 'General Documentation Package',
    description: 'Generic starting checklist for other visa types.',
    items: [
      ...items('Basic documents', [
        ['passport', 'Passport', true],
        ['resume', 'Resume/CV', true],
        ['status_docs', 'Current immigration documents'],
        ['i94', 'I-94 if applicable'],
      ], 10),
      ...items('Education', [['degrees', 'Degree certificates'], ['transcripts', 'Transcripts']], 80),
      ...items('Employment', [['employment_letter', 'Employment letter'], ['offer_letter', 'Offer letter']], 140),
      ...items('Additional evidence', [['additional', 'Additional evidence']], 200),
    ],
  },
]
