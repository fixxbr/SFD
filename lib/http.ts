import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { AssignLawyerError } from '@/lib/assign-lawyer'
import { AuthError } from '@/lib/auth'
import { BRAND_DOMAIN } from '@/lib/brand'
import { RbacError } from '@/lib/rbac'
import { StorageError } from '@/lib/storage'
import { LinkValidationError } from '@/lib/link-request-items'

const LEGACY_BRAND_DOMAIN = 'lawfirm.ai'

/** Canonical production origin (www). Kept as NETLIFY_APP_ORIGIN for existing imports. */
export const NETLIFY_APP_ORIGIN = `https://www.${BRAND_DOMAIN}`
export const PRODUCTION_APP_ORIGIN = NETLIFY_APP_ORIGIN

/** Secure cookies on HTTPS (including Netlify behind x-forwarded-proto). */
export function cookieSecureFromRequest(request?: Request | null): boolean {
  if (process.env.NODE_ENV === 'production') return true
  const proto = request?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  return proto === 'https'
}

export function jsonError(
  message: string,
  status = 400,
  extra?: { code?: string; correlationId?: string; clientItemId?: string | null; questionKey?: string },
) {
  return NextResponse.json(
    {
      error: message,
      ...(extra?.code ? { code: extra.code } : {}),
      ...(extra?.correlationId ? { correlationId: extra.correlationId } : {}),
      ...(extra?.clientItemId ? { clientItemId: extra.clientItemId } : {}),
      ...(extra?.questionKey ? { questionKey: extra.questionKey } : {}),
    },
    { status },
  )
}

export function handleApiError(error: unknown) {
  if (error instanceof AuthError) return jsonError(error.message, error.status)
  if (error instanceof RbacError) return jsonError('You do not have permission to do that.', 403)
  if (error instanceof AssignLawyerError) return jsonError(error.message, error.status)
  if (error instanceof LinkValidationError) return jsonError(error.message, 400)
  if (error instanceof StorageError) {
    console.error('[storage-api]', error.message)
    return jsonError(error.message, error.status || 400)
  }
  // Bad input from the caller is a 4xx, not a server error.
  if (error instanceof SyntaxError) return jsonError('The request body is not valid JSON.', 400)
  if (error instanceof Prisma.PrismaClientValidationError) return jsonError('Some of the submitted values are not valid.', 400)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2023: malformed id (e.g. not a UUID) — nothing can match it.
    if (error.code === 'P2023' || error.code === 'P2025') return jsonError('Not found.', 404)
    if (error.code === 'P2003') return jsonError('A linked record does not exist.', 400)
    if (error.code === 'P2002') return jsonError('That record already exists.', 409)
  }
  if (error instanceof Error && /^(Candidate|Case|Document|Payment|File|Link) not found\.?$/.test(error.message)) {
    return jsonError(error.message, 404)
  }
  if (error instanceof TypeError && error.message.includes('Content-Type was not one of')) {
    return jsonError('Send this request as a file upload (multipart/form-data).', 415)
  }
  if (error instanceof Error) {
    const known = [
      'That file type is not allowed',
      'Unsupported file type',
      'Empty files are not allowed',
      'exceeds the maximum',
      'File exceeds',
      'DOCUMENT_TOO_LARGE',
      'A file is required',
      'Select at least one document',
      'Document not found',
      'Private object storage is not configured',
      'Upload failed because storage',
      'Upload incomplete',
      'Invalid upload chunk',
      'Invalid chunked upload',
      'Upload chunk is empty',
      'Enter at least one URL',
      'Enter a valid URL',
      'Only http:// and https://',
      'Please submit a single URL',
      'A URL is required',
      'A URL cannot contain spaces',
      'This looks like a file name',
      'Links cannot include',
      'Enter a complete URL',
      'This link is already saved',
      'Links must be',
      'Add a description for each file',
      'Description must be at least',
      'Description must be 1000',
    ]
    if (known.some((k) => error.message.includes(k))) {
      console.error('[api]', error.message)
      const status = error.message.includes('DOCUMENT_TOO_LARGE') ? 413 : 400
      return jsonError(error.message, status)
    }
  }
  console.error('[admin-api]', error instanceof Error ? error.message : 'unknown error')
  return jsonError('Something went wrong on the server. Please try again.', 500)
}

