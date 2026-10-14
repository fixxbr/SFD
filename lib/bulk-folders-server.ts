import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import type { Prisma, VisaType } from '@prisma/client'
import { prisma } from '@/lib/db'
import { formatVisa, CASE_STATUS_LABELS, parseVisaType } from '@/lib/visa'
import { formatCents } from '@/lib/payments'
import { resolveVisaTemplate } from '@/lib/visa-templates'
import { onboardingCatalogForCase } from '@/lib/onboarding'
import { documentKeyLookupKeys, isAdditionalEvidenceKey } from '@/lib/document-keys'
import { isLinkRequestKey } from '@/lib/link-request-items'
import { findOrCreateCandidate, nextCaseNumber } from '@/lib/candidates'
import { normalizeEmail, normalizeName } from '@/lib/normalize'
import { ActivityType, logActivity } from '@/lib/activity'
import {
  BULK_FORMAT,
  EDITABLE_FIELDS,
  FIELD_LABELS,
  FILE_KIND_SLOT,
  GENERATED_PDF_SUBJECT,
  candidateFolderNames,
  type CandidateFolderDetails,
  type EditableField,
} from '@/lib/bulk-folders'

export type FolderScope = { includeFinance: boolean; includeNotes: boolean }

/** Document items on a case's list (visa list + custom documents), for naming and mapping folders. */
async function caseDocumentItems(caseId: string, visaType: VisaType) {
  const template = await resolveVisaTemplate(visaType)
  const custom = await prisma.customDocumentDef.findMany({ where: { caseId }, select: { key: true, label: true } })
  const items = [
    ...(template?.items ?? [])
      .filter((i) => !isLinkRequestKey(i.documentKey))
      .map((i) => ({ key: i.documentKey, label: i.documentName })),
    ...custom.filter((c) => !isLinkRequestKey(c.key)).map((c) => ({ key: c.key, label: c.label })),
  ]
  return items
}

