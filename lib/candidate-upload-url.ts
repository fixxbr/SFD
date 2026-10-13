import { appUrl } from '@/lib/http'

/** Extract the raw access token from a stored secure URL or bare token. */
export function extractDocumentUploadToken(secureUrlOrToken: string | null | undefined): string | null {
  if (!secureUrlOrToken?.trim()) return null
  const value = secureUrlOrToken.trim()
  const match = value.match(/\/documents\/r\/([^/?#]+)/i)
  if (match?.[1]) return decodeURIComponent(match[1])
  // Bare token (no path) — reject obvious URLs without the expected path.
  if (/^https?:\/\//i.test(value)) return null
  return value
}

/** Build the candidate upload URL from the current public base + token (domain-agnostic). */
export function getCandidateUploadUrl(tokenOrSecureUrl: string, baseUrl = appUrl()): string {
  const token = extractDocumentUploadToken(tokenOrSecureUrl)
  if (!token) throw new Error('Document upload token is missing.')
  return `${baseUrl.replace(/\/$/, '')}/documents/r/${encodeURIComponent(token)}`
}

/** Prefer regenerating from stored URL/token so Copy Email never keeps a stale localhost domain. */
export function resolveCandidateUploadUrl(
  storedSecureUrl: string | null | undefined,
  baseUrl = appUrl(),
): string | null {
  const token = extractDocumentUploadToken(storedSecureUrl)
  if (!token) return null
  return `${baseUrl.replace(/\/$/, '')}/documents/r/${encodeURIComponent(token)}`
}
