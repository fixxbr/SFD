/** Per-file explanation of what an uploaded attachment is. Required for every file. */
export function normalizeDocumentDescription(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

export function validateDocumentDescription(raw: unknown): { ok: true; description: string } | { ok: false; error: string } {
  const description = normalizeDocumentDescription(raw)
  if (!description) {
    return {
      ok: false,
      error: 'Add a description for each file explaining what the document is.',
    }
  }
  if (description.length < 3) {
    return {
      ok: false,
      error: 'Description must be at least 3 characters.',
    }
  }
  if (description.length > 1000) {
    return {
      ok: false,
      error: 'Description must be 1000 characters or fewer.',
    }
  }
  return { ok: true, description }
}
