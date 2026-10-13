import { cn } from '@/lib/utils'
import { statusTone } from '@/lib/format'

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const tone = statusTone(status)
  const label = (status ?? '—').replaceAll('_', ' ')
  return (
    <span
      className={cn(
        'inline-flex rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide',
        tone === 'ok' && 'bg-emerald-50 text-emerald-800',
        tone === 'bad' && 'bg-red-50 text-red-800',
        tone === 'warn' && 'bg-amber-50 text-amber-800',
        tone === 'info' && 'bg-sky-50 text-sky-800',
        tone === 'muted' && 'bg-slate-100 text-slate-600',
      )}
    >
      {label}
    </span>
  )
}
