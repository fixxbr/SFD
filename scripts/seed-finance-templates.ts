import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { FINANCE_EMAIL_TEMPLATES } from '../lib/finance-email-templates'

const prisma = new PrismaClient()

async function main() {
  for (const [key, tmpl] of Object.entries(FINANCE_EMAIL_TEMPLATES)) {
    await prisma.emailTemplate.upsert({
      where: { templateKey: key },
      update: {
        name: tmpl.label,
        subjectTemplate: tmpl.subject,
        htmlTemplate: tmpl.html,
        active: true,
      },
      create: {
        id: randomUUID(),
        templateKey: key,
        name: tmpl.label,
        subjectTemplate: tmpl.subject,
        htmlTemplate: tmpl.html,
        version: 1,
        active: true,
      },
    })
    console.log(`Seeded finance email ${key}`)
  }

  await prisma.financeSetting.upsert({
    where: { key: 'reminder_defaults' },
    update: {
      value: {
        firstReminderDaysBefore: 3,
        secondReminderDaysBefore: 1,
        dueDateReminder: true,
        overdueDaysAfter: 3,
        secondOverdueDaysAfter: 7,
        autoSendEnabled: false,
      },
    },
    create: {
      id: randomUUID(),
      key: 'reminder_defaults',
      value: {
        firstReminderDaysBefore: 3,
        secondReminderDaysBefore: 1,
        dueDateReminder: true,
        overdueDaysAfter: 3,
        secondOverdueDaysAfter: 7,
        autoSendEnabled: false,
      },
    },
  })
  console.log('Seeded finance reminder settings (manual send default)')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
