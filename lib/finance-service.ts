import { randomUUID } from 'crypto'
import { prisma } from '@/lib/db'
import { ActivityType, logActivity } from '@/lib/activity'
import { sendClientEmail } from '@/lib/email'
import { formatVisa } from '@/lib/visa'
import {
  allocatedToItem,
  calculateFinanceTotals,
  computeItemStatus,
  formatCents,
  type ScheduleDraftItem,
  type ScheduleStructure,
} from '@/lib/manual-finance'
import {
  renderFinanceEmail,
  scheduleRowsHtml,
  type FinanceTemplateKey,
} from '@/lib/finance-email-templates'
import { buildPaymentDescription } from '@/lib/payment-description'

function isStripeLikeMethod(method: string) {
  const m = method.trim().toLowerCase()
  return m === 'stripe' || m === 'card' || m === 'credit card' || m === 'debit card'
}

function methodDisplayLabel(method: string, methodOther?: string | null) {
  if (isStripeLikeMethod(method)) return methodOther || method
  return `Manual Entry · ${methodOther || method}`
}

async function logFinanceEvent(input: {
  candidateId: string
  caseId?: string | null
  eventType: string
  message: string
  actorId?: string | null
  metadata?: Record<string, unknown>
}) {
  await prisma.financeEvent.create({
    data: {
      id: randomUUID(),
      candidateId: input.candidateId,
      caseId: input.caseId ?? null,
      eventType: input.eventType,
      message: input.message,
      actorId: input.actorId ?? null,
      metadata: (input.metadata ?? undefined) as never,
    },
  })
}

export async function getOrCreateEngagement(caseId: string) {
  const existing = await prisma.financialEngagement.findUnique({ where: { caseId } })
  if (existing) return existing
  const caseRow = await prisma.case.findUnique({ where: { id: caseId } })
  if (!caseRow) throw new Error('Case not found')
  return prisma.financialEngagement.create({
    data: {
      id: randomUUID(),
      candidateId: caseRow.candidateId,
      caseId,
      quotedAmountCents: caseRow.quotedAmountCents ?? 0,
      currency: (caseRow.currency || 'usd').toUpperCase(),
      quoteStatus: caseRow.quotedAmountCents ? 'DRAFT' : 'DRAFT',
    },
  })
}

export async function saveQuote(input: {
  caseId: string
  amountCents: number
  currency?: string
  status?: string
  changeReason?: string
  actorId: string
  sendEmail?: boolean
}) {
  const caseRow = await prisma.case.findUnique({
    where: { id: input.caseId },
    include: { candidate: true },
  })
  if (!caseRow) throw new Error('Case not found')

  const engagement = await getOrCreateEngagement(input.caseId)
  const previous = engagement.quotedAmountCents
  const status =
    input.status ||
    (previous > 0 && previous !== input.amountCents ? 'UPDATED' : engagement.quoteStatus === 'SENT' ? 'AGREED' : 'DRAFT')

  const updated = await prisma.financialEngagement.update({
    where: { id: engagement.id },
    data: {
      quotedAmountCents: input.amountCents,
      currency: (input.currency || engagement.currency || 'USD').toUpperCase(),
      quoteStatus: status,
      quotedAt: new Date(),
      quotedById: input.actorId,
    },
  })

  await prisma.quoteHistory.create({
    data: {
      id: randomUUID(),
      candidateId: caseRow.candidateId,
      caseId: caseRow.id,
      engagementId: engagement.id,
      amountCents: input.amountCents,
      currency: updated.currency,
      status,
      createdById: input.actorId,
      changeReason: input.changeReason || (previous !== input.amountCents ? 'Quote updated' : 'Quote saved'),
    },
  })

  await prisma.case.update({
    where: { id: caseRow.id },
    data: {
      quotedAmountCents: input.amountCents,
      currency: updated.currency.toLowerCase(),
      quotedAmountLockedAt: new Date(),
      quotedAmountUpdatedById: input.actorId,
    },
  })

  await logFinanceEvent({
    candidateId: caseRow.candidateId,
    caseId: caseRow.id,
    eventType: previous ? 'QUOTE_UPDATED' : 'QUOTE_CREATED',
    message: `Quote ${formatCents(input.amountCents, updated.currency)} (${status})`,
    actorId: input.actorId,
  })
  await logActivity({
    candidateId: caseRow.candidateId,
    caseId: caseRow.id,
    type: previous ? ActivityType.QUOTE_UPDATED : ActivityType.QUOTE_CREATED,
    message: `Quote set to ${formatCents(input.amountCents, updated.currency)}`,
    actorType: 'ADMIN',
    actorId: input.actorId,
  })

  let email = null
  if (input.sendEmail) {
    email = await sendFinanceTemplate({
      caseId: caseRow.id,
      actorId: input.actorId,
      templateKey: 'AGREED_QUOTE',
      extra: {
        'Payment Structure Summary': updated.structureType || 'To be confirmed',
        'First Due Date': '—',
      },
    })
    await prisma.financialEngagement.update({
      where: { id: updated.id },
      data: { quoteStatus: 'SENT' },
    })
  }

  return { engagement: updated, previous, email }
}

