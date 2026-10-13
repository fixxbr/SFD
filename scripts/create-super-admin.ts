import { PrismaClient, AdminRole } from '@prisma/client'
import bcrypt from 'bcryptjs'

async function main() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase()
  const password = process.env.SUPER_ADMIN_PASSWORD ?? ''
  const fullName = process.env.SUPER_ADMIN_NAME ?? 'Platform Admin'
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  if (!email || !password) throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required')
  if (password.length < 8) throw new Error('SUPER_ADMIN_PASSWORD must be at least 8 characters')

  const prisma = new PrismaClient()
  const passwordHash = await bcrypt.hash(password, 12)
  const user = await prisma.adminUser.upsert({
    where: { email },
    update: { fullName, passwordHash, role: AdminRole.SUPER_ADMIN, status: 'ACTIVE', authProvider: 'password' },
    create: { fullName, email, passwordHash, role: AdminRole.SUPER_ADMIN, authProvider: 'password' },
  })
  console.log(`Super admin ready: ${user.email} (${user.id})`)
  await prisma.$disconnect()
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
