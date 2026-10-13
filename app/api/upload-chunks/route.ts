import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { isUploadBlob, saveUploadChunk } from '@/lib/chunked-upload'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { resolveInvite } from '@/lib/onboarding'
import { DOC_SESSION_COOKIE, resolveSubmissionSession } from '@/lib/submission-session'

async function canUploadChunk(inviteToken: string): Promise<boolean> {
  const jar = await cookies()
  if (await getSessionUser()) return true
  if (await resolveSubmissionSession(jar.get(DOC_SESSION_COOKIE)?.value)) return true
  if (inviteToken) {
    const invite = await resolveInvite(inviteToken)
    if (invite) return true
  }
  return false
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)

    const contentType = request.headers.get('content-type') || ''
    let uploadId = ''
    let index = -1
    let total = 0
    let mimeType = 'application/octet-stream'
    let bytes: Buffer
    let inviteToken = ''

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      uploadId = String(form.get('uploadId') ?? '').trim()
      index = Number(form.get('index'))
      total = Number(form.get('total'))
      mimeType = String(form.get('mimeType') || 'application/octet-stream')
      inviteToken = String(form.get('inviteToken') || '').trim()
      const chunk = form.get('chunk')
      if (!isUploadBlob(chunk)) return jsonError('Upload chunk is required.')
      bytes = Buffer.from(await chunk.arrayBuffer())
    } else {
      const body = (await request.json().catch(() => null)) as {
        uploadId?: string
        index?: number
        total?: number
        dataBase64?: string
        mimeType?: string
        inviteToken?: string
      } | null
      if (!body?.uploadId || body.dataBase64 == null) {
        return jsonError('uploadId and chunk data are required.')
      }
      uploadId = String(body.uploadId).trim()
      index = Number(body.index)
      total = Number(body.total)
      mimeType = String(body.mimeType || 'application/octet-stream')
      inviteToken = String(body.inviteToken || '').trim()
      bytes = Buffer.from(body.dataBase64, 'base64')
    }

    if (!(await canUploadChunk(inviteToken))) {
      return jsonError('Authentication required.', 401)
    }

    const saved = await saveUploadChunk({ uploadId, index, total, bytes, mimeType })
    return NextResponse.json({ success: true, ...saved })
  } catch (error) {
    return handleApiError(error)
  }
}