export async function savePaymentSchedule(input: {
  caseId: string
  structureType: ScheduleStructure
  frequency?: string | null
  items: ScheduleDraftItem[]
  actorId: string
  allowMismatch?: boolean
  sendEmail?: boolean
}) {
  const caseRow = await prisma.case.findUnique({
    where: { id: input.caseId },
    include: { candidate: true },
  })
  if (!caseRow) throw new Error('Case not found')
  if (!input.items.length) throw new Error('Add at least one scheduled payment')

  const engagement = await getOrCreateEngagement(input.caseId)
  const total = input.items.reduce((s, i) => s + i.amountCents, 0)
  if (!input.allowMismatch && engagement.quotedAmountCents > 0 && total !== engagement.quotedAmountCents) {
    throw new Error(
      `Scheduled total ${formatCents(total)} does not equal quoted ${formatCents(engagement.quotedAmountCents)}. Confirm override to continue.`,
    )
  }

  await prisma.paymentSchedule.updateMany({
    where: { caseId: caseRow.id, status: 'ACTIVE' },
    data: { status: 'SUPERSEDED' },
  })

  const schedule = await prisma.paymentSchedule.create({
    data: {
      id: randomUUID(),
      candidateId: caseRow.candidateId,
      caseId: caseRow.id,
      engagementId: engagement.id,
      structureType: input.structureType,
      frequency: input.frequency ?? null,
      totalAmountCents: total,
      currency: engagement.currency,
      status: 'ACTIVE',
      createdById: input.actorId,
      items: {
        create: input.items.map((item, index) => ({
          id: randomUUID(),
          candidateId: caseRow.candidateId,
          caseId: caseRow.id,
          label: item.label.trim() || `Payment ${index + 1}`,
          sequenceNumber: index + 1,
          scheduledAmountCents: item.amountCents,
          feeCategory: item.feeCategory || 'PROFESSIONAL_FEE',
          countsTowardEngagement: item.countsTowardEngagement !== false,
          dueDate: item.dueDate ? new Date(item.dueDate) : null,
          dueCondition: item.dueCondition || null,
          notes: item.notes || null,
          status: 'UPCOMING',
        })),
      },
    },
    include: { items: { orderBy: { sequenceNumber: 'asc' } } },
  })

  await prisma.financialEngagement.update({
    where: { id: engagement.id },
    data: { structureType: input.structureType },
  })

  await logFinanceEvent({
    candidateId: caseRow.candidateId,
    caseId: caseRow.id,
    eventType: 'SCHEDULE_CREATED',
    message: `Payment schedule (${input.structureType}) · ${schedule.items.length} items`,
    actorId: input.actorId,
  })
  await logActivity({
    candidateId: caseRow.candidateId,
    caseId: caseRow.id,
    type: ActivityType.PAYMENT_PLAN_CREATED,
    message: `Payment schedule created · ${schedule.items.length} payments`,
    actorType: 'ADMIN',
    actorId: input.actorId,
  })

  let email = null
  if (input.sendEmail) {
    email = await sendFinanceTemplate({
      caseId: caseRow.id,
      actorId: input.actorId,
      templateKey: 'PAYMENT_SCHEDULE',
    })
  }

  return { schedule, email }
}