function documentFolderLabel(questionKey: string, items: Array<{ key: string; label: string }>) {
  const lookups = documentKeyLookupKeys(questionKey)
  const item = items.find((i) => lookups.includes(i.key))
  if (item) return item.label
  const special = Object.values(FILE_KIND_SLOT).find((s) => s.questionKey === questionKey)
  if (special) return special.label
  if (isAdditionalEvidenceKey(questionKey)) return 'Additional information'
  return questionKey.replace(/^custom_/, '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || 'Other'
}

/** Everything the browser needs to build the folder ZIP. Files are fetched one by one afterwards. */
export async function buildFolderManifest(scope: FolderScope, candidateIds?: string[]) {
  const candidates = await prisma.candidate.findMany({
    where: { lifecycle: 'ACTIVE', ...(candidateIds?.length ? { id: { in: candidateIds } } : {}) },
    orderBy: { fullLegalName: 'asc' },
    include: {
      cases: {
        where: { lifecycle: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          documents: {
            where: { status: { not: 'ARCHIVED' }, isCurrentVersion: true },
            orderBy: { uploadedAt: 'asc' },
            select: {
              id: true,
              questionKey: true,
              originalFilename: true,
              displayName: true,
              fileSizeBytes: true,
              externalUrl: true,
            },
          },
          financialEngagement: scope.includeFinance ? { select: { quotedAmountCents: true, currency: true } } : false,
        },
      },
    },
  })
  const folders = candidateFolderNames(candidates)
  const out = []
  for (const candidate of candidates) {
    const c = candidate.cases[0]
    const items = c ? await caseDocumentItems(c.id, c.visaType) : []
    const files = (c?.documents ?? []).filter((d) => !d.externalUrl)
    const links = (c?.documents ?? []).filter((d) => d.externalUrl)
    const quotedCents = c ? (c.financialEngagement?.quotedAmountCents ?? c.quotedAmountCents ?? null) : null
    const details: CandidateFolderDetails = {
      format: BULK_FORMAT,
      candidateNumber: candidate.candidateNumber,
      fullLegalName: candidate.fullLegalName,
      email: candidate.email,
      phone: candidate.phone,
      nationality: candidate.nationality,
      dateOfBirth: candidate.dateOfBirth ? candidate.dateOfBirth.toISOString().slice(0, 10) : null,
      currentImmigrationStatus: candidate.currentImmigrationStatus,
      currentAddress: candidate.currentAddress,
      visaType: c ? String(c.visaType) : null,
      caseNumber: c?.caseNumber ?? null,
      caseStatus: c ? (CASE_STATUS_LABELS[c.status] ?? c.status) : null,
      quotedAmount:
        scope.includeFinance && quotedCents != null
          ? formatCents(quotedCents, (c?.financialEngagement?.currency || c?.currency || 'USD').toUpperCase())
          : null,
      newLawyerNotes: [],
    }
    out.push({
      id: candidate.id,
      candidateNumber: candidate.candidateNumber,
      fullLegalName: candidate.fullLegalName,
      folder: folders.get(candidate.id)!,
      caseId: c?.id ?? null,
      details,
      documents: files.map((d) => ({
        id: d.id,
        folder: documentFolderLabel(d.questionKey, items),
        // Original file name, so the downloaded file looks like what was uploaded.
        fileName: d.originalFilename || d.displayName || 'file',
        size: d.fileSizeBytes,
      })),
      links: links.map((d) => ({ label: d.displayName && d.displayName !== d.externalUrl ? d.displayName : '', url: d.externalUrl as string })),
    })
  }
  return out
}

// ---------- PDFs ----------

class PdfWriter {
  private constructor(
    readonly pdf: PDFDocument,
    private font: PDFFont,
    private bold: PDFFont,
  ) {
    this.page = pdf.addPage([612, 792])
  }
  private page: PDFPage
  private y = 744
  static async create(title: string) {
    const pdf = await PDFDocument.create()
    pdf.setTitle(title)
    pdf.setSubject(GENERATED_PDF_SUBJECT)
    pdf.setProducer('Afterstem')
    const writer = new PdfWriter(pdf, await pdf.embedFont(StandardFonts.Helvetica), await pdf.embedFont(StandardFonts.HelveticaBold))
    writer.heading(title, 16)
    return writer
  }
  /** Standard fonts only cover WinAnsi; replace anything else so a name never breaks the PDF. */
  private clean(text: string) {
    return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/[^\x20-\x7e\xa0-\xff]/g, '?')
  }
  private line(text: string, size: number, font: PDFFont, indent = 0) {
    const maxWidth = 516 - indent
    const words = this.clean(text).split(/\s+/)
    let current = ''
    const flush = () => {
      if (this.y < 56) {
        this.page = this.pdf.addPage([612, 792])
        this.y = 744
      }
      this.page.drawText(current, { x: 48 + indent, y: this.y, size, font, color: rgb(0.05, 0.14, 0.25) })
      this.y -= size + 5
      current = ''
    }
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (font.widthOfTextAtSize(next, size) > maxWidth && current) flush()
      current = current ? `${current} ${word}` : word
      while (font.widthOfTextAtSize(current, size) > maxWidth) {
        // A single very long word (URL): hard-wrap it.
        let cut = current.length - 1
        while (cut > 1 && font.widthOfTextAtSize(current.slice(0, cut), size) > maxWidth) cut -= 1
        const rest = current.slice(cut)
        current = current.slice(0, cut)
        flush()
        current = rest
      }
    }
    if (current) flush()
  }
  heading(text: string, size = 12) {
    this.y -= 4
    this.line(text, size, this.bold)
    this.y -= 2
  }
  field(label: string, value: string | null | undefined) {
    if (value == null || value === '') return
    this.line(`${label}: ${value}`, 10, this.font)
  }
  text(value: string, indent = 0) {
    for (const para of value.split(/\r?\n/)) this.line(para || ' ', 10, this.font, indent)
  }
  gap() {
    this.y -= 8
  }
  async save() {
    return Buffer.from(await this.pdf.save())
  }
}

async function loadCase(candidateId: string) {
  return prisma.case.findFirst({ where: { candidateId, lifecycle: 'ACTIVE' }, orderBy: { createdAt: 'desc' } })
}

export async function candidateDetailsPdf(candidateId: string) {
  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } })
  if (!candidate) throw new Error('Candidate not found')
  const c = await loadCase(candidateId)
  const lawyer = c?.assignedAttorneyId
    ? await prisma.adminUser.findUnique({ where: { id: c.assignedAttorneyId }, select: { fullName: true } })
    : null
  const w = await PdfWriter.create('Candidate Details')
  w.field('Name', candidate.fullLegalName)
  w.field('Candidate ID', candidate.candidateNumber)
  w.field('Email', candidate.email)
  w.field('Phone', candidate.phone)
  w.field('Nationality', candidate.nationality)
  w.field('Date of birth', candidate.dateOfBirth?.toISOString().slice(0, 10))
  w.field('Immigration status', candidate.currentImmigrationStatus)
  w.field('Address', candidate.currentAddress)
  if (c) {
    w.gap()
    w.heading('Case')
    w.field('Case number', c.caseNumber)
    w.field('Visa type', formatVisa(c.visaType))
    w.field('Status', CASE_STATUS_LABELS[c.status] ?? c.status)
    w.field('Lawyer', lawyer?.fullName ?? 'Unassigned')
    w.field('Opened', c.openedAt?.toISOString().slice(0, 10))
  }
  w.gap()
  w.text('To change these details, edit Candidate_Details.json in this folder and use Bulk Upload.')
  return w.save()
}

