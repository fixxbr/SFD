import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError } from '@/lib/http'
import { assertCanAccessCase } from '@/lib/lawyer-access'
import { caseVersion } from '@/lib/case-version'

type Ctx = { params: Promise<{ caseId: string }> }

/** Change marker for an open candidate profile (see lib/case-version.ts). */
export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requirePermission('candidates:read')
    const { caseId } = await ctx.params
    if (!/^[0-9a-f-]{36}$/i.test(caseId)) return jsonError('Case not found', 404)
    await assertCanAccessCase(user, caseId)
    const version = await caseVersion(caseId)
    if (!version) return jsonError('Case not found', 404)
    return NextResponse.json({ version }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return handleApiError(error)
  }
}
