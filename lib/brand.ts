export const BRAND_NAME = 'Afterstem'
export const BRAND_DOMAIN = 'afterstem.ai'
export const CLIENT_FROM_EMAIL = 'clients@afterstem.ai'
export const ADMIN_FROM_EMAIL = 'clients@afterstem.ai'

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024
/** Keep each network request under Netlify/Lambda ~6MB payload limits. */
export const UPLOAD_CHUNK_BYTES = 2.5 * 1024 * 1024

export const ALLOWED_UPLOAD_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const

export const SIGNED_URL_TTL_SECONDS = 120

export const SESSION_COOKIE = 'as_admin_session'
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000