export async function quotedAmountPdf(candidateId: string) {
  const c = await loadCase(candidateId)
  const w = await PdfWriter.create('Quoted Amount')
  if (!c) {
    w.text('No active case.')
    return w.save()
  }
  const engagement = await prisma.financialEngagement.findUnique({ where: { caseId: c.id } })
  const currency = (engagement?.currency || c.currency || 'USD').toUpperCase()
  const quoted = engagement?.quotedAmountCents ?? c.quotedAmountCents
  w.field('Case', `${c.caseNumber} (${formatVisa(c.visaType)})`)
  w.field('Quoted amount', quoted != null ? formatCents(quoted, currency) : 'Not quoted yet')
  w.field('Quote status', engagement?.quoteStatus)
  w.field('Quoted on', engagement?.quotedAt?.toISOString().slice(0, 10))
  if (engagement?.notes) w.field('Notes', engagement.notes)
  const history = await prisma.quoteHistory.findMany({ where: { caseId: c.id }, orderBy: { createdAt: 'asc' } })
  if (history.length) {
    w.gap()
    w.heading('Quote history')
    for (const h of history) {
      w.text(`${h.createdAt.toISOString().slice(0, 10)}  ${formatCents(h.amountCents, h.currency.toUpperCase())}  ${h.status}${h.changeReason ? ` - ${h.changeReason}` : ''}`)
    }
  }
  return w.save()
}

export async function paymentPlanPdf(candidateId: string) {
  const c = await loadCase(candidateId)
  const w = await PdfWriter.create('Payment Plan')
  if (!c) {
    w.text('No active case.')
    return w.save()
  }
  const schedules = await prisma.paymentSchedule.findMany({
    where: { caseId: c.id, status: 'ACTIVE' },
    orderBy: { createdAt: 'asc' },
  })
  const items = await prisma.paymentScheduleItem.findMany({ where: { caseId: c.id }, orderBy: { sequenceNumber: 'asc' } })
  const receipts = await prisma.paymentReceipt.findMany({ where: { caseId: c.id, status: 'ACTIVE' }, orderBy: { receivedDate: 'asc' } })
  w.field('Case', `${c.caseNumber} (${formatVisa(c.visaType)})`)
  if (!schedules.length && !items.length) w.text('No payment plan yet.')
  for (const s of schedules) {
    w.gap()
    w.heading(`Plan: ${s.structureType}${s.frequency ? ` (${s.frequency})` : ''}`)
    w.field('Total', formatCents(s.totalAmountCents, s.currency.toUpperCase()))
    w.field('Status', s.status)
    for (const i of items.filter((x) => x.scheduleId === s.id)) {
      const due = i.dueDate ? i.dueDate.toISOString().slice(0, 10) : i.dueCondition || 'No due date'
      w.text(`${i.sequenceNumber}. ${i.label} - ${formatCents(i.scheduledAmountCents, s.currency.toUpperCase())} - due ${due} - ${i.status}`, 8)
    }
  }
  w.gap()
  w.heading('Payments received')
  if (!receipts.length) w.text('None yet.')
  let total = 0
  for (const r of receipts) {
    total += r.amountCents
    w.text(`${r.receivedDate.toISOString().slice(0, 10)}  ${formatCents(r.amountCents, r.currency.toUpperCase())}  ${r.paymentMethod}${r.referenceNumber ? `  ref ${r.referenceNumber}` : ''}  ${r.description}`)
  }
  if (receipts.length) w.field('Total received', formatCents(total, (receipts[0]?.currency || 'USD').toUpperCase()))
  return w.save()
}

