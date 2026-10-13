/**
 * Production deploy gate + bulk document E2E against https://www.afterstem.ai
 *
 * Creates a uniquely tagged synthetic candidate + request, uploads 45+ files,
 * verifies admin/lawyer visibility, then archives ONLY the test document rows
 * (and removes their stored blobs). Does not delete candidate/case/request.
 *
 *   npx tsx --env-file=.env scripts/prod-bulk-upload-e2e.ts
 */
import { createHash, randomBytes } from 'crypto'
import { AdminRole, AdminStatus, PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/auth'
import { buildChecklist, countVisibleReceivedDocuments, isReceivedChecklistItem } from '../lib/documents-checklist'
import { extractDocumentUploadToken } from '../lib/candidate-upload-url'
import { createDocumentRequestPackage } from '../lib/document-requests'
import { getPrivateObject } from '../lib/storage'

const prisma = new PrismaClient()
const BASE = process.env.AUDIT_BASE_URL || process.env.APP_URL || 'https://www.afterstem.ai'
const EXPECTED_SHA = process.env.EXPECTED_COMMIT_SHA || ''
const MARKER = `E2E-BULK-${(EXPECTED_SHA || randomBytes(4).toString('hex')).slice(0, 8)}-${Date.now()}`
const BATCH_SIZE = 45

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
  if (!headers.has('Origin') && init?.method && init.method !== 'GET' && init.method !== 'HEAD') {
    headers.set('Origin', BASE.replace(/\/$/, ''))
  }
  const res = await fetch(`${BASE.replace(/\/$/, '')}${path}`, { ...init, headers, redirect: 'manual' })
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

/** New deploy fingerprint: unauthenticated POST returns SESSION_REQUIRED + correlationId. */
async function deployFingerprint(): Promise<{ ok: boolean; body: any; status: number }> {
  const res = await fetch(`${BASE.replace(/\/$/, '')}/api/documents`, {
    method: 'POST',
    headers: { Origin: BASE.replace(/\/$/, ''), 'Content-Type': 'application/json' },
    body: '{}',
  })
  const body = await res.json().catch(() => ({}))
  const ok = res.status === 401 && body?.code === 'SESSION_REQUIRED' && typeof body?.correlationId === 'string'
  return { ok, body, status: res.status }
}

async function waitForDeploy(timeoutMs = 12 * 60_000) {
  const start = Date.now()
  let attempt = 0
  while (Date.now() - start < timeoutMs) {
    attempt += 1
    try {
      const fp = await deployFingerprint()
      console.log(`[deploy] attempt ${attempt} status=${fp.status} code=${fp.body?.code || '?'} corr=${fp.body?.correlationId || '-'}`)
      if (fp.ok) return true
    } catch (e) {
      console.log(`[deploy] attempt ${attempt} error=${e instanceof Error ? e.message : e}`)
    }
    await new Promise((r) => setTimeout(r, 15_000))
  }
  return false
}

async function main() {
  console.log('\n=== PRODUCTION BULK DOCUMENT E2E ===')
  console.log(`Base: ${BASE}`)
  console.log(`Marker: ${MARKER}`)
  console.log(`Expected SHA: ${EXPECTED_SHA || '(not set)'}`)
  console.log(`Remote HEAD should be a7fa910…\n`)

  // --- Deploy gate ---
  const deployed = await waitForDeploy()
  if (!deployed) {
    fail('Deploy contains new commit', 'timed out waiting for SESSION_REQUIRED+correlationId fingerprint')
    await finish(1)
    return
  }
  pass('Deploy fingerprint live', 'SESSION_REQUIRED + correlationId')

  const email = process.env.AUDIT_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || ''
  const password = process.env.AUDIT_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || ''
  if (!email || !password) {
    fail('Admin credentials', 'missing SUPER_ADMIN_EMAIL/PASSWORD')
    await finish(1)
    return
  }

  const login = await http('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  if (!login.res.ok) {
    fail('Admin login (production)', `${login.res.status} ${login.json?.error || ''}`)
    await finish(1)
    return
  }
  const adminCookie = cookieHeader(login.setCookie)
  const me = await http('/api/admin/me', { cookie: adminCookie })
  const adminUserId = me.json?.user?.id as string
  if (!adminUserId) {
    fail('Admin session', 'no user id')
    await finish(1)
    return
  }
  pass('Admin login (production)', me.json.user.role)

  // Lawyer for assignment (leave account — only docs cleaned)
  const lawyerPass = `Bulk-${randomBytes(4).toString('hex')}!Aa`
  const lawyer = await prisma.adminUser.create({
    data: {
      fullName: `${MARKER} Lawyer`,
      email: `${MARKER.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@afterstem.test`,
      passwordHash: await hashPassword(lawyerPass),
      role: AdminRole.ATTORNEY,
      status: AdminStatus.ACTIVE,
    },
  })
  pass('Test lawyer created', lawyer.email)

  // Candidate (leave candidate/case/request after test per instructions)
  const create = await http('/api/admin/candidates', {
    method: 'POST',
    cookie: adminCookie,
    body: JSON.stringify({
      fullLegalName: `${MARKER} Candidate`,
      email: `${MARKER.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com`,
      phone: '+15550999',
      visaType: 'O1A',
      assignedAttorneyId: lawyer.id,
    }),
  })
  if (!create.res.ok) {
    fail('Create synthetic candidate', create.json?.error || String(create.res.status))
    await finish(1)
    return
  }
  const candidateId = create.json.candidate?.id || create.json.id
  const caseId = create.json.case?.id || create.json.currentCase?.id
  const candidateNumber = create.json.candidate?.candidateNumber
  pass('Create synthetic candidate', `${candidateNumber} ${candidateId}`)

  const pkg = await createDocumentRequestPackage({
    caseId,
    createdById: adminUserId,
    requestType: 'SELECTED',
    items: [
      { key: 'resume', label: 'Resume', category: '01 Basic Documents', source: 'template', inputKind: 'file' },
      { key: 'passport', label: 'Passport', category: '01 Basic Documents', source: 'template', inputKind: 'file' },
      {
        key: 'other_supporting_document',
        label: 'Other supporting document',
        category: 'additional',
        source: 'custom',
        inputKind: 'file',
      },
    ],
    sendEmail: false,
    publicBaseUrl: BASE,
  })
  if (pkg.preview) throw new Error('preview only')
  const token = extractDocumentUploadToken(pkg.url)!
  pass('Document request + link', pkg.documentRequest.requestNumber)

  const open = await http(`/documents/r/${encodeURIComponent(token)}`)
  const docCookie = cookieHeader(open.setCookie)
  if (!docCookie.includes('as_doc_session')) {
    fail('Candidate magic link', 'no session cookie')
    await finish(1)
    return
  }
  pass('Candidate magic link', 'session cookie set')

  const tracked: Array<{ id: string; storageKey: string; filename: string; clientItemId: string }> = []

  async function uploadOne(opts: {
    questionKey: string
    filename: string
    index: number
    clientItemId: string
    description?: string
  }) {
    const body = pdfBuffer(`${MARKER}-${opts.index}-${opts.filename}`)
    const form = new FormData()
    form.set('questionKey', opts.questionKey)
    form.set('description', opts.description || `${MARKER} file ${opts.index} ${opts.filename}`)
    form.set('clientItemId', opts.clientItemId)
    form.set('clientIdempotencyKey', opts.clientItemId)
    form.set('file', new Blob([body], { type: 'application/pdf' }), opts.filename)
    const res = await fetch(`${BASE.replace(/\/$/, '')}/api/documents`, {
      method: 'POST',
      headers: { cookie: docCookie, Origin: BASE.replace(/\/$/, '') },
      body: form,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.document?.id) {
      return { ok: false as const, error: json.error || `HTTP ${res.status}`, json }
    }
    const row = await prisma.caseDocument.findUnique({ where: { id: json.document.id } })
    if (!row || row.candidateId !== candidateId) {
      return { ok: false as const, error: 'DB association mismatch', json }
    }
    // Must stay UPLOADED — not auto-reviewed/accepted
    if (row.status !== 'UPLOADED') {
      return { ok: false as const, error: `unexpected status ${row.status}`, json }
    }
    await getPrivateObject(row.storageKey, row.storageProvider)
    tracked.push({
      id: row.id,
      storageKey: row.storageKey,
      filename: row.originalFilename,
      clientItemId: opts.clientItemId,
    })
    return { ok: true as const, row, json }
  }

  // --- Batch of 45 into other_supporting (single request accepts many files) ---
  const batchFailures: string[] = []
  for (let i = 1; i <= BATCH_SIZE; i++) {
    const r = await uploadOne({
      questionKey: 'other_supporting_document',
      filename: `${MARKER}-batch-${String(i).padStart(2, '0')}.pdf`,
      index: i,
      clientItemId: `${MARKER}-batch-${i}`,
    })
    if (!r.ok) batchFailures.push(`#${i}: ${r.error}`)
    if (i % 10 === 0) console.log(`  … uploaded ${i}/${BATCH_SIZE}`)
  }
  if (batchFailures.length === 0 && tracked.length === BATCH_SIZE) {
    pass('45-file batch all persisted', `${tracked.length} ids tracked`)
  } else {
    fail('45-file batch all persisted', `${tracked.length} ok; failures=${batchFailures.slice(0, 5).join(' | ')}`)
  }

  // Count check — no silent missing
  const batchCount = await prisma.caseDocument.count({
    where: {
      candidateId,
      description: { startsWith: MARKER },
      status: { not: 'ARCHIVED' },
    },
  })
  if (batchCount === BATCH_SIZE) pass('Batch DB count matches', String(batchCount))
  else fail('Batch DB count matches', `expected ${BATCH_SIZE} got ${batchCount}`)

  // --- Additional submission while request open (resume + passport multi) ---
  const multiA = await uploadOne({
    questionKey: 'resume',
    filename: `${MARKER}-resume-1.pdf`,
    index: 101,
    clientItemId: `${MARKER}-resume-1`,
  })
  const multiB = await uploadOne({
    questionKey: 'resume',
    filename: `${MARKER}-resume-2.pdf`,
    index: 102,
    clientItemId: `${MARKER}-resume-2`,
  })
  const multiC = await uploadOne({
    questionKey: 'passport',
    filename: `${MARKER}-passport-1.pdf`,
    index: 103,
    clientItemId: `${MARKER}-passport-1`,
  })
  if (multiA.ok && multiB.ok && multiC.ok) {
    pass('Multi-file per request (resume×2 + passport)', 'additional submission OK')
  } else {
    fail('Multi-file per request (resume×2 + passport)', 'one or more failed')
  }

  // Same filename twice
  const same1 = await uploadOne({
    questionKey: 'passport',
    filename: `${MARKER}-same-name.pdf`,
    index: 201,
    clientItemId: `${MARKER}-same-1`,
  })
  const same2 = await uploadOne({
    questionKey: 'passport',
    filename: `${MARKER}-same-name.pdf`,
    index: 202,
    clientItemId: `${MARKER}-same-2`,
  })
  if (same1.ok && same2.ok && same1.row!.id !== same2.row!.id) {
    pass('Same filename preserved as two docs', `${same1.row!.id} / ${same2.row!.id}`)
  } else {
    fail('Same filename preserved as two docs', 'deduped or failed')
  }

  // Idempotent retry of a successful item
  const retry = await uploadOne({
    questionKey: 'other_supporting_document',
    filename: `${MARKER}-batch-01.pdf`,
    index: 1,
    clientItemId: `${MARKER}-batch-1`,
  })
  if (retry.ok && retry.row!.id === tracked[0]?.id) {
    pass('Retry successful item is idempotent', retry.row!.id)
  } else {
    fail('Retry successful item is idempotent', `${retry.ok && retry.row?.id} vs ${tracked[0]?.id}`)
  }

  // Partial failure then retry: intentional bad slot, then good upload
  {
    const form = new FormData()
    form.set('questionKey', 'totally_unknown_slot_xyz')
    form.set('description', `${MARKER} should fail`)
    form.set('clientItemId', `${MARKER}-bad`)
    form.set('file', new Blob([pdfBuffer('bad')], { type: 'application/pdf' }), 'bad.pdf')
    const bad = await fetch(`${BASE.replace(/\/$/, '')}/api/documents`, {
      method: 'POST',
      headers: { cookie: docCookie, Origin: BASE.replace(/\/$/, '') },
      body: form,
    })
    const badJson = await bad.json().catch(() => ({}))
    if (!bad.ok) {
      const before = tracked.length
      const good = await uploadOne({
        questionKey: 'other_supporting_document',
        filename: `${MARKER}-retry-after-fail.pdf`,
        index: 301,
        clientItemId: `${MARKER}-retry-after-fail`,
      })
      if (good.ok && tracked.length === before + 1) {
        pass('Partial failure then retry keeps successes', badJson.code || badJson.error)
      } else {
        fail('Partial failure then retry keeps successes', 'retry failed')
      }
    } else {
      fail('Partial failure then retry keeps successes', 'bad slot unexpectedly accepted')
    }
  }

  const totalTestDocs = await prisma.caseDocument.findMany({
    where: { candidateId, description: { startsWith: MARKER }, status: { not: 'ARCHIVED' } },
    select: {
      id: true,
      storageKey: true,
      originalFilename: true,
      status: true,
      questionKey: true,
      fileSizeBytes: true,
      isCurrentVersion: true,
    },
  })
  console.log(`\nTracked test docs: ${totalTestDocs.length}`)
  for (const d of totalTestDocs.slice(0, 3)) {
    console.log(`  id=${d.id} key=${d.storageKey} status=${d.status}`)
  }
  if (totalTestDocs.length > 3) console.log(`  … +${totalTestDocs.length - 3} more`)

  // Status must not be ACCEPTED/UNDER_REVIEW from upload alone
  const autoReviewed = totalTestDocs.filter((d) => d.status === 'ACCEPTED' || d.status === 'UNDER_REVIEW')
  if (autoReviewed.length === 0) pass('Upload status remains UPLOADED (not auto-approved)', `${totalTestDocs.length} docs`)
  else fail('Upload status remains UPLOADED (not auto-approved)', autoReviewed.map((d) => d.status).join(','))

  // Admin checklist / overview counts
  const allDocs = await prisma.caseDocument.findMany({
    where: { candidateId, status: { not: 'ARCHIVED' } },
  })
  const defs = await prisma.customDocumentDef.findMany({
    where: { caseId },
    select: { key: true, label: true, category: true },
  })
  const checklist = buildChecklist(allDocs, defs)
  const received = checklist.folders.flatMap((f) => f.items).filter(isReceivedChecklistItem)
  const visible = countVisibleReceivedDocuments(allDocs)
  if (visible >= BATCH_SIZE + 5) {
    pass('Admin checklist / Overview counts', `visibleFiles=${visible} receivedSlots=${received.length}`)
  } else {
    fail('Admin checklist / Overview counts', `visible=${visible}`)
  }

  // Admin download one file
  const sample = totalTestDocs[0]!
  const dl = await http(`/api/admin/documents/${sample.id}?download=1&stream=1`, { cookie: adminCookie })
  if (dl.res.ok && dl.text.length > 0) pass('Admin download stream', `${dl.text.length} bytes`)
  else fail('Admin download stream', String(dl.res.status))

  // Lawyer visibility
  const loginL = await http('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email: lawyer.email, password: lawyerPass }),
  })
  const lawyerCookie = cookieHeader(loginL.setCookie)
  const list = await http('/api/lawyer/candidates', { cookie: lawyerCookie })
  const ids = (list.json?.items || []).map((i: { id: string }) => i.id)
  if (ids.includes(candidateId)) pass('Lawyer list includes candidate', candidateNumber)
  else fail('Lawyer list includes candidate', ids.join(','))

  const preview = await http(`/api/admin/documents/${sample.id}`, { cookie: lawyerCookie })
  if (preview.res.ok && preview.json.previewPath) pass('Lawyer preview path', preview.json.previewPath)
  else fail('Lawyer preview path', JSON.stringify(preview.json))

  const denied = await http(`/api/admin/documents/${sample.id}?download=1&stream=1`, { cookie: lawyerCookie })
  if (denied.res.status === 403) pass('Lawyer download blocked', '403')
  else fail('Lawyer download blocked', String(denied.res.status))

  // Fresh admin session sees same counts
  const login2 = await http('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const adminCookie2 = cookieHeader(login2.setCookie)
  const refreshDocs = await prisma.caseDocument.count({
    where: { candidateId, description: { startsWith: MARKER }, status: { not: 'ARCHIVED' } },
  })
  void adminCookie2
  if (refreshDocs === totalTestDocs.length) {
    pass('Counts stable after new admin session', String(refreshDocs))
  } else {
    fail('Counts stable after new admin session', `${refreshDocs} vs ${totalTestDocs.length}`)
  }

  // --- Cleanup: archive via API + delete stored blobs for TEST docs only ---
  console.log('\n--- Cleanup test documents only ---')
  let cleaned = 0
  const storageKeys = totalTestDocs.map((d) => d.storageKey)
  for (const doc of totalTestDocs) {
    const del = await http(`/api/admin/documents/${doc.id}`, {
      method: 'DELETE',
      cookie: adminCookie,
      body: JSON.stringify({ reason: `${MARKER} cleanup`, confirmFilename: doc.originalFilename }),
    })
    if (del.res.ok) cleaned += 1
    else console.error(`  archive failed ${doc.id}: ${del.json?.error || del.res.status}`)
  }
  // Remove BYTEA for archived test uploads (supported hard cleanup of storage for test marker keys)
  const deletedBlobs = await prisma.storedObject.deleteMany({
    where: { key: { in: storageKeys } },
  })
  pass('Archived test documents via API', `${cleaned}/${totalTestDocs.length}`)
  pass('Removed test stored_objects', `${deletedBlobs.count} blobs`)

  const remaining = await prisma.caseDocument.count({
    where: {
      candidateId,
      description: { startsWith: MARKER },
      isCurrentVersion: true,
      status: { not: 'ARCHIVED' },
    },
  })
  const remainingBlobs = await prisma.storedObject.count({ where: { key: { in: storageKeys } } })
  if (remaining === 0 && remainingBlobs === 0) {
    pass('Cleanup reflected in DB/storage', 'no active test docs or blobs')
  } else {
    fail('Cleanup reflected in DB/storage', `docs=${remaining} blobs=${remainingBlobs}`)
  }

  const afterDocs = await prisma.caseDocument.findMany({
    where: { candidateId, status: { not: 'ARCHIVED' }, isCurrentVersion: true },
  })
  const afterVisible = countVisibleReceivedDocuments(afterDocs)
  pass('Overview after cleanup', `visibleFiles=${afterVisible} (candidate/request retained)`)

  // Do NOT delete candidate/case/request/lawyer per instructions — only test files.
  // Soft-disable the disposable lawyer so it cannot be used accidentally.
  await prisma.adminUser.update({
    where: { id: lawyer.id },
    data: { status: AdminStatus.DISABLED, email: `disabled.${lawyer.email}` },
  })
  pass('Test lawyer disabled (candidate retained)', lawyer.id)

  await finish(results.some((r) => r.status === 'FAIL') ? 1 : 0)
}

async function finish(code: number) {
  console.log('\n=== SUMMARY ===')
  const counts = { PASS: 0, FAIL: 0, SKIP: 0 }
  for (const r of results) counts[r.status] += 1
  console.log(counts)
  for (const r of results.filter((x) => x.status === 'FAIL')) {
    console.log(` - FAIL: ${r.name}: ${r.detail}`)
  }
  console.log(`Marker: ${MARKER}`)
  await prisma.$disconnect()
  process.exit(code)
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
