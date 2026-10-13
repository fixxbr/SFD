import { requireAdminPage } from '@/lib/auth'
import { EMAIL_TEMPLATES } from '@/lib/email-templates'
import { renderCatalogEmail } from '@/lib/email/catalog-html'
import { PageHeader } from '@/components/admin/ui'
import { EmailTemplatePreview } from '@/components/admin/email-template-preview'

export const dynamic = 'force-dynamic'

export default async function EmailTemplatesPage() {
  await requireAdminPage('communications:read')

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <PageHeader
        title="Email Templates"
        description="Official Afterstem catalog. Staff select these from Candidate → Emails."
        breadcrumb={[
          { label: 'Admin', href: '/admin' },
          { label: 'Settings', href: '/admin/settings' },
          { label: 'Email Templates' },
        ]}
      />
      {EMAIL_TEMPLATES.map((t) => {
        const rendered = renderCatalogEmail({
          templateKey: t.key,
          fullLegalName: 'Thanuja Narameta',
          candidateNumber: 'ASM-1001',
          email: 'thanuja@email.com',
          visaType: 'O1A',
          caseNumber: 'O1A-2026-000041',
          quotedCents: 2000000,
          paymentCents: 500000,
          paymentNumber: 2,
          currency: 'usd',
          documentLink: 'https://afterstem.ai/documents',
          paymentLink: 'https://checkout.stripe.com/example',
          missingDocumentLabels:
            t.key === 'MISSING_DOCUMENT_REMINDER' ? ['Passport', 'Resume / CV', 'I-94'] : undefined,
        })
        return (
          <EmailTemplatePreview
            key={t.key}
            title={t.key}
            html={rendered.html}
            summary={
              <>
                {t.label} <span className="text-xs font-normal text-[#5B6B7C]">({rendered.version})</span>
              </>
            }
          >
            <p className="mt-2 text-sm text-[#5B6B7C]">{rendered.subject}</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-[#5B6B7C]">Gmail plain-text preview</summary>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded bg-[#F3F5F7] p-3 text-xs">
                {rendered.plainTextForGmail}
              </pre>
            </details>
          </EmailTemplatePreview>
        )
      })}
    </div>
  )
}
