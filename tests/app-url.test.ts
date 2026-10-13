import { afterEach, describe, expect, it, vi } from 'vitest'

describe('appUrl environment handling', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('prefers APP_URL over NEXT_PUBLIC_APP_URL', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('APP_URL', 'http://localhost:3000')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3003')
    const { appUrl } = await import('@/lib/http')
    expect(appUrl()).toBe('http://localhost:3000')
  })

  it('never returns localhost in production even if misconfigured', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:3003')
    vi.stubEnv('APP_URL', '')
    vi.stubEnv('VERCEL_URL', '')
    vi.stubEnv('URL', '')
    vi.stubEnv('DEPLOY_PRIME_URL', '')
    vi.stubEnv('DEPLOY_URL', '')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', '')
    const { appUrl, NETLIFY_APP_ORIGIN } = await import('@/lib/http')
    expect(appUrl()).toBe(NETLIFY_APP_ORIGIN)
    expect(appUrl()).not.toMatch(/localhost/)
  })

  it('defaults to live Netlify app in production without config', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('APP_URL', '')
    vi.stubEnv('VERCEL_URL', '')
    vi.stubEnv('URL', '')
    vi.stubEnv('DEPLOY_PRIME_URL', '')
    vi.stubEnv('DEPLOY_URL', '')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', '')
    const { appUrl, NETLIFY_APP_ORIGIN } = await import('@/lib/http')
    expect(appUrl()).toBe(NETLIFY_APP_ORIGIN)
  })

  it('prefers Netlify URL over brand domain', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', '')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('URL', 'https://afterstem-ai.netlify.app')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', '')
    const { appUrl } = await import('@/lib/http')
    expect(appUrl()).toBe('https://afterstem-ai.netlify.app')
  })

  it('rewrites a legacy platform URL to the Afterstem domain', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', '')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('URL', 'https://www.lawfirm.ai')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', '')
    const { appUrl } = await import('@/lib/http')
    expect(appUrl()).toBe('https://www.afterstem.ai')
  })

  it('rewrites brand APP_URL to Netlify only when cutover is explicitly deferred', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://www.afterstem.ai')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('URL', 'https://afterstem.netlify.app')
    vi.stubEnv('DEPLOY_PRIME_URL', '')
    vi.stubEnv('DEPLOY_URL', '')
    vi.stubEnv('VERCEL_URL', '')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', 'false')
    const { appUrl } = await import('@/lib/http')
    expect(appUrl()).toBe('https://afterstem.netlify.app')
  })

  it('keeps www brand APP_URL even if Netlify alias is still in URL env', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://www.afterstem.ai')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('URL', 'https://afterstem.netlify.app')
    vi.stubEnv('DEPLOY_PRIME_URL', '')
    vi.stubEnv('DEPLOY_URL', '')
    vi.stubEnv('VERCEL_URL', '')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', '')
    const { appUrl } = await import('@/lib/http')
    expect(appUrl()).toBe('https://www.afterstem.ai')
  })

  it('uses www.afterstem.ai once brand DNS serves this app', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://www.afterstem.ai')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://www.afterstem.ai')
    vi.stubEnv('URL', 'https://www.afterstem.ai')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', 'true')
    const { appUrl } = await import('@/lib/http')
    expect(appUrl()).toBe('https://www.afterstem.ai')
  })

  it('rewrites a legacy lawfirm APP_URL to the Afterstem domain', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://www.lawfirm.ai')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('URL', '')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', 'true')
    const { appUrl } = await import('@/lib/http')
    expect(appUrl()).toBe('https://www.afterstem.ai')
  })

  it('canonicalizes apex brand APP_URL to www when brand serves app', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://afterstem.ai')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    vi.stubEnv('URL', 'https://afterstem.ai')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', 'true')
    const { appUrl } = await import('@/lib/http')
    expect(appUrl()).toBe('https://www.afterstem.ai')
  })

  it('publicAppUrlFromRequest upgrades netlify host to brand after cutover', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://www.afterstem.ai')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', 'true')
    const { publicAppUrlFromRequest } = await import('@/lib/http')
    const req = new Request('https://afterstem.netlify.app/api/admin/document-requests', {
      headers: { origin: 'https://afterstem.netlify.app' },
    })
    expect(publicAppUrlFromRequest(req)).toBe('https://www.afterstem.ai')
  })

  it('rewrites a legacy lawfirm request host to the Afterstem domain', async () => {
    const { publicAppUrlFromRequest } = await import('@/lib/http')
    const req = new Request('https://www.lawfirm.ai/api/admin/document-requests', {
      headers: { origin: 'https://www.lawfirm.ai' },
    })
    expect(publicAppUrlFromRequest(req)).toBe('https://www.afterstem.ai')
  })

  it('treats www and apex as equivalent origins', async () => {
    const { assertSameOrigin, hostsEquivalent } = await import('@/lib/http')
    expect(hostsEquivalent('www.afterstem.ai', 'afterstem.ai')).toBe(true)
    const req = new Request('https://www.afterstem.ai/api/documents', {
      method: 'POST',
      headers: {
        origin: 'https://afterstem.ai',
        host: 'www.afterstem.ai',
      },
    })
    expect(() => assertSameOrigin(req)).not.toThrow()
  })
})

describe('candidate upload URL helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('rebuilds domain from stored localhost URL using current APP_URL', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('APP_URL', 'https://afterstem.netlify.app')
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '')
    const { resolveCandidateUploadUrl, extractDocumentUploadToken } = await import(
      '@/lib/candidate-upload-url'
    )
    const token = 'kg2S-7JmmTWAE5tN8YU-BjWZJsvgFEUITgqLSHaGjKI'
    expect(extractDocumentUploadToken(`http://localhost:3003/documents/r/${token}`)).toBe(token)
    expect(resolveCandidateUploadUrl(`http://localhost:3003/documents/r/${token}`)).toBe(
      `https://afterstem.netlify.app/documents/r/${encodeURIComponent(token)}`,
    )
  })

  it('rebuilds stored netlify links onto brand host after cutover', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('APP_URL', 'https://www.afterstem.ai')
    vi.stubEnv('BRAND_DOMAIN_SERVES_APP', 'true')
    vi.stubEnv('URL', 'https://www.afterstem.ai')
    const { resolveCandidateUploadUrl } = await import('@/lib/candidate-upload-url')
    const token = 'abcToken123'
    expect(
      resolveCandidateUploadUrl(`https://afterstem.netlify.app/documents/r/${token}`),
    ).toBe(`https://www.afterstem.ai/documents/r/${encodeURIComponent(token)}`)
  })
})
