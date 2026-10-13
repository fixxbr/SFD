import { randomBytes } from 'crypto'

/** Short correlation id for upload workflow logs (never log tokens or file bodies). */
export function createCorrelationId(prefix = 'doc'): string {
  return `${prefix}_${randomBytes(6).toString('hex')}`
}

export function correlationFromRequest(request: Request, prefix = 'doc'): string {
  const incoming =
    request.headers.get('x-correlation-id')?.trim() ||
    request.headers.get('x-request-id')?.trim() ||
    ''
  if (incoming && /^[a-zA-Z0-9_-]{6,64}$/.test(incoming)) return incoming
  return createCorrelationId(prefix)
}

export function logDocumentWorkflow(
  correlationId: string,
  event: string,
  meta: Record<string, string | number | boolean | null | undefined> = {},
) {
  const safe: Record<string, string | number | boolean | null> = {}
  for (const [key, value] of Object.entries(meta)) {
    if (value === undefined) continue
    // Never echo secrets / PII fields if callers slip.
    if (/token|password|cookie|authorization|signed|url|email|body|buffer/i.test(key)) continue
    safe[key] = value
  }
  console.info(`[doc-workflow] ${event}`, { correlationId, ...safe })
}
