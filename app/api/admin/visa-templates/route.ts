import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { handleApiError, jsonError, assertSameOrigin } from '@/lib/http'
import {
  addTemplateItem,
  bumpTemplateVersion,
  createVisaTypeDef,
  getActiveVisaTemplate,
  listVisaTypeDefs,
} from '@/lib/visa-templates'
import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'
import { can } from '@/lib/rbac'

export async function GET(request: Request) {
  try {
    await requirePermission('settings:read')
    const url = new URL(request.url)
    const code = url.searchParams.get('visaTypeCode')
    const visas = await listVisaTypeDefs()
    if (!code) {
      const templates = await prisma.visaDocumentTemplate.findMany({
        where: { isActive: true },
        orderBy: [{ visaTypeCode: 'asc' }, { version: 'desc' }],
        include: { _count: { select: { items: true } } },
      })
      return NextResponse.json({ visas, templates })
    }
    const template = await getActiveVisaTemplate(code)
    return NextResponse.json({ visas, template })
  } catch (error) {
    return handleApiError(error)
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request)
    const user = await requirePermission('settings:write')
    if (!can(user.role, 'settings:write')) return jsonError('Not allowed', 403)

    const body = (await request.json()) as {
      action?: string
      visaTypeCode?: string
      name?: string
      code?: string
      templateId?: string
      category?: string
      documentName?: string
      instructions?: string
      defaultRequired?: boolean
      allowsMultipleFiles?: boolean
      itemId?: string
      patch?: Record<string, unknown>
    }

    if (body.action === 'create-visa') {
      if (!body.code || !body.name) return jsonError('code and name required')
      const visa = await createVisaTypeDef({ code: body.code, name: body.name })
      const template = await prisma.visaDocumentTemplate.create({
        data: {
          id: randomUUID(),
          visaTypeCode: visa.code,
          templateName: `${visa.name} Documentation Package`,
          description: 'Admin-created visa template',
          version: 1,
          isActive: true,
        },
      })
      return NextResponse.json({ visa, template })
    }

    if (body.action === 'add-item') {
      if (!body.templateId || !body.documentName || !body.category) {
        return jsonError('templateId, category, and documentName required')
      }
      const item = await addTemplateItem({
        templateId: body.templateId,
        category: body.category,
        documentName: body.documentName,
        instructions: body.instructions,
        defaultRequired: body.defaultRequired,
        // Every document request supports multiple files — no single-file exceptions.
        allowsMultipleFiles: true,
      })
      return NextResponse.json({ item })
    }

    if (body.action === 'archive-item' && body.itemId) {
      const item = await prisma.visaDocumentTemplateItem.update({
        where: { id: body.itemId },
        data: { isActive: false },
      })
      return NextResponse.json({ item })
    }

    if (body.action === 'update-item' && body.itemId && body.patch) {
      const item = await prisma.visaDocumentTemplateItem.update({
        where: { id: body.itemId },
        data: {
          documentName: typeof body.patch.documentName === 'string' ? body.patch.documentName : undefined,
          category: typeof body.patch.category === 'string' ? body.patch.category : undefined,
          instructions: typeof body.patch.instructions === 'string' ? body.patch.instructions : undefined,
          defaultRequired: typeof body.patch.defaultRequired === 'boolean' ? body.patch.defaultRequired : undefined,
          // Multiple attachments are mandatory for every document request — never disable.
          allowsMultipleFiles: true,
          sortOrder: typeof body.patch.sortOrder === 'number' ? body.patch.sortOrder : undefined,
        },
      })
      return NextResponse.json({ item })
    }

    if (body.action === 'bump-version' && body.templateId) {
      const template = await bumpTemplateVersion(body.templateId)
      return NextResponse.json({ template })
    }

    return jsonError('Unknown action')
  } catch (error) {
    return handleApiError(error)
  }
}
