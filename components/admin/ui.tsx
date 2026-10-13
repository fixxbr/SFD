import Link from 'next/link'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
}: {
  title: string
  description?: string
  actions?: ReactNode
  breadcrumb?: Array<{ label: string; href?: string }>
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="mb-1.5 flex flex-wrap items-center gap-1 text-xs text-[#64748B]" aria-label="Breadcrumb">
            {breadcrumb.map((item, i) => (
              <span key={`${item.label}-${i}`} className="inline-flex items-center gap-1">
                {i > 0 && <span className="text-[#CBD5E1]">/</span>}
                {item.href ? (
                  <Link href={item.href} className="hover:text-[#0F766E]">
                    {item.label}
                  </Link>
                ) : (
                  <span className="text-[#0C2340]">{item.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-[#0C2340]">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-[#64748B]">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function StatCard({
  label,
  value,
  detail,
  href,
  tone = 'default',
}: {
  label: string
  value: string | number
  detail?: string
  href?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
}) {
  const tones = {
    default: 'border-[#E2E8F0]',
    success: 'border-emerald-200',
    warning: 'border-amber-200',
    danger: 'border-red-200',
    info: 'border-sky-200',
  }
  const body = (
    <>
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-[#0C2340]">{value}</p>
      {detail && <p className="mt-1 text-xs text-[#94A3B8]">{detail}</p>}
    </>
  )
  const className = cn(
    'block rounded-xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition',
    tones[tone],
    href && 'hover:border-[#0F766E]/40 hover:shadow-sm',
  )
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

export function SectionCard({
  title,
  action,
  children,
  className,
}: {
  title: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-[#F1F5F9] px-4 py-3 sm:px-5">
        <h2 className="text-sm font-semibold text-[#0C2340]">{title}</h2>
        {action}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-[#D7DEE6] bg-[#F8FAFC] px-4 py-8 text-center">
      <p className="text-sm font-medium text-[#0C2340]">{title}</p>
      {description && <p className="mt-1 text-xs text-[#64748B]">{description}</p>}
    </div>
  )
}
