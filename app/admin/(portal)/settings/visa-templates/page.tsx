import { requireAdminPage } from '@/lib/auth'
import { VisaTemplateManager } from '@/components/admin/visa-template-manager'

export const dynamic = 'force-dynamic'

export default async function VisaTemplatesSettingsPage() {
  await requireAdminPage('settings:read')
  return <VisaTemplateManager />
}
