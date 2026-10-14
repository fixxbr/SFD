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

type Doc = [key: string, name: string, required?: boolean, instructions?: string]

function items(category: string, docs: Doc[], start = 0): SeedItem[] {
  return docs.map(([documentKey, documentName, defaultRequired, instructions], i) => ({
    category,
    documentKey,
    documentName,
    defaultRequired: Boolean(defaultRequired),
    instructions,
    sortOrder: start + i,
  }))
}

// Acceptable-document guidance shared by several visa types.
const I = {
  resume: 'Current CV listing every position, dates, achievements, publications, awards and memberships.',
  passport: 'Biographic page of a valid passport, plus pages with U.S. visas and entry stamps.',
  currentVisa: 'Copy of your current U.S. visa stamp, if you have one.',
  i94: 'Most recent I-94 record (download from the CBP I-94 website).',
  i797: 'All I-797 approval and receipt notices for current and past petitions.',
  status: 'Documents showing your current U.S. status (I-797, I-20, EAD, DS-2019, as applicable).',
  degrees: 'Degree certificates or diplomas; add certified English translations where needed.',
  transcripts: 'Official academic transcripts (mark sheets) for each degree.',
  credentialEval: 'Foreign degree evaluation from a credential evaluation service, if your degree is from outside the U.S.',
  recLetters: 'Signed letters on letterhead from experts, including independent experts who know your work by reputation, describing specific, verifiable achievements, their impact and how they know your work.',
  recContacts: 'Name, title, organization, email and relationship for each person who may write a letter.',
  advisory: 'Written consultation from a peer group, labor union or management organization, or a request to waive it if no such group exists.',
  contract: 'Signed contract between the petitioner and you, or a written summary of the terms of an oral agreement.',
  itinerary: 'Dates, locations and descriptions of events or engagements; needed when you work in more than one location.',
  agent: 'Agent agreement and authorizations, if an agent or agency files the petition.',
  petitioner: 'U.S. employer or petitioner details: company overview, website, recent financials, FEIN.',
  comparable: 'Comparable evidence, if a listed criterion does not readily apply to your occupation, with an explanation of why it is comparable.',
  awards: 'Award certificates or letters, selection criteria, number of nominees or winners, past recipients, issuer details and press about the award.',
  majorAward: 'One-time, major internationally recognized award (e.g. Nobel Prize, Fields Medal), if applicable.',
  memberships: 'Membership certificates plus bylaws or rules showing members are admitted for outstanding achievement judged by recognized experts.',
  media: 'Independent articles about you or your work in professional, trade or major media: copies with title, date, author, outlet circulation and translations.',
  judging: 'Invitations to judge or review others’ work (journals, conferences, competitions, grant panels), proof you completed it (reviewer records, thank-you letters), what you evaluated, and evidence of the venue’s standing.',
  contributions: 'Patents, licensing, adoption of your work, citations, usage metrics, independent corroboration and expert letters describing major significance.',
  scholarly: 'Copies of your scholarly articles or books showing the author list, date and venue, with journal impact or circulation details.',
  citations: 'Citation reports (Google Scholar, Scopus, Web of Science), field averages for comparison, and examples of others citing your work.',
  criticalRole: 'Letters from the organization describing your leading or critical role, your specific responsibilities and results, org charts, and evidence of the organization’s distinguished reputation.',
  highSalary: 'Contracts, pay stubs, W-2s or tax returns, plus comparison data (BLS wage data, salary surveys) for your field and location.',
  speaking: 'Invitations, conference programs, agendas, attendance figures and recordings for talks you gave, plus any recognition you received.',
  exhibitions: 'Exhibition catalogs, invitations, programs and reviews for shows or showcases displaying your work.',
  commercial: 'Box office receipts, sales figures, ratings, chart standings or streaming numbers.',
  immigrationHistory: 'Your full U.S. immigration history: every prior status and visa, petitions filed (approved, denied or withdrawn), RFEs, visa refusals and travel dates.',
  translations: 'Certified English translations of any document not in English, each with the translator’s certificate of accuracy.',
  dependents: 'For a spouse or children coming with you: passports, birth certificates, marriage certificate and current status documents.',
  signedForms: 'USCIS forms and signature pages your attorney prepares for you to sign. Upload them here once signed.',
  awardCriteria: 'For each award: selection criteria, number of applicants or nominees, past recipients, who judged it, and its national or international reputation.',
  outletReputation: 'Circulation, readership or ranking of the outlets that published material about you.',
  impactEvidence: 'Independent proof your work is used or had major impact: adoption by others, licensing, sales, usage metrics, third-party articles.',
  orgReputation: 'Evidence of the organization’s distinguished reputation: rankings, press coverage, revenue, awards, notable clients.',
  membershipRules: 'Bylaws or admission rules showing members are selected for outstanding achievement, judged by recognized experts.',
  salaryComparison: 'Wage data for your occupation, location and seniority (BLS / DOL wage levels, salary surveys) showing your pay is high in comparison.',
}