export async function recordPaymentReceipt(input: {
  caseId: string
  amountCents: number
  receivedDate: string
  paymentMethod: string
  paymentMethodOther?: string | null
  receivedByName: string
  confirmedByAdminId?: string | null
  referenceNumber?: string | null
  internalNote?: string | null
  description?: string
  receiptType?: 'SCHEDULED' | 'ADDITIONAL' | 'ADJUSTMENT'
  scheduleItemId?: string | null
  allocations?: Array<{ scheduleItemId: string; amountCents: number }>
  sendConfirmation?: boolean
  actorId?: string | null
  attachment?: {
    storageKey: string
    filename: string
    mimeType: string
    sizeBytes: number
    provider: string
  } | null
}) {
  if (input.amountCents <= 0) throw new Error('Amount must be greater than zero')
  const caseRow = await prisma.case.findUnique({
    where: { id: input.caseId },
    include: { candidate: true },
  })
  if (!caseRow) throw new Error('Case not found')

  const ref = input.referenceNumber?.trim() || null
  if (ref) {
    const existing = await prisma.paymentReceipt.findFirst({
      where: { caseId: caseRow.id, referenceNumber: ref, status: 'ACTIVE' },
      include: {
        confirmedBy: { select: { fullName: true } },
        allocations: true,
      },
    })
    if (existing) {
      return {
        receipt: existing,
        summary: await loadFinanceSummary(caseRow.id),
        email: null,
        duplicate: true as const,
      }
    }
  }

  const receiptType = input.receiptType || (input.scheduleItemId ? 'SCHEDULED' : 'ADDITIONAL')
  let scheduleItem: { sequenceNumber: number; label: string } | null = null
  if (input.scheduleItemId) {
    scheduleItem = await prisma.paymentScheduleItem.findUnique({
      where: { id: input.scheduleItemId },
      select: { sequenceNumber: true, label: true },
    })
  }

  const autoDescription = buildPaymentDescription({
    visaType: caseRow.visaType,
    installmentNumber: scheduleItem?.sequenceNumber ?? null,
    candidateNumber: caseRow.candidate.candidateNumber,
  })
  const description =
    input.description?.trim() ||
    (receiptType === 'ADDITIONAL' ? 'Additional Payment' : autoDescription)

  const manual = !isStripeLikeMethod(input.paymentMethod)
  const noteParts = [
    manual ? 'Manual Entry' : null,
    input.internalNote?.trim() || null,
  ].filter(Boolean)
  const internalNote = noteParts.length ? noteParts.join(' · ') : null

  const receipt = await prisma.paymentReceipt.create({
    data: {
      id: randomUUID(),
      candidateId: caseRow.candidateId,
      caseId: caseRow.id,
      paymentScheduleItemId: input.scheduleItemId || null,
      description,
      amountCents: input.amountCents,
      currency: (caseRow.currency || 'usd').toUpperCase(),
      receivedDate: new Date(input.receivedDate),
      paymentMethod: input.paymentMethod,
      paymentMethodOther: input.paymentMethodOther || null,
      receivedByName: input.receivedByName.trim(),
      confirmedByAdminId: input.confirmedByAdminId || null,
      referenceNumber: ref,
      internalNote,
      receiptType,
      status: 'ACTIVE',
      createdById: input.actorId || null,
      attachmentStorageKey: input.attachment?.storageKey || null,
      attachmentFilename: input.attachment?.filename || null,
      attachmentMimeType: input.attachment?.mimeType || null,
      attachmentSizeBytes: input.attachment?.sizeBytes ?? null,
      attachmentProvider: input.attachment?.provider || null,
      allocations: input.allocations?.length
        ? {
            create: input.allocations.map((a) => ({
              id: randomUUID(),
              scheduleItemId: a.scheduleItemId,
              amountCents: a.amountCents,
            })),
          }
        : undefined,
    },
    include: {
      confirmedBy: { select: { fullName: true } },
      allocations: true,
    },
  })

  await refreshScheduleItemStatuses(caseRow.id)

  const methodLabel = methodDisplayLabel(input.paymentMethod, input.paymentMethodOther)
  await logFinanceEvent({
    candidateId: caseRow.candidateId,
    caseId: caseRow.id,
    eventType: receiptType === 'ADDITIONAL' ? 'ADDITIONAL_PAYMENT_RECORDED' : 'PAYMENT_RECORDED',
    message: `${formatCents(input.amountCents)} · ${methodLabel} · ${description}`,
    actorId: input.actorId,
    metadata: { receiptId: receipt.id, manualEntry: manual },
  })
  await logActivity({
    candidateId: caseRow.candidateId,
    caseId: caseRow.id,
    type: ActivityType.PAYMENT_RECEIVED,
    message: `Payment recorded · ${formatCents(input.amountCents)}${manual ? ' · Manual Entry' : ''}`,
    actorType: 'ADMIN',
    actorId: input.actorId ?? undefined,
  })

  const summary = await loadFinanceSummary(caseRow.id)
  let email = null
  if (input.sendConfirmation && input.actorId) {
    const key: FinanceTemplateKey =
      summary.calculator.paidInFull
        ? 'PAID_IN_FULL'
        : receiptType === 'ADDITIONAL'
          ? 'ADDITIONAL_PAYMENT_RECEIVED'
          : 'PAYMENT_RECEIVED'
    email = await sendFinanceTemplate({
      caseId: caseRow.id,
      actorId: input.actorId,
      templateKey: key,
      extra: {
        'Payment Label': description,
        'Amount Received': formatCents(input.amountCents),
        'Date Received': new Date(input.receivedDate).toLocaleDateString(),
        'Payment Method': input.paymentMethodOther || input.paymentMethod,
        'Received By': `${input.receivedByName}${receipt.confirmedBy ? ` / ${receipt.confirmedBy.fullName}` : ''}`,
        'Payment Reference': input.referenceNumber || '—',
      },
    })
  }

  return { receipt, summary, email }
}

