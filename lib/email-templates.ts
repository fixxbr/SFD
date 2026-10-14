import { BRAND_NAME } from '@/lib/brand'
import { formatCents } from '@/lib/payments'
import { SEED_VISA_TEMPLATES } from '@/lib/visa-template-seed-data'

export type EmailTemplateKey =
  | 'WELCOME'
  | 'O1_PROCESS_STARTED'
  | 'DOCUMENTATION_REQUEST'
  | 'MISSING_DOCUMENT_REMINDER'
  | 'DOCUMENTS_RECEIVED'
  | 'AGREED_AMOUNT'
  | 'PAYMENT_SCHEDULE'
  | 'PAYMENT_1_DUE'
  | 'PAYMENT_1_CONFIRMATION'
  | 'PAYMENT_2_DUE'
  | 'PAYMENT_2_CONFIRMATION'
  | 'PAYMENT_3_DUE'
  | 'PAYMENT_3_CONFIRMATION'
  | 'PRE_FILING_COMPLETE'
  | 'FINAL_PAYMENT_DUE'
  | 'FINAL_PAYMENT_CONFIRMATION'
  | 'PAYMENT_REQUEST'
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_OVERDUE'
  | 'CASE_UPDATE'
  | 'CUSTOM'

export type MergeVars = {
  clientName: string
  candidateId: string
  email: string
  visaType: string
  caseNumber: string
  quotedAmount: string
  paymentAmount: string
  paymentNumber: string
  paymentLink?: string
  documentLink?: string
  /** Bulleted document categories for the case's own visa type. */
  documentCategories: string
}

/** Category names for a visa: the live template's when given, else the built-in list for that visa. */
export function documentCategoriesText(visaTypeCode?: string | null, categories?: string[] | null): string {
  const fromSeed = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === visaTypeCode)?.items.map((i) => i.category)
  const list = [...new Set((categories?.length ? categories : fromSeed) ?? [])]
    .map((c) => c.replace(/^\d+\s+/, '').trim())
    .filter(Boolean)
  return list.length ? list.map((c) => `- ${c}`).join('\n') : '- Documents listed on your secure upload page'
}