export async function lawyersNotesPdf(candidateId: string) {
  const c = await loadCase(candidateId)
  const w = await PdfWriter.create("Lawyer's Notes")
  const notes = c
    ? await prisma.caseNote.findMany({
        where: { caseId: c.id, archivedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { fullName: true } } },
      })
    : []
  if (!notes.length) w.text('No notes yet.')
  for (const n of notes) {
    w.heading(`${n.createdAt.toISOString().slice(0, 16).replace('T', ' ')} - ${n.author.fullName}${n.isPinned ? ' (pinned)' : ''}`, 10)
    w.text(n.note, 8)
    w.gap()
  }
  w.text('To add a note offline, add it to "newLawyerNotes" in Candidate_Details.json and use Bulk Upload.')
  return w.save()
}

function answerToText(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map(answerToText).filter(Boolean).join('; ')
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>
    if ('value' in v) return answerToText(v.value)
    if (Array.isArray(v.items)) {
      return v.items
        .map((row) =>
          Object.entries(row as Record<string, unknown>)
            .map(([k, x]) => (answerToText(x) ? `${k}: ${answerToText(x)}` : ''))
            .filter(Boolean)
            .join(', '),
        )
        .filter(Boolean)
        .join(' | ')
    }
  }
  return ''
}

export async function onboardingAnswersPdf(candidateId: string) {
  const c = await loadCase(candidateId)
  const w = await PdfWriter.create('Onboarding Answers')
  const submission = c
    ? await prisma.o1OnboardingSubmission.findFirst({ where: { caseId: c.id }, orderBy: { updatedAt: 'desc' } })
    : null
  if (!c || !submission) {
    w.text('No onboarding answers yet.')
    return w.save()
  }
  w.field('Status', submission.status)
  w.field('Submitted', submission.submittedAt?.toISOString().slice(0, 10))
  const answers = (submission.answers ?? {}) as Record<string, unknown>
  const catalog = await onboardingCatalogForCase(String(c.visaType))
  for (const section of catalog) {
    const rows = section.questions
      .filter((q) => q.type !== 'file')
      .map((q) => ({ label: q.label, text: answerToText(answers[q.key]) }))
      .filter((r) => r.text)
    if (!rows.length) continue
    w.gap()
    w.heading(section.title)
    for (const r of rows) w.field(r.label, r.text)
  }
  return w.save()
}

// ---------- Bulk upload: match folders to candidates ----------

export type FolderInput = { folder: string; details: CandidateFolderDetails | null; detailsError?: string | null }

export type FolderPlan = {
  folder: string
  action: 'update' | 'create' | 'skip'
  matchedBy: 'candidate number' | 'email' | 'name' | null
  candidateId: string | null
  candidateNumber: string | null
  caseId: string | null
  name: string
  /** Field changes an update would make. */
  changes: Array<{ field: EditableField; label: string; from: string | null; to: string }>
  newNotes: number
  warnings: string[]
  errors: string[]
  /** Document items for mapping Uploaded_Documents/<name> folders (filled for update/create-after-apply). */
  documentItems: Array<{ key: string; label: string }>
  /** Files already on the record, used to skip re-uploads. */
  existingFiles: Array<{ name: string; size: number }>
  existingLinks: string[]
}

const VALID_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function fieldValue(candidate: Record<string, unknown>, field: EditableField): string | null {
  const v = candidate[field]
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return v == null ? null : String(v)
}

async function existingRecordInfo(caseId: string | null, visaType: VisaType | null) {
  if (!caseId || !visaType) return { documentItems: [], existingFiles: [], existingLinks: [] }
  const docs = await prisma.caseDocument.findMany({
    where: { caseId, status: { not: 'ARCHIVED' }, isCurrentVersion: true },
    select: { originalFilename: true, displayName: true, fileSizeBytes: true, externalUrl: true },
  })
  return {
    documentItems: await caseDocumentItems(caseId, visaType),
    existingFiles: docs
      .filter((d) => !d.externalUrl)
      .flatMap((d) => [d.originalFilename, d.displayName].filter(Boolean).map((name) => ({ name: name as string, size: d.fileSizeBytes }))),
    existingLinks: docs.filter((d) => d.externalUrl).map((d) => d.externalUrl as string),
  }
}

/**
 * Decide what each folder does, without writing anything.
 * Reliable matches only: candidate number, then email. A name-only match is used when
 * exactly one candidate has that name and the folder gives no conflicting email.
 */
