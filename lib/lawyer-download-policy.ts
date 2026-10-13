import { AuthError } from '@/lib/auth'
import { isLawyerUser } from '@/lib/is-lawyer'

/** Lawyers may preview assigned documents. They may not download or export them. */
export function assertLawyerCannotDownload(user: { role: string }) {
  if (isLawyerUser(user)) {
    throw new AuthError('Downloads are restricted for lawyer accounts. You do not have permission to download this document.', 403)
  }
}