function stripSlash(url: string) {
  return url.trim().replace(/\/$/, '')
}

function isLocalHost(urlOrHost: string) {
  return /localhost|127\.0\.0\.1/i.test(urlOrHost)
}

function hostnameOf(urlOrHost: string): string {
  const raw = urlOrHost.trim()
  try {
    if (raw.includes('://')) return new URL(raw).hostname.toLowerCase()
  } catch {
    /* fall through */
  }
  return raw.split(':')[0]?.toLowerCase() || ''
}

/** Canonical public brand origin (www). */
export function preferredBrandOrigin(): string {
  return `https://www.${BRAND_DOMAIN}`
}

export function isBrandHost(urlOrHost: string): boolean {
  const host = hostnameOf(urlOrHost)
  return host === BRAND_DOMAIN || host === `www.${BRAND_DOMAIN}`
}

function isLegacyBrandHost(urlOrHost: string): boolean {
  const host = hostnameOf(urlOrHost)
  return host === LEGACY_BRAND_DOMAIN || host === `www.${LEGACY_BRAND_DOMAIN}`
}

export function isNetlifyAppHost(urlOrHost: string): boolean {
  return /\.netlify\.app$/i.test(hostnameOf(urlOrHost))
}

/** True once DNS for afterstem.ai points at this full app (set in Netlify env). */
export function brandDomainServesApp(): boolean {
  return process.env.BRAND_DOMAIN_SERVES_APP === 'true'
}

/** Prefer www.afterstem.ai over apex for cookies + shared links. */
export function canonicalizePublicOrigin(url: string): string {
  try {
    const parsed = new URL(url)
    if (parsed.hostname.toLowerCase() === BRAND_DOMAIN) {
      parsed.hostname = `www.${BRAND_DOMAIN}`
    }
    return stripSlash(parsed.origin)
  } catch {
    return stripSlash(url)
  }
}

function canonicalizeKnownBrandOrigin(url: string): string {
  if (isLegacyBrandHost(url)) return preferredBrandOrigin()
  return isBrandHost(url) ? canonicalizePublicOrigin(url) : url
}

/** www and apex afterstem.ai are treated as the same site for CSRF checks. */
export function hostsEquivalent(a: string, b: string): boolean {
  const ha = hostnameOf(a)
  const hb = hostnameOf(b)
  if (!ha || !hb) return false
  if (ha === hb) return true
  const stripWww = (h: string) => h.replace(/^www\./, '')
  if (stripWww(ha) === stripWww(hb)) return true
  // Netlify deploy previews: 123abc--site.netlify.app ↔ site.netlify.app
  const netlifySite = (h: string) => {
    const m = h.toLowerCase().match(/^(?:[a-z0-9]+--)?([a-z0-9-]+)\.netlify\.app$/)
    return m?.[1] || null
  }
  const sa = netlifySite(ha)
  const sb = netlifySite(hb)
  if (sa && sb && sa === sb) return true
  return false
}

export function assertSameOrigin(request: Request) {
  if (request.method === 'GET' || request.method === 'HEAD') return
  const origin = request.headers.get('origin')
  if (!origin) return
  const host =
    request.headers.get('x-forwarded-host')?.split(',')[0]?.trim() ||
    request.headers.get('host') ||
    ''
  try {
    const originHost = new URL(origin).host
    if (hostsEquivalent(originHost, host)) return
    // During domain cutover, allow brand ↔ Netlify app host when brand is live.
    if (brandDomainServesApp()) {
      if (
        (isBrandHost(originHost) && isNetlifyAppHost(host)) ||
        (isNetlifyAppHost(originHost) && isBrandHost(host))
      ) {
        return
      }
    }
    throw new AuthError('Invalid request origin', 403)
  } catch (error) {
    if (error instanceof AuthError) throw error
    throw new AuthError('Invalid request origin', 403)
  }
}

