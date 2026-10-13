import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/system-backup/auth'
import { handleApiError, assertSameOrigin, jsonError } from '@/lib/http'
import { buildFullSystemBackup } from '@/lib/system-backup/build-backup'
import { contentDisposition } from '@/lib/download-names'
import { prisma } from '@/lib/db'
import { audit } from '@/lib/activity'
import { buildBulkExport } from '@/lib/candidate-exports'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(request: Request) {
  try {
    const user = await requireSuperAdmin()
    const url = new URL(request.url)
    const action = url.searchParams.get('action') || 'full'

    if (action === 'history') {
      const jobs = await prisma.backupJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { requestedBy: { select: { fullName: true, email: true } } },
      })
      return NextResponse.json({ jobs })
    }

    if (action === 'excel' || action === 'csv') {
      const ids = (await prisma.candidate.findMany({ select: { id: true } })).map((c) => c.id)
      const result = await buildBulkExport(
        ids,
        { includeFinance: true, includeNotes: true, includeCommunications: false },
        { includeDocuments: false, includeData: true },
      )
      // For excel/csv preference, still return zip with Candidates.xlsx from bulk, or convert
      await prisma.backupJob.create({
        data: {
          kind: action === 'excel' ? 'EXCEL' : 'CSV',
          status: 'SUCCEEDED',
          filename: result.filename,
          byteSize: result.buffer.length,
          candidateCount: ids.length,
          requestedById: user.id,
          startedAt: new Date(),
          finishedAt: new Date(),
        },
      })
      return new NextResponse(new Uint8Array(result.buffer), {
        headers: {
          'Content-Type': result.contentType,
          'Content-Disposition': contentDisposition(result.filename),
          'Cache-Control': 'no-store',
        },
      })
    }

    const includeFiles = action !== 'data-only'
    const kind =
      action === 'data-only' ? 'DATA_ONLY' : action === 'documents-only' ? 'DOCUMENTS_ONLY' : action === 'pre-restore' ? 'PRE_RESTORE' : 'FULL'

    const job = await prisma.backupJob.create({
      data: {
        kind: kind as any,
        status: 'RUNNING',
        requestedById: user.id,
        startedAt: new Date(),
      },
    })

    try {
      const result = await buildFullSystemBackup({ includeFiles })
      await prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: result.filesMissing > 0 ? 'PARTIAL' : 'SUCCEEDED',
          filename: result.filename,
          byteSize: result.buffer.length,
          candidateCount: result.candidateCount,
          caseCount: result.caseCount,
          documentCount: result.documentCount,
          paymentCount: result.paymentCount,
          filesIncluded: result.filesIncluded,
          filesMissing: result.filesMissing,
          manifestJson: result.manifest as any,
          warningReport: result.missingFiles.length ? (result.missingFiles as any) : undefined,
          finishedAt: new Date(),
        },
      })
      await audit({
        actorId: user.id,
        action: 'SYSTEM_BACKUP',
        entityType: 'system',
        metadata: {
          jobId: job.id,
          filename: result.filename,
          filesIncluded: result.filesIncluded,
          filesMissing: result.filesMissing,
          kind,
        },
      })
      return new NextResponse(new Uint8Array(result.buffer), {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': contentDisposition(result.filename),
          'Cache-Control': 'no-store',
          'X-Backup-Incomplete': result.filesMissing > 0 ? '1' : '0',
        },
      })
    } catch (err) {
      await prisma.backupJob.update({
        where: { id: job.id },
        data: {
          status: 'FAILED',
          errorMessage: err instanceof Error ? err.message : 'Backup failed',
          finishedAt: new Date(),
        },
      })
      throw err
    }
  } catch (error) {
    return handleApiError(error)
  }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireSuperAdmin()
    const body = (await request.json()) as { jobId?: string }
    if (!body.jobId) return jsonError('jobId required')
    await prisma.backupJob.delete({ where: { id: body.jobId } })
    await audit({
      actorId: user.id,
      action: 'SYSTEM_BACKUP_HISTORY_DELETE',
      entityType: 'backup_job',
      entityId: body.jobId,
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
