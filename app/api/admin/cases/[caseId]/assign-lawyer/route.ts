import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { assignCaseLawyer } from '@/lib/assign-lawyer'
import { audit } from '@/lib/activity'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ caseId: string }> }

/**
 * Dedicated lawyer assign / reassign / unassign endpoint.
 * Body: { lawyerId: string | null, confirm: true }
 */
export async function POST(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('cases:write')
    const { caseId } = await ctx.params
    const body = (await request.json()) as { lawyerId?: string | null; confirm?: boolean; note?: string }

    if (!body.confirm) {
      return jsonError('Confirmation is required to change lawyer assignment.')
    }

    const lawyerId =
      body.lawyerId === null || body.lawyerId === undefined || body.lawyerId === ''
        ? null
        : String(body.lawyerId)

    const result = await assignCaseLawyer({
      caseId,
      lawyerId,
      actor: user,
      note: body.note,
    })

    await audit({
      actorId: user.id,
      action: result.changed
        ? result.nextLawyerId
          ? result.previousLawyerId
            ? 'LAWYER_REASSIGNED'
            : 'LAWYER_ASSIGNED'
          : 'LAWYER_UNASSIGNED'
        : 'LAWYER_ASSIGN_NOOP',
      entityType: 'case',
      entityId: caseId,
      metadata: {
        previousLawyerId: result.previousLawyerId,
        nextLawyerId: result.nextLawyerId,
        message: result.message,
      },
    })

    const record = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        assignedAttorney: { select: { id: true, fullName: true, email: true, role: true } },
      },
    })

    return NextResponse.json({
      ok: true,
      changed: result.changed,
      message: result.message,
      assignment: result,
      case: record,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
