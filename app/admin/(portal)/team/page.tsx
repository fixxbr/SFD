import { requireAdminPage } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { TeamManager } from '@/components/admin/team-manager'
import { can } from '@/lib/rbac'
import { PageHeader } from '@/components/admin/ui'

export const dynamic = 'force-dynamic'

export default async function TeamPage() {
  const user = await requireAdminPage('team:read')
  const users = await prisma.adminUser.findMany({
    orderBy: { fullName: 'asc' },
  })

  const canWrite = can(user.role, 'team:write')
  const canDelete = can(user.role, 'team:delete')

  return (
    <div className="space-y-5">
      <PageHeader
        title="Team"
        description="Lawyers and referral names are separate. Each feeds only its own candidate field."
        breadcrumb={[{ label: 'Admin', href: '/admin' }, { label: 'Team' }]}
        actions={
          canWrite ? (
            <a href="#add-member" className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0C2340] px-4 text-sm font-semibold text-white hover:bg-[#143a66]">
              + Add Team Member
            </a>
          ) : undefined
        }
      />

      <TeamManager
        users={users}
        canWrite={canWrite}
        canDelete={canDelete}
        actorRole={user.role}
        actorId={user.id}
      />
    </div>
  )
}
