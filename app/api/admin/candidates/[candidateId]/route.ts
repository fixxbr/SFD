import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { can } from '@/lib/rbac'
import { audit, logActivity, ActivityType } from '@/lib/activity'
import { archiveCandidate, permanentlyDeleteCandidate, restoreCandidate } from '@/lib/delete-candidate'
import { normalizeName } from '@/lib/normalize'
import { assertCanAccessCandidate, isLawyerUser, stripFinanceForLawyer } from '@/lib/lawyer-access'

type Ctx = { params: Promise<{ candidateId: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requirePermission('candidates:read')
    const { candidateId } = await ctx.params
    await assertCanAccessCandidate(user, candidateId)
    const includeArchived = can(user.role, 'candidates:view_archived')
    const candidate = await prisma.candidate.findUnique({
      where: { id: candidateId },
      include: {
        assessments: { orderBy: { submittedAt: 'desc' } },
        cases: {
          where: includeArchived ? undefined : { lifecycle: 'ACTIVE' },
          orderBy: { createdAt: 'desc' },
          include: {
            assignedCaseManager: { select: { id: true, fullName: true, email: true } },
            assignedAttorney: { select: { id: true, fullName: true, email: true } },
            payments: { orderBy: { installmentNumber: 'asc' } },
            documents: { orderBy: [{ questionKey: 'asc' }, { version: 'desc' }] },
            onboardingSubmissions: { orderBy: { updatedAt: 'desc' } },
            notes: {
              where: { visibility: 'INTERNAL', archivedAt: null },
              orderBy: { createdAt: 'desc' },
              include: { author: { select: { fullName: true } } },
            },
            activities: { orderBy: { createdAt: 'desc' }, take: 100 },
            communications: { orderBy: { sentAt: 'desc' } },
            statusHistory: { orderBy: { createdAt: 'desc' } },
            onboardingInvites: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        },
        activities: { orderBy: { createdAt: 'desc' }, take: 100 },
        communications: { orderBy: { sentAt: 'desc' }, take: 100 },
      },
    })
    if (!candidate) return jsonError('Candidate not found', 404)
    if (candidate.lifecycle === 'ARCHIVED' && !includeArchived) return jsonError('Candidate not found', 404)

    if (!can(user.role, 'candidates:full_profile')) {
      const currentCase = candidate.cases[0]
      return NextResponse.json({
        candidate: {
          id: candidate.id,
          fullLegalName: candidate.fullLegalName,
          email: candidate.email,
          phone: candidate.phone,
          createdAt: candidate.createdAt,
        },
        limited: true,
        lawyerMode: isLawyerUser(user),
        currentCase: currentCase
          ? {
              id: currentCase.id,
              caseNumber: currentCase.caseNumber,
              visaType: currentCase.visaType,
              status: currentCase.status,
              ...(isLawyerUser(user)
                ? {}
                : {
                    payments: currentCase.payments,
                    quotedAmountCents: currentCase.quotedAmountCents,
                    currency: currentCase.currency,
                  }),
            }
          : null,
      })
    }

    if (isLawyerUser(user)) {
      const safe = stripFinanceForLawyer(candidate as unknown as Record<string, unknown>)
      return NextResponse.json({ candidate: safe, limited: false, lawyerMode: true })
    }

    return NextResponse.json({ candidate, limited: false, lawyerMode: false })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('candidates:write')
    const { candidateId } = await ctx.params
    const body = (await request.json()) as Record<string, string | null | boolean>
    if (body.action === 'restore') {
      if (!can(user.role, 'candidates:view_archived')) return jsonError('Not authorized to restore', 403)
      const restored = await restoreCandidate({ candidateId, actorId: user.id })
      if (!restored) return jsonError('Candidate not found', 404)
      return NextResponse.json({ ok: true, candidate: restored, restored: true })
    }

    const data: Record<string, unknown> = {
      phone: body.phone ?? undefined,
      currentImmigrationStatus: body.currentImmigrationStatus ?? undefined,
      currentAddress: body.currentAddress ?? undefined,
      nationality: body.nationality ?? undefined,
      dateOfBirth: body.dateOfBirth ? new Date(String(body.dateOfBirth)) : undefined,
    }
    if (typeof body.fullLegalName === 'string' && body.fullLegalName.trim()) {
      data.fullLegalName = body.fullLegalName.trim()
      data.normalizedName = normalizeName(body.fullLegalName)
    }

    const candidate = await prisma.candidate.update({
      where: { id: candidateId },
      data,
    })
    await logActivity({
      candidateId,
      type: ActivityType.PROFILE_UPDATED,
      message: 'Candidate profile updated',
      actorType: 'ADMIN',
      actorId: user.id,
    })
    await audit({ actorId: user.id, action: 'CANDIDATE_UPDATE', entityType: 'candidate', entityId: candidateId })
    return NextResponse.json({ candidate })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('candidates:archive')
    const { candidateId } = await ctx.params
    const url = new URL(request.url)
    const permanent = url.searchParams.get('permanent') === '1'
    const body = await request.json().catch(() => ({} as { confirmName?: string; reason?: string }))

    const existing = await prisma.candidate.findUnique({
      where: { id: candidateId },
      select: { fullLegalName: true, candidateNumber: true },
    })
    if (!existing) return jsonError('Candidate not found', 404)

    if (body.confirmName && body.confirmName.trim() !== existing.fullLegalName) {
      return jsonError('Confirmation name does not match the candidate.', 400)
    }

    if (permanent) {
      if (!can(user.role, 'candidates:purge')) {
        return jsonError('Only Super Admin can permanently delete candidate data.', 403)
      }
      const deleted = await permanentlyDeleteCandidate({ candidateId, actorId: user.id })
      if (!deleted) return jsonError('Candidate not found', 404)
      return NextResponse.json({
        ok: true,
        permanent: true,
        candidateNumber: deleted.candidateNumber,
        fullLegalName: deleted.fullLegalName,
      })
    }

    const archived = await archiveCandidate({
      candidateId,
      actorId: user.id,
      reason: typeof body.reason === 'string' ? body.reason : null,
    })
    if (!archived) return jsonError('Candidate not found', 404)
    return NextResponse.json({
      ok: true,
      archived: true,
      candidateNumber: archived.candidateNumber,
      fullLegalName: archived.fullLegalName,
    })
  } catch (error) {
    return handleApiError(error)
  }
}
