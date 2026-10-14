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
 * Make the saved links for one onboarding URL field match what the candidate typed:
 * valid URLs are saved as links (never documents), removed ones are archived.
 * Invalid entries are reported and not saved.
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
    select: { id: true, externalUrl: true },
  })
  // Keep previously saved links while the field has an invalid entry, so a typo never deletes data.
  if (!errors.length) {
    for (const row of existing) {
      if (row.externalUrl && !urls.includes(row.externalUrl)) {
        await deleteCaseLink({ documentId: row.id, actorId: null })
      }
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
  return { urls, errors }
}
