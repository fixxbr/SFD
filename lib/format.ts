export function formatDate(value: Date | string | null | undefined) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function formatTime(value: Date | string | null | undefined) {
  if (!value) return ''
  const date = value instanceof Date ? value : new Date(value)
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(date)
}

export function statusTone(status: string | null | undefined) {
  const value = status ?? ''
  if (['APPROVED', 'ACCEPTED', 'PAID', 'Paid in Full'].includes(value)) return 'ok'
  if (['DENIED', 'REJECTED', 'FAILED'].includes(value)) return 'bad'
  if (['NEEDS_REPLACEMENT', 'RFE', 'MORE_DOCUMENTS_REQUIRED', 'MORE_INFORMATION_REQUIRED'].includes(value)) return 'warn'
  if (['MISSING', 'PENDING', 'Unpaid'].includes(value)) return 'muted'
  return 'info'
}
