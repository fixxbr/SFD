import JSZip from 'jszip'
import ExcelJS from 'exceljs'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { prisma } from '@/lib/db'
import { getPrivateObject } from '@/lib/storage'
import { formatVisa, CASE_STATUS_LABELS } from '@/lib/visa'
import { formatCents } from '@/lib/payments'
import { candidateSlug, downloadFilename, safePathSegment, uniqueName } from '@/lib/download-names'
import { sectionMeta } from '@/lib/evidence-section-meta'
import type { EvidenceSection } from '@prisma/client'

export type ExportScope = {
  includeFinance: boolean
  includeNotes: boolean
  includeCommunications: boolean
}

const SECTION_FOLDER: Record<EvidenceSection, string> = {
  EDUCATION: 'Education',
  TRANSCRIPT: 'Transcripts',
  EMPLOYMENT: 'Employment',
  LICENSE: 'Licenses_Certifications',
  CLIENT: 'Clients',
}

function categoryFolder(category: string, questionKey: string): string {
  const c = category.toLowerCase()
  const k = questionKey.toLowerCase()
  if (c.includes('education') || k.includes('education') || k.includes('transcript') || k.includes('degree')) {
    return 'Education'
  }
  if (c.includes('employ') || k.includes('employ') || k.includes('offer') || k.includes('w2') || k.includes('pay')) {
    return 'Employment'
  }
  if (c.includes('credential') || c.includes('license') || k.includes('license') || k.includes('cert')) {
    return 'Licenses_Certifications'
  }
  if (c.includes('client')) return 'Clients'
  if (
    c.includes('immigration') ||
    k.includes('passport') ||
    k.includes('i94') ||
    k.includes('i-94') ||
    k.includes('i797') ||
    k.includes('i-797') ||
    k.includes('ead') ||
    k.includes('i20') ||
    k.includes('i-20')
  ) {
    return 'Immigration'
  }
  if (c.includes('basic') || k.includes('resume') || k.includes('cv')) return 'Basic'
  return 'Other'
}

export async function loadCandidateExportBundle(candidateId: string, scope: ExportScope) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: candidateId },
    include: {
      cases: {
        where: { lifecycle: 'ACTIVE' },
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          documents: {
            where: { status: { not: 'ARCHIVED' }, isCurrentVersion: true },
            orderBy: { uploadedAt: 'desc' },
          },
          evidenceEntries: {
            orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
            include: {
              documents: {
                where: { status: { not: 'ARCHIVED' } },
                orderBy: { uploadedAt: 'desc' },
              },
            },
          },
          payments: scope.includeFinance,
          financialEngagement: scope.includeFinance,
          paymentReceipts: scope.includeFinance
            ? { where: { status: 'ACTIVE' }, orderBy: { receivedDate: 'desc' } }
            : false,
          notes: scope.includeNotes
            ? {
                where: { archivedAt: null },
                orderBy: { createdAt: 'desc' },
                include: { author: { select: { fullName: true } } },
              }
            : false,
          communications: scope.includeCommunications
            ? { orderBy: { sentAt: 'desc' }, take: 100, include: { sentBy: { select: { fullName: true } } } }
            : false,
          documentRequests: {
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              requestNumber: true,
              status: true,
              requestType: true,
              createdAt: true,
              completedAt: true,
            },
          },
          onboardingSubmissions: { orderBy: { updatedAt: 'desc' }, take: 1 },
        },
      },
    },
  })
  if (!candidate) throw new Error('Candidate not found')
  return candidate
}

export type ZipDocFilter =
  | { kind: 'all' }
  | { kind: 'section'; section: EvidenceSection }
  | { kind: 'category'; category: string }

