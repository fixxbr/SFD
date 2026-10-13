import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/brand'

function stubVercelInsights(pathname: string) {
  if (pathname.endsWith('.js') || pathname.includes('script')) {
    return new NextResponse('/* vercel analytics disabled on this host */\n', {
      status: 200,
      headers: {
        'content-type': 'application/javascript; charset=utf-8',
        'cache-control': 'no-store',
      },
    })
  }
  return new NextResponse(null, { status: 204 })
}

function requireSession(request: NextRequest, pathname: string) {
  const session = request.cookies.get(SESSION_COOKIE)?.value
  if (session) return null
  const login = request.nextUrl.clone()
  login.pathname = '/admin/login'
  login.search = ''
  login.searchParams.set('next', pathname)
  return NextResponse.redirect(login)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith('/_vercel/insights')) {
    return stubVercelInsights(pathname)
  }

  if (pathname.startsWith('/lawyer')) {
    return requireSession(request, pathname) ?? NextResponse.next()
  }

  if (!pathname.startsWith('/admin')) return NextResponse.next()
  if (pathname === '/admin/login') return NextResponse.next()

  return requireSession(request, pathname) ?? NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/lawyer/:path*', '/_vercel/:path*'],
}
