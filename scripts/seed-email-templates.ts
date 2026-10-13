import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import { DOC_REQUEST_TEMPLATES } from '../lib/document-request-templates'
import { EMAIL_TEMPLATES } from '../lib/email-templates'
import { BRAND_NAME } from '../lib/brand'

const prisma = new PrismaClient()

function wrapPlainAsHtml(body: string) {
  const escaped = body
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('\n', '<br>')
  return `<!doctype html><html><body style="margin:0;padding:0;background:#edf3f6;font-family:Arial,Helvetica,sans-serif;color:#17324d;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf3f6;"><tr><td align="center" style="padding:34px 14px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#fff;border-radius:22px;overflow:hidden;">
<tr><td align="center" style="padding:30px 30px 16px;"><img src="https://www.afterstem.ai/afterstem-full.png" alt="Afterstem" width="230" style="display:block;width:230px;max-width:76%;height:auto;border:0;"></td></tr>
<tr><td style="padding:18px 42px 30px;font-size:15px;line-height:26px;color:#17324d;">${escaped}</td></tr>
<tr><td style="background:#f8fafc;padding:24px 38px;text-align:center;border-top:1px solid #e6edf2;">
<div style="font-size:11px;line-height:18px;color:#94a3af;">${BRAND_NAME} is a technology and consulting platform, not a law firm. Legal advice and immigration legal services are provided by licensed immigration attorneys where applicable.</div>
<div style="font-size:11px;line-height:18px;color:#a6b2bc;margin-top:9px;">© 2026 ${BRAND_NAME}. All rights reserved.</div>
</td></tr>
</table></td></tr></table></body></html>`
}

async function upsertTemplate(input: {
  templateKey: string
  name: string
  subjectTemplate: string
  htmlTemplate: string
}) {
  await prisma.emailTemplate.upsert({
    where: { templateKey: input.templateKey },
    update: {
      name: input.name,
      subjectTemplate: input.subjectTemplate,
      htmlTemplate: input.htmlTemplate,
      active: true,
    },
    create: {
      id: randomUUID(),
      templateKey: input.templateKey,
      name: input.name,
      subjectTemplate: input.subjectTemplate,
      htmlTemplate: input.htmlTemplate,
      version: 1,
      active: true,
    },
  })
  console.log(`Seeded email template ${input.templateKey}`)
}

async function main() {
  await upsertTemplate({
    templateKey: 'FULL_PACKAGE',
    name: DOC_REQUEST_TEMPLATES.FULL_O1.label,
    subjectTemplate: 'Afterstem | {{Visa Type}} Documentation Request – {{Candidate ID}}',
    htmlTemplate: DOC_REQUEST_TEMPLATES.FULL_O1.html,
  })
  await upsertTemplate({
    templateKey: 'CUSTOM_DOCUMENT_REQUEST',
    name: DOC_REQUEST_TEMPLATES.CUSTOM.label,
    subjectTemplate: 'Afterstem | Additional Documents Required – {{Candidate ID}}',
    htmlTemplate: DOC_REQUEST_TEMPLATES.CUSTOM.html,
  })
  await upsertTemplate({
    templateKey: 'SINGLE_ADDITIONAL_DOCUMENT',
    name: DOC_REQUEST_TEMPLATES.SINGLE.label,
    subjectTemplate: 'Afterstem | Document Requested – {{Candidate ID}}',
    htmlTemplate: DOC_REQUEST_TEMPLATES.SINGLE.html,
  })

  for (const tmpl of EMAIL_TEMPLATES) {
    await upsertTemplate({
      templateKey: tmpl.key,
      name: tmpl.label,
      subjectTemplate: tmpl.subject,
      htmlTemplate: wrapPlainAsHtml(tmpl.body),
    })
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