export async function planFolders(inputs: FolderInput[]): Promise<FolderPlan[]> {
  const plans: FolderPlan[] = []
  const seen = new Map<string, string>()
  for (const input of inputs) {
    const d = input.details
    const plan: FolderPlan = {
      folder: input.folder,
      action: 'skip',
      matchedBy: null,
      candidateId: null,
      candidateNumber: null,
      caseId: null,
      name: d?.fullLegalName || input.folder,
      changes: [],
      newNotes: d?.newLawyerNotes?.length ?? 0,
      warnings: [],
      errors: [],
      documentItems: [],
      existingFiles: [],
      existingLinks: [],
    }
    if (input.detailsError) plan.errors.push(input.detailsError)
    if (d?.email && !VALID_EMAIL.test(d.email)) plan.errors.push(`Email "${d.email}" is not valid.`)

    let match: Awaited<ReturnType<typeof prisma.candidate.findFirst>> = null
    if (d?.candidateNumber) {
      match = await prisma.candidate.findUnique({ where: { candidateNumber: d.candidateNumber } })
      if (match) plan.matchedBy = 'candidate number'
      else plan.warnings.push(`Candidate number ${d.candidateNumber} was not found.`)
    }
    if (!match && d?.email) {
      const byEmail = await prisma.candidate.findMany({ where: { normalizedEmail: normalizeEmail(d.email), lifecycle: 'ACTIVE' }, take: 3 })
      if (byEmail.length === 1) {
        match = byEmail[0]
        plan.matchedBy = 'email'
      } else if (byEmail.length > 1) {
        const sameName = byEmail.filter((c) => c.normalizedName === normalizeName(d.fullLegalName || input.folder))
        if (sameName.length === 1) {
          match = sameName[0]
          plan.matchedBy = 'email'
        } else {
          plan.errors.push(`${byEmail.length} candidates share the email ${d.email}; add the candidateNumber to Candidate_Details.json.`)
        }
      }
    }
    if (!match && !plan.errors.length && !d?.email) {
      const folderName = input.folder.replace(/\s*\([^)]*\)\s*$/, '')
      const byName = await prisma.candidate.findMany({
        where: { normalizedName: normalizeName(d?.fullLegalName || folderName), lifecycle: 'ACTIVE' },
        take: 3,
      })
      if (byName.length === 1) {
        match = byName[0]
        plan.matchedBy = 'name'
        plan.warnings.push('Matched by name only. Add a Candidate_Details.json with the email or candidate number to be sure.')
      } else if (byName.length > 1) {
        plan.errors.push(`${byName.length} candidates are named "${folderName}". Add a Candidate_Details.json with the candidate number.`)
      }
    }

    if (match) {
      if (match.lifecycle !== 'ACTIVE') plan.warnings.push('This candidate is archived.')
      const other = seen.get(match.id)
      if (other) {
        plan.errors.push(`Same candidate as folder "${other}". Merge the two folders.`)
      } else {
        seen.set(match.id, input.folder)
      }
      const c = await loadCase(match.id)
      plan.action = plan.errors.length ? 'skip' : 'update'
      plan.candidateId = match.id
      plan.candidateNumber = match.candidateNumber
      plan.caseId = c?.id ?? null
      plan.name = match.fullLegalName
      if (!c) plan.warnings.push('No active case: documents cannot be filed for this candidate.')
      if (d) {
        for (const field of EDITABLE_FIELDS) {
          const next = d[field]
          if (next == null || next === '') continue
          const current = fieldValue(match as unknown as Record<string, unknown>, field)
          const same =
            field === 'email' ? normalizeEmail(next) === normalizeEmail(current ?? '') : next.trim() === (current ?? '').trim()
          if (!same) {
            if (field === 'dateOfBirth' && Number.isNaN(new Date(next).getTime())) {
              plan.warnings.push(`Date of birth "${next}" is not a date (use YYYY-MM-DD); it is not changed.`)
              continue
            }
            plan.changes.push({ field, label: FIELD_LABELS[field], from: current, to: next.trim() })
          }
        }
        if (d.visaType && c && d.visaType !== String(c.visaType)) {
          plan.warnings.push(`Visa type in the file (${d.visaType}) differs from the case (${String(c.visaType)}); the case is not changed.`)
        }
      }
      Object.assign(plan, await existingRecordInfo(plan.caseId, c?.visaType ?? null))
    } else if (!plan.errors.length) {
      // No match: create a new candidate, if the folder has enough to do it safely.
      const missing = [
        !d?.fullLegalName ? 'fullLegalName' : '',
        !d?.email ? 'email' : '',
        !d?.visaType ? 'visaType' : '',
      ].filter(Boolean)
      if (!d) {
        plan.errors.push('No matching candidate, and no Candidate_Details.json to create one from.')
      } else if (missing.length) {
        plan.errors.push(`No matching candidate. To create one, Candidate_Details.json needs: ${missing.join(', ')}.`)
      } else {
        plan.action = 'create'
        plan.name = d.fullLegalName!
        if (d.candidateNumber) plan.warnings.push('A new candidate number is assigned; the one in the file is not used.')
        if (d.visaType && parseVisaType(d.visaType) === 'OTHER' && d.visaType !== 'OTHER') {
          plan.warnings.push(`Unknown visa type "${d.visaType}"; the case is created as Other.`)
        }
      }
    }
    if (plan.errors.length) plan.action = 'skip'
    plans.push(plan)
  }
  return plans
}

