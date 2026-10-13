import JSZip from 'jszip'
import ExcelJS from 'exceljs'
import { prisma } from '@/lib/db'
import { getPrivateObject } from '@/lib/storage'
import { formatVisa, CASE_STATUS_LABELS } from '@/lib/visa'
import { formatCents } from '@/lib/payments'
import {
  BACKUP_APPLICATION,
  BACKUP_VERSION,
  SCHEMA_VERSION,
  categoryFolderForDoc,
  safeZipSegment,
  sha256,
} from '@/lib/system-backup/common'
import { candidateSlug } from '@/lib/download-names'

export type BackupBuildResult = {
  buffer: Buffer
  filename: string
  manifest: Record<string, unknown>
  filesIncluded: number
  filesMissing: number
  missingFiles: Array<{ documentId: string; storageKey: string; reason: string }>
  candidateCount: number
  caseCount: number
  documentCount: number
  paymentCount: number
}

function stamp(): string {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}_${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
}

async function loadGraph() {
  const candidates = await prisma.candidate.findMany({
    orderBy: { candidateNumber: 'asc' },
    include: {
      assessments: true,
      evidenceEntries: { include: { documents: true } },
      documents: true,
      notes: true,
      activities: { take: 2000, orderBy: { createdAt: 'desc' } },
      communications: { take: 2000, orderBy: { sentAt: 'desc' } },
      documentRequests: { include: { items: true } },
      customDocumentDefs: true,
      payments: { include: { events: true } },
      paymentReceipts: true,
      financialEngagements: true,
      paymentSchedules: { include: { items: true } },
      onboardingSubmissions: true,
      cases: {
        include: {
          evidenceEntries: { include: { documents: true } },
          documents: true,
          notes: true,
          activities: true,
          communications: true,
          documentRequests: { include: { items: true } },
          customDocumentDefs: true,
          payments: { include: { events: true } },
          paymentReceipts: true,
          financialEngagement: true,
          paymentSchedules: { include: { items: true } },
          lawyerAssignments: true,
          statusHistory: true,
          onboardingSubmissions: true,
          assignedAttorney: { select: { id: true, email: true, fullName: true, role: true } },
          assignedCaseManager: { select: { id: true, email: true, fullName: true, role: true } },
          referredByAdmin: { select: { id: true, email: true, fullName: true, role: true } },
        },
      },
    },
  })

  const team = await prisma.adminUser.findMany({
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      status: true,
      createdAt: true,
      lastLoginAt: true,
    },
  })

  return { candidates, team }
}

function serialize(value: unknown): unknown {
  return JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)),
  )
}

