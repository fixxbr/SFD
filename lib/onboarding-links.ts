import { prisma } from '@/lib/db'
import { createCaseLink, deleteCaseLink } from '@/lib/case-links'
import { normalizeSubmittedUrls, validateHttpUrl } from '@/lib/link-request-items'
import { markMatchingRequestItemsUploaded } from '@/lib/sync-request-status'
import type { OnboardingCategory } from '@/lib/onboarding-catalog'

/** URL questions on an onboarding form (LinkedIn, research profile, portfolio, …). */
export function onboardingUrlQuestions(catalog: OnboardingCategory[]) {
  return catalog.flatMap((c) => c.questions.filter((q) => q.type === 'url'))
}

export function answerText(answer: unknown): string {
  if (answer == null) return ''
  if (typeof answer === 'string') return answer
  if (typeof answer === 'object' && 'value' in (answer as Record<string, unknown>)) {
    return String((answer as { value?: unknown }).value ?? '')
  }
  return ''
}

/** Check every URL typed into one field; one field may hold several (comma or new line). */
export function checkOnboardingUrls(raw: string): { urls: string[]; errors: string[] } {
  const urls: string[] = []
  const errors: string[] = []
  for (const value of normalizeSubmittedUrls(raw)) {
    const check = validateHttpUrl(value)
    if (check.ok) urls.push(check.href)
    else errors.push(`${value}: ${check.error}`)
  }
  return { urls: [...new Set(urls)], errors }
}

/**
 * Save what the candidate typed in one onboarding URL field as links (never documents).
 * Invalid entries are reported and not saved.
 *
 * Nothing the candidate has sent is lost: after the form is submitted (the candidate can
 * reopen the same link and add more at any time), removing a URL from the field does not
 * delete the saved link. Only a link an admin or lawyer marked "needs replacement" or
 * "rejected" can be dropped by the candidate. Before the first submit, a removed URL is
 * archived so typos can be fixed.
 */
export async function syncOnboardingUrlField(input: {
  candidateId: string
  caseId: string
  submissionId: string
  visaTypeCode: string
  questionKey: string
  label: string
  raw: string
}): Promise<{ urls: string[]; errors: string[] }> {
  const { urls, errors } = checkOnboardingUrls(input.raw)
  // Rows this form field created earlier (other channels' links are left alone).
  const existing = await prisma.caseDocument.findMany({
    where: {
      caseId: input.caseId,
      questionKey: input.questionKey,
      onboardingSubmissionId: input.submissionId,
      externalUrl: { not: null },
      isCurrentVersion: true,
      status: { not: 'ARCHIVED' },
    },
    select: { id: true, externalUrl: true, status: true },
  })
  const submission = await prisma.o1OnboardingSubmission.findUnique({
    where: { id: input.submissionId },
    select: { status: true },
  })
  const submitted = submission?.status === 'SUBMITTED' || submission?.status === 'ACCEPTED'
  const kept: string[] = []
  // Keep previously saved links while the field has an invalid entry, so a typo never deletes data.
  for (const row of existing) {
    if (!row.externalUrl || urls.includes(row.externalUrl)) continue
    const disapproved = row.status === 'NEEDS_REPLACEMENT' || row.status === 'REJECTED'
    if (!errors.length && (!submitted || disapproved)) {
      await deleteCaseLink({ documentId: row.id, actorId: null })
    } else {
      kept.push(row.externalUrl)
    }
  }
  const have = new Set(existing.map((row) => row.externalUrl))
  for (const [index, href] of urls.entries()) {
    if (have.has(href)) continue
    const link = await createCaseLink({
      candidateId: input.candidateId,
      caseId: input.caseId,
      url: href,
      label: urls.length > 1 ? `${input.label} (${index + 1})` : input.label,
      questionKey: input.questionKey,
      uploadedByType: 'CANDIDATE',
      onboardingSubmissionId: input.submissionId,
      visaTypeCode: input.visaTypeCode,
      onDuplicate: 'reuse',
    })
    await markMatchingRequestItemsUploaded({ caseId: input.caseId, questionKey: input.questionKey, documentId: link.id })
  }
  return { urls: [...kept, ...urls], errors }
}
