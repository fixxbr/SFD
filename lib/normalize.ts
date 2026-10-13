export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function namesMatch(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b)
}

export function emailsMatch(a: string, b: string): boolean {
  return normalizeEmail(a) === normalizeEmail(b)
}

export function isDuplicateCandidate(
  existing: { normalizedName: string; normalizedEmail: string },
  incoming: { name: string; email: string },
): boolean {
  return (
    existing.normalizedName === normalizeName(incoming.name) &&
    existing.normalizedEmail === normalizeEmail(incoming.email)
  )
}

export function sanitizeFilename(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? 'file'
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
}

export function digitsOnly(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}
