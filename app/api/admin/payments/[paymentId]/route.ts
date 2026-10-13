import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { ActivityType, logActivity } from '@/lib/activity'
import { isPaidStatus } from '@/lib/payments'

type Ctx = { params: Promise<{ paymentId: string }> }

/** Legacy installment mark-paid only. Stripe checkout/link generation is removed. */
export async function POST(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('payments:write')
    const { paymentId } = await ctx.params
    const body = (await request.json()) as {
      action?: string
      sendEmail?: boolean
      paidAmountCents?: number
      paidAt?: string
      paymentMethodType?: string
      referenceId?: string
      adminNote?: string
    }
    const payment = await prisma.payment.findUnique({ where: { id: paymentId } })
    if (!payment) return jsonError('Payment not found', 404)

    if (body.action === 'mark-paid') {
      if (isPaidStatus(payment.status)) return jsonError('This installment is already paid.')
      const paidAmountCents = Number(body.paidAmountCents ?? payment.amountCents)
      if (!Number.isFinite(paidAmountCents) || paidAmountCents <= 0) {
        return jsonError('Paid amount is required.')
      }
      const method = String(body.paymentMethodType || '').trim()
      if (!method) return jsonError('Payment method is required.')
      if (/stripe/i.test(method)) return jsonError('Stripe is no longer supported. Choose a manual payment method.')
      const paidAt = body.paidAt ? new Date(body.paidAt) : new Date()

      const updated = await prisma.payment.update({
        where: { id: paymentId },
        data: {
          status: 'PAID',
          paidAmountCents,
          paidAt,
          paymentMethodType: method,
          referenceId: body.referenceId?.trim() || null,
          adminNote: body.adminNote?.trim() || null,
          confirmedById: user.id,
          confirmedSource: 'ADMIN',
        },
        include: { confirmedBy: { select: { fullName: true } } },
      })

      await prisma.paymentEvent.create({
        data: {
          paymentId,
          candidateId: payment.candidateId,
          caseId: payment.caseId,
          fromStatus: payment.status,
          toStatus: 'PAID',
          source: 'ADMIN',
          actorId: user.id,
          note: body.adminNote?.trim() || null,
          metadata: { method, referenceId: body.referenceId ?? null },
        },
      })

      await logActivity({
        candidateId: payment.candidateId,
        caseId: payment.caseId,
        type: ActivityType.PAYMENT_RECEIVED,
        message: `Payment ${payment.installmentNumber} marked paid (${method})`,
        actorType: 'ADMIN',
        actorId: user.id,
        metadata: { paymentId, confirmedSource: 'ADMIN' },
      })

      return NextResponse.json({ payment: updated })
    }

    return jsonError(
      'Stripe payment links are disabled. Open Candidate → Payments to record payments manually.',
      410,
    )
  } catch (error) {
    return handleApiError(error)
  }
}
