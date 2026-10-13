import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import { ActivityType, logActivity } from '@/lib/activity'
import { assertCanAccessCandidate } from '@/lib/lawyer-access'

type Ctx = { params: Promise<{ candidateId: string }> }

export async function POST(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('notes:write')
    const { candidateId } = await ctx.params
    await assertCanAccessCandidate(user, candidateId)
    const body = (await request.json()) as {
      caseId?: string
      note?: string
      visibility?: 'INTERNAL' | 'CLIENT_VISIBLE'
      isPinned?: boolean
    }
    if (!body.caseId || !body.note?.trim()) return jsonError('Case and note are required.')
    const created = await prisma.caseNote.create({
      data: {
        candidateId,
        caseId: body.caseId,
        authorId: user.id,
        note: body.note.trim(),
        visibility: body.visibility === 'CLIENT_VISIBLE' ? 'CLIENT_VISIBLE' : 'INTERNAL',
        isPinned: Boolean(body.isPinned),
      },
      include: { author: { select: { fullName: true } } },
    })
    await logActivity({
      candidateId,
      caseId: body.caseId,
      type: ActivityType.NOTE_ADDED,
      message: body.isPinned ? 'Pinned note added' : 'Internal note added',
      actorType: 'ADMIN',
      actorId: user.id,
    })
    return NextResponse.json({ note: created })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function PATCH(request: Request, ctx: Ctx) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('notes:write')
    const { candidateId } = await ctx.params
    await assertCanAccessCandidate(user, candidateId)
    const body = (await request.json()) as { noteId?: string; isPinned?: boolean; archive?: boolean }
    if (!body.noteId) return jsonError('noteId is required.')
    const note = await prisma.caseNote.findFirst({ where: { id: body.noteId, candidateId } })
    if (!note) return jsonError('Note not found', 404)
    const updated = await prisma.caseNote.update({
      where: { id: note.id },
      data: {
        isPinned: typeof body.isPinned === 'boolean' ? body.isPinned : undefined,
        archivedAt: body.archive ? new Date() : undefined,
      },
      include: { author: { select: { fullName: true } } },
    })
    return NextResponse.json({ note: updated })
  } catch (error) {
    return handleApiError(error)
  }
}
