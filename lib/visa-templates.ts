import { prisma } from '@/lib/db'
import { randomUUID } from 'crypto'
import type { VisaType } from '@prisma/client'
import { SEED_VISA_TEMPLATES } from '@/lib/visa-template-seed-data'

export type ResolvedTemplateItem = {
  id: string
  category: string
  documentKey: string
  documentName: string
  instructions: string | null
  defaultRequired: boolean
  allowsMultipleFiles: boolean
  sortOrder: number
}

/** Seed rows have no DB id; callers must not store this as a templateItemId. */
export const SEED_TEMPLATE_ITEM_PREFIX = 'seed:'

export function seedTemplateFor(visaTypeCode: string) {
  const seed = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === visaTypeCode) ??
    SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'OTHER')
  if (!seed) return null
  return {
    id: null as string | null,
    visaTypeCode,
    templateName: seed.name,
    version: 0,
    items: seed.items.map<ResolvedTemplateItem>((item) => ({
      id: `${SEED_TEMPLATE_ITEM_PREFIX}${item.documentKey}`,
      category: item.category,
      documentKey: item.documentKey,
      documentName: item.documentName,
      instructions: item.instructions ?? null,
      defaultRequired: Boolean(item.defaultRequired),
      allowsMultipleFiles: true,
      sortOrder: item.sortOrder,
    })),
  }
}

/**
 * The one visa document list used by Overview, Documents and Request Documents:
 * the active admin-edited template, or the built-in starting list if none exists yet.
 */
export async function resolveVisaTemplate(visaType: VisaType | string) {
  const code = String(visaType)
  const active = await getActiveVisaTemplate(code)
  if (active && active.items.length) {
    return {
      id: active.id as string | null,
      visaTypeCode: code,
      templateName: active.templateName,
      version: active.version,
      items: active.items.map<ResolvedTemplateItem>((item) => ({
        id: item.id,
        category: item.category,
        documentKey: item.documentKey,
        documentName: item.documentName,
        instructions: item.instructions,
        defaultRequired: item.defaultRequired,
        allowsMultipleFiles: item.allowsMultipleFiles,
        sortOrder: item.sortOrder,
      })),
    }
  }
  return seedTemplateFor(code)
}

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
