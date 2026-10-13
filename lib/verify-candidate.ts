import { normalizeEmail } from '@/lib/normalize'
import { normalizeCandidateNumber } from '@/lib/candidate-number'

export const VERIFY_GENERIC_ERROR =
  'We could not verify your Candidate ID and email address. Please check your information and try again.'

export function candidateCredentialsMatch(
  stored: { candidateNumber: string; normalizedEmail: string },
  submitted: { candidateNumber: string; email: string },
) {
  const idOk = normalizeCandidateNumber(stored.candidateNumber) === normalizeCandidateNumber(submitted.candidateNumber)
  const emailOk = stored.normalizedEmail === normalizeEmail(submitted.email)
  return idOk && emailOk
}