export const EMAIL_TEMPLATES: Array<{
  key: EmailTemplateKey
  label: string
  subject: string
  body: string
  ctaLabel?: string
  ctaVar?: 'documentLink' | 'paymentLink'
  /** Only offered for these visa types (all visa types when omitted). */
  visaTypes?: string[]
}> = [
  {
    key: 'WELCOME',
    label: 'Welcome Email',
    subject: `Welcome to ${BRAND_NAME}`,
    body: `Hi {{Client Name}},

Welcome to ${BRAND_NAME}.

Your case has been created and our team will guide you through the next steps of your process.

Candidate ID:
{{Candidate ID}}

Visa Type:
{{Visa Type}}

What happens next:
01 Our team reviews your profile and goals
02 You may receive a documentation request
03 We build your case strategy with attorney oversight
04 We guide you through filing and updates

Please save this email for your records. Reply to this message if you have questions — our team is here to help.

— ${BRAND_NAME} Team
clients@afterstem.ai`,
  },
  {
    key: 'O1_PROCESS_STARTED',
    label: 'Process Started',
    subject: `${BRAND_NAME} — your {{Visa Type}} journey has started`,
    body: `Hi {{Client Name}},

Your {{Visa Type}} journey has started.

Welcome to the {{Visa Type}} process with ${BRAND_NAME}.

Your initial onboarding is complete and our team is preparing the next stage.

Candidate ID:
{{Candidate ID}}

Please keep an eye on your email.
Your next email will contain documentation requirements.

What happens from here:

01 Documentation Request
02 Profile & Evidence Review
03 Case Strategy
04 Petition Preparation
05 Attorney Review & Finalization
06 Filing & Case Updates

Nothing additional is required at this moment unless specifically requested.

— ${BRAND_NAME} Team
clients@afterstem.ai`,
  },
  {
    key: 'DOCUMENTATION_REQUEST',
    label: 'Documentation Request',
    subject: `${BRAND_NAME} — complete your {{Visa Type}} documentation`,
    body: `Hi {{Client Name}},

Please complete your {{Visa Type}} documentation request.

Candidate ID:
{{Candidate ID}}

Visa Type:
{{Visa Type}}

Use the button below to submit documents. Each item has its own upload field.

Documentation we may request:

{{Document Categories}}

[Complete Your Documentation]
{{Document Link}}

— ${BRAND_NAME} Team`,
    ctaLabel: 'Complete Your Documentation',
    ctaVar: 'documentLink',
  },
  {
    key: 'MISSING_DOCUMENT_REMINDER',
    label: 'Missing Document Reminder',
    subject: `Reminder: Documents Needed for Your ${BRAND_NAME} Case`,
    body: `Hi {{Client Name}},

We are still missing documents needed for your {{Visa Type}} case.

Candidate ID:
{{Candidate ID}}

Please upload the outstanding items using your secure ${BRAND_NAME} link:

[Upload Missing Documents]
{{Document Link}}

If you already submitted these files, reply to this email so we can confirm receipt.

— ${BRAND_NAME} Team`,
    ctaLabel: 'Upload Missing Documents',
    ctaVar: 'documentLink',
  },
  {
    key: 'DOCUMENTS_RECEIVED',
    label: 'Documents Received',
    subject: `Documents Received — ${BRAND_NAME}`,
    body: `Hi {{Client Name}},

Thank you — we have received documents for your {{Visa Type}} case.

Candidate ID:
{{Candidate ID}}

Our team will review what you submitted and follow up if anything else is needed. Receiving documents does not mean your case is complete.

— ${BRAND_NAME} Team
clients@afterstem.ai`,
  },
  {
    key: 'AGREED_AMOUNT',
    label: 'Agreed Amount / Quote',
    subject: `${BRAND_NAME} — agreed engagement amount ({{Candidate ID}})`,
    body: `Hi {{Client Name}},

Please find your agreed engagement amount for your {{Visa Type}} matter.

Candidate ID:
{{Candidate ID}}

Agreed Total:
{{Quoted Amount}}

Our team will share payment stage details and due dates separately when ready.

— ${BRAND_NAME} Team
clients@afterstem.ai`,
    ctaLabel: 'View Payment Details',
    ctaVar: 'paymentLink',
  },
  {
    key: 'PAYMENT_SCHEDULE',
    label: 'Payment Schedule',
    subject: `Your ${BRAND_NAME} Payment Schedule`,
    body: `Hi {{Client Name}},

Here is your agreed payment schedule for your {{Visa Type}} engagement.

Candidate ID:
{{Candidate ID}}

Agreed Total:
{{Quoted Amount}}

Payment stages typically include Payment 1, Payment 2, Payment 3 (collectively 75% before filing), and Final Payment (remaining 25% after approval), with amounts set for your case.

Reply to this email if you have questions about timing or payment methods.

— ${BRAND_NAME} Team
clients@afterstem.ai`,
    ctaLabel: 'View Payment Details',
    ctaVar: 'paymentLink',
  },
  {
    key: 'PAYMENT_REQUEST',
    label: 'Payment Request',
    subject: `Payment Request — ${BRAND_NAME}`,
    body: `Hi {{Client Name}},

Please complete the following payment for your {{Visa Type}} engagement.

Candidate ID:
{{Candidate ID}}

Amount Due:
{{Payment Amount}}

Quoted Engagement:
{{Quoted Amount}}

[Pay Securely]
{{Payment Link}}

— ${BRAND_NAME} Team`,
    ctaLabel: 'Pay Securely',
    ctaVar: 'paymentLink',
  },
  {
    key: 'PAYMENT_REMINDER',
    label: 'Payment Reminder',
    subject: `Payment Reminder — ${BRAND_NAME}`,
    body: `Hi {{Client Name}},

This is a friendly reminder that a payment remains outstanding for your {{Visa Type}} engagement.

Candidate ID:
{{Candidate ID}}

Amount Due:
{{Payment Amount}}

[Pay Securely]
{{Payment Link}}

— ${BRAND_NAME} Team`,
    ctaLabel: 'Make Payment',
    ctaVar: 'paymentLink',
  },
  {
    key: 'PAYMENT_OVERDUE',
    label: 'Payment Past Due',
    subject: `Payment Past Due — ${BRAND_NAME}`,
    body: `Hi {{Client Name}},

Our records show a payment for your {{Visa Type}} engagement is past due.

Candidate ID:
{{Candidate ID}}

Amount Due:
{{Payment Amount}}

Please complete payment at your earliest convenience, or reply to this email if you need assistance arranging a schedule.

[Make Payment]
{{Payment Link}}

— ${BRAND_NAME} Team
clients@afterstem.ai`,
    ctaLabel: 'Make Payment',
    ctaVar: 'paymentLink',
  },
  {
    key: 'PAYMENT_1_DUE',
    label: 'First Payment Request',
    subject: `First Payment Request — ${BRAND_NAME}`,
    body: paymentDueBody(1),
    ctaLabel: 'Make Payment',
    ctaVar: 'paymentLink',
  },
  {
    key: 'PAYMENT_1_CONFIRMATION',
    label: 'Payment 1 Confirmation',
    subject: `Payment Received — ${BRAND_NAME}`,
    body: paymentConfirmBody(1),
  },
  {
    key: 'PAYMENT_2_DUE',
    label: 'Second Payment Request',
    subject: `Second Payment Request — ${BRAND_NAME}`,
    body: paymentDueBody(2),
    ctaLabel: 'Make Payment',
    ctaVar: 'paymentLink',
  },
  {
    key: 'PAYMENT_2_CONFIRMATION',
    label: 'Payment 2 Confirmation',
    subject: `Payment Received — ${BRAND_NAME}`,
    body: paymentConfirmBody(2),
  },
  {
    key: 'PAYMENT_3_DUE',
    label: 'Third Payment Request',
    subject: `Third Payment Request — ${BRAND_NAME}`,
    body: paymentDueBody(3),
    ctaLabel: 'Make Payment',
    ctaVar: 'paymentLink',
  },
  {
    key: 'PAYMENT_3_CONFIRMATION',
    label: 'Payment 3 Confirmation',
    subject: `Payment Received — ${BRAND_NAME}`,
    body: `Hi {{Client Name}},

We received Payment 3 ({{Payment Amount}}) for your {{Visa Type}} engagement.

Candidate ID:
{{Candidate ID}}

Payments 1–3 have completed the required 75% pre-filing payment amount.

— ${BRAND_NAME} Team`,
  },
  {
    key: 'PRE_FILING_COMPLETE',
    label: '75% Pre-Filing Complete',
    subject: `${BRAND_NAME} — pre-filing payments complete`,
    body: `Hi {{Client Name}},

Payments 1–3 have completed the required 75% pre-filing payment amount.

Candidate ID:
{{Candidate ID}}

Quoted engagement: {{Quoted Amount}}

— ${BRAND_NAME} Team`,
  },
  {
    key: 'FINAL_PAYMENT_DUE',
    label: 'Final Payment Request',
    subject: `Final Payment Request — ${BRAND_NAME}`,
    body: paymentDueBody(4),
    ctaLabel: 'Make Payment',
    ctaVar: 'paymentLink',
  },
  {
    key: 'FINAL_PAYMENT_CONFIRMATION',
    label: 'Final Payment Confirmation',
    subject: `Payment Received — ${BRAND_NAME}`,
    body: `Hi {{Client Name}},

Final payment received.

Paid in Full.

Candidate ID:
{{Candidate ID}}

Payment 4 ({{Payment Amount}}) completes your {{Visa Type}} engagement of {{Quoted Amount}}.

— ${BRAND_NAME} Team`,
  },
  {
    key: 'CASE_UPDATE',
    label: 'Case Update',
    subject: `${BRAND_NAME} — update on {{Case Number}}`,
    body: `Hi {{Client Name}},

Here is an update on your {{Visa Type}} case.

Candidate ID:
{{Candidate ID}}
Case Number:
{{Case Number}}

[Write your update here]

— ${BRAND_NAME} Team`,
  },
  {
    key: 'CUSTOM',
    label: 'General Email',
    subject: `${BRAND_NAME} — message for {{Client Name}}`,
    body: `Hi {{Client Name}},

Candidate ID:
{{Candidate ID}}

[Write your message here]

— ${BRAND_NAME} Team`,
  },
]

