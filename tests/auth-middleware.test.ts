import { describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'
import { SESSION_COOKIE } from '@/lib/brand'

describe('admin login and route protection', () => {
  it('allows /admin/login without a session', () => {
    const request = new NextRequest('http://localhost/admin/login')
    const response = proxy(request)
    expect(response.headers.get('location')).toBeNull()
  })

  it('redirects other admin routes to login when the session cookie is missing', () => {
    const request = new NextRequest('http://localhost/admin/candidates')
    const response = proxy(request)
    expect(response.headers.get('location')).toContain('/admin/login')
    expect(response.headers.get('location')).toContain('next=%2Fadmin%2Fcandidates')
  })

  it('lets requests with a session cookie continue so the server can validate it', () => {
    const request = new NextRequest('http://localhost/admin', {
      headers: { cookie: `${SESSION_COOKIE}=opaque-session-token` },
    })
    const response = proxy(request)
    expect(response.headers.get('location')).toBeNull()
  })

  it('protects /lawyer routes the same way as admin', () => {
    const blocked = proxy(new NextRequest('http://localhost/lawyer/candidates'))
    expect(blocked.headers.get('location')).toContain('/admin/login')
    expect(blocked.headers.get('location')).toContain('next=%2Flawyer%2Fcandidates')

    const ok = proxy(
      new NextRequest('http://localhost/lawyer/candidates', {
        headers: { cookie: `${SESSION_COOKIE}=opaque-session-token` },
      }),
    )
    expect(ok.headers.get('location')).toBeNull()
  })

  it('stubs leftover Vercel Analytics beacons instead of 404ing', () => {
    const script = proxy(new NextRequest('http://localhost/_vercel/insights/script.js'))
    expect(script.status).toBe(200)
    expect(script.headers.get('content-type')).toContain('javascript')

    const view = proxy(new NextRequest('http://localhost/_vercel/insights/view', { method: 'POST' }))
    expect(view.status).toBe(204)
  })
})
