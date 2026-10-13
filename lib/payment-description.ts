import { formatVisa } from '@/lib/visa'

const STAGE_LABELS: Record<number, string> = {
  1: 'First Installment',
  2: 'Second Installment',
  3: 'Third Installment',
  4: 'Final Payment',
}

/** Meaningful payment description from visa type + installment stage. */
export function buildPaymentDescription(input: {
  visaType?: string | null
  installmentNumber?: number | null
  customLabel?: string | null
  candidateNumber?: string | null
}) {
  if (input.customLabel?.trim()) return input.customLabel.trim()
  const visa = input.visaType ? formatVisa(input.visaType) : 'Legal Services'
  const stage =
    input.installmentNumber && STAGE_LABELS[input.installmentNumber]
      ? STAGE_LABELS[input.installmentNumber]
      : input.installmentNumber
        ? `Installment ${input.installmentNumber}`
        : 'Payment'
  const id = input.candidateNumber ? ` · ${input.candidateNumber}` : ''
  return `${visa} Legal Services — ${stage}${id}`
}

export function installmentStageLabel(n: number) {
  return STAGE_LABELS[n] ?? `Installment ${n}`
}
