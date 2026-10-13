import { findOrCreateCandidate, ensureCase, recordAssessment } from '@/lib/candidates'
import { parseVisaType } from '@/lib/visa'
import { jsonError } from '@/lib/http'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>
    const name = typeof body.name === 'string' ? body.name : ''
    const email = typeof body.email === 'string' ? body.email : ''
    const visa = typeof body.visa === 'string' ? body.visa : ''
    const message = typeof body.message === 'string' ? body.message : ''
    const phone = typeof body.phone === 'string' ? body.phone : ''
    const currentStatus = typeof body.currentStatus === 'string' ? body.currentStatus : ''

    if (name.trim().length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return jsonError('Please provide a valid name and email.')
    }

    const { candidate } = await findOrCreateCandidate({
      fullLegalName: name,
      email,
      phone: phone || null,
      currentImmigrationStatus: currentStatus || null,
      source: 'website_assessment',
    })

    await recordAssessment({
      candidateId: candidate.id,
      submittedData: {
        name: name.trim(),
        email: email.trim(),
        visa,
        message: message.slice(0, 4000),
        phone: phone.trim(),
        currentStatus: currentStatus.trim(),
      },
      visaRecommendation: visa || null,
      result: 'RECEIVED',
    })

    await ensureCase({
      candidateId: candidate.id,
      visaType: parseVisaType(visa),
      status: 'ASSESSMENT',
    })

    return NextResponse.json({ ok: true, candidateId: candidate.id })
  } catch (error) {
    console.error('[assessment]', error instanceof Error ? error.message : 'failed')
    return NextResponse.json(
      { error: 'Unable to save your submission right now. Please try again or email hello@afterstem.ai.' },
      { status: 500 },
    )
  }
}
