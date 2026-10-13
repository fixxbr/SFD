import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import {
  buildFinanceCsv,
  loadFinanceSummary,
  recordPaymentReceipt,
  savePaymentSchedule,
  saveQuote,
  sendFinanceTemplate,
  voidPaymentReceipt,
} from '@/lib/finance-service'
import { buildInstallmentDrafts, dollarsToCents, type ScheduleStructure } from '@/lib/manual-finance'
import type { FinanceTemplateKey } from '@/lib/finance-email-templates'
import { prisma } from '@/lib/db'
import { formatCents } from '@/lib/manual-finance'

export async function GET(request: Request) {
  try {
    await requirePermission('payments:read')
    const url = new URL(request.url)
    const caseId = url.searchParams.get('caseId')
    const exportCsv = url.searchParams.get('export') === 'csv'

    if (exportCsv) {
      const receipts = await prisma.paymentReceipt.findMany({
        where: { status: 'ACTIVE' },
        orderBy: { receivedDate: 'desc' },
        take: 2000,
        include: {
          candidate: { select: { candidateNumber: true, fullLegalName: true } },
          case: { select: { visaType: true, quotedAmountCents: true } },
          confirmedBy: { select: { fullName: true } },
          scheduleItem: { select: { label: true } },
        },
      })
      const rows = receipts.map((r) => ({
        'Candidate ID': r.candidate.candidateNumber,
        'Candidate Name': r.candidate.fullLegalName,
        Visa: r.case.visaType,
        Quoted: formatCents(r.case.quotedAmountCents ?? 0),
        Description: r.description,
        Amount: formatCents(r.amountCents),
        'Payment Method': r.paymentMethodOther || r.paymentMethod,
        'Payment Date': r.receivedDate.toISOString().slice(0, 10),
        'Received By': r.receivedByName,
        'Confirmed By': r.confirmedBy?.fullName ?? '',
        Reference: r.referenceNumber ?? '',
      }))
      const csv = buildFinanceCsv(rows)
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="afterstem-payments.csv"',
        },
      })
    }

    if (!caseId) return jsonError('caseId is required')
    const summary = await loadFinanceSummary(caseId)
    return NextResponse.json(summary)
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('payments:write')
    const body = (await request.json()) as Record<string, unknown>
    const action = String(body.action || '')

    if (action === 'save-quote') {
      const caseId = String(body.caseId || '')
      const amountCents =
        typeof body.amountCents === 'number' ? body.amountCents : dollarsToCents(String(body.amount || '0'))
      const result = await saveQuote({
        caseId,
        amountCents,
        currency: typeof body.currency === 'string' ? body.currency : 'USD',
        status: typeof body.status === 'string' ? body.status : undefined,
        changeReason: typeof body.changeReason === 'string' ? body.changeReason : undefined,
        actorId: user.id,
        sendEmail: Boolean(body.sendEmail),
      })
      return NextResponse.json(result)
    }

    if (action === 'save-schedule') {
      const caseId = String(body.caseId || '')
      const structureType = String(body.structureType || 'CUSTOM') as ScheduleStructure
      let items = (body.items as Array<{
        label: string
        amountCents?: number
        amount?: string
        dueDate?: string | null
        dueCondition?: string | null
        feeCategory?: string
        countsTowardEngagement?: boolean
        notes?: string | null
      }>) || []

      if (structureType === 'MONTHLY' && body.generateMonthly) {
        const total =
          typeof body.totalCents === 'number' ? body.totalCents : dollarsToCents(String(body.total || '0'))
        const count = Number(body.installmentCount || 6)
        const first = String(body.firstDueDate || new Date().toISOString().slice(0, 10))
        const frequency = (body.frequency === 'BIWEEKLY' ? 'BIWEEKLY' : 'MONTHLY') as 'MONTHLY' | 'BIWEEKLY'
        items = buildInstallmentDrafts({
          totalCents: total,
          count,
          firstDueDate: new Date(first),
          frequency,
        })
      }

      const normalized = items.map((i) => ({
        label: i.label,
        amountCents: typeof i.amountCents === 'number' ? i.amountCents : dollarsToCents(String(i.amount || '0')),
        dueDate: i.dueDate,
        dueCondition: i.dueCondition,
        feeCategory: i.feeCategory,
        countsTowardEngagement: i.countsTowardEngagement,
        notes: i.notes,
      }))

      try {
        const result = await savePaymentSchedule({
          caseId,
          structureType,
          frequency: typeof body.frequency === 'string' ? body.frequency : null,
          items: normalized,
          actorId: user.id,
          allowMismatch: Boolean(body.allowMismatch),
          sendEmail: Boolean(body.sendEmail),
        })
        return NextResponse.json(result)
      } catch (e) {
        if (e instanceof Error && /does not equal quoted/i.test(e.message)) {
          return jsonError(e.message, 409)
        }
        throw e
      }
    }

    if (action === 'record-payment') {
      let attachment:
        | {
            storageKey: string
            filename: string
            mimeType: string
            sizeBytes: number
            provider: string
          }
        | null = null
      if (body.attachmentStorageKey && body.attachmentFilename) {
        attachment = {
          storageKey: String(body.attachmentStorageKey),
          filename: String(body.attachmentFilename),
          mimeType: String(body.attachmentMimeType || 'application/octet-stream'),
          sizeBytes: Number(body.attachmentSizeBytes || 0),
          provider: String(body.attachmentProvider || 's3'),
        }
      }
      const result = await recordPaymentReceipt({
        caseId: String(body.caseId || ''),
        amountCents:
          typeof body.amountCents === 'number' ? body.amountCents : dollarsToCents(String(body.amount || '0')),
        receivedDate: String(body.receivedDate || new Date().toISOString().slice(0, 10)),
        paymentMethod: String(body.paymentMethod || 'Other'),
        paymentMethodOther: typeof body.paymentMethodOther === 'string' ? body.paymentMethodOther : null,
        receivedByName: String(body.receivedByName || user.fullName),
        confirmedByAdminId: user.id,
        referenceNumber: typeof body.referenceNumber === 'string' ? body.referenceNumber : null,
        internalNote: typeof body.internalNote === 'string' ? body.internalNote : null,
        description: typeof body.description === 'string' ? body.description : undefined,
        receiptType: (body.receiptType as 'SCHEDULED' | 'ADDITIONAL' | 'ADJUSTMENT') || undefined,
        scheduleItemId: typeof body.scheduleItemId === 'string' ? body.scheduleItemId : null,
        allocations: Array.isArray(body.allocations)
          ? (body.allocations as Array<{ scheduleItemId: string; amountCents: number }>)
          : undefined,
        sendConfirmation: Boolean(body.sendConfirmation),
        actorId: user.id,
        attachment,
      })
      return NextResponse.json(result)
    }

    if (action === 'upload-receipt-attachment') {
      const { buildStorageKey, putPrivateObject, validateUpload, storageConfigured } = await import('@/lib/storage')
      if (!storageConfigured()) return jsonError('File storage is not configured.', 503)
      const caseId = String(body.caseId || '')
      const filename = String(body.filename || '')
      const mimeType = String(body.mimeType || '')
      const base64 = String(body.contentBase64 || '')
      if (!caseId || !filename || !base64) return jsonError('caseId, filename, and contentBase64 are required.')
      const buf = Buffer.from(base64, 'base64')
      const safeName = validateUpload({ mimeType, size: buf.length, filename })
      const caseRow = await prisma.case.findUnique({ where: { id: caseId } })
      if (!caseRow) return jsonError('Case not found', 404)
      const key = buildStorageKey({
        candidateId: caseRow.candidateId,
        caseId,
        category: 'payment-proof',
        documentType: 'receipt',
        filename: safeName,
      })
      const stored = await putPrivateObject({ key, body: buf, mimeType })
      return NextResponse.json({
        storageKey: stored.key,
        provider: stored.provider,
        filename: safeName,
        mimeType,
        sizeBytes: buf.length,
      })
    }

    if (action === 'receipt-attachment-url') {
      const { signedGetUrl } = await import('@/lib/storage')
      const receiptId = String(body.receiptId || '')
      const receipt = await prisma.paymentReceipt.findUnique({ where: { id: receiptId } })
      if (!receipt?.attachmentStorageKey) return jsonError('Attachment not found', 404)
      const signed = await signedGetUrl(
        receipt.attachmentStorageKey,
        receipt.attachmentFilename || 'receipt',
        'attachment',
      )
      return NextResponse.json({ url: signed.url, filename: receipt.attachmentFilename })
    }

    if (action === 'void-payment') {
      const result = await voidPaymentReceipt({
        receiptId: String(body.receiptId || ''),
        reason: String(body.reason || 'Corrected'),
        actorId: user.id,
      })
      return NextResponse.json({ receipt: result })
    }

    if (action === 'send-email') {
      const result = await sendFinanceTemplate({
        caseId: String(body.caseId || ''),
        actorId: user.id,
        templateKey: String(body.templateKey || 'PAYMENT_DUE') as FinanceTemplateKey,
        scheduleItemId: typeof body.scheduleItemId === 'string' ? body.scheduleItemId : undefined,
        subjectOverride: typeof body.subject === 'string' ? body.subject : undefined,
        extra: (body.extra as Record<string, string>) || undefined,
      })
      return NextResponse.json(result)
    }

    if (action === 'preview-email') {
      const result = await sendFinanceTemplate({
        caseId: String(body.caseId || ''),
        actorId: user.id,
        templateKey: String(body.templateKey || 'PAYMENT_DUE') as FinanceTemplateKey,
        scheduleItemId: typeof body.scheduleItemId === 'string' ? body.scheduleItemId : undefined,
        previewOnly: true,
      })
      return NextResponse.json(result)
    }

    if (action === 'update-item-due') {
      const itemId = String(body.itemId || '')
      const item = await prisma.paymentScheduleItem.update({
        where: { id: itemId },
        data: {
          dueDate: body.dueDate ? new Date(String(body.dueDate)) : null,
          dueCondition: typeof body.dueCondition === 'string' ? body.dueCondition : undefined,
        },
      })
      const { refreshScheduleItemStatuses } = await import('@/lib/finance-service')
      await refreshScheduleItemStatuses(item.caseId)
      return NextResponse.json({ item })
    }

    return jsonError('Unknown action')
  } catch (error) {
    if (error instanceof Error && /not found|must be|greater than|at least/i.test(error.message)) {
      return jsonError(error.message)
    }
    return handleApiError(error)
  }
}