export async function buildFullSystemBackup(options?: {
  includeFiles?: boolean
  kindLabel?: string
}): Promise<BackupBuildResult> {
  const includeFiles = options?.includeFiles !== false
  const { candidates, team } = await loadGraph()
  const zip = new JSZip()
  const root = `Afterstem_Full_Backup_${stamp()}`
  const folder = zip.folder(root)!

  const cases = candidates.flatMap((c) => c.cases)
  const evidenceEntries = [
    ...candidates.flatMap((c) => c.evidenceEntries),
    ...cases.flatMap((c) => c.evidenceEntries),
  ]
  // Dedupe evidence by id
  const evidenceById = new Map(evidenceEntries.map((e) => [e.id, e]))
  const allEvidence = [...evidenceById.values()]

  const docById = new Map<string, (typeof candidates)[0]['documents'][0] & { evidenceSection?: string | null; evidenceTitle?: string | null }>()
  for (const c of candidates) {
    for (const d of c.documents) docById.set(d.id, d)
    for (const e of c.evidenceEntries) {
      for (const d of e.documents) {
        docById.set(d.id, { ...d, evidenceSection: e.section, evidenceTitle: e.title })
      }
    }
  }
  for (const cs of cases) {
    for (const d of cs.documents) {
      if (!docById.has(d.id)) docById.set(d.id, d)
    }
    for (const e of cs.evidenceEntries) {
      for (const d of e.documents) {
        docById.set(d.id, { ...d, evidenceSection: e.section, evidenceTitle: e.title })
      }
    }
  }

  const payments = [
    ...candidates.flatMap((c) => c.payments),
    ...cases.flatMap((c) => c.payments),
  ]
  const paymentById = new Map(payments.map((p) => [p.id, p]))
  const receipts = [
    ...candidates.flatMap((c) => c.paymentReceipts),
    ...cases.flatMap((c) => c.paymentReceipts),
  ]
  const receiptById = new Map(receipts.map((r) => [r.id, r]))

  const documentMeta: Array<Record<string, unknown>> = []
  const missingFiles: BackupBuildResult['missingFiles'] = []
  let filesIncluded = 0

  const usedPaths = new Set<string>()

  for (const c of candidates) {
    const slug = candidateSlug(c.candidateNumber, c.fullLegalName)
    const profile = {
      id: c.id,
      candidateNumber: c.candidateNumber,
      fullLegalName: c.fullLegalName,
      email: c.email,
      phone: c.phone,
      currentAddress: c.currentAddress,
      nationality: c.nationality,
      currentImmigrationStatus: c.currentImmigrationStatus,
      source: c.source,
      lifecycle: c.lifecycle,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }
    folder.file(`candidates/${slug}/profile/Candidate_Profile.json`, JSON.stringify(serialize(profile), null, 2))

    for (const e of c.evidenceEntries.length ? c.evidenceEntries : c.cases.flatMap((cs) => cs.evidenceEntries)) {
      const sectionFolder = categoryFolderForDoc('evidence', '', e.section)
      const entryFolder = `candidates/${slug}/${sectionFolder}/${safeZipSegment(e.title)}`
      folder.file(
        `${entryFolder}/entry.json`,
        JSON.stringify(
          serialize({
            id: e.id,
            section: e.section,
            title: e.title,
            subtitle: e.subtitle,
            description: e.description,
            metadata: e.metadata,
            caseId: e.caseId,
            candidateId: e.candidateId,
          }),
          null,
          2,
        ),
      )
    }
  }

  if (includeFiles) {
    for (const doc of docById.values()) {
      const candidate = candidates.find((c) => c.id === doc.candidateId)
      if (!candidate) continue
      const slug = candidateSlug(candidate.candidateNumber, candidate.fullLegalName)
      const section = categoryFolderForDoc(doc.category, doc.questionKey, (doc as any).evidenceSection)
      const parent = (doc as any).evidenceTitle ? safeZipSegment((doc as any).evidenceTitle) : null
      const baseDir = parent
        ? `candidates/${slug}/${section}/${parent}`
        : `candidates/${slug}/${section}`
      let filename = safeZipSegment(doc.displayName || doc.originalFilename, 'file')
      let backupPath = `${baseDir}/${filename}`
      let i = 2
      while (usedPaths.has(backupPath.toLowerCase())) {
        const dot = filename.lastIndexOf('.')
        const stem = dot > 0 ? filename.slice(0, dot) : filename
        const ext = dot > 0 ? filename.slice(dot) : ''
        filename = `${stem}_${i}${ext}`
        backupPath = `${baseDir}/${filename}`
        i += 1
      }
      usedPaths.add(backupPath.toLowerCase())

      let checksum = ''
      let included = false
      try {
        const { body } = await getPrivateObject(doc.storageKey, doc.storageProvider)
        checksum = sha256(body)
        folder.file(backupPath, body)
        filesIncluded += 1
        included = true
      } catch (err) {
        missingFiles.push({
          documentId: doc.id,
          storageKey: doc.storageKey,
          reason: err instanceof Error ? err.message : 'Unable to read object',
        })
      }

      documentMeta.push({
        documentId: doc.id,
        candidateUuid: doc.candidateId,
        candidateId: candidate.candidateNumber,
        caseId: doc.caseId,
        evidenceEntryId: doc.evidenceEntryId,
        category: doc.category,
        documentType: doc.documentType,
        questionKey: doc.questionKey,
        originalFileName: doc.originalFilename,
        displayName: doc.displayName,
        backupPath,
        mimeType: doc.mimeType,
        fileSize: doc.fileSizeBytes,
        checksum,
        status: doc.status,
        version: doc.version,
        isCurrentVersion: doc.isCurrentVersion,
        uploadedAt: doc.uploadedAt,
        uploadedByType: doc.uploadedByType,
        included,
      })
    }

    // Payment receipt attachments
    for (const r of receiptById.values()) {
      if (!r.attachmentStorageKey) continue
      const candidate = candidates.find((c) => c.id === r.candidateId)
      if (!candidate) continue
      const slug = candidateSlug(candidate.candidateNumber, candidate.fullLegalName)
      const filename = safeZipSegment(r.attachmentFilename || 'receipt', 'receipt')
      const backupPath = `candidates/${slug}/payments/${filename}`
      try {
        const { body } = await getPrivateObject(r.attachmentStorageKey)
        const checksum = sha256(body)
        folder.file(backupPath, body)
        filesIncluded += 1
        documentMeta.push({
          documentId: `receipt-att:${r.id}`,
          receiptId: r.id,
          candidateUuid: r.candidateId,
          candidateId: candidate.candidateNumber,
          category: 'payments',
          originalFileName: r.attachmentFilename,
          backupPath,
          mimeType: r.attachmentMimeType,
          fileSize: r.attachmentSizeBytes,
          checksum,
          included: true,
          kind: 'payment_receipt_attachment',
        })
      } catch (err) {
        missingFiles.push({
          documentId: `receipt-att:${r.id}`,
          storageKey: r.attachmentStorageKey,
          reason: err instanceof Error ? err.message : 'Unable to read receipt attachment',
        })
      }
    }
  } else {
    for (const doc of docById.values()) {
      const candidate = candidates.find((c) => c.id === doc.candidateId)
      documentMeta.push({
        documentId: doc.id,
        candidateId: candidate?.candidateNumber,
        candidateUuid: doc.candidateId,
        storageKey: doc.storageKey,
        originalFileName: doc.originalFilename,
        included: false,
      })
    }
  }

  const graph = serialize({
    exportedAt: new Date().toISOString(),
    team,
    candidates: candidates.map((c) => {
      const { cases, documents, evidenceEntries, ...rest } = c
      return {
        ...rest,
        caseIds: cases.map((x) => x.id),
      }
    }),
    cases: cases.map((cs) => {
      const {
        documents,
        evidenceEntries,
        notes,
        activities,
        communications,
        documentRequests,
        payments,
        paymentReceipts,
        financialEngagement,
        paymentSchedules,
        ...rest
      } = cs as any
      return rest
    }),
    evidenceEntries: allEvidence.map((e) => {
      const { documents, ...rest } = e
      return rest
    }),
    notes: [
      ...candidates.flatMap((c) => c.notes),
      ...cases.flatMap((c) => c.notes),
    ],
    activities: [
      ...candidates.flatMap((c) => c.activities),
      ...cases.flatMap((c) => c.activities),
    ],
    communications: [
      ...candidates.flatMap((c) => c.communications),
      ...cases.flatMap((c) => c.communications),
    ],
    payments: [...paymentById.values()],
    paymentReceipts: [...receiptById.values()].map((r) => ({
      ...r,
      // Strip live storage keys from restored payload — restore uses backupPath
      attachmentStorageKey: null,
    })),
    financialEngagements: [
      ...candidates.flatMap((c) => c.financialEngagements),
      ...cases.map((c) => c.financialEngagement).filter(Boolean),
    ],
    paymentSchedules: [
      ...candidates.flatMap((c) => c.paymentSchedules),
      ...cases.flatMap((c) => c.paymentSchedules),
    ],
    documentRequests: [
      ...candidates.flatMap((c) => c.documentRequests),
      ...cases.flatMap((c) => c.documentRequests),
    ],
    customDocumentDefs: [
      ...candidates.flatMap((c) => c.customDocumentDefs),
      ...cases.flatMap((c) => c.customDocumentDefs),
    ],
    onboardingSubmissions: [
      ...candidates.flatMap((c) => c.onboardingSubmissions),
      ...cases.flatMap((c) => c.onboardingSubmissions),
    ],
    lawyerAssignments: cases.flatMap((c) => c.lawyerAssignments),
    statusHistory: cases.flatMap((c) => c.statusHistory),
    assessments: candidates.flatMap((c) => c.assessments),
    documents: documentMeta,
  })

  const data = folder.folder('data')!
  data.file('graph.json', JSON.stringify(graph, null, 2))
  data.file('candidates.json', JSON.stringify((graph as any).candidates, null, 2))
  data.file('cases.json', JSON.stringify((graph as any).cases, null, 2))
  data.file(
    'education.json',
    JSON.stringify((graph as any).evidenceEntries.filter((e: any) => e.section === 'EDUCATION'), null, 2),
  )
  data.file(
    'employment.json',
    JSON.stringify((graph as any).evidenceEntries.filter((e: any) => e.section === 'EMPLOYMENT'), null, 2),
  )
  data.file(
    'transcripts.json',
    JSON.stringify((graph as any).evidenceEntries.filter((e: any) => e.section === 'TRANSCRIPT'), null, 2),
  )
  data.file(
    'certifications.json',
    JSON.stringify((graph as any).evidenceEntries.filter((e: any) => e.section === 'LICENSE'), null, 2),
  )
  data.file(
    'clients.json',
    JSON.stringify((graph as any).evidenceEntries.filter((e: any) => e.section === 'CLIENT'), null, 2),
  )
  data.file('documents.json', JSON.stringify(documentMeta, null, 2))
  data.file('payments.json', JSON.stringify((graph as any).payments, null, 2))
  data.file('notes.json', JSON.stringify((graph as any).notes, null, 2))
  data.file('communications.json', JSON.stringify((graph as any).communications, null, 2))
  data.file('onboarding.json', JSON.stringify((graph as any).onboardingSubmissions, null, 2))
  data.file('document-requests.json', JSON.stringify((graph as any).documentRequests, null, 2))
  data.file('assignments.json', JSON.stringify((graph as any).lawyerAssignments, null, 2))
  data.file('statuses.json', JSON.stringify((graph as any).statusHistory, null, 2))
  data.file('team-directory.json', JSON.stringify(team, null, 2))

  // Human exports
  const wb = new ExcelJS.Workbook()
  const sheet = wb.addWorksheet('Candidates')
  sheet.addRow([
    'Candidate ID',
    'Name',
    'Email',
    'Phone',
    'Visa Type',
    'Case Status',
    'Location',
    'Documents Count',
    'Quoted Amount',
    'Paid',
  ])
  for (const c of candidates) {
    const cs = c.cases[0]
    const quoted = cs?.financialEngagement?.quotedAmountCents ?? cs?.quotedAmountCents ?? 0
    const paid = (cs?.paymentReceipts ?? c.paymentReceipts ?? []).reduce((s, r) => s + r.amountCents, 0)
    sheet.addRow([
      c.candidateNumber,
      c.fullLegalName,
      c.email,
      c.phone ?? '',
      cs ? formatVisa(cs.visaType) : '',
      cs ? CASE_STATUS_LABELS[cs.status] ?? cs.status : '',
      c.currentAddress ?? '',
      c.documents.length,
      formatCents(quoted),
      formatCents(paid),
    ])
  }
  const xlsxBuf = Buffer.from(await wb.xlsx.writeBuffer())
  folder.file('exports/Candidates.xlsx', xlsxBuf)

  const csvLines = [
    'Candidate ID,Name,Email,Phone,Visa Type,Case Status,Location',
    ...candidates.map((c) => {
      const cs = c.cases[0]
      const cells = [
        c.candidateNumber,
        c.fullLegalName,
        c.email,
        c.phone ?? '',
        cs ? formatVisa(cs.visaType) : '',
        cs ? cs.status : '',
        c.currentAddress ?? '',
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`)
      return cells.join(',')
    }),
  ]
  folder.file('exports/Candidates.csv', csvLines.join('\n'))

  const manifest = {
    application: BACKUP_APPLICATION,
    backupVersion: BACKUP_VERSION,
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date().toISOString(),
    incomplete: missingFiles.length > 0,
    candidateCount: candidates.length,
    caseCount: cases.length,
    documentCount: docById.size,
    paymentCount: paymentById.size,
    evidenceCount: allEvidence.length,
    filesIncluded,
    filesMissing: missingFiles.length,
    includeFiles,
    checksumAlgorithm: 'sha256',
  }

  folder.file('manifest.json', JSON.stringify(manifest, null, 2))
  folder.file(
    'backup-info.json',
    JSON.stringify(
      {
        ...manifest,
        brand: BACKUP_APPLICATION,
        note: 'Machine-restorable Afterstem backup. Excel/CSV are for human review only.',
        missingFiles,
      },
      null,
      2,
    ),
  )
  if (missingFiles.length) {
    folder.file('exports/Missing_Files_Report.json', JSON.stringify(missingFiles, null, 2))
  }

  const buffer = Buffer.from(await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
  return {
    buffer,
    filename: `${root}.zip`,
    manifest,
    filesIncluded,
    filesMissing: missingFiles.length,
    missingFiles,
    candidateCount: candidates.length,
    caseCount: cases.length,
    documentCount: docById.size,
    paymentCount: paymentById.size,
  }
}
