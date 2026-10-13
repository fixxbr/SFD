import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'
import { SESSION_COOKIE } from '@/lib/brand'
import { handleApiError } from '@/lib/http'

export async function POST() {
  try {
    const jar = await cookies()
    const token = jar.get(SESSION_COOKIE)?.value
    await destroySession(token)
    jar.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return handleApiError(error)
  }
}
