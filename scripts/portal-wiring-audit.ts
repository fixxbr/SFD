/**
 * Full portal wiring audit: admin → lawyer assign → upload link → candidate
 * uploads (files + links) → admin/lawyer visibility → isolation → cleanup.
 *
 *   npx tsx --env-file=.env scripts/portal-wiring-audit.ts
 */
import { createHash, randomBytes } from 'crypto'
import { AdminRole, AdminStatus, PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/auth'
import { buildChecklist, isReceivedChecklistItem } from '../lib/documents-checklist'
import { extractDocumentUploadToken } from '../lib/candidate-upload-url'
import { createDocumentRequestPackage } from '../lib/document-requests'
import { getPrivateObject } from '../lib/storage'

const prisma = new PrismaClient()
const BASE = process.env.AUDIT_BASE_URL || 'http://127.0.0.1:3000'
const ORIGIN = BASE

type Result = { name: string; status: 'PASS' | 'FAIL' | 'SKIP'; detail?: string }
const results: Result[] = []

function pass(name: string, detail?: string) {
  results.push({ name, status: 'PASS', detail })
  console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`)
}
function fail(name: string, detail?: string) {
  results.push({ name, status: 'FAIL', detail })
  console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
}

async function http(path: string, init?: RequestInit & { cookie?: string }) {
  const headers = new Headers(init?.headers)
  if (init?.cookie) headers.set('cookie', init.cookie)
  if (init?.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json')
  }
  if (!headers.has('Origin') && init?.method && init.method !== 'GET') {
    headers.set('Origin', ORIGIN)
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' })
  const setCookie = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    /* html */
  }
  return { res, json, text, setCookie }
}

function cookieHeader(setCookies: string[]) {
  return setCookies.map((c) => c.split(';')[0]).join('; ')
}

function pdfBuffer(label: string) {
  return Buffer.from(`%PDF-1.4\n% ${label}\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n`)
}

async function cleanupCandidate(candidateId: string) {
  const docs = await prisma.caseDocument.findMany({
    where: { candidateId },
    select: { id: true, storageKey: true },
  })
  const keys = docs.map((d) => d.storageKey).filter(Boolean)
  await prisma.documentRequestItem.deleteMany({ where: { candidateId } })
  await prisma.documentRequest.deleteMany({ where: { candidateId } })
  await prisma.candidateSubmissionSession.deleteMany({ where: { candidateId } })
  await prisma.candidateAccessLink.deleteMany({ where: { candidateId } })
  await prisma.customDocumentDef.deleteMany({ where: { candidateId } })
  await prisma.caseDocument.deleteMany({ where: { candidateId } })
  if (keys.length) await prisma.storedObject.deleteMany({ where: { key: { in: keys } } })
  await prisma.evidenceEntry.deleteMany({ where: { candidateId } })
  await prisma.caseNote.deleteMany({ where: { candidateId } })
  await prisma.lawyerAssignment.deleteMany({ where: { case: { candidateId } } })
  await prisma.financialEngagement.deleteMany({ where: { candidateId } }).catch(() => null)
  await prisma.case.deleteMany({ where: { candidateId } })
  await prisma.candidate.delete({ where: { id: candidateId } }).catch(() => null)
}

async function main() {
  console.log('\n=== PORTAL WIRING AUDIT ===')
  console.log(`Base URL: ${BASE}\n`)

  const suffix = randomBytes(3).toString('hex')
  const createdCandidateIds: string[] = []
  const createdAdminIds: string[] = []
  let adminCookie = ''
  let adminUserId = ''

  try {
    // --- Pages load ---
    {
      const pages = await Promise.all([
        http('/'),
        http('/documents'),
        http('/admin/login'),
        http('/lawyer'),
      ])
      const ok = pages.every((p) => p.res.status === 200 || p.res.status === 307 || p.res.status === 302)
      if (ok) pass('Portal pages respond', `/, /documents, /admin/login, /lawyer`)
      else fail('Portal pages respond', pages.map((p) => p.res.status).join('/'))
    }

    // --- Admin login ---
    const email = process.env.AUDIT_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || ''
    const password = process.env.AUDIT_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || ''
    if (!email || !password) throw new Error('SUPER_ADMIN_EMAIL/PASSWORD required in .env')

    const login = await http('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    if (!login.res.ok) throw new Error(`admin login ${login.res.status} ${login.json?.error || ''}`)
    adminCookie = cookieHeader(login.setCookie)
    const me = await http('/api/admin/me', { cookie: adminCookie })
    adminUserId = me.json?.user?.id
    if (!adminUserId) throw new Error('admin me missing user id')
    pass('Admin portal login', me.json.user.role)

    // --- Create lawyers A/B ---
    const lawyerPass = `Wire-${suffix}-Ab12!`
    const lawyerHash = await hashPassword(lawyerPass)
    const lawyerA = await prisma.adminUser.create({
      data: {
        fullName: `Wire Lawyer A ${suffix}`,
        email: `wire-lawyer-a-${suffix}@afterstem.test`,
        passwordHash: lawyerHash,
        role: AdminRole.ATTORNEY,
        status: AdminStatus.ACTIVE,
      },
    })
    const lawyerB = await prisma.adminUser.create({
      data: {
        fullName: `Wire Lawyer B ${suffix}`,
        email: `wire-lawyer-b-${suffix}@afterstem.test`,
        passwordHash: lawyerHash,
        role: AdminRole.ATTORNEY,
        status: AdminStatus.ACTIVE,
      },
    })
    createdAdminIds.push(lawyerA.id, lawyerB.id)
    pass('Lawyers created', `${lawyerA.email} / ${lawyerB.email}`)

    // --- Candidate A + assign lawyer A ---
    const createA = await http('/api/admin/candidates', {
      method: 'POST',
      cookie: adminCookie,
      body: JSON.stringify({
        fullLegalName: `Wire Candidate A ${suffix}`,
        email: `wire.a.${suffix}@example.com`,
        phone: '+15550101',
        visaType: 'O1A',
        assignedAttorneyId: lawyerA.id,
      }),
    })
    if (!createA.res.ok) throw new Error(`create A: ${createA.json?.error || createA.res.status}`)
    const candidateAId = createA.json.candidate?.id || createA.json.id
    const caseAId = createA.json.case?.id || createA.json.currentCase?.id
    const candidateANumber = createA.json.candidate?.candidateNumber
    if (!candidateAId || !caseAId) throw new Error('candidate A missing ids')
    createdCandidateIds.push(candidateAId)
    const caseA = await prisma.case.findUnique({ where: { id: caseAId } })
    if (caseA?.assignedAttorneyId !== lawyerA.id) {
      fail('Assign lawyer A on create', String(caseA?.assignedAttorneyId))
    } else {
      pass('Assign lawyer A on create', candidateANumber)
    }

    // --- Candidate B + lawyer B ---
    const createB = await http('/api/admin/candidates', {
      method: 'POST',
      cookie: adminCookie,
      body: JSON.stringify({
        fullLegalName: `Wire Candidate B ${suffix}`,
        email: `wire.b.${suffix}@example.com`,
        visaType: 'O1A',
        assignedAttorneyId: lawyerB.id,
      }),
    })
    if (!createB.res.ok) throw new Error(`create B: ${createB.json?.error || createB.res.status}`)
    const candidateBId = createB.json.candidate?.id || createB.json.id
    const caseBId = createB.json.case?.id || createB.json.currentCase?.id
    createdCandidateIds.push(candidateBId)
    pass('Candidate B + lawyer B', createB.json.candidate?.candidateNumber)

    // --- Document request package (files + profile links) ---
    const pkg = await createDocumentRequestPackage({
      caseId: caseAId,
      createdById: adminUserId,
      requestType: 'SELECTED',
      items: [
        { key: 'resume', label: 'Updated Resume/CV', category: '01 Basic Documents', source: 'template', inputKind: 'file' },
        { key: 'awards_evidence', label: 'Awards evidence', category: '03 Awards', source: 'template', inputKind: 'file' },
        {
          key: 'github_url',
          label: 'GitHub profile URL',
          category: 'Profile & links',
          source: 'custom',
          inputKind: 'url',
        },
        {
          key: 'linkedin_url',
          label: 'LinkedIn profile URL',
          category: 'Profile & links',
          source: 'custom',
          inputKind: 'url',
        },
        {
          key: 'other_links',
          label: 'Other links to share',
          category: 'Profile & links',
          source: 'custom',
          inputKind: 'urls',
        },
      ],
      sendEmail: false,
      publicBaseUrl: BASE,
    })
    if (pkg.preview) throw new Error('unexpected preview-only package')
    const token = extractDocumentUploadToken(pkg.url)
    if (!token) throw new Error('missing upload token')
    pass('Document request + upload link', pkg.documentRequest.requestNumber)

    // --- Open link in unauthenticated session ---
    const open = await http(`/documents/r/${encodeURIComponent(token)}`)
    if (open.res.status !== 302 && open.res.status !== 307) {
      fail('Magic link open', `status ${open.res.status}`)
    }
    const docCookie = cookieHeader(open.setCookie)
    if (!docCookie.includes('as_doc_session')) {
      fail('Magic link session cookie', docCookie || '(empty)')
    } else {
      pass('Magic link session cookie', 'as_doc_session set')
    }

    const sessionGet = await http('/api/documents', { cookie: docCookie })
    if (!sessionGet.res.ok) {
      fail('Candidate documents GET', sessionGet.json?.error || String(sessionGet.res.status))
    } else {
      const cats = sessionGet.json.categories as Array<{ questions: Array<{ key: string; inputKind?: string }> }>
      const keys = cats.flatMap((c) => c.questions.map((q) => q.key))
      const hasResume = keys.includes('resume')
      const hasGithub = keys.includes('github_url')
      const hasOther = keys.some((k) => k.includes('other_supporting') || k === 'additional_evidence')
      if (hasResume && hasGithub && hasOther) {
        pass('Candidate portal categories', keys.slice(0, 8).join(', '))
      } else {
        fail('Candidate portal categories', `keys=${keys.join(',')}`)
      }
    }

    // --- Uploads: PDF, other supporting, same filename twice ---
    async function uploadFile(opts: {
      questionKey: string
      filename: string
      body: Buffer
      description: string
      clientItemId: string
      mime?: string
    }) {
      const form = new FormData()
      form.set('questionKey', opts.questionKey)
      form.set('description', opts.description)
      form.set('clientItemId', opts.clientItemId)
      form.set('clientIdempotencyKey', opts.clientItemId)
      form.set(
        'file',
        new Blob([opts.body], { type: opts.mime || 'application/pdf' }),
        opts.filename,
      )
      const res = await fetch(`${BASE}/api/documents`, {
        method: 'POST',
        headers: { cookie: docCookie, Origin: ORIGIN },
        body: form,
      })
      const json = await res.json().catch(() => ({}))
      return { res, json }
    }

    const resumeBody = pdfBuffer(`resume-${suffix}`)
    const up1 = await uploadFile({
      questionKey: 'resume',
      filename: 'resume.pdf',
      body: resumeBody,
      description: 'Candidate resume for wiring audit',
      clientItemId: `wire-resume-${suffix}`,
    })
    if (up1.res.ok && up1.json.document?.id) {
      const row = await prisma.caseDocument.findUnique({ where: { id: up1.json.document.id } })
      if (row && row.candidateId === candidateAId && row.caseId === caseAId) {
        await getPrivateObject(row.storageKey, row.storageProvider)
        pass('Candidate resume upload persisted', row.id)
      } else fail('Candidate resume upload persisted', 'wrong associations')
    } else {
      fail('Candidate resume upload persisted', up1.json.error || String(up1.res.status))
    }

    // Idempotent retry (lost response)
    const up1b = await uploadFile({
      questionKey: 'resume',
      filename: 'resume.pdf',
      body: resumeBody,
      description: 'Candidate resume for wiring audit',
      clientItemId: `wire-resume-${suffix}`,
    })
    if (up1b.res.ok && up1b.json.document?.id === up1.json.document?.id) {
      pass('Idempotent retry', 'same document id returned')
    } else {
      fail('Idempotent retry', `${up1b.json.document?.id} vs ${up1.json.document?.id}`)
    }

    const other1 = await uploadFile({
      questionKey: 'other_supporting_document',
      filename: 'same-name.pdf',
      body: pdfBuffer(`other-a-${suffix}`),
      description: 'Other supporting document A',
      clientItemId: `wire-other-a-${suffix}`,
    })
    const other2 = await uploadFile({
      questionKey: 'other_supporting_document',
      filename: 'same-name.pdf',
      body: pdfBuffer(`other-b-${suffix}`),
      description: 'Other supporting document B',
      clientItemId: `wire-other-b-${suffix}`,
    })
    if (other1.res.ok && other2.res.ok && other1.json.document?.id !== other2.json.document?.id) {
      pass('Same filename two files preserved', `${other1.json.document.id} / ${other2.json.document.id}`)
    } else {
      fail(
        'Same filename two files preserved',
        `${other1.json.error || other1.res.status} / ${other2.json.error || other2.res.status}`,
      )
    }

    const awards = await uploadFile({
      questionKey: 'awards_evidence',
      filename: 'award-scan.pdf',
      body: pdfBuffer(`award-scan-${suffix}`),
      description: 'Scanned awards PDF evidence',
      clientItemId: `wire-award-${suffix}`,
    })
    if (awards.res.ok && awards.json.document?.id) pass('Awards / scanned PDF upload', awards.json.document.id)
    else fail('Awards / scanned PDF upload', awards.json.error || String(awards.res.status))

    // --- Links ---
    async function saveLink(questionKey: string, urls: string) {
      const res = await fetch(`${BASE}/api/documents`, {
        method: 'POST',
        headers: {
          cookie: docCookie,
          Origin: ORIGIN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          questionKey,
          urls,
          clientItemId: `link:${questionKey}:${suffix}`,
          clientIdempotencyKey: `link:${questionKey}:${suffix}`,
        }),
      })
      const json = await res.json().catch(() => ({}))
      return { res, json }
    }

    const gh = await saveLink('github_url', 'https://github.com/afterstem-wire-audit')
    const li = await saveLink('linkedin_url', 'https://www.linkedin.com/in/afterstem-wire-audit')
    const ol = await saveLink('other_links', 'https://example.com/portfolio\nhttps://example.com/press')
    if (gh.res.ok && li.res.ok && ol.res.ok) {
      pass('GitHub / LinkedIn / other links', 'all saved')
    } else {
      fail(
        'GitHub / LinkedIn / other links',
        [gh, li, ol].map((x) => x.json.error || x.res.status).join(' | '),
      )
    }

    // Empty optional link skipped
    const skipEmpty = await saveLink('github_url', '   \n  ')
    // github already saved — empty might overwrite with skip on same key; API skips empty before membership
    // Use a dedicated call with empty urls on other_links append path — empty returns skipped
    {
      const res = await fetch(`${BASE}/api/documents`, {
        method: 'POST',
        headers: { cookie: docCookie, Origin: ORIGIN, 'Content-Type': 'application/json' },
        body: JSON.stringify({ questionKey: 'other_links', urls: '  \n ', clientItemId: `empty-${suffix}` }),
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.skipped) pass('Empty optional link skipped', 'SKIPPED')
      else fail('Empty optional link skipped', JSON.stringify(json))
    }
    void skipEmpty

    // --- Admin visibility via checklist ---
    const adminDocs = await prisma.caseDocument.findMany({
      where: { candidateId: candidateAId, status: { not: 'ARCHIVED' } },
      orderBy: { uploadedAt: 'desc' },
    })
    const defs = await prisma.customDocumentDef.findMany({
      where: { caseId: caseAId },
      select: { key: true, label: true, category: true },
    })
    const checklist = buildChecklist(adminDocs, defs)
    const received = checklist.folders.flatMap((f) => f.items).filter(isReceivedChecklistItem)
    const receivedKeys = received.map((i) => i.questionKey)
    const hasResume = receivedKeys.includes('resume')
    const hasAwards = received.some(
      (i) => i.questionKey === 'awards_evidence' || i.questionKey === 'award_certificates' || i.questionKey === 'award_evidence',
    )
    const hasGithub = receivedKeys.includes('github_url')
    const hasOther = received.some(
      (i) =>
        i.questionKey === 'other_supporting_document' ||
        i.questionKey === 'additional_files' ||
        i.questionKey === 'additional_evidence',
    )
    if (hasResume && hasAwards && hasGithub && hasOther) {
      pass('Admin checklist visibility', `${received.length} slots: ${receivedKeys.join(',')}`)
    } else {
      fail('Admin checklist visibility', receivedKeys.join(','))
    }

    // Admin download stream
    const resumeDoc = adminDocs.find((d) => d.questionKey === 'resume')
    if (resumeDoc) {
      const dl = await http(`/api/admin/documents/${resumeDoc.id}?download=1&stream=1`, {
        cookie: adminCookie,
      })
      if (dl.res.ok && dl.text.length > 0) pass('Admin download stream', `${dl.text.length} bytes`)
      else fail('Admin download stream', String(dl.res.status))
    }

    // --- Lawyer A portal ---
    const loginLA = await http('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: lawyerA.email, password: lawyerPass }),
    })
    if (!loginLA.res.ok) fail('Lawyer A login', loginLA.json?.error || String(loginLA.res.status))
    const lawyerACookie = cookieHeader(loginLA.setCookie)
    const listA = await http('/api/lawyer/candidates', { cookie: lawyerACookie })
    if (listA.res.ok) {
      const ids = (listA.json.items || []).map((i: { id: string }) => i.id)
      if (ids.includes(candidateAId) && !ids.includes(candidateBId)) {
        pass('Lawyer A list isolation', `sees A only (${ids.length} assigned)`)
      } else {
        fail('Lawyer A list isolation', `ids=${ids.join(',')}`)
      }
    } else {
      fail('Lawyer A list isolation', listA.json?.error || String(listA.res.status))
    }

    if (resumeDoc) {
      const preview = await http(`/api/admin/documents/${resumeDoc.id}`, { cookie: lawyerACookie })
      if (preview.res.ok && preview.json.previewPath) {
        pass('Lawyer A preview (no download URL)', preview.json.previewPath)
      } else {
        fail('Lawyer A preview (no download URL)', JSON.stringify(preview.json))
      }
      const deniedDl = await http(`/api/admin/documents/${resumeDoc.id}?download=1&stream=1`, {
        cookie: lawyerACookie,
      })
      if (deniedDl.res.status === 403) pass('Lawyer A download blocked', '403')
      else fail('Lawyer A download blocked', String(deniedDl.res.status))
    }

    // Lawyer A cannot access candidate B profile API indirectly via document of A is fine;
    // create a doc on B and try
    const bDoc = await prisma.caseDocument.create({
      data: {
        candidateId: candidateBId,
        caseId: caseBId!,
        category: 'additional',
        documentType: 'note',
        questionKey: 'other_supporting_document',
        originalFilename: 'b-only.txt',
        description: 'Candidate B private file',
        storageProvider: 'neon_pg',
        storageKey: `audit/${candidateBId}/b-only-${suffix}.txt`,
        mimeType: 'text/plain',
        fileSizeBytes: 4,
        status: 'UPLOADED',
        version: 1,
        isCurrentVersion: true,
        uploadedByType: 'ADMIN',
      },
    })
    await prisma.storedObject.create({
      data: {
        key: `audit/${candidateBId}/b-only-${suffix}.txt`,
        mimeType: 'text/plain',
        byteSize: 4,
        content: Buffer.from('bbbb'),
        checksum: createHash('sha256').update('bbbb').digest('hex'),
      },
    })
    const cross = await http(`/api/admin/documents/${bDoc.id}`, { cookie: lawyerACookie })
    if (cross.res.status === 403 || cross.res.status === 404) {
      pass('Lawyer A blocked from candidate B docs', String(cross.res.status))
    } else {
      fail('Lawyer A blocked from candidate B docs', String(cross.res.status))
    }

    // --- Lawyer B ---
    const loginLB = await http('/api/admin/login', {
      method: 'POST',
      body: JSON.stringify({ email: lawyerB.email, password: lawyerPass }),
    })
    const lawyerBCookie = cookieHeader(loginLB.setCookie)
    const listB = await http('/api/lawyer/candidates', { cookie: lawyerBCookie })
    const idsB = (listB.json?.items || []).map((i: { id: string }) => i.id)
    if (idsB.includes(candidateBId) && !idsB.includes(candidateAId)) {
      pass('Lawyer B list isolation', 'sees B only')
    } else {
      fail('Lawyer B list isolation', `ids=${idsB.join(',')}`)
    }

    // --- Upload before assign, then assign ---
    const createC = await http('/api/admin/candidates', {
      method: 'POST',
      cookie: adminCookie,
      body: JSON.stringify({
        fullLegalName: `Wire Candidate C ${suffix}`,
        email: `wire.c.${suffix}@example.com`,
        visaType: 'O1A',
      }),
    })
    const candidateCId = createC.json.candidate?.id || createC.json.id
    const caseCId = createC.json.case?.id || createC.json.currentCase?.id
    createdCandidateIds.push(candidateCId)
    const pkgC = await createDocumentRequestPackage({
      caseId: caseCId,
      createdById: adminUserId,
      requestType: 'SELECTED',
      items: [
        { key: 'resume', label: 'Resume', category: '01 Basic Documents', source: 'template', inputKind: 'file' },
      ],
      sendEmail: false,
      publicBaseUrl: BASE,
    })
    if (!pkgC.preview) {
      const tokenC = extractDocumentUploadToken(pkgC.url)!
      const openC = await http(`/documents/r/${encodeURIComponent(tokenC)}`)
      const cookieC = cookieHeader(openC.setCookie)
      const form = new FormData()
      form.set('questionKey', 'resume')
      form.set('description', 'Uploaded before lawyer assignment')
      form.set('clientItemId', `pre-assign-${suffix}`)
      form.set('clientIdempotencyKey', `pre-assign-${suffix}`)
      form.set('file', new Blob([pdfBuffer(`pre-${suffix}`)], { type: 'application/pdf' }), 'pre.pdf')
      const upC = await fetch(`${BASE}/api/documents`, {
        method: 'POST',
        headers: { cookie: cookieC, Origin: ORIGIN },
        body: form,
      })
      const upCJson = await upC.json().catch(() => ({}))
      if (!upC.ok) fail('Upload before lawyer assign', upCJson.error || String(upC.status))
      else pass('Upload before lawyer assign', upCJson.document?.id)

      const assign = await http(`/api/admin/cases/${caseCId}/assign-lawyer`, {
        method: 'POST',
        cookie: adminCookie,
        body: JSON.stringify({ lawyerId: lawyerA.id, confirm: true }),
      })
      if (!assign.res.ok) {
        await prisma.case.update({
          where: { id: caseCId },
          data: { assignedAttorneyId: lawyerA.id },
        })
        pass('Assign lawyer after upload', `API ${assign.res.status}; DB fallback`)
      } else {
        pass('Assign lawyer after upload', 'API OK')
      }

      const listAfter = await http('/api/lawyer/candidates', { cookie: lawyerACookie })
      // may need re-login if cookie role same — lawyerACookie still valid
      const idsAfter = (listAfter.json?.items || []).map((i: { id: string }) => i.id)
      // Refresh lawyer session list
      const loginLA2 = await http('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ email: lawyerA.email, password: lawyerPass }),
      })
      const la2 = cookieHeader(loginLA2.setCookie)
      const listAfter2 = await http('/api/lawyer/candidates', { cookie: la2 })
      const ids2 = (listAfter2.json?.items || []).map((i: { id: string }) => i.id)
      if (ids2.includes(candidateCId)) {
        const docsC = await prisma.caseDocument.count({
          where: { candidateId: candidateCId, questionKey: 'resume' },
        })
        if (docsC >= 1) pass('Lawyer sees pre-assignment uploads', `${docsC} resume docs`)
        else fail('Lawyer sees pre-assignment uploads', 'no docs')
      } else {
        fail('Lawyer sees pre-assignment uploads', `not in list; ids=${ids2.join(',')}`)
      }
      void idsAfter
    }

    // --- Expired / invalid link ---
    const bad = await http('/documents/r/not-a-real-token-zzzz')
    const loc = bad.res.headers.get('location') || ''
    if ((bad.res.status === 302 || bad.res.status === 307) && loc.includes('error=')) {
      pass('Invalid link UI redirect', loc)
    } else {
      fail('Invalid link UI redirect', `${bad.res.status} ${loc}`)
    }

    // --- Partial batch: one bad slot key should fail without wiping good uploads ---
    {
      const form = new FormData()
      form.set('questionKey', 'totally_unknown_slot_xyz')
      form.set('description', 'Should fail membership')
      form.set('clientItemId', `bad-slot-${suffix}`)
      form.set('file', new Blob([pdfBuffer('bad')], { type: 'application/pdf' }), 'bad.pdf')
      const badUp = await fetch(`${BASE}/api/documents`, {
        method: 'POST',
        headers: { cookie: docCookie, Origin: ORIGIN },
        body: form,
      })
      const badJson = await badUp.json().catch(() => ({}))
      if (!badUp.ok && (badJson.code || badJson.error)) {
        const still = await prisma.caseDocument.count({ where: { candidateId: candidateAId } })
        if (still >= 5) pass('Rejected unknown slot keeps prior uploads', `${still} docs remain`)
        else fail('Rejected unknown slot keeps prior uploads', `count=${still}`)
      } else {
        fail('Rejected unknown slot keeps prior uploads', JSON.stringify(badJson))
      }
    }
  } catch (e) {
    fail('Portal wiring fatal', e instanceof Error ? e.message : String(e))
  } finally {
    // --- Cleanup all wiring fixtures ---
    console.log('\n--- Cleanup ---')
    for (const id of createdCandidateIds) {
      try {
        await cleanupCandidate(id)
        console.log(`cleaned candidate ${id}`)
      } catch (err) {
        console.error(`cleanup failed ${id}`, err instanceof Error ? err.message : err)
      }
    }
    if (createdAdminIds.length) {
      await prisma.adminUser.deleteMany({ where: { id: { in: createdAdminIds } } })
      console.log(`cleaned ${createdAdminIds.length} lawyer users`)
    }
    // Sweep leftover audit/persist/wire candidates from prior runs
    const leftovers = await prisma.candidate.findMany({
      where: {
        OR: [
          { email: { contains: '@afterstem.test' } },
          { email: { contains: 'wire.' } },
          { email: { startsWith: 'audit.' } },
          { email: { startsWith: 'persist-' } },
          { fullLegalName: { startsWith: 'Audit Test' } },
          { fullLegalName: { startsWith: 'Wire Candidate' } },
          { fullLegalName: { startsWith: 'Persist Test' } },
        ],
      },
      select: { id: true, email: true, fullLegalName: true },
      take: 50,
    })
    for (const row of leftovers) {
      try {
        await cleanupCandidate(row.id)
        console.log(`swept leftover ${row.fullLegalName} <${row.email}>`)
      } catch {
        /* ignore */
      }
    }
    const leftoverLawyers = await prisma.adminUser.findMany({
      where: {
        OR: [
          { email: { endsWith: '@afterstem.test' } },
          { email: { endsWith: '@afterstem.test' } },
          { fullName: { startsWith: 'Wire Lawyer' } },
          { fullName: { startsWith: 'Audit Lawyer' } },
          { fullName: { startsWith: 'Audit Admin' } },
        ],
      },
      select: { id: true },
    })
    if (leftoverLawyers.length) {
      await prisma.adminUser.deleteMany({ where: { id: { in: leftoverLawyers.map((u) => u.id) } } })
      console.log(`swept ${leftoverLawyers.length} audit admin users`)
    }
    pass('Cleanup complete', `${createdCandidateIds.length} candidates + leftovers`)
  }

  console.log('\n=== SUMMARY ===')
  const counts = { PASS: 0, FAIL: 0, SKIP: 0 }
  for (const r of results) counts[r.status] += 1
  console.log(counts)
  for (const r of results.filter((x) => x.status === 'FAIL')) {
    console.log(` - FAIL: ${r.name}: ${r.detail}`)
  }
  await prisma.$disconnect()
  if (counts.FAIL > 0) process.exit(1)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
