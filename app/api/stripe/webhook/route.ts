import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/** Stripe is no longer used for Afterstem payments. */
export async function POST() {
  return NextResponse.json(
    { error: 'Stripe webhooks are disabled. Afterstem uses manual payment recording only.' },
    { status: 410 },
  )
}