export async function voidPaymentReceipt(input: {
  receiptId: string
  reason: string
  actorId: string
}) {
  const receipt = await prisma.paymentReceipt.findUnique({ where: { id: input.receiptId } })
  if (!receipt) throw new Error('Receipt not found')
  const updated = await prisma.paymentReceipt.update({
    where: { id: receipt.id },
    data: { status: 'VOIDED', voidReason: input.reason },
  })
  await refreshScheduleItemStatuses(receipt.caseId)
  await logFinanceEvent({
    candidateId: receipt.candidateId,
    caseId: receipt.caseId,
    eventType: 'PAYMENT_VOIDED',
    message: `Voided ${formatCents(receipt.amountCents)} · ${input.reason}`,
    actorId: input.actorId,
  })
  return updated
}

export async function refreshScheduleItemStatuses(caseId: string) {
  const items = await prisma.paymentScheduleItem.findMany({
    where: { caseId, schedule: { status: 'ACTIVE' } },
  })
  const receipts = await prisma.paymentReceipt.findMany({
    where: { caseId, status: 'ACTIVE' },
    include: { allocations: true },
  })
  for (const item of items) {
    if (item.status === 'WAIVED' || item.status === 'CANCELLED') continue
    const received = allocatedToItem(item.id, receipts)
    const status = computeItemStatus({
      scheduledCents: item.scheduledAmountCents,
      receivedCents: received,
      dueDate: item.dueDate,
      dueCondition: item.dueCondition,
    })
    if (status !== item.status) {
      await prisma.paymentScheduleItem.update({
        where: { id: item.id },
        data: { status },
      })
    }
  }
}

