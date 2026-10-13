import { prisma } from '@/lib/db'

export const CANDIDATE_NUMBER_PREFIX = 'ASM-'
export const CANDIDATE_NUMBER_START = 1031

export function formatCandidateNumber(n: number | bigint): string {
  return `${CANDIDATE_NUMBER_PREFIX}${n}`
}

export function normalizeCandidateNumber(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '')
}

export function isCandidateNumber(value: string): boolean {
  return /^ASM-\d+$/.test(normalizeCandidateNumber(value))
}

export async function allocateCandidateNumber(): Promise<string> {
  const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT nextval('lawfirm_candidate_number_seq') AS n
  `
  const n = rows[0]?.n
  if (n == null) throw new Error('Unable to allocate a candidate number.')
  return formatCandidateNumber(n)
}
