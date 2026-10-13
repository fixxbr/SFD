import { prisma } from '@/lib/db'
import { CANDIDATE_NUMBER_PREFIX } from '@/lib/candidate-number'

/** Ensure next ASM-#### allocation continues after the highest restored ID. */
export async function syncCandidateNumberSequence(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ max: number | null }>>`
    SELECT MAX(CAST(SUBSTRING(candidate_number FROM 5) AS INTEGER)) AS max
    FROM candidates
    WHERE candidate_number ~ '^ASM-[0-9]+$'
  `
  const max = rows[0]?.max ?? 1000
  const nextFloor = Math.max(1000, Number(max))
  await prisma.$executeRawUnsafe(
    `SELECT setval('lawfirm_candidate_number_seq', ${nextFloor}, true)`,
  )
  return nextFloor + 1
}

export function formatNextCandidateHint(n: number) {
  return `${CANDIDATE_NUMBER_PREFIX}${n}`
}