/** Netlify sets URL / DEPLOY_PRIME_URL to the live site (custom domain when configured). */
function platformUrl(): string | null {
  const candidates = [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, '')}` : '',
  ]
  for (const raw of candidates) {
    const value = stripSlash(raw || '')
    if (!value || isLocalHost(value)) continue
    return value.startsWith('http') ? value : `https://${value}`
  }
  return null
}

/**
 * Canonical public origin for candidate-facing links (document uploads, onboarding, email).
 *
 * Production default is https://www.afterstem.ai.
 * Only when BRAND_DOMAIN_SERVES_APP=false (pre-cutover) do we prefer the Netlify alias host.
 */
export function appUrl(): string {
  const fromApp = stripSlash(process.env.APP_URL || '')
  const fromPublic = stripSlash(process.env.NEXT_PUBLIC_APP_URL || '')
  const configured = fromApp || fromPublic
  const platform = platformUrl()
  const brandDeferred =
    process.env.BRAND_DOMAIN_SERVES_APP === 'false' && Boolean(platform && isNetlifyAppHost(platform))

  if (configured) {
    if (isLocalHost(configured)) {
      if (process.env.NODE_ENV === 'production') {
        if (platform) {
          return canonicalizeKnownBrandOrigin(platform)
        }
        return preferredBrandOrigin()
      }
      return configured
    }

    if (isBrandHost(configured)) {
      // Explicit pre-cutover: mint links on the live Netlify alias until DNS flips.
      if (brandDeferred && platform) return platform
      return canonicalizePublicOrigin(configured)
    }

    if (isLegacyBrandHost(configured)) {
      if (brandDeferred && platform) return platform
      return preferredBrandOrigin()
    }

    return stripSlash(configured)
  }

  if (brandDeferred && platform) return platform

  if (platform) {
    return canonicalizeKnownBrandOrigin(platform)
  }

  if (process.env.NODE_ENV === 'production') {
    return preferredBrandOrigin()
  }
  return 'http://127.0.0.1:3000'
}

/**
 * Prefer the browser Origin / Host of the admin request when it is a real public host,
 * so upload links match the site the admin is actually using. Falls back to appUrl().
 * When the brand domain serves this app, Netlify alias requests still mint www.afterstem.ai links.
 */
export function publicAppUrlFromRequest(request?: Request | null): string {
  if (request) {
    const originHeader = (request.headers.get('origin') || '').trim()
    if (originHeader && !isLocalHost(originHeader)) {
      if (brandDomainServesApp() && isNetlifyAppHost(originHeader)) {
        return preferredBrandOrigin()
      }
      if (isLegacyBrandHost(originHeader)) return preferredBrandOrigin()
      return isBrandHost(originHeader) ? canonicalizePublicOrigin(originHeader) : stripSlash(originHeader)
    }
    const host = (request.headers.get('x-forwarded-host') || request.headers.get('host') || '')
      .split(',')[0]
      ?.trim()
    const proto = (request.headers.get('x-forwarded-proto') || 'https').split(',')[0]?.trim() || 'https'
    if (host && !isLocalHost(host)) {
      if (brandDomainServesApp() && isNetlifyAppHost(host)) {
        return preferredBrandOrigin()
      }
      if (isLegacyBrandHost(host)) return preferredBrandOrigin()
      const origin = `${proto}://${host}`
      return isBrandHost(origin) ? canonicalizePublicOrigin(origin) : stripSlash(origin)
    }
  }
  return appUrl()
}
