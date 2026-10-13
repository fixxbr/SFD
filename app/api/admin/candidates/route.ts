import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { findOrCreateCandidate, nextCaseNumber } from '@/lib/candidates'
import { parseVisaType } from '@/lib/visa'
import { searchCandidates } from '@/lib/admin/search-candidates'
import { prisma } from '@/lib/db'
import { ActivityType, logActivity } from '@/lib/activity'
import { autoPayment4, expectedSplit, formatCents, validateInstallments } from '@/lib/payments'
import { assertAssignableLawyer } from '@/lib/assign-lawyer'

export async function GET(request: Request) {
  try {
    const user = await requirePermission('candidates:read')
    const url = new URL(request.url)
    const data = await searchCandidates(user, url.searchParams)
    return NextResponse.json(data)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('candidates:write')
    const body = (await request.json()) as Record<string, string>
    if (!body.fullLegalName || !body.email) return jsonError('Name and email are required.')

    const quotedDollars = body.quotedPrice ? Number(body.quotedPrice) : NaN
    const quotedAmountCents = Number.isFinite(quotedDollars) ? Math.round(quotedDollars * 100) : null
    const currency = (body.currency || 'usd').toLowerCase()
    const visaType = parseVisaType(body.visaType)

    const { candidate, created } = await findOrCreateCandidate({
      fullLegalName: body.fullLegalName,
      email: body.email,
      phone: body.phone,
      currentAddress: body.currentAddress || body.location || null,
      source: 'admin',
    })

    let currentCase = await prisma.case.findFirst({
      where: { candidateId: candidate.id, lifecycle: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
    })

    const openedAt =
      body.appliedDate || body.openedAt
        ? new Date(String(body.appliedDate || body.openedAt))
        : undefined
    const openedAtValid = openedAt && !Number.isNaN(openedAt.getTime()) ? openedAt : undefined

    // Optional structured note for role/experience (no separate DB columns)
    const detailBits = [
      body.occupation?.trim() ? `Occupation: ${body.occupation.trim()}` : '',
      body.experience?.trim() ? `Experience: ${body.experience.trim()}` : '',
      body.notes?.trim() || '',
    ].filter(Boolean)
    const combinedNotes = detailBits.join('\n')

    if (!currentCase) {
      const assignedId = body.assignedAttorneyId?.trim() || ''
      if (assignedId) await assertAssignableLawyer(assignedId)

      const caseNumber = await nextCaseNumber(visaType)
      currentCase = await prisma.case.create({
        data: {
          candidateId: candidate.id,
          caseNumber,
          visaType,
          status: (body.caseStatus as never) || 'QUALIFIED',
          quotedAmountCents: quotedAmountCents ?? undefined,
          currency,
          quotedAmountUpdatedById: user.id,
          quotedAmountLockedAt: quotedAmountCents != null ? new Date() : undefined,
          assignedAttorneyId: assignedId || undefined,
          referredByAdminId: body.referredByAdminId || undefined,
          referredByName: body.referredByName || undefined,
          referralType: (body.referralType as never) || (body.referredByAdminId ? 'TEAM_MEMBER' : undefined),
          referredAt: body.referredByAdminId || body.referredByName ? new Date() : undefined,
          openedAt: openedAtValid,
        },
      })
      if (assignedId) {
        await prisma.lawyerAssignment.create({
          data: {
            caseId: currentCase.id,
            lawyerId: assignedId,
            assignedById: user.id,
            note: 'ASSIGN',
          },
        })
        const lawyer = await prisma.adminUser.findUnique({
          where: { id: assignedId },
          select: { fullName: true },
        })
        await logActivity({
          candidateId: candidate.id,
          caseId: currentCase.id,
          type: ActivityType.LAWYER_ASSIGNED,
          message: `${lawyer?.fullName || 'Lawyer'} assigned by ${user.fullName}.`,
          actorType: 'ADMIN',
          actorId: user.id,
          metadata: { nextLawyerId: assignedId, action: 'ASSIGN' },
        })
      }
      await logActivity({
        candidateId: candidate.id,
        caseId: currentCase.id,
        type: ActivityType.CASE_CREATED,
        message: `${currentCase.caseNumber} case created`,
        actorType: 'ADMIN',
        actorId: user.id,
      })
      if (quotedAmountCents != null) {
        await logActivity({
          candidateId: candidate.id,
          caseId: currentCase.id,
          type: ActivityType.QUOTE_CREATED,
          message: `Quoted amount ${formatCents(quotedAmountCents, currency.toUpperCase())}`,
          actorType: 'ADMIN',
          actorId: user.id,
        })
        const { preFilingCents, postApprovalCents } = expectedSplit(quotedAmountCents)
        // Default equal-ish split of the 75% across payments 1-3
        const p1 = Math.floor(preFilingCents / 3)
        const p2 = Math.floor(preFilingCents / 3)
        const p3 = preFilingCents - p1 - p2
        const p4 = postApprovalCents
        const plan = validateInstallments({
          totalCents: quotedAmountCents,
          payment1Cents: p1,
          payment2Cents: p2,
          payment3Cents: p3,
          payment4Cents: p4,
        })
        if (plan.ok) {
          const amounts = [p1, p2, p3, autoPayment4(quotedAmountCents, p1, p2, p3)]
          for (let i = 0; i < 4; i += 1) {
            await prisma.payment.create({
              data: {
                candidateId: candidate.id,
                caseId: currentCase.id,
                installmentNumber: i + 1,
                amountCents: amounts[i],
                currency,
                status: 'READY',
                createdById: user.id,
              },
            })
          }
          await logActivity({
            candidateId: candidate.id,
            caseId: currentCase.id,
            type: ActivityType.PAYMENT_PLAN_CREATED,
            message: 'Default 75/25 payment plan created',
            actorType: 'ADMIN',
            actorId: user.id,
          })
        }
      }
    } else if (quotedAmountCents != null && currentCase.quotedAmountCents == null) {
      currentCase = await prisma.case.update({
        where: { id: currentCase.id },
        data: {
          quotedAmountCents,
          currency,
          quotedAmountUpdatedById: user.id,
          quotedAmountLockedAt: new Date(),
        },
      })
    }

    if (combinedNotes) {
      await prisma.caseNote.create({
        data: {
          candidateId: candidate.id,
          caseId: currentCase.id,
          authorId: user.id,
          note: combinedNotes,
          visibility: 'INTERNAL',
        },
      })
    }

    return NextResponse.json({ candidate, case: currentCase, created, existing: !created })
  } catch (error) {
    return handleApiError(error)
  }
}
