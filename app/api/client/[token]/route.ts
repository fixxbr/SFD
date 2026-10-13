import { NextResponse } from 'next/server'
import { resolveAccessToken, issueEmailVerificationCode, verifyEmailCode, maskEmail } from '@/lib/client-access'
import { handleApiError, jsonError } from '@/lib/http'
import { financialSummary, formatCents } from '@/lib/payments'
import { CASE_STATUS_LABELS, formatVisa } from '@/lib/visa'
import { sendClientEmail } from '@/lib/email'
import { prisma } from '@/lib/db'

type Ctx = { params: Promise<{ token: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params
    const link = await resolveAccessToken(token)
    if (!link) return jsonError('This secure link is invalid or has expired.', 404)

    if (link.requiresEmailVerification) {
      return NextResponse.json({
        requiresVerification: true,
        maskedEmail: maskEmail(link.candidate.email),
        purpose: link.purpose,
      })
    }

    return NextResponse.json(await clientPayload(link))
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    const { token } = await ctx.params
    const link = await resolveAccessToken(token)
    if (!link) return jsonError('This secure link is invalid or has expired.', 404)
    const body = (await request.json()) as { action?: string; code?: string }

    if (body.action === 'send-code') {
      const code = await issueEmailVerificationCode(link.id, link.candidateId)
      await sendClientEmail({
        candidateId: link.candidateId,
        caseId: link.caseId,
        type: 'GENERIC',
        to: link.candidate.email,
        subject: 'Your Afterstem verification code',
        text: `Your Afterstem verification code is ${code}. It expires in 15 minutes.`,
      })
      return NextResponse.json({ ok: true, maskedEmail: maskEmail(link.candidate.email) })
    }

    if (body.action === 'verify') {
      const ok = await verifyEmailCode(link.id, String(body.code ?? ''))
      if (!ok) return jsonError('Invalid or expired verification code.', 401)
      await prisma.candidateAccessLink.update({
        where: { id: link.id },
        data: { requiresEmailVerification: false },
      })
      const refreshed = await resolveAccessToken(token)
      if (!refreshed) return jsonError('This secure link is invalid or has expired.', 404)
      return NextResponse.json(await clientPayload(refreshed))
    }

    return jsonError('Unknown action')
  } catch (error) {
    return handleApiError(error)
  }
}

async function clientPayload(link: NonNullable<Awaited<ReturnType<typeof resolveAccessToken>>>) {
  const payments = link.case.payments
  const quoted = link.case.quotedAmountCents ?? payments.reduce((s, p) => s + p.amountCents, 0)
  const summary = financialSummary(quoted, payments)
  const focusRow =
    (link.paymentId ? payments.find((p) => p.id === link.paymentId) : null) ??
    payments.find((p) => p.installmentNumber === summary.nextPayment?.installmentNumber) ??
    null

  return {
    requiresVerification: false,
    candidate: {
      fullLegalName: link.candidate.fullLegalName,
      email: link.candidate.email,
    },
    case: {
      caseNumber: link.case.caseNumber,
      visaType: link.case.visaType,
      visaLabel: formatVisa(link.case.visaType),
      status: link.case.status,
      statusLabel: CASE_STATUS_LABELS[link.case.status],
      currency: link.case.currency,
    },
    purpose: link.purpose,
    financial: {
      quotedCents: quoted,
      paidCents: summary.totalPaid,
      remainingCents: summary.remaining,
      preFilingCents: summary.preFilingCents,
      prePaidCents: summary.prePaid,
      preFilingComplete: summary.preFilingComplete,
      paidInFull: summary.paidInFull,
      quotedLabel: formatCents(quoted, link.case.currency.toUpperCase()),
      paidLabel: formatCents(summary.totalPaid, link.case.currency.toUpperCase()),
      remainingLabel: formatCents(summary.remaining, link.case.currency.toUpperCase()),
    },
    payments: payments.map((p) => ({
      id: p.id,
      installmentNumber: p.installmentNumber,
      amountCents: p.amountCents,
      amountLabel: formatCents(p.amountCents, p.currency.toUpperCase()),
      status: p.status,
      paymentUrl: p.paymentUrl,
      paidAt: p.paidAt,
    })),
    focusPayment: focusRow
      ? {
          id: focusRow.id,
          installmentNumber: focusRow.installmentNumber,
          amountCents: focusRow.amountCents,
          amountLabel: formatCents(focusRow.amountCents, focusRow.currency.toUpperCase()),
          status: focusRow.status,
          paymentUrl: focusRow.paymentUrl,
        }
      : null,
  }
}