export async function buildDocumentsZip(
  candidateId: string,
  filter: ZipDocFilter = { kind: 'all' },
): Promise<{ buffer: Buffer; filename: string }> {
  const candidate = await loadCandidateExportBundle(candidateId, {
    includeFinance: false,
    includeNotes: false,
    includeCommunications: false,
  })
  const currentCase = candidate.cases[0]
  const slug = candidateSlug(candidate.candidateNumber, candidate.fullLegalName)
  const zip = new JSZip()
  const usedPaths = new Set<string>()

  async function addFile(
    folderPath: string,
    displayName: string,
    storageKey: string,
    storageProvider?: string | null,
  ) {
    try {
      const { body } = await getPrivateObject(storageKey, storageProvider)
      const folderUsed = new Set(
        [...usedPaths].filter((p) => p.startsWith(folderPath + '/')).map((p) => p.slice(folderPath.length + 1)),
      )
      const name = uniqueName(folderUsed, displayName)
      const full = `${folderPath}/${name}`
      usedPaths.add(full.toLowerCase())
      zip.file(full, body)
    } catch {
      // Skip missing storage objects rather than failing the whole package.
    }
  }

  if (currentCase) {
    for (const entry of currentCase.evidenceEntries) {
      if (filter.kind === 'section' && entry.section !== filter.section) continue
      if (filter.kind === 'category') continue
      const sectionFolder = SECTION_FOLDER[entry.section]
      const entryFolder = `${sectionFolder}/${safePathSegment(entry.title)}`
      for (const doc of entry.documents) {
        await addFile(entryFolder, doc.displayName || doc.originalFilename, doc.storageKey, doc.storageProvider)
      }
    }

    if (filter.kind !== 'section') {
      for (const doc of currentCase.documents) {
        if (doc.evidenceEntryId) continue
        const folder = categoryFolder(doc.category, doc.questionKey)
        if (filter.kind === 'category' && folder.toLowerCase() !== filter.category.toLowerCase()) continue
        await addFile(folder, doc.displayName || doc.originalFilename, doc.storageKey, doc.storageProvider)
      }
    }
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  const label =
    filter.kind === 'section'
      ? SECTION_FOLDER[filter.section]
      : filter.kind === 'category'
        ? filter.category
        : 'Documents'
  return {
    buffer,
    filename: downloadFilename([slug, label], 'zip'),
  }
}

export function buildCandidateDataRows(candidate: Awaited<ReturnType<typeof loadCandidateExportBundle>>, scope: ExportScope) {
  const c = candidate.cases[0]
  const quoted = scope.includeFinance
    ? (c?.financialEngagement?.quotedAmountCents ?? c?.quotedAmountCents ?? 0)
    : null
  const paid = scope.includeFinance
    ? (c?.paymentReceipts ?? []).reduce((s: number, r: { amountCents: number }) => s + r.amountCents, 0)
    : null
  const docs = c?.documents?.length ?? 0
  const evidenceDocs = (c?.evidenceEntries ?? []).reduce((s, e) => s + e.documents.length, 0)

  return {
    candidateId: candidate.candidateNumber,
    name: candidate.fullLegalName,
    email: candidate.email,
    phone: candidate.phone ?? '',
    visaType: c ? formatVisa(c.visaType) : '',
    caseStatus: c ? CASE_STATUS_LABELS[c.status] ?? c.status : '',
    location: candidate.currentAddress ?? '',
    job: '',
    employer:
      (c?.evidenceEntries ?? [])
        .filter((e) => e.section === 'EMPLOYMENT')
        .map((e) => e.title)
        .join('; ') || '',
    nationality: candidate.nationality ?? '',
    immigrationStatus: candidate.currentImmigrationStatus ?? '',
    experience: '',
    appliedDate: c?.openedAt ? c.openedAt.toISOString().slice(0, 10) : '',
    documentsCount: docs + evidenceDocs,
    quoted: quoted != null ? formatCents(quoted) : '',
    paid: paid != null ? formatCents(paid) : '',
    outstanding: quoted != null && paid != null ? formatCents(Math.max(0, quoted - paid)) : '',
    education: (c?.evidenceEntries ?? [])
      .filter((e) => e.section === 'EDUCATION')
      .map((e) => [e.title, e.subtitle, e.description].filter(Boolean).join(' — '))
      .join('; '),
    employment: (c?.evidenceEntries ?? [])
      .filter((e) => e.section === 'EMPLOYMENT')
      .map((e) => [e.title, e.subtitle, e.description].filter(Boolean).join(' — '))
      .join('; '),
    clients: (c?.evidenceEntries ?? [])
      .filter((e) => e.section === 'CLIENT')
      .map((e) => [e.title, e.subtitle, e.description].filter(Boolean).join(' — '))
      .join('; '),
    licenses: (c?.evidenceEntries ?? [])
      .filter((e) => e.section === 'LICENSE')
      .map((e) => [e.title, e.subtitle].filter(Boolean).join(' — '))
      .join('; '),
    docRequestStatus: (c?.documentRequests ?? []).map((r) => `${r.requestNumber}:${r.status}`).join('; '),
  }
}

export async function buildCandidateCsv(candidateId: string, scope: ExportScope) {
  const candidate = await loadCandidateExportBundle(candidateId, scope)
  const row = buildCandidateDataRows(candidate, scope)
  const headers = Object.keys(row)
  const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`
  const csv = [headers.join(','), headers.map((h) => escape(String((row as any)[h] ?? ''))).join(',')].join('\n')
  const slug = candidateSlug(candidate.candidateNumber, candidate.fullLegalName)
  return {
    buffer: Buffer.from(csv, 'utf8'),
    filename: downloadFilename([slug, 'Candidate_Data'], 'csv'),
    contentType: 'text/csv; charset=utf-8',
  }
}

export async function buildCandidateExcel(candidateId: string, scope: ExportScope) {
  const candidate = await loadCandidateExportBundle(candidateId, scope)
  const row = buildCandidateDataRows(candidate, scope)
  const c = candidate.cases[0]
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Afterstem'
  const profile = wb.addWorksheet('Profile')
  profile.addRow(['Field', 'Value'])
  for (const [k, v] of Object.entries(row)) profile.addRow([k, v])

  const entries = wb.addWorksheet('Evidence')
  entries.addRow(['Section', 'Title', 'Subtitle', 'Description', 'Documents'])
  for (const e of c?.evidenceEntries ?? []) {
    entries.addRow([
      sectionMeta(e.section).label,
      e.title,
      e.subtitle ?? '',
      e.description ?? '',
      e.documents.map((d) => d.displayName || d.originalFilename).join('; '),
    ])
  }

  const docs = wb.addWorksheet('Documents')
  docs.addRow(['Category', 'Type', 'Filename', 'Status', 'Uploaded'])
  for (const d of c?.documents ?? []) {
    docs.addRow([d.category, d.documentType, d.displayName || d.originalFilename, d.status, d.uploadedAt.toISOString()])
  }

  if (scope.includeNotes && c?.notes) {
    const notes = wb.addWorksheet('Notes')
    notes.addRow(['Author', 'Note', 'Pinned', 'Created'])
    for (const n of c.notes as any[]) {
      notes.addRow([n.author?.fullName ?? '', n.note, n.isPinned ? 'Yes' : 'No', n.createdAt?.toISOString?.() ?? ''])
    }
  }

  if (scope.includeFinance && c?.paymentReceipts) {
    const pay = wb.addWorksheet('Payments')
    pay.addRow(['Date', 'Amount', 'Method', 'Reference'])
    for (const r of c.paymentReceipts as any[]) {
      pay.addRow([
        r.receivedDate?.toISOString?.()?.slice(0, 10) ?? '',
        formatCents(r.amountCents),
        r.paymentMethod ?? '',
        r.referenceNumber ?? '',
      ])
    }
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer())
  const slug = candidateSlug(candidate.candidateNumber, candidate.fullLegalName)
  return {
    buffer,
    filename: downloadFilename([slug, 'Candidate_Data'], 'xlsx'),
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }
}

export async function buildCandidatePdf(candidateId: string, scope: ExportScope) {
  const candidate = await loadCandidateExportBundle(candidateId, scope)
  const row = buildCandidateDataRows(candidate, scope)
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage([612, 792])
  let y = 750
  const left = 48

  const write = (text: string, size = 11, isBold = false) => {
    if (y < 48) {
      page = pdf.addPage([612, 792])
      y = 750
    }
    page.drawText(text.slice(0, 110), {
      x: left,
      y,
      size,
      font: isBold ? bold : font,
      color: rgb(0.05, 0.14, 0.25),
    })
    y -= size + 6
  }

  write('Afterstem Candidate Profile', 16, true)
  write(`${row.candidateId} · ${row.name}`, 12, true)
  y -= 8
  for (const [label, value] of [
    ['Email', row.email],
    ['Phone', row.phone],
    ['Visa', row.visaType],
    ['Status', row.caseStatus],
    ['Location', row.location],
    ['Job', row.job],
    ['Employer', row.employer],
    ['Education', row.education],
    ['Employment', row.employment],
    ['Clients', row.clients],
    ['Licenses', row.licenses],
    ['Documents', String(row.documentsCount)],
    ...(scope.includeFinance
      ? [
          ['Quoted', row.quoted],
          ['Paid', row.paid],
          ['Outstanding', row.outstanding],
        ]
      : []),
  ] as Array<[string, string]>) {
    if (!value) continue
    write(`${label}: ${value}`, 10)
  }

  const bytes = await pdf.save()
  const slug = candidateSlug(candidate.candidateNumber, candidate.fullLegalName)
  return {
    buffer: Buffer.from(bytes),
    filename: downloadFilename([slug, 'Candidate_Profile'], 'pdf'),
    contentType: 'application/pdf',
  }
}

export async function buildCompletePackage(candidateId: string, scope: ExportScope) {
  const candidate = await loadCandidateExportBundle(candidateId, scope)
  const slug = candidateSlug(candidate.candidateNumber, candidate.fullLegalName)
  const zip = new JSZip()
  const root = zip.folder(slug)!

  const pdf = await buildCandidatePdf(candidateId, scope)
  root.file('Candidate_Profile.pdf', pdf.buffer)
  const xlsx = await buildCandidateExcel(candidateId, scope)
  root.file('Candidate_Data.xlsx', xlsx.buffer)

  const docsZip = await buildDocumentsZip(candidateId, { kind: 'all' })
  const docsInner = await JSZip.loadAsync(docsZip.buffer)
  const docsFolder = root.folder('Documents')!
  for (const [path, entry] of Object.entries(docsInner.files)) {
    if (entry.dir) continue
    docsFolder.file(path, await entry.async('nodebuffer'))
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  return {
    buffer,
    filename: downloadFilename([slug, 'Complete_Package'], 'zip'),
    contentType: 'application/zip',
  }
}

export async function buildBulkExport(
  candidateIds: string[],
  scope: ExportScope,
  options: { includeDocuments: boolean; includeData: boolean },
) {
  const date = new Date().toISOString().slice(0, 10)
  const zip = new JSZip()
  const rootName = `Candidate_Bulk_Export_${date}`
  const root = zip.folder(rootName)!

  if (options.includeData) {
    const wb = new ExcelJS.Workbook()
    const sheet = wb.addWorksheet('Candidates')
    const headers = [
      'Candidate ID',
      'Name',
      'Email',
      'Phone',
      'Visa Type',
      'Case Status',
      'Job',
      'Location',
      'Experience',
      'Applied Date',
      'Documents Count',
      'Total Amount Quoted',
      'Total Paid',
      'Outstanding Amount',
    ]
    sheet.addRow(headers)
    for (const id of candidateIds) {
      const candidate = await loadCandidateExportBundle(id, scope)
      const row = buildCandidateDataRows(candidate, scope)
      sheet.addRow([
        row.candidateId,
        row.name,
        row.email,
        row.phone,
        row.visaType,
        row.caseStatus,
        row.job,
        row.location,
        row.experience,
        row.appliedDate,
        row.documentsCount,
        row.quoted,
        row.paid,
        row.outstanding,
      ])
    }
    root.file('Candidates.xlsx', Buffer.from(await wb.xlsx.writeBuffer()))
  }

  if (options.includeDocuments) {
    const docsRoot = root.folder('Candidate_Documents')!
    for (const id of candidateIds) {
      const candidate = await loadCandidateExportBundle(id, {
        includeFinance: false,
        includeNotes: false,
        includeCommunications: false,
      })
      const folderName = candidateSlug(candidate.candidateNumber, candidate.fullLegalName)
      const docsZip = await buildDocumentsZip(id, { kind: 'all' })
      const inner = await JSZip.loadAsync(docsZip.buffer)
      const dest = docsRoot.folder(folderName)!
      for (const [path, entry] of Object.entries(inner.files)) {
        if (entry.dir) continue
        dest.file(path, await entry.async('nodebuffer'))
      }
    }
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  return {
    buffer,
    filename: `${rootName}.zip`,
    contentType: 'application/zip',
  }
}