export async function loadFinanceSummary(caseId: string) {
  await refreshScheduleItemStatuses(caseId)
  const caseRow = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      candidate: { select: { id: true, fullLegalName: true, candidateNumber: true, email: true } },
    },
  })
  if (!caseRow) throw new Error('Case not found')

  const engagement = await prisma.financialEngagement.findUnique({
    where: { caseId },
    include: { quotedBy: { select: { fullName: true } } },
  })
  const quoteHistory = await prisma.quoteHistory.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    include: { createdBy: { select: { fullName: true } } },
  })
  const schedule = await prisma.paymentSchedule.findFirst({
    where: { caseId, status: 'ACTIVE' },
    include: {
      items: {
        orderBy: { sequenceNumber: 'asc' },
        include: {
          receipts: {
            where: { status: 'ACTIVE' },
            orderBy: { receivedDate: 'desc' },
            include: { confirmedBy: { select: { fullName: true } } },
          },
        },
      },
    },
  })
  const receipts = await prisma.paymentReceipt.findMany({
    where: { caseId },
    orderBy: { receivedDate: 'desc' },
    include: {
      confirmedBy: { select: { fullName: true } },
      allocations: true,
      scheduleItem: { select: { label: true, sequenceNumber: true } },
    },
  })
  const events = await prisma.financeEvent.findMany({
    where: { caseId },
    orderBy: { createdAt: 'desc' },
    take: 40,
    include: { actor: { select: { fullName: true } } },
  })

  const active = receipts.filter((r) => r.status === 'ACTIVE')
  let engagementCents = 0
  let scheduledCents = 0
  let additionalCents = 0
  let externalCents = 0
  for (const r of active) {
    const item = schedule?.items.find((i) => i.id === r.paymentScheduleItemId)
    const counts = item ? item.countsTowardEngagement : true
    if (!counts) {
      externalCents += r.amountCents
      continue
    }
    engagementCents += r.amountCents
    if (r.receiptType === 'ADDITIONAL') additionalCents += r.amountCents
    else scheduledCents += r.amountCents
  }

  const quoted = engagement?.quotedAmountCents ?? caseRow.quotedAmountCents ?? 0
  const calculator = calculateFinanceTotals({
    quotedCents: quoted,
    engagementReceiptsCents: engagementCents,
    scheduledReceiptsCents: scheduledCents,
    additionalReceiptsCents: additionalCents,
    externalFeesCents: externalCents,
  })

  const itemsWithBalances =
    schedule?.items.map((item) => {
      const received = allocatedToItem(item.id, active)
      const remaining = Math.max(0, item.scheduledAmountCents - received)
      return {
        ...item,
        receivedCents: received,
        remainingCents: remaining,
        computedStatus: item.status,
      }
    }) ?? []

  const nextDue = itemsWithBalances.find((i) => !['PAID', 'WAIVED', 'CANCELLED'].includes(i.status))

  return {
    candidate: caseRow.candidate,
    visaType: caseRow.visaType,
    visaLabel: formatVisa(caseRow.visaType),
    engagement,
    quoteHistory,
    schedule,
    items: itemsWithBalances,
    receipts,
    events,
    calculator,
    nextDue,
  }
}

