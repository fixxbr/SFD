import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth'
import { searchCandidates } from '@/lib/admin/search-candidates'
import { handleApiError, jsonError } from '@/lib/http'
import { isLawyerUser, stripFinanceForLawyer } from '@/lib/lawyer-access'

/**
 * Lawyer-only candidate list.
 * Server-filters by Case.assignedAttorneyId === authenticated lawyer.
 * Never returns the full candidate database.
 */
export async function GET(request: Request) {
  try {
    const user = await requireUser()
    if (!isLawyerUser(user)) {
      return jsonError('Lawyer portal access only.', 403)
    }
    const url = new URL(request.url)
    const result = await searchCandidates(user, url.searchParams)
    return NextResponse.json({
      ...result,
      items: result.items.map((row) => stripFinanceForLawyer(row as never)),
    })
  } catch (error) {
    return handleApiError(error)
  }
}
