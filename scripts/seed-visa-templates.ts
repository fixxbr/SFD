import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { SEED_VISA_TEMPLATES, SEED_VISA_TYPES } from '../lib/visa-template-seed-data'

const prisma = new PrismaClient()

async function main() {
  for (const visa of SEED_VISA_TYPES) {
    await prisma.visaTypeDef.upsert({
      where: { code: visa.code },
      update: { name: visa.name, isActive: true },
      create: { id: randomUUID(), code: visa.code, name: visa.name, isActive: true },
    })
  }

  for (const pack of SEED_VISA_TEMPLATES) {
    const existing = await prisma.visaDocumentTemplate.findFirst({
      where: { visaTypeCode: pack.visaTypeCode, isActive: true },
      orderBy: { version: 'desc' },
    })
    if (existing) {
      console.log(`Skip active template ${pack.visaTypeCode} v${existing.version}`)
      continue
    }
    const template = await prisma.visaDocumentTemplate.create({
      data: {
        id: randomUUID(),
        visaTypeCode: pack.visaTypeCode,
        templateName: pack.name,
        description: pack.description,
        version: 1,
        isActive: true,
        items: {
          create: pack.items.map((item) => ({
            id: randomUUID(),
            category: item.category,
            documentKey: item.documentKey,
            documentName: item.documentName,
            description: item.instructions ?? null,
            instructions: item.instructions ?? null,
            defaultRequired: Boolean(item.defaultRequired),
            allowsMultipleFiles: true,
            sortOrder: item.sortOrder,
            isActive: true,
          })),
        },
      },
    })
    console.log(`Seeded ${template.visaTypeCode} v${template.version} (${pack.items.length} items)`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
