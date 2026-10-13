import { NextResponse } from 'next/server'
import { requirePermission, requireUser } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { assertCanAccessDocument } from '@/lib/lawyer-access'
import { ActivityType, logActivity } from '@/lib/activity'
import { can } from '@/lib/rbac'
import { formatRole } from '@/lib/role-labels'

type Ctx = { params: Promise<{ documentId: string }> }

function serializeComment(row: {
  id: string
  documentId: string
  candidateId: string
  body: string
  createdAt: Date
  updatedAt: Date
  author: { id: string; fullName: string; role: string }
}) {
  return {
    id: row.id,
    documentId: row.documentId,
    candidateId: row.candidateId,
    authorId: row.author.id,
    authorName: row.author.fullName,
    authorRole: row.author.role,
    authorRoleLabel: formatRole(row.author.role),
    comment: row.body,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function GET(_request: Request, ctx: Ctx) {
  try {
    const user = await requireUser()
    if (!can(user.role, 'documents:read') && !can(user.role, 'notes:read')) {
      return jsonError('You do not have permission to view comments.', 403)
    }
    const { documentId } = await ctx.params
    await assertCanAccessDocument(user, documentId)

    const comments = await prisma.documentComment.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
      },
    })

    return NextResponse.json({
      comments: comments.map(serializeComment),
      count: comments.length,
    })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('notes:write')
    const { documentId } = await ctx.params
    const access = await assertCanAccessDocument(user, documentId)

    const body = (await request.json()) as { comment?: string }
    const text = body.comment?.trim() || ''
    if (!text) return jsonError('Comment text is required.')
    if (text.length > 5000) return jsonError('Comment must be 5000 characters or fewer.')

    const created = await prisma.documentComment.create({
      data: {
        documentId,
        candidateId: access.candidateId,
        authorId: user.id,
        body: text,
      },
      include: {
        author: { select: { id: true, fullName: true, role: true } },
      },
    })

    const document = await prisma.caseDocument.findUnique({
      where: { id: documentId },
      select: { originalFilename: true, displayName: true, caseId: true },
    })

    await logActivity({
      candidateId: access.candidateId,
      caseId: access.caseId || document?.caseId,
      type: ActivityType.DOCUMENT_COMMENT_ADDED,
      message: `Comment added on ${document?.displayName || document?.originalFilename || 'document'}`,
      actorType: 'ADMIN',
      actorId: user.id,
      metadata: { documentId, commentId: created.id },
    })

    return NextResponse.json({ comment: serializeComment(created) }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
