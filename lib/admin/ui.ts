/** Shared Afterstem admin UI class tokens — keep pages visually consistent. */
export const admin = {
  canvas: 'bg-[#EEF2F6]',
  card: 'rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  cardPad: 'p-4 sm:p-5',
  sectionTitle: 'text-sm font-semibold text-[#0C2340]',
  muted: 'text-sm text-[#64748B]',
  label: 'text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748B]',
  input:
    'h-10 w-full rounded-lg border border-[#D7DEE6] bg-white px-3 text-sm text-[#0C2340] placeholder:text-[#94A3B8] focus:border-[#0F766E] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20',
  select:
    'h-10 w-full rounded-lg border border-[#D7DEE6] bg-white px-3 text-sm text-[#0C2340] focus:border-[#0F766E] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20',
  textarea:
    'w-full rounded-lg border border-[#D7DEE6] bg-white px-3 py-2 text-sm text-[#0C2340] placeholder:text-[#94A3B8] focus:border-[#0F766E] focus:outline-none focus:ring-2 focus:ring-[#0F766E]/20',
  btnPrimary:
    'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0C2340] px-4 text-sm font-semibold text-white transition hover:bg-[#143a66] disabled:opacity-60',
  btnAccent:
    'inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0F766E] px-4 text-sm font-semibold text-white transition hover:bg-[#0d655e] disabled:opacity-60',
  btnSecondary:
    'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-[#D7DEE6] bg-white px-4 text-sm font-medium text-[#0C2340] transition hover:bg-[#F8FAFC] disabled:opacity-60',
  btnGhost:
    'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-[#475569] transition hover:bg-[#F1F5F9] disabled:opacity-60',
  btnDanger:
    'inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-white px-4 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-60',
  tableWrap: 'overflow-x-auto rounded-xl border border-[#E2E8F0] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]',
  th: 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]',
  td: 'px-3 py-3 text-sm text-[#0C2340]',
  badge:
    'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
} as const
