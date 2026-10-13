import { NextResponse } from 'next/server'
import { requirePermission } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { handleApiError } from '@/lib/http'

export async function GET() {
  try {
    await requirePermission('payments:read')
    const payments = await prisma.payment.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        candidate: { select: { id: true, fullLegalName: true, email: true } },
        case: { select: { caseNumber: true, visaType: true } },
      },
    })
    return NextResponse.json({ payments })
  } catch (error) {
    return handleApiError(error)
  }
}