export const SEED_VISA_TEMPLATES: SeedTemplate[] = [
  {
    visaTypeCode: 'O_1A',
    name: 'O-1A Documentation Package',
    description: 'O-1A extraordinary ability (sciences, education, business, athletics). Evidence: one major award or at least 3 of 8 criteria.',
    items: [
      ...items('01 Basic Documents', [
        ['resume', 'Updated Resume/CV', true, I.resume],
        ['passport', 'Passport copy', true, I.passport],
        ['current_visa', 'Current visa copy', false, I.currentVisa],
        ['i94', 'Latest I-94', false, I.i94],
        ['immigration_status_docs', 'Current immigration status documents', false, I.status],
        ['i797', 'All I-797 approval/receipt notices, if applicable', false, I.i797],
        ['ead_i20', 'EAD and I-20 copies, if applicable', false, 'EAD card (front and back) and all I-20s, if applicable.'],
        ['previous_o1', 'Previous O-1 petition/approval/RFE documents, if applicable', false, 'Prior O-1 petition copy, approval notice and any RFE and response.'],
        ['degrees', "Bachelor's, Master's, Ph.D. or other degree certificates", true, I.degrees],
        ['transcripts', 'Academic transcripts', false, I.transcripts],
        ['certifications', 'Professional certifications/licenses', false, 'Professional licenses or certifications relevant to your field.'],
        ['credential_eval', 'Credential evaluation, if applicable', false, I.credentialEval],
        ['immigration_history', 'Full immigration history (prior statuses, petitions, travel)', false, I.immigrationHistory],
        ['translations', 'Certified English translations, if applicable', false, I.translations],
        ['dependent_documents', 'Dependent documents (spouse / children), if applicable', false, I.dependents],
      ], 10),
      ...items('02 Employment Information', [
        ['employment_letter', 'Employment / offer letter', false, 'Current employment verification or offer letter on company letterhead.'],
        ['job_description', 'Job description / duties', false, 'Description of your current role and duties.'],
        ['pay_evidence', 'Pay stubs / compensation evidence', false, 'Recent pay stubs, W-2s or employment contracts.'],
      ], 100),
      ...items('03 Awards & Recognition', [
        ['awards_evidence', 'Awards & recognition evidence', false, I.awards],
        ['major_award', 'One-time major internationally recognized award, if applicable', false, I.majorAward],
        ['award_criteria', 'Award criteria, selectivity and past recipients', false, I.awardCriteria],
      ], 200),
      ...items('04 Judging Experience', [['judging_evidence', 'Judging experience evidence', false, I.judging]], 300),
      ...items('05 Publications & Research', [
        ['publications_evidence', 'Publications & research evidence', false, I.scholarly],
        ['citation_report', 'Citation reports', false, I.citations],
      ], 400),
      ...items('06 Media / Published Material About Candidate', [
        ['media_evidence', 'Media / published material about you', false, I.media],
        ['outlet_reputation', 'Circulation / reputation of the outlets', false, I.outletReputation],
      ], 500),
      ...items('07 Original Contributions / Major Impact', [
        ['contributions_evidence', 'Original contributions / major impact evidence', false, I.contributions],
        ['impact_evidence', 'Independent evidence of adoption / impact', false, I.impactEvidence],
      ], 600),
      ...items('08 Critical / Essential Role', [
        ['critical_role_evidence', 'Critical / essential role evidence', false, I.criticalRole],
        ['org_reputation', 'Evidence of the organization’s distinguished reputation', false, I.orgReputation],
      ], 700),
      ...items('09 Professional Memberships', [
        ['memberships_evidence', 'Professional memberships evidence', false, I.memberships],
        ['membership_requirements', 'Membership admission requirements / bylaws', false, I.membershipRules],
      ], 800),
      ...items('10 High Salary / Compensation', [
        ['high_salary_evidence', 'High salary / compensation evidence', false, I.highSalary],
        ['salary_comparison', 'Comparable salary data (occupation, location, seniority)', false, I.salaryComparison],
      ], 900),
      ...items('11 Speaking & Professional Recognition', [['speaking_evidence', 'Speaking & professional recognition', false, I.speaking]], 1000),
      ...items('12 Recommendation Letter Contacts', [
        ['recommender_contacts', 'Recommendation letter contacts', false, I.recContacts],
        ['recommendation_letters', 'Signed expert / recommendation letters', false, I.recLetters],
      ], 1100),
      ...items('13 Proposed O-1 Work', [
        ['proposed_work', 'Proposed O-1 work description', false, 'Detailed description of the work you will do in the U.S.: projects, events, duties, the petitioner, location and duration.'],
        ['advisory_opinion', 'Advisory opinion / consultation letter (peer group or labor organization)', false, I.advisory],
        ['contract', 'Contract or summary of oral agreement', false, I.contract],
        ['itinerary', 'Itinerary of events / engagements', false, I.itinerary],
        ['agent_agreement', 'Agent agreement (if an agent files the petition)', false, I.agent],
        ['petitioner_docs', 'U.S. employer / petitioner information', false, I.petitioner],
        ['signed_forms', 'Signed forms and signature pages', false, I.signedForms],
      ], 1200),
      ...items('14 Additional Evidence', [
        ['additional_evidence', 'Additional supporting evidence', false, 'Anything else that supports your case.'],
        ['comparable_evidence', 'Comparable evidence', false, I.comparable],
      ], 1300),
    ],
  },
  {
    visaTypeCode: 'O_1B',
    name: 'O-1B Documentation Package',
    description: 'O-1B extraordinary ability or achievement in the arts, motion picture or television.',
    items: [
      ...items('01 Basic Documents', [
        ['resume', 'Updated Resume/CV / credits', true, 'Current CV with full list of credits, productions, roles and dates.'],
        ['passport', 'Passport copy', true, I.passport],
        ['current_visa', 'Current visa copy', false, I.currentVisa],
        ['i94', 'Latest I-94', false, I.i94],
        ['i797', 'I-797 notices if applicable', false, I.i797],
        ['i94_history', 'I-94 travel history', false, 'Travel history printout from the CBP I-94 website.'],
        ['link_portfolio', 'Portfolio / demo reel link', false, 'Link to your portfolio, demo reel or showreel. Check that it opens without a login.'],
        ['portfolio_copies', 'Dated copies / screenshots of portfolio work', false, 'Dated screenshots or copies of your portfolio and online work, in case a link changes or goes offline.'],
        ['immigration_history', 'Full immigration history (prior statuses, petitions, travel)', false, I.immigrationHistory],
        ['translations', 'Certified English translations, if applicable', false, I.translations],
        ['dependent_documents', 'Dependent documents (spouse / children), if applicable', false, I.dependents],
      ], 10),
      ...items('02 Achievements', [
        ['awards', 'Awards & nominations', false, 'Nominations for or awards such as an Academy Award, Emmy, Grammy or Directors Guild Award, plus other national or international prizes.'],
        ['critical_reviews', 'Critical reviews / press', false, 'Reviews and articles in major newspapers, trade journals or magazines about you and your work.'],
        ['lead_roles', 'Lead / starring role evidence', false, 'Evidence of lead or starring roles in productions or events with a distinguished reputation: reviews, contracts, screen credits, production materials.'],
        ['commercial_success', 'Commercial success evidence', false, I.commercial],
        ['distinguished_org_evidence', 'Lead role for distinguished organizations / productions', false, 'Letters and evidence of your lead or critical role for organizations with a distinguished reputation.'],
        ['testimonial_letters', 'Reviews and testimonial letters (organizations, critics, experts)', false, 'Testimonials from organizations, critics, government agencies or recognized experts, with specific, verifiable examples of your achievements.'],
        ['high_salary', 'High salary / remuneration evidence', false, I.highSalary],
        ['recommendation_letters', 'Signed expert / recommendation letters', false, I.recLetters],
        ['box_office', 'Box office, ratings, sales or chart standings', false, I.commercial],
        ['publicity', 'Advertisements, playbills and publicity naming you', false, 'Posters, playbills, advertisements and press kits that name you and your role.'],
        ['comparable_evidence', 'Comparable evidence', false, I.comparable],
        ['award_criteria', 'Award reputation and selection criteria', false, I.awardCriteria],
        ['credits_proof', 'Screen credits, cast lists and production materials', false, 'Screen credits, cast and crew lists, call sheets and production materials showing your name and role.'],
        ['org_reputation', 'Reputation of the organizations / productions', false, 'Independent evidence of the distinguished reputation of the organizations, productions or venues you worked with.'],
        ['salary_comparison', 'Industry pay comparisons', false, 'Union scale, industry rate cards or salary surveys for your role, showing your pay is high in comparison.'],
      ], 100),
      ...items('Petition documents', [
        ['advisory_opinion', 'Advisory opinion / consultation letter (union or peer group)', false, I.advisory],
        ['contract', 'Contract / deal memo or summary of oral agreement', false, I.contract],
        ['itinerary', 'Itinerary of events / engagements', false, I.itinerary],
        ['management_opinion', 'Consultation from a management organization (film / TV)', false, 'For motion picture or television work, a consultation from a management organization as well as the union.'],
        ['agent_agreement', 'Agent agreement (if an agent files the petition)', false, I.agent],
        ['petitioner_docs', 'U.S. employer / petitioner information', false, I.petitioner],
        ['signed_forms', 'Signed forms and signature pages', false, I.signedForms],
      ], 150),
      ...items('03 Additional Evidence', [['additional_evidence', 'Additional supporting evidence', false, 'Anything else that supports your case.']], 200),
    ],
  },
  {
    visaTypeCode: 'EB_1A',
    name: 'EB-1A Documentation Package',
    description: 'EB-1A extraordinary ability green card. Evidence: one major award or at least 3 of 10 criteria, plus continuing work in the field.',
    items: [
      ...items('Basic immigration documents', [
        ['passport', 'Passport', true, I.passport],
        ['i94', 'I-94', false, I.i94],
        ['status_docs', 'Current status documents', false, I.status],
        ['current_visa', 'Current visa copy', false, I.currentVisa],
        ['i797', 'I-797 approval / receipt notices', false, I.i797],
        ['immigration_history', 'Full immigration history (prior statuses, petitions, travel)', false, I.immigrationHistory],
        ['translations', 'Certified English translations, if applicable', false, I.translations],
      ], 10),
      ...items('Resume/CV', [['resume', 'Updated Resume/CV', true, I.resume]], 50),
      ...items('Education', [
        ['degrees', 'Degree certificates', false, I.degrees],
        ['transcripts', 'Transcripts', false, I.transcripts],
        ['credential_eval', 'Credential evaluation, if applicable', false, I.credentialEval],
      ], 100),
      ...items('Awards', [
        ['awards', 'Awards evidence', false, I.awards],
        ['major_award', 'One-time major internationally recognized award, if applicable', false, I.majorAward],
        ['award_criteria', 'Award criteria, selectivity and past recipients', false, I.awardCriteria],
      ], 150),
      ...items('Published material', [
        ['media', 'Published material about you', false, I.media],
        ['outlet_reputation', 'Circulation / reputation of the outlets', false, I.outletReputation],
      ], 200),
      ...items('Judging', [['judging', 'Judging evidence', false, I.judging]], 250),
      ...items('Original contributions', [
        ['contributions', 'Original contributions', false, I.contributions],
        ['impact_evidence', 'Independent evidence of major significance', false, I.impactEvidence],
      ], 300),
      ...items('Scholarly authorship', [
        ['publications', 'Scholarly publications', false, I.scholarly],
        ['citations', 'Citation records', false, I.citations],
      ], 350),
      ...items('Critical/leading role', [
        ['critical_role', 'Critical / leading role', false, I.criticalRole],
        ['org_reputation', 'Evidence of the organization’s distinguished reputation', false, I.orgReputation],
      ], 400),
      ...items('Artistic exhibitions', [['exhibitions', 'Artistic exhibitions / showcases (if arts)', false, I.exhibitions]], 420),
      ...items('Commercial success', [['commercial_success', 'Commercial success in the performing arts (if applicable)', false, I.commercial]], 430),
      ...items('High remuneration', [
        ['high_salary', 'High remuneration evidence', false, I.highSalary],
        ['salary_comparison', 'Comparable compensation data', false, I.salaryComparison],
      ], 450),
      ...items('Professional memberships', [
        ['memberships', 'Professional memberships', false, I.memberships],
        ['membership_requirements', 'Membership admission requirements / bylaws', false, I.membershipRules],
      ], 500),
      ...items('Recommendation contacts', [
        ['recommenders', 'Recommendation contacts', false, I.recContacts],
        ['recommendation_letters', 'Signed expert / recommendation letters', false, I.recLetters],
      ], 550),
      ...items('Continuing work in the U.S.', [['continuing_work', 'Evidence of continuing work in the field in the U.S.', false, 'Letters from prospective U.S. employers, contracts, offers, project plans, or a detailed statement of your plans to continue working in your field.']], 570),
      ...items('Civil documents', [
        ['civil_documents', 'Birth / marriage certificates (principal and dependents)', false, 'Birth certificates, and marriage certificate if applicable, with certified translations.'],
        ['dependent_documents', 'Dependent documents (spouse / children), if applicable', false, I.dependents],
      ], 580),
      ...items('Forms & signatures', [['signed_forms', 'Signed forms and signature pages', false, I.signedForms]], 590),
      ...items('Additional evidence', [
        ['additional', 'Additional evidence', false, 'Anything else that supports your case.'],
        ['comparable_evidence', 'Comparable evidence', false, I.comparable],
      ], 600),
    ],
  },
  {
    visaTypeCode: 'EB_2_NIW',
    name: 'EB-2 NIW Documentation Package',
    description: 'EB-2 national interest waiver: advanced degree or exceptional ability, plus the three Dhanasar prongs.',
    items: [
      ...items('Basic immigration documents', [
        ['passport', 'Passport', true, I.passport],
        ['i94', 'I-94', false, I.i94],
        ['status_docs', 'Current status documents', false, I.status],
        ['immigration_history', 'Full immigration history (prior statuses, petitions, travel)', false, I.immigrationHistory],
        ['translations', 'Certified English translations, if applicable', false, I.translations],
      ], 10),
      ...items('Resume/CV', [['resume', 'Updated Resume/CV', true, I.resume]], 40),
      ...items('Education and advanced degree evidence', [
        ['degrees', 'Advanced degree evidence', true, "U.S. master's or higher (or foreign equivalent), or a bachelor's degree plus letters proving 5 years of progressive experience."],
        ['transcripts', 'Transcripts', false, I.transcripts],
        ['credential_eval', 'Credential evaluation if applicable', false, I.credentialEval],
      ], 80),
      ...items('Employment history', [
        ['employment_history', 'Employment history evidence', false, 'Employment verification letters, contracts or pay records for past and current roles.'],
        ['experience_letters', 'Employer experience verification letters', false, 'Letters from employers on letterhead with your title, exact dates, full-time status and detailed duties.'],
      ], 120),
      ...items('Exceptional ability (if no advanced degree)', [
        ['professional_license', 'Professional license or certification', false, 'License to practice or certification for your profession.'],
        ['salary_evidence', 'Salary evidence showing exceptional ability', false, I.highSalary],
        ['memberships', 'Memberships in professional associations', false, 'Membership certificates or letters from professional associations.'],
        ['recognition', 'Recognition from peers, government or business organizations', false, 'Awards, letters or certificates recognizing your achievements and contributions.'],
      ], 130),
      ...items('Research/publications', [['publications', 'Research / publications', false, I.scholarly]], 160),
      ...items('Citation information', [['citations', 'Citation information', false, I.citations]], 200),
      ...items('Patents/innovations', [['patents', 'Patents / innovations', false, 'Patents, patent applications, licensing agreements or products built on your innovations, plus evidence of adoption, use or measurable impact.']], 240),
      ...items('Projects', [['projects', 'Key projects', false, 'Key projects you led or contributed to: your role, outcomes and verifiable results.']], 280),
      ...items('National importance evidence', [
        ['national_importance', 'National importance evidence', false, 'Evidence your specific endeavor has substantial merit and national importance, including its broader implications: government reports, industry data, policy documents, media coverage.'],
        ['funding_evidence', 'Grants, funding, and letters of interest', false, 'Grants, investment, contracts or letters of interest from potential users, customers or partners.'],
      ], 320),
      ...items('Future endeavor', [
        ['future_endeavor', 'Proposed future endeavor', false, 'A statement of the specific work you plan to do in the U.S.: scope, objectives, milestones, expected outcomes and how you will carry it out.'],
        ['business_plan', 'Business plan (entrepreneurs)', false, 'Business plan with market evidence, team and resources, financial assumptions and an execution plan, if you are founding a company.'],
        ['waiver_statement', 'Why waiving the job offer benefits the U.S.', false, 'Explanation of why the U.S. benefits from waiving the job offer and labor certification in your case.'],
      ], 360),
      ...items('Recommendation contacts', [
        ['recommenders', 'Recommendation contacts', false, I.recContacts],
        ['recommendation_letters', 'Signed recommendation letters', false, I.recLetters],
      ], 400),
      ...items('Independent expert letters', [['expert_letters', 'Independent expert letters', false, 'Signed letters from independent experts who know your work through its reputation, not personal ties.']], 440),
      ...items('Industry impact', [
        ['industry_impact', 'Industry impact evidence', false, 'Evidence others in your field use or rely on your work: adoption, metrics, testimonials.'],
        ['media', 'Media coverage of you or your work', false, I.media],
      ], 480),
      ...items('Civil documents', [
        ['civil_documents', 'Birth / marriage certificates (principal and dependents)', false, 'Birth certificates, and marriage certificate if applicable, with certified translations.'],
        ['dependent_documents', 'Dependent documents (spouse / children), if applicable', false, I.dependents],
      ], 500),
      ...items('Forms & signatures', [['signed_forms', 'Signed forms and signature pages', false, I.signedForms]], 510),
      ...items('Additional supporting evidence', [['additional', 'Additional supporting evidence', false, 'Anything else that supports your case.']], 520),
    ],
  },
  {
    visaTypeCode: 'H_1B',
    name: 'H-1B Documentation Package',
    description: 'H-1B specialty occupation: certified LCA, a qualifying degree, and a job that requires it.',
    items: [
      ...items('Identity & status', [
        ['passport', 'Passport', true, I.passport],
        ['current_visa', 'Current visa/status documents', false, I.status],
        ['i94', 'I-94', false, I.i94],
        ['ead_i20', 'I-20/EAD if applicable', false, 'All I-20s and EAD cards (front and back), if applicable.'],
        ['immigration_history', 'Full immigration history (prior statuses, petitions, travel)', false, I.immigrationHistory],
        ['translations', 'Certified English translations, if applicable', false, I.translations],
        ['dependent_documents', 'Dependent documents (spouse / children), if applicable', false, I.dependents],
      ], 10),
      ...items('Education', [
        ['degrees', 'Degrees', true, "Bachelor's degree or higher in a field related to the job (or foreign equivalent)."],
        ['transcripts', 'Transcripts', false, I.transcripts],
        ['credential_eval', 'Credential evaluation if applicable', false, I.credentialEval],
        ['professional_license', 'Professional license (if required for the job)', false, 'State license or registration, if the occupation requires one.'],
        ['experience_letters', 'Experience letters for degree equivalency', false, 'Employer letters if experience is used toward degree equivalency (3 years of experience = 1 year of college).'],
      ], 80),
      ...items('Employment', [
        ['resume', 'Resume', true, I.resume],
        ['offer_letter', 'Offer letter', false, 'Signed job offer with title, salary, start date and worksite.'],
        ['job_description', 'Job description', false, 'Detailed duties showing the role requires a specialized degree.'],
        ['specialty_evidence', 'Evidence the role requires a specialty degree', false, 'Industry job postings, degree requirements for similar roles, and the employer’s past hiring for this position.'],
        ['worksite', 'Worksite information', false, 'Address of every place you will work; it must match the LCA.'],
        ['pay_records', 'Pay records if applicable', false, 'Recent pay stubs and W-2s showing you maintained status (extensions and transfers).'],
      ], 150),
      ...items('Prior approvals', [['prior_h1b', 'Prior H-1B approvals', false, 'All prior H-1B I-797 approval notices.']], 220),
      ...items('Employer documents', [
        ['employer_docs', 'Employer supporting documents', false, I.petitioner],
        ['lca', 'Certified Labor Condition Application (LCA)', false, 'The certified LCA (ETA-9035) from the Department of Labor, prepared by the employer.'],
        ['registration_notice', 'H-1B registration selection notice (cap cases)', false, 'The registration selection notice, for cap-subject petitions.'],
        ['end_client_letter', 'End-client letter / itinerary (third-party worksite)', false, 'Letter from the end client confirming the project, your role and duration, for third-party placements.'],
        ['msa_sow', 'Client contracts (MSA / SOW / work orders)', false, 'Contracts linking the employer to the end client, for third-party placements.'],
        ['signed_forms', 'Signed forms and signature pages', false, I.signedForms],
      ], 260),
      ...items('Supporting letters', [
        ['recommendation_letters', 'Signed expert / recommendation letters', false, I.recLetters],
        ['expert_opinion', 'Specialty occupation expert opinion (if needed)', false, 'An expert letter explaining why the position requires a specialized degree.'],
      ], 290),
      ...items('Additional documents', [['additional', 'Additional documents', false, 'Anything else that supports your case.']], 300),
    ],
  },
  {
    visaTypeCode: 'L_1A',
    name: 'L-1A Documentation Package',
    description: 'L-1A intracompany transferee (manager or executive): qualifying relationship, one year abroad, managerial role.',
    items: [
      ...items('Identity & status', [
        ['passport', 'Passport', true, I.passport],
        ['status_docs', 'Current immigration documents', false, I.status],
        ['resume', 'Resume', true, I.resume],
        ['i94', 'I-94', false, I.i94],
        ['current_visa', 'Current visa copy', false, I.currentVisa],
        ['i797', 'I-797 notices / prior approvals', false, I.i797],
        ['immigration_history', 'Full immigration history (prior statuses, petitions, travel)', false, I.immigrationHistory],
        ['translations', 'Certified English translations, if applicable', false, I.translations],
        ['dependent_documents', 'Dependent documents (spouse / children), if applicable', false, I.dependents],
      ], 10),
      ...items('Corporate relationship', [
        ['foreign_employer', 'Foreign employer evidence', false, 'Registration, business license and proof the foreign company is operating.'],
        ['us_employer', 'U.S. employer evidence', false, 'Articles of incorporation, EIN letter and proof the U.S. company is operating.'],
        ['corporate_relationship', 'Corporate relationship documents', false, 'Documents proving parent, branch, subsidiary or affiliate relationship: ownership charts, annual reports.'],
        ['blanket_l', 'Blanket L approval (if applicable)', false, 'Blanket L approval notice, if the company has one.'],
        ['ownership_docs', 'Ownership records (stock certificates, shareholder register)', false, 'Stock certificates, shareholder registers, operating agreements showing common ownership.'],
        ['corporate_chart', 'Corporate ownership chart', false, 'Chart of every entity in the group with ownership percentages, matching the ownership records.'],
      ], 80),
      ...items('Employment', [
        ['employment_history', 'Employment history', false, 'Your employment history with the company group.'],
        ['foreign_payroll', 'Foreign payroll/employment evidence', false, 'Pay slips, tax records and an employer letter proving 1 continuous year of full-time work abroad in the last 3 years.'],
        ['managerial_evidence', 'Managerial/executive evidence', false, 'Evidence you manage the organization, a department or an essential function: duties, authority, decisions and time allocation.'],
        ['org_charts', 'Organizational charts', false, 'Org charts for the foreign and U.S. companies showing your position, reporting lines, subordinate roles and staffing.'],
        ['job_descriptions', 'Job descriptions', false, 'Detailed descriptions of your duties abroad and in the proposed U.S. role, with time percentages.'],
        ['position_comparison', 'Foreign vs. U.S. position comparison', false, 'Side-by-side comparison of your role abroad and the U.S. role: duties, authority, reports and time spent.'],
        ['assignment_letter', 'Transfer / assignment letter', false, 'Employer letter describing the U.S. assignment: role, duties, salary and duration.'],
        ['subordinates', 'Subordinate staff list', false, 'Names, titles, duties, qualifications and reporting lines of the people you will supervise.'],
      ], 150),
      ...items('Company documentation', [
        ['company_docs', 'Company documentation', false, 'Company brochures, website printouts and descriptions of products and services.'],
        ['financial_statements', 'Financial statements / tax returns (both companies)', false, 'Recent financial statements and tax returns for both companies.'],
        ['new_office_docs', 'New office lease and business plan (if applicable)', false, 'For a new U.S. office: lease for premises, business plan and proof of funding.'],
        ['doing_business', 'Evidence both companies are doing business', false, 'Invoices, contracts, bank statements and payroll records showing ongoing business.'],
      ], 220),
      ...items('Supporting letters', [['recommendation_letters', 'Signed expert / recommendation letters', false, I.recLetters]], 250),
      ...items('Forms & signatures', [['signed_forms', 'Signed forms and signature pages', false, I.signedForms]], 255),
      ...items('Additional evidence', [['additional', 'Additional evidence', false, 'Anything else that supports your case.']], 260),
    ],
  },
  {
    visaTypeCode: 'L_1B',
    name: 'L-1B Documentation Package',
    description: 'L-1B intracompany transferee with specialized knowledge: qualifying relationship, one year abroad, specialized knowledge.',
    items: [
      ...items('Identity & status', [
        ['passport', 'Passport', true, I.passport],
        ['status_docs', 'Current immigration documents', false, I.status],
        ['resume', 'Resume', true, I.resume],
        ['i94', 'I-94', false, I.i94],
        ['current_visa', 'Current visa copy', false, I.currentVisa],
        ['i797', 'I-797 notices / prior approvals', false, I.i797],
        ['immigration_history', 'Full immigration history (prior statuses, petitions, travel)', false, I.immigrationHistory],
        ['translations', 'Certified English translations, if applicable', false, I.translations],
        ['dependent_documents', 'Dependent documents (spouse / children), if applicable', false, I.dependents],
      ], 10),
      ...items('Corporate relationship', [
        ['foreign_employer', 'Foreign employer evidence', false, 'Registration, business license and proof the foreign company is operating.'],
        ['us_employer', 'U.S. employer evidence', false, 'Articles of incorporation, EIN letter and proof the U.S. company is operating.'],
        ['corporate_relationship', 'Corporate relationship documents', false, 'Documents proving parent, branch, subsidiary or affiliate relationship: ownership charts, annual reports.'],
        ['blanket_l', 'Blanket L approval (if applicable)', false, 'Blanket L approval notice, if the company has one.'],
        ['ownership_docs', 'Ownership records (stock certificates, shareholder register)', false, 'Stock certificates, shareholder registers, operating agreements showing common ownership.'],
        ['corporate_chart', 'Corporate ownership chart', false, 'Chart of every entity in the group with ownership percentages, matching the ownership records.'],
      ], 80),
      ...items('Employment', [
        ['employment_history', 'Employment history', false, 'Your employment history with the company group.'],
        ['foreign_payroll', 'Foreign payroll/employment evidence', false, 'Pay slips, tax records and an employer letter proving 1 continuous year of full-time work abroad in the last 3 years.'],
        ['specialized_knowledge', 'Specialized knowledge evidence', false, 'Evidence of special knowledge of the company’s products, services, processes or procedures, and why it is not commonly held in the industry.'],
        ['training_records', 'Training records / certificates', false, 'Internal training records and certificates, with an explanation of how the training built your knowledge (not just attendance).'],
        ['org_charts', 'Organizational charts', false, 'Org charts for the foreign and U.S. companies showing your position and where your knowledge is applied.'],
        ['job_descriptions', 'Job descriptions', false, 'Detailed descriptions of your duties abroad and in the proposed U.S. role.'],
        ['assignment_letter', 'Transfer / assignment letter', false, 'Employer letter describing the U.S. assignment: role, duties, salary, duration and why your knowledge is needed.'],
        ['knowledge_need', 'Why the U.S. role needs your specialized knowledge', false, 'Employer explanation of how the U.S. role uses your knowledge and why others could not easily be trained to do it.'],
      ], 150),
      ...items('Company documentation', [
        ['company_docs', 'Company documentation', false, 'Company brochures, website printouts and descriptions of products and services.'],
        ['financial_statements', 'Financial statements / tax returns (both companies)', false, 'Recent financial statements and tax returns for both companies.'],
        ['new_office_docs', 'New office lease and business plan (if applicable)', false, 'For a new U.S. office: lease for premises, business plan and proof of funding.'],
        ['doing_business', 'Evidence both companies are doing business', false, 'Invoices, contracts, bank statements and payroll records showing ongoing business.'],
      ], 220),
      ...items('Supporting letters', [['recommendation_letters', 'Signed expert / recommendation letters', false, I.recLetters]], 250),
      ...items('Forms & signatures', [['signed_forms', 'Signed forms and signature pages', false, I.signedForms]], 255),
      ...items('Additional evidence', [['additional', 'Additional evidence', false, 'Anything else that supports your case.']], 260),
    ],
  },
  {
    visaTypeCode: 'EB_5',
    name: 'EB-5 Documentation Package',
    description: 'EB-5 immigrant investor: qualifying investment, lawful source and path of funds, and job creation.',
    items: [
      ...items('Identity documents', [
        ['passport', 'Passport / identity', true, I.passport],
        ['translations', 'Certified English translations, if applicable', false, I.translations],
      ], 10),
      ...items('Immigration documents', [
        ['status_docs', 'Immigration documents', false, I.status],
        ['immigration_history', 'Full immigration history (prior statuses, petitions, travel)', false, I.immigrationHistory],
      ], 40),
      ...items('Investment information', [
        ['investment_info', 'Investment information', false, 'Amount invested, investment date and the new commercial enterprise you invested in.'],
        ['tea_designation', 'Targeted employment area (TEA) evidence, if applicable', false, 'TEA designation or data supporting the reduced investment amount.'],
      ], 80),
      ...items('Source of funds', [
        ['source_of_funds', 'Source of funds', false, 'Documents proving the investment funds were lawfully earned: salary, business income, sale of assets, gifts or loans.'],
        ['asset_sale_records', 'Records of asset or property sales', false, 'Sale agreements, deeds, valuations and proceeds records for assets sold to fund the investment.'],
        ['employment_income', 'Employment and salary history', false, 'Employment letters, pay records and tax filings showing how the funds were earned.'],
        ['funds_explanation', 'Explanation of gaps or discrepancies in financial records', false, 'A signed statement explaining any gaps, missing years or differences between your financial records.'],
      ], 120),
      ...items('Path of funds', [
        ['path_of_funds', 'Path of funds', false, 'Bank records tracing every material transfer of the money from its source to the investment.'],
        ['capital_transfer', 'Proof of capital transfer (wire / escrow records)', false, 'Wire confirmations, escrow receipts and currency exchange records.'],
        ['escrow_agreement', 'Escrow agreement / escrow confirmation', false, 'Escrow agreement and confirmation of funds held, if applicable.'],
      ], 160),
      ...items('Tax returns', [['tax_returns', 'Tax returns', false, 'Personal tax returns for the last 5 years, from every country where you filed. Note any years not filed.']], 200),
      ...items('Bank statements', [['bank_statements', 'Bank statements', false, 'Bank statements showing accumulation and transfer of the investment funds.']], 240),
      ...items('Business ownership records', [
        ['business_ownership', 'Business ownership records', false, 'Ownership records, ownership history and financials for businesses that generated the funds.'],
        ['business_valuation', 'Business valuation reports, if applicable', false, 'Independent valuation of a business or shares sold or used to fund the investment.'],
      ], 280),
      ...items('Loan/gift/inheritance evidence', [
        ['funds_support', 'Loan/gift/inheritance evidence where applicable', false, 'Gift letters, loan agreements and collateral records, or inheritance documents.'],
        ['donor_source', 'Donor / lender source of funds, if applicable', false, 'The donor’s or lender’s own source-of-funds records and the transfer trail to you.'],
      ], 320),
      ...items('Investment entity documents', [
        ['investment_entity', 'Investment entity documents', false, 'Formation documents of the new commercial enterprise: articles, operating or partnership agreement.'],
        ['subscription_agreement', 'Signed subscription agreement', false, 'Signed subscription agreement for the investment.'],
        ['offering_documents', 'Private placement memorandum / offering documents', false, 'Private placement memorandum and other offering documents (regional center investments).'],
      ], 360),
      ...items('Supporting letters', [['recommendation_letters', 'Signed expert / recommendation letters', false, I.recLetters]], 380),
      ...items('Project documentation', [
        ['project_docs', 'Project documentation', false, 'Project overview, budgets and timelines.'],
        ['business_plan', 'Comprehensive business plan', false, 'Business plan meeting USCIS (Matter of Ho) standards, used for direct investments.'],
        ['i956f_approval', 'Regional center project approval (I-956F), if applicable', false, 'I-956F approval notice for the regional center project and its current status.'],
        ['project_financials', 'Project financial and operational records', false, 'Project budgets, financial statements, construction or operating updates, and use-of-funds records.'],
      ], 400),
      ...items('Employment/job creation records', [['job_creation', 'Employment/job creation records', false, 'Economic impact study with its methodology, or payroll records, showing 10 full-time jobs created per investor.']], 440),
      ...items('Family/dependent documents', [
        ['dependents', 'Family/dependent documents', false, 'Documents for your spouse and unmarried children under 21.'],
        ['civil_documents', 'Birth / marriage certificates (principal and dependents)', false, 'Birth certificates, and marriage certificate if applicable, with certified translations.'],
      ], 480),
      ...items('Forms & signatures', [['signed_forms', 'Signed forms and signature pages', false, I.signedForms]], 500),
      ...items('Additional evidence', [
        ['additional', 'Additional evidence', false, 'Anything else that supports your case.'],
        ['legal_proceedings', 'Records of any legal proceedings', false, 'Court records for any civil or criminal proceedings involving you, if applicable.'],
      ], 520),
    ],
  },
  {
    visaTypeCode: 'OTHER',
    name: 'General Documentation Package',
    description: 'Generic starting checklist for other visa types.',
    items: [
      ...items('Basic documents', [
        ['passport', 'Passport', true, I.passport],
        ['resume', 'Resume/CV', true, I.resume],
        ['status_docs', 'Current immigration documents', false, I.status],
        ['i94', 'I-94 if applicable', false, I.i94],
        ['immigration_history', 'Full immigration history (prior statuses, petitions, travel)', false, I.immigrationHistory],
        ['translations', 'Certified English translations, if applicable', false, I.translations],
        ['dependent_documents', 'Dependent documents (spouse / children), if applicable', false, I.dependents],
      ], 10),
      ...items('Education', [['degrees', 'Degree certificates', false, I.degrees], ['transcripts', 'Transcripts', false, I.transcripts]], 80),
      ...items('Employment', [
        ['employment_letter', 'Employment letter', false, 'Employment verification letter on company letterhead.'],
        ['offer_letter', 'Offer letter', false, 'Signed job offer with title, salary and start date.'],
      ], 140),
      ...items('Supporting letters', [['recommendation_letters', 'Signed expert / recommendation letters', false, I.recLetters]], 170),
      ...items('Visa-specific documents', [['visa_specific', 'Visa-specific eligibility documents', false, 'Documents your attorney asks for that are specific to your visa category.']], 180),
      ...items('Forms & signatures', [['signed_forms', 'Signed forms and signature pages', false, I.signedForms]], 190),
      ...items('Additional evidence', [['additional', 'Additional evidence', false, 'Anything else that supports your case.']], 200),
    ],
  },
]
