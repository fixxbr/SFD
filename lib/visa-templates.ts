import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'
import type { VisaType } from '@prisma/client'

export async function getActiveVisaTemplate(visaTypeCode: string) {
  return prisma.visaDocumentTemplate.findFirst({
    where: { visaTypeCode, isActive: true },
    orderBy: { version: 'desc' },
    include: {
      items: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      },
    },
  })
}

export async function listVisaTypeDefs() {
  return prisma.visaTypeDef.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
  })
}

export function caseVisaToCode(visaType: VisaType | string): string {
  return String(visaType)
}

export async function addTemplateItem(input: {
  templateId: string
  category: string
  documentName: string
  documentKey?: string
  instructions?: string
  defaultRequired?: boolean
  allowsMultipleFiles?: boolean
}) {
  const key =
    input.documentKey ||
    input.documentName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 48) ||
    `custom_${Date.now()}`

  const max = await prisma.visaDocumentTemplateItem.aggregate({
    where: { templateId: input.templateId },
    _max: { sortOrder: true },
  })

  return prisma.visaDocumentTemplateItem.create({
    data: {
      id: randomUUID(),
      templateId: input.templateId,
      category: input.category,
      documentKey: key,
      documentName: input.documentName.trim(),
      instructions: input.instructions?.trim() || null,
      defaultRequired: Boolean(input.defaultRequired),
      allowsMultipleFiles: true,
      sortOrder: (max._max.sortOrder ?? 0) + 10,
      isActive: true,
    },
  })
}

/** Create a new version of a template by cloning + applying mutation (versioning). */
export async function bumpTemplateVersion(templateId: string) {
  const current = await prisma.visaDocumentTemplate.findUnique({
    where: { id: templateId },
    include: { items: true },
  })
  if (!current) throw new Error('Template not found')

  await prisma.visaDocumentTemplate.update({
    where: { id: current.id },
    data: { isActive: false },
  })

  return prisma.visaDocumentTemplate.create({
    data: {
      id: randomUUID(),
      visaTypeCode: current.visaTypeCode,
      templateName: current.templateName,
      description: current.description,
      version: current.version + 1,
      isActive: true,
      items: {
        create: current.items
          .filter((i) => i.isActive)
          .map((i) => ({
            id: randomUUID(),
            category: i.category,
            documentKey: i.documentKey,
            documentName: i.documentName,
            description: i.description,
            instructions: i.instructions,
            defaultRequired: i.defaultRequired,
            allowsMultipleFiles: true,
            sortOrder: i.sortOrder,
            isActive: true,
          })),
      },
    },
    include: { items: { orderBy: { sortOrder: 'asc' } } },
  })
}

export async function createVisaTypeDef(input: { code: string; name: string }) {
  const code = input.code.trim().toUpperCase().replace(/[\s-]+/g, '_')
  return prisma.visaTypeDef.create({
    data: {
      id: randomUUID(),
      code,
      name: input.name.trim(),
      isActive: true,
    },
  })
}
