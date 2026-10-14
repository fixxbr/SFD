/**
 * When a candidate may remove or replace a file they sent.
 *
 * The concept:
 * - Before submitting, a candidate can replace or remove what they attached.
 * - Clicking Submit submits it. After that the file cannot be changed or replaced by the
 *   candidate. They can reopen the same link and add more files on top of what is saved,
 *   as many times as they need.
 * - A submitted file is only open to replacement once an admin or lawyer disapproves it
 *   ("needs revision" or "rejected").
 * The same rule applies to links saved from the form (see lib/onboarding-links.ts).
 */
export type CandidateFileRuleInput = {
  uploadedByType: string
  status: string
  uploadedAt: Date | string
  /** Set when the file came through this onboarding form. */
  onboardingSubmissionId: string | null
}

export type CandidateSubmissionState = {
  id: string
  status: string
  submittedAt: Date | string | null
}

const DISAPPROVED = new Set(['NEEDS_REPLACEMENT', 'REJECTED'])

/** True while a file has not been submitted yet (uploaded after the last Submit, or never submitted). */
export function isNotYetSubmitted(file: Pick<CandidateFileRuleInput, 'uploadedAt'>, submission: CandidateSubmissionState): boolean {
  if (submission.status !== 'SUBMITTED' && submission.status !== 'ACCEPTED') return true
  if (!submission.submittedAt) return true
  return new Date(file.uploadedAt).getTime() > new Date(submission.submittedAt).getTime()
}

export function candidateCanReplaceFile(file: CandidateFileRuleInput, submission: CandidateSubmissionState): boolean {
  // Only the candidate's own files from this form; staff uploads are never theirs to change.
  if (file.uploadedByType !== 'CANDIDATE' || file.onboardingSubmissionId !== submission.id) return false
  if (file.status === 'ARCHIVED') return false
  if (DISAPPROVED.has(file.status)) return true
  // Once staff started reviewing or accepted it, it stays.
  if (file.status !== 'UPLOADED') return false
  return isNotYetSubmitted(file, submission)
}