function paymentDueBody(n: number) {
  return `Hi {{Client Name}},

Your payment for your {{Visa Type}} engagement is ready.

Candidate ID:
{{Candidate ID}}

Payment:
${n} of 4

Amount Due:
{{Payment Amount}}

Total Engagement Amount:
{{Quoted Amount}}

[Make Payment]
{{Payment Link}}

— ${BRAND_NAME} Team`
}

function paymentConfirmBody(n: number) {
  return `Hi {{Client Name}},

We received Payment ${n} ({{Payment Amount}}) for your {{Visa Type}} case {{Case Number}}.

Candidate ID:
{{Candidate ID}}

Thank you.

— ${BRAND_NAME} Team`
}

export function mergeTemplate(template: string, vars: MergeVars) {
  return template
    .replaceAll('{{Client Name}}', vars.clientName)
    .replaceAll('{{Candidate ID}}', vars.candidateId)
    .replaceAll('{{Email}}', vars.email)
    .replaceAll('{{Visa Type}}', vars.visaType)
    .replaceAll('{{Case Number}}', vars.caseNumber)
    .replaceAll('{{Quoted Amount}}', vars.quotedAmount)
    .replaceAll('{{Payment Amount}}', vars.paymentAmount)
    .replaceAll('{{Payment Number}}', vars.paymentNumber)
    .replaceAll('{{Payment Link}}', vars.paymentLink || '[payment link pending]')
    .replaceAll('{{Document Link}}', vars.documentLink || '[document link pending]')
    .replaceAll('{{Document Categories}}', vars.documentCategories)
}

