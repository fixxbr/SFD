export function nextDocumentVersion(currentVersion?: number | null): number {
  return (currentVersion ?? 0) + 1
}

export function documentAccessIsReusable(storageKey: string, storedPublicUrl?: string | null) {
  return Boolean(storageKey) && !storedPublicUrl
}

export function mergeOnboardingAnswers(
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  return { ...existing, ...incoming }
}