export async function sendFinanceTemplate(input: {
  caseId: string
  actorId: string
  templateKey: FinanceTemplateKey
  scheduleItemId?: string
  extra?: Record<string, string>
  subjectOverride?: string
  previewOnly?: boolean
}) {
  const summary = await loadFinanceSummary(input.caseId)
  const item = input.scheduleItemId
    ? summary.items.find((i) => i.id === input.scheduleItemId)
    : summary.nextDue

  const dueLabel = item?.dueCondition
    ? item.dueCondition
    : item?.dueDate
      ? new Date(item.dueDate).toLocaleDateString()
      : '—'

  let daysOverdue = '0'
  if (item?.dueDate && item.status === 'OVERDUE') {
    const days = Math.max(
      0,
      Math.floor((Date.now() - new Date(item.dueDate).getTime()) / (24 * 60 * 60 * 1000)),
    )
    daysOverdue = String(days)
  }

  const scheduleRows = scheduleRowsHtml(
    (summary.items || []).map((i) => ({
      label: i.label,
      amount: formatCents(i.scheduledAmountCents),
      due: i.dueCondition || (i.dueDate ? new Date(i.dueDate).toLocaleDateString() : '—'),
    })),
  )

  const vars: Record<string, string> = {
    'Client Name': summary.candidate.fullLegalName.split(' ')[0] || summary.candidate.fullLegalName,
    'Candidate ID': summary.candidate.candidateNumber,
    'Visa Type': summary.visaLabel,
    'Quoted Amount': formatCents(summary.calculator.quotedTotal),
    'Total Paid': formatCents(summary.calculator.totalReceived),
    'Remaining Balance': formatCents(summary.calculator.remainingBalance),
    'Payment Label': item?.label || 'Payment',
    'Amount Due': formatCents(item?.remainingCents ?? item?.scheduledAmountCents ?? 0),
    'Due Date': dueLabel,
    'Days Overdue': daysOverdue,
    'Payment Structure Summary': summary.engagement?.structureType || 'Custom',
    'First Due Date':
      summary.items.find((i) => i.dueDate)?.dueDate
        ? new Date(summary.items.find((i) => i.dueDate)!.dueDate!).toLocaleDateString()
        : summary.items.find((i) => i.dueCondition)?.dueCondition || '—',
    'Amount Received': input.extra?.['Amount Received'] || '—',
    'Date Received': input.extra?.['Date Received'] || '—',
    'Payment Method': input.extra?.['Payment Method'] || '—',
    'Received By': input.extra?.['Received By'] || '—',
    'Payment Reference': input.extra?.['Payment Reference'] || '—',
    SCHEDULE_ROWS: scheduleRows,
    ...(input.extra || {}),
  }

  const rendered = renderFinanceEmail(input.templateKey, vars)
  const subject = input.subjectOverride || rendered.subject

  if (input.previewOnly) {
    return { email: null, subject, html: rendered.html, plainText: rendered.plainText, vars, preview: true as const }
  }

  const email = await sendClientEmail({
    candidateId: summary.candidate.id,
    caseId: input.caseId,
    type: input.templateKey,
    templateType: input.templateKey,
    to: summary.candidate.email,
    subject,
    text: rendered.plainText,
    html: rendered.html,
    sentById: input.actorId,
    candidateNumber: summary.candidate.candidateNumber,
    metadata: { financeTemplate: input.templateKey, scheduleItemId: input.scheduleItemId },
  })

  if (input.scheduleItemId && (input.templateKey === 'PAYMENT_REMINDER' || input.templateKey === 'PAYMENT_DUE')) {
    await prisma.paymentScheduleItem.update({
      where: { id: input.scheduleItemId },
      data: {
        reminderCount: { increment: 1 },
        lastReminderAt: new Date(),
      },
    })
  }
  if (input.scheduleItemId && input.templateKey === 'PAYMENT_OVERDUE') {
    await prisma.paymentScheduleItem.update({
      where: { id: input.scheduleItemId },
      data: { lastOverdueNoticeAt: new Date() },
    })
  }

  await logFinanceEvent({
    candidateId: summary.candidate.id,
    caseId: input.caseId,
    eventType: `EMAIL_${input.templateKey}`,
    message: `Sent ${rendered.label}`,
    actorId: input.actorId,
  })

  return { email, subject, html: rendered.html, vars, preview: false as const }
}

export function buildFinanceCsv(rows: Array<Record<string, string | number | null | undefined>>) {
  if (!rows.length) return 'Candidate ID,Candidate Name\n'
  const headers = Object.keys(rows[0])
  const escape = (v: unknown) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`
    return s
  }
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n')
}
