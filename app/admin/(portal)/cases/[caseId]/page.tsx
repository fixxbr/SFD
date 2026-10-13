import { redirect } from 'next/navigation'
import { requireAdminPage } from '@/lib/auth'
import { prisma } from '@/lib/db'

export default async function CaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  await requireAdminPage('cases:read')
  const { caseId } = await params
  const record = await prisma.case.findUnique({ where: { id: caseId } })
  if (!record) redirect('/admin/cases')
  redirect(`/admin/candidates/${record.candidateId}#progress`)
}
