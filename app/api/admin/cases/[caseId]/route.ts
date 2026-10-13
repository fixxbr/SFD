import { NextResponse } from 'next/server'
import { CaseStatus, Prisma } from '@prisma/client'
import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, assertSameOrigin, jsonError } from '@/lib/http'
import { ActivityType, audit, logActivity } from '@/lib/activity'
import { createOnboardingInvite } from '@/lib/onboarding'
import { canReadyToFile, formatCents, validateInstallments } from '@/lib/payments'
import { createAccessLink } from '@/lib/client-access'
import { assertCanAccessCase } from '@/lib/lawyer-access'
import { assignCaseLawyer } from '@/lib/assign-lawyer'

type Ctx = { params: Promise<{ caseId: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requirePermission('cases:read')
    const { caseId } = await ctx.params
    await assertCanAccessCase(user, caseId)
    const record = await prisma.case.findUnique({
      where: { id: caseId },
      include: {
        candidate: true,
        assignedCaseManager: true,
        assignedAttorney: true,
        payments: { orderBy: { installmentNumber: 'asc' } },
      },
    })
    if (!record) return jsonError('Case not found', 404)
    return NextResponse.json({ case: record })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('cases:write')
    const { caseId } = await ctx.params
    const body = (await request.json()) as Record<string, unknown>
    const current = await prisma.case.findUnique({
      where: { id: caseId },
      include: { payments: true },
    })
    if (!current) return jsonError('Case not found', 404)

    if (typeof body.status === 'string' && body.status === 'READY_TO_FILE' && body.status !== current.status) {
      const quoted = current.quotedAmountCents ?? 0
      const allowed = canReadyToFile(quoted, current.payments)
      if (!allowed) {
        const isSuperOverride = body.override === true && user.role === 'SUPER_ADMIN'
        const reason = String(body.overrideReason ?? '').trim()
        if (!isSuperOverride || !reason) {
          const paid = current.payments
            .filter((p) => p.installmentNumber <= 3 && p.status === 'PAID')
            .reduce((s, p) => s + (p.paidAmountCents ?? p.amountCents), 0)
          const required = Math.round((quoted || 0) * 0.75)
          return NextResponse.json(
            {
              error: 'PRE-FILING PAYMENT REQUIREMENT NOT MET',
              paid,
              required,
              remaining: Math.max(0, required - paid),
            },
            { status: 409 },
          )
        }
      }
    }

    const data: Prisma.CaseUpdateInput = {}
    if (typeof body.assignedCaseManagerId === 'string' || body.assignedCaseManagerId === null) {
      data.assignedCaseManager = body.assignedCaseManagerId
        ? { connect: { id: body.assignedCaseManagerId as string } }
        : { disconnect: true }
    }
    // assignedAttorneyId is handled via assignCaseLawyer() — never a bare connect.
    if (typeof body.status === 'string') {
      data.status = body.status as CaseStatus
      if (body.status === 'FILED') data.filedAt = new Date()
      if (body.status === 'APPROVED') data.approvedAt = new Date()
      if (body.status === 'CLOSED' || body.status === 'DENIED') data.closedAt = new Date()
      if (body.status === 'READY_TO_FILE' && body.override === true && user.role === 'SUPER_ADMIN') {
        data.filingPaymentOverrideAt = new Date()
        data.filingPaymentOverrideBy = { connect: { id: user.id } }
        data.filingPaymentOverrideReason = String(body.overrideReason ?? '')
      }
    }
    if (body.lifecycle === 'ARCHIVED' || body.lifecycle === 'ACTIVE') {
      data.lifecycle = body.lifecycle
    }

    if (typeof body.caseHealth === 'string') {
      data.caseHealth = body.caseHealth as never
    }
    if (typeof body.referralType === 'string' || body.referralType === null) {
      data.referralType = (body.referralType as never) ?? null
    }
    if (typeof body.referredByName === 'string' || body.referredByName === null) {
      data.referredByName = body.referredByName as string | null
    }
    if (typeof body.referredByAdminId === 'string' || body.referredByAdminId === null) {
      data.referredByAdmin = body.referredByAdminId
        ? { connect: { id: body.referredByAdminId as string } }
        : { disconnect: true }
      if (body.referredByAdminId) data.referredAt = new Date()
    }
    if (typeof body.referralNote === 'string' || body.referralNote === null) {
      data.referralNote = body.referralNote as string | null
    }

    if (typeof body.quotedAmountCents === 'number') {
      const hasPaid = current.payments.some((p) => p.status === 'PAID')
      if (hasPaid && !(user.role === 'SUPER_ADMIN' || user.role === 'ADMIN')) {
        return jsonError('Only ADMIN or SUPER_ADMIN can change a quoted price after payments exist.', 403)
      }
      if (hasPaid) {
        const reason = String(body.quoteChangeReason ?? '').trim()
        if (!reason) return jsonError('A reason is required to change the quoted price after payments begin.')
      }
      data.quotedAmountCents = body.quotedAmountCents
      if (typeof body.currency === 'string') data.currency = body.currency
      data.quotedAmountUpdatedBy = { connect: { id: user.id } }
      if (!current.quotedAmountLockedAt) data.quotedAmountLockedAt = new Date()
    }

    // Lawyer assignment first (validates ATTORNEY + ACTIVE, transactional audit).
    let assignMessage: string | null = null
    if (typeof body.assignedAttorneyId === 'string' || body.assignedAttorneyId === null) {
      const nextId =
        body.assignedAttorneyId === null || body.assignedAttorneyId === ''
          ? null
          : String(body.assignedAttorneyId)
      const assignResult = await assignCaseLawyer({
        caseId,
        lawyerId: nextId,
        actor: user,
      })
      assignMessage = assignResult.message
    }

    const hasOtherUpdates = Object.keys(data).length > 0
    const updated = hasOtherUpdates
      ? await prisma.case.update({ where: { id: caseId }, data })
      : await prisma.case.findUniqueOrThrow({ where: { id: caseId } })

    if (typeof body.quotedAmountCents === 'number' && body.quotedAmountCents !== current.quotedAmountCents) {
      await logActivity({
        candidateId: current.candidateId,
        caseId,
        type: current.quotedAmountCents == null ? ActivityType.QUOTE_CREATED : ActivityType.QUOTE_UPDATED,
        message: `Quoted amount set to ${formatCents(body.quotedAmountCents as number)}`,
        actorType: 'ADMIN',
        actorId: user.id,
        metadata: { reason: body.quoteChangeReason ?? null, previous: current.quotedAmountCents },
      })
      await audit({
        actorId: user.id,
        action: 'QUOTE_UPDATE',
        entityType: 'case',
        entityId: caseId,
        metadata: { reason: body.quoteChangeReason ?? null },
      })
    }

    if (typeof body.status === 'string' && body.status !== current.status) {
      if (body.status === 'READY_TO_FILE' && body.override === true && user.role === 'SUPER_ADMIN') {
        await logActivity({
          candidateId: current.candidateId,
          caseId,
          type: ActivityType.FILING_PAYMENT_OVERRIDE,
          message: `Filing gate overridden: ${String(body.overrideReason ?? '')}`,
          actorType: 'ADMIN',
          actorId: user.id,
        })
      }
      await prisma.caseStatusHistory.create({
        data: {
          caseId,
          fromStatus: current.status,
          toStatus: body.status as CaseStatus,
          changedBy: user.id,
          note: typeof body.overrideReason === 'string' ? body.overrideReason : null,
        },
      })
      await logActivity({
        candidateId: current.candidateId,
        caseId,
        type:
          body.status === 'FILED'
            ? ActivityType.FILED
            : body.status === 'APPROVED'
              ? ActivityType.APPROVED
              : ActivityType.CASE_STATUS_CHANGED,
        message: `Case status changed to ${body.status}`,
        actorType: 'ADMIN',
        actorId: user.id,
      })
    }
    if (typeof body.assignedCaseManagerId === 'string') {
      await logActivity({
        candidateId: current.candidateId,
        caseId,
        type: ActivityType.CASE_MANAGER_ASSIGNED,
        message: 'Case manager assigned',
        actorType: 'ADMIN',
        actorId: user.id,
      })
    }
    if (typeof body.caseHealth === 'string' && body.caseHealth !== current.caseHealth) {
      await logActivity({
        candidateId: current.candidateId,
        caseId,
        type: ActivityType.CASE_HEALTH_UPDATED,
        message: `Case health set to ${String(body.caseHealth).replaceAll('_', ' ')}`,
        actorType: 'ADMIN',
        actorId: user.id,
      })
    }

    await audit({
      actorId: user.id,
      action: 'CASE_UPDATE',
      entityType: 'case',
      entityId: caseId,
      metadata: assignMessage ? { lawyerAssignment: assignMessage } : undefined,
    })
    return NextResponse.json({ case: updated, lawyerAssignmentMessage: assignMessage })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('onboarding:write')
    const { caseId } = await ctx.params
    const body = (await request.json()) as { action?: string }
    const record = await prisma.case.findUnique({ where: { id: caseId }, include: { candidate: true } })
    if (!record) return jsonError('Case not found', 404)

    if (body.action === 'invite') {
      const result = await createOnboardingInvite({
        candidateId: record.candidateId,
        caseId: record.id,
        sentById: user.id,
        sendEmail: true,
        recipientEmail: record.candidate.email,
      })
      return NextResponse.json({ url: result.url })
    }

    if (body.action === 'client-link') {
      const purpose = (body as { purpose?: 'ONBOARDING' | 'DOCUMENT_UPLOAD' | 'PAYMENT' | 'CASE_UPDATE' }).purpose ?? 'CASE_UPDATE'
      const result = await createAccessLink({
        candidateId: record.candidateId,
        caseId: record.id,
        purpose,
        requiresEmailVerification: Boolean((body as { verify?: boolean }).verify),
      })
      await logActivity({
        candidateId: record.candidateId,
        caseId,
        type: ActivityType.ACCESS_LINK_CREATED,
        message: `Client ${purpose.toLowerCase()} link created`,
        actorType: 'ADMIN',
        actorId: user.id,
      })
      return NextResponse.json({ url: result.url })
    }

    if (body.action === 'document-request') {
      await requirePermission('communications:write')
      const template = await (await import('@/lib/visa-templates')).getActiveVisaTemplate(
        (await import('@/lib/visa-templates')).caseVisaToCode(record.visaType),
      )
      const items =
        template?.items.map((i) => ({
          key: i.documentKey,
          label: i.documentName,
          category: i.category,
          instructions: i.instructions,
          required: i.defaultRequired,
          allowsMultipleFiles: true,
          templateItemId: i.id,
          source: 'template' as const,
        })) ?? []
      const { createDocumentRequestPackage } = await import('@/lib/document-requests')
      const result = await createDocumentRequestPackage({
        caseId: record.id,
        createdById: user.id,
        requestType: 'FULL',
        items,
        sendEmail: true,
      })
      return NextResponse.json({
        url: result.url,
        documentRequest: result.documentRequest,
      })
    }

    if (body.action === 'configure-payments') {
      await requirePermission('payments:write')
      const plan = body as unknown as {
        totalCents: number
        payment1Cents: number
        payment2Cents: number
        payment3Cents: number
        payment4Cents: number
        currency?: string
      }
      const check = validateInstallments(plan)
      if (!check.ok) return jsonError(check.error)
      await prisma.case.update({
        where: { id: caseId },
        data: {
          quotedAmountCents: plan.totalCents,
          currency: plan.currency ?? record.currency ?? 'usd',
          quotedAmountUpdatedById: user.id,
          quotedAmountLockedAt: record.quotedAmountLockedAt ?? new Date(),
        },
      })
      const amounts = [plan.payment1Cents, plan.payment2Cents, plan.payment3Cents, plan.payment4Cents]
      for (let i = 0; i < 4; i += 1) {
        const existing = await prisma.payment.findUnique({
          where: { caseId_installmentNumber: { caseId, installmentNumber: i + 1 } },
        })
        if (existing?.status === 'PAID') continue
        await prisma.payment.upsert({
          where: { caseId_installmentNumber: { caseId, installmentNumber: i + 1 } },
          update: {
            amountCents: amounts[i],
            currency: plan.currency ?? record.currency ?? 'usd',
            status: existing?.status === 'PAYMENT_LINK_GENERATED' || existing?.status === 'PAYMENT_LINK_SENT'
              ? existing.status
              : 'READY',
          },
          create: {
            candidateId: record.candidateId,
            caseId,
            installmentNumber: i + 1,
            amountCents: amounts[i],
            currency: plan.currency ?? record.currency ?? 'usd',
            status: 'READY',
            createdById: user.id,
          },
        })
      }
      await logActivity({
        candidateId: record.candidateId,
        caseId,
        type: ActivityType.PAYMENT_PLAN_CREATED,
        message: `Payment plan saved for ${formatCents(plan.totalCents)}`,
        actorType: 'ADMIN',
        actorId: user.id,
      })
      return NextResponse.json({ ok: true })
    }

    return jsonError('Unknown action')
  } catch (error) {
    return handleApiError(error)
  }
}
