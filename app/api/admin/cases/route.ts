import { NextResponse } from 'next/server'
import { Prisma, VisaType, CaseStatus } from '@prisma/client'
import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError } from '@/lib/http'
import { isLawyerUser } from '@/lib/lawyer-access'

export async function GET(request: Request) {
  try {
    const user = await requirePermission('cases:read')
    const url = new URL(request.url)
    const q = url.searchParams.get('q')?.trim() ?? ''
    const status = url.searchParams.get('status')
    const visaType = url.searchParams.get('visaType')
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1))
    const take = 25

    const where: Prisma.CaseWhereInput = { lifecycle: 'ACTIVE' }
    // Lawyers only see cases currently assigned to them.
    if (isLawyerUser(user)) {
      where.assignedAttorneyId = user.id
    }
    if (q) {
      where.OR = [
        { caseNumber: { contains: q, mode: 'insensitive' } },
        { candidate: { fullLegalName: { contains: q, mode: 'insensitive' } } },
        { candidate: { email: { contains: q, mode: 'insensitive' } } },
      ]
    }
    if (status) where.status = status as CaseStatus
    if (visaType) where.visaType = visaType as VisaType

    const [total, items] = await prisma.$transaction([
      prisma.case.count({ where }),
      prisma.case.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * take,
        take,
        include: {
          candidate: { select: { id: true, fullLegalName: true, email: true } },
          assignedCaseManager: { select: { fullName: true } },
          assignedAttorney: { select: { fullName: true } },
          payments: true,
          onboardingSubmissions: { orderBy: { updatedAt: 'desc' }, take: 1 },
        },
      }),
    ])

    return NextResponse.json({ items, total, page, pageSize: take })
  } catch (error) {
    return handleApiError(error)
  }
}