export function buildMergeVars(input: {
  fullLegalName: string
  candidateNumber?: string
  email: string
  visaLabel: string
  caseNumber: string
  quotedCents: number
  paymentCents?: number
  paymentNumber?: number
  currency?: string
  paymentLink?: string
  documentLink?: string
  visaTypeCode?: string | null
  documentCategories?: string[] | null
}): MergeVars {
  const currency = (input.currency || 'usd').toUpperCase()
  return {
    clientName: input.fullLegalName,
    candidateId: input.candidateNumber || '',
    email: input.email,
    visaType: input.visaLabel,
    caseNumber: input.caseNumber,
    quotedAmount: formatCents(input.quotedCents, currency),
    paymentAmount: formatCents(input.paymentCents ?? 0, currency),
    paymentNumber: String(input.paymentNumber ?? ''),
    paymentLink: input.paymentLink,
    documentLink: input.documentLink,
    documentCategories: documentCategoriesText(input.visaTypeCode, input.documentCategories),
  }
}

/** Catalog templates offered for a case of this visa type. */
export function templatesForVisa(visaType?: string | null) {
  return EMAIL_TEMPLATES.filter((t) => !t.visaTypes || t.visaTypes.includes(String(visaType ?? '')))
}

export function gmailComposeUrl(to: string, subject: string, body: string) {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to,
    su: subject,
    body,
  })
  return `https://mail.google.com/mail/?${params.toString()}`
}

export function templateByKey(key: string) {
  return EMAIL_TEMPLATES.find((t) => t.key === key) ?? EMAIL_TEMPLATES[EMAIL_TEMPLATES.length - 1]
}
