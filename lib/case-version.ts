import { prisma } from '@/lib/db'

/**
 * One cheap query that changes whenever anything shown on a candidate's profile
 * changes (documents, links, requests, onboarding, notes, payments, case/candidate
 * fields). The open profile polls this and only re-renders when it differs, instead
 * of rebuilding the whole page (~28 queries) on a timer.
 */
export async function caseVersion(caseId: string): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ version: string | null }>>`
    SELECT concat_ws('|',
      c.updated_at::text,
      cand.updated_at::text,
      (SELECT count(*) || ':' || coalesce(max(updated_at)::text, '') FROM case_documents WHERE case_id = c.id),
      (SELECT count(*) || ':' || coalesce(max(greatest(created_at, coalesce(cancelled_at, created_at)))::text, '') FROM document_requests WHERE case_id = c.id),
      (SELECT count(*) || ':' || coalesce(max(updated_at)::text, '') FROM document_request_items WHERE case_id = c.id),
      (SELECT count(*) || ':' || coalesce(max(created_at)::text, '') FROM custom_document_defs WHERE case_id = c.id),
      (SELECT count(*) || ':' || coalesce(max(updated_at)::text, '') FROM o1_onboarding_submissions WHERE case_id = c.id),
      (SELECT count(*) || ':' || coalesce(max(greatest(created_at, coalesce(revoked_at, created_at)))::text, '') FROM onboarding_invites WHERE case_id = c.id),
      (SELECT count(*) || ':' || coalesce(max(updated_at)::text, '') FROM case_notes WHERE case_id = c.id),
      (SELECT count(*) || ':' || coalesce(max(updated_at)::text, '') FROM evidence_entries WHERE case_id = c.id),
      (SELECT count(*) || ':' || coalesce(max(updated_at)::text, '') FROM payments WHERE case_id = c.id),
      (SELECT count(*) || ':' || coalesce(max(updated_at)::text, '') FROM payment_receipts WHERE case_id = c.id)
    ) AS version
    FROM cases c JOIN candidates cand ON cand.id = c.candidate_id
    WHERE c.id = ${caseId}::uuid
  `
  return rows[0]?.version ?? null
}