/** Apply one planned folder: update the record or create it, and add new notes. Files are uploaded separately. */
export async function applyFolder(
  input: FolderInput,
  actor: { id: string; canWriteNotes: boolean },
): Promise<FolderPlan & { applied: string[] }> {
  const [plan] = await planFolders([input])
  const applied: string[] = []
  if (plan.action === 'skip') return { ...plan, applied }
  const d = input.details
  if (plan.action === 'create' && d) {
    const visaType = parseVisaType(d.visaType)
    const { candidate } = await findOrCreateCandidate({
      fullLegalName: d.fullLegalName!,
      email: d.email!,
      phone: d.phone,
      nationality: d.nationality,
      currentImmigrationStatus: d.currentImmigrationStatus,
      currentAddress: d.currentAddress,
      source: 'bulk_upload',
    })
    let c = await loadCase(candidate.id)
    if (!c) {
      c = await prisma.case.create({
        data: { candidateId: candidate.id, caseNumber: await nextCaseNumber(visaType), visaType, status: 'QUALIFIED' },
      })
      await logActivity({
        candidateId: candidate.id,
        caseId: c.id,
        type: ActivityType.CASE_CREATED,
        message: `${c.caseNumber} case created by bulk upload`,
        actorType: 'ADMIN',
        actorId: actor.id,
      })
    }
    if (d.dateOfBirth && !Number.isNaN(new Date(d.dateOfBirth).getTime())) {
      await prisma.candidate.update({ where: { id: candidate.id }, data: { dateOfBirth: new Date(d.dateOfBirth) } })
    }
    Object.assign(plan, {
      candidateId: candidate.id,
      candidateNumber: candidate.candidateNumber,
      caseId: c.id,
      ...(await existingRecordInfo(c.id, c.visaType)),
    })
    applied.push('Created candidate')
  } else if (plan.action === 'update' && plan.candidateId && plan.changes.length) {
    const data: Prisma.CandidateUpdateInput = {}
    for (const change of plan.changes) {
      if (change.field === 'dateOfBirth') data.dateOfBirth = new Date(change.to)
      else if (change.field === 'fullLegalName') {
        data.fullLegalName = change.to
        data.normalizedName = normalizeName(change.to)
      } else if (change.field === 'email') {
        data.email = change.to
        data.normalizedEmail = normalizeEmail(change.to)
      } else data[change.field] = change.to
    }
    try {
      await prisma.candidate.update({ where: { id: plan.candidateId }, data })
      applied.push(`Updated ${plan.changes.map((c) => c.label.toLowerCase()).join(', ')}`)
      if (plan.caseId) {
        await logActivity({
          candidateId: plan.candidateId,
          caseId: plan.caseId,
          type: ActivityType.NOTE_ADDED,
          message: `Details updated by bulk upload: ${plan.changes.map((c) => c.label).join(', ')}`,
          actorType: 'ADMIN',
          actorId: actor.id,
        })
      }
    } catch (err) {
      // e.g. the new name + email already belong to another candidate.
      plan.errors.push(`Details not updated: ${err instanceof Error && /Unique constraint/i.test(err.message) ? 'another candidate already has this name and email.' : 'the update failed.'}`)
    }
  }
  const notes = d?.newLawyerNotes ?? []
  if (notes.length && plan.candidateId && plan.caseId) {
    if (!actor.canWriteNotes) {
      plan.warnings.push('New notes were not added: your role cannot write notes.')
    } else {
      for (const note of notes) {
        await prisma.caseNote.create({
          data: { candidateId: plan.candidateId, caseId: plan.caseId, authorId: actor.id, note: note.slice(0, 10000) },
        })
      }
      applied.push(`Added ${notes.length} note${notes.length === 1 ? '' : 's'}`)
    }
  }
  return { ...plan, applied }
}
