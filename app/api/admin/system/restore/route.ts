import { NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/system-backup/auth'
import { handleApiError, assertSameOrigin, jsonError } from '@/lib/http'
import { validateBackupZip } from '@/lib/system-backup/validate-backup'
import { restoreSystemBackup } from '@/lib/system-backup/restore-backup'
import { buildFullSystemBackup } from '@/lib/system-backup/build-backup'
import { prisma } from '@/lib/db'
import { audit } from '@/lib/activity'
import type { RestoreMode } from '@prisma/client'

export const runtime = 'nodejs'
export const maxDuration = 300

const MAX_UPLOAD_BYTES = 512 * 1024 * 1024 // 512 MB

export async function GET() {
  try {
    await requireSuperAdmin()
    const jobs = await prisma.restoreJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { requestedBy: { select: { fullName: true, email: true } } },
    })
    return NextResponse.json({ jobs })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requireSuperAdmin()
    const form = await request.formData()
    const action = String(form.get('action') || 'validate')
    const file = form.get('file')
    if (!(file instanceof File)) return jsonError('Backup ZIP file is required.')
    if (file.size <= 0) return jsonError('Empty file.')
    if (file.size > MAX_UPLOAD_BYTES) return jsonError('Backup ZIP exceeds the 512 MB upload limit.')
    if (!file.name.toLowerCase().endsWith('.zip') && file.type !== 'application/zip') {
      return jsonError('Only Afterstem .zip backup packages are accepted.')
    }

    const buffer = Buffer.from(await file.arrayBuffer())

    if (action === 'validate') {
      const preview = await validateBackupZip(buffer)
      const job = await prisma.restoreJob.create({
        data: {
          status: preview.valid ? 'PREVIEW_READY' : 'FAILED',
          mode: 'MERGE',
          sourceFilename: file.name,
          byteSize: file.size,
          summaryJson: preview as any,
          errorMessage: preview.valid ? null : preview.errors.join('; '),
          requestedById: user.id,
          startedAt: new Date(),
          finishedAt: preview.valid ? null : new Date(),
        },
      })
      return NextResponse.json({ jobId: job.id, preview })
    }

    if (action === 'restore') {
      const mode = (String(form.get('mode') || 'MERGE') as RestoreMode) || 'MERGE'
      const confirmation = String(form.get('confirmation') || '')
      const conflictPolicy = String(form.get('conflictPolicy') || 'skip') as 'skip' | 'update'
      if (!['MERGE', 'MISSING_ONLY', 'UPDATE_EXISTING', 'FULL'].includes(mode)) {
        return jsonError('Invalid restore mode.')
      }
      if (mode === 'FULL' && confirmation.trim() !== 'RESTORE Afterstem') {
        return jsonError('Full System Restore requires typing RESTORE Afterstem to confirm.')
      }

      const preview = await validateBackupZip(buffer)
      if (!preview.valid) return jsonError(`Backup validation failed: ${preview.errors.join('; ')}`)

      let preRestoreBackupId: string | null = null
      if (mode === 'FULL') {
        const pre = await buildFullSystemBackup({ includeFiles: true, kindLabel: 'PRE_RESTORE' })
        const preJob = await prisma.backupJob.create({
          data: {
            kind: 'PRE_RESTORE',
            status: pre.filesMissing > 0 ? 'PARTIAL' : 'SUCCEEDED',
            filename: pre.filename.replace('Full_Backup', 'PreRestore_Backup'),
            byteSize: pre.buffer.length,
            candidateCount: pre.candidateCount,
            caseCount: pre.caseCount,
            documentCount: pre.documentCount,
            paymentCount: pre.paymentCount,
            filesIncluded: pre.filesIncluded,
            filesMissing: pre.filesMissing,
            manifestJson: pre.manifest as any,
            requestedById: user.id,
            startedAt: new Date(),
            finishedAt: new Date(),
          },
        })
        preRestoreBackupId = preJob.id
        // Pre-restore ZIP is recorded in history; bytes are not retained in DB (too large).
      }

      const job = await prisma.restoreJob.create({
        data: {
          status: 'IMPORTING',
          mode,
          sourceFilename: file.name,
          byteSize: file.size,
          summaryJson: preview as any,
          confirmationText: confirmation || null,
          preRestoreBackupId,
          requestedById: user.id,
          startedAt: new Date(),
        },
      })

      try {
        const result = await restoreSystemBackup({
          buffer,
          mode,
          conflictPolicy: mode === 'UPDATE_EXISTING' || mode === 'FULL' ? 'update' : conflictPolicy,
        })
        await prisma.restoreJob.update({
          where: { id: job.id },
          data: {
            status: 'COMPLETED',
            resultJson: result as any,
            finishedAt: new Date(),
          },
        })
        await audit({
          actorId: user.id,
          action: 'SYSTEM_RESTORE',
          entityType: 'system',
          metadata: { jobId: job.id, mode, result },
        })
        return NextResponse.json({ jobId: job.id, result, preview })
      } catch (err) {
        await prisma.restoreJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            errorMessage: err instanceof Error ? err.message : 'Restore failed',
            finishedAt: new Date(),
          },
        })
        throw err
      }
    }

    return jsonError('Unknown action.')
  } catch (error) {
    return handleApiError(error)
  }
}
