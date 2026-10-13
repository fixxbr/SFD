import type { AccessLinkPurpose } from '@prisma/client'
import { prisma } from '@/lib/db'
import { randomToken, sha256 } from '@/lib/crypto'
import { appUrl } from '@/lib/http'

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000
const OTP_TTL_MS = 15 * 60 * 1000

export async function createAccessLink(input: {
  candidateId: string
  caseId: string
  purpose: AccessLinkPurpose
  paymentId?: string | null
  requiresEmailVerification?: boolean
  ttlMs?: number
}) {
  const token = randomToken(32)
  const link = await prisma.candidateAccessLink.create({
    data: {
      candidateId: input.candidateId,
      caseId: input.caseId,
      purpose: input.purpose,
      paymentId: input.paymentId ?? null,
      requiresEmailVerification: Boolean(input.requiresEmailVerification),
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS)),
    },
  })
  return { link, token, url: `${appUrl()}/client/${token}` }
}

export type AccessTokenFailure = 'invalid' | 'revoked' | 'expired' | 'wrong_purpose'

export async function resolveAccessToken(token: string) {
  const link = await prisma.candidateAccessLink.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      candidate: true,
      case: { include: { payments: { orderBy: { installmentNumber: 'asc' } } } },
    },
  })
  if (!link) return null
  if (link.revokedAt) return null
  if (link.expiresAt.getTime() < Date.now()) return null
  return link
}

/** Distinguish expired / revoked / invalid for candidate-facing error copy. */
export async function inspectAccessToken(token: string): Promise<
  | { ok: true; link: NonNullable<Awaited<ReturnType<typeof resolveAccessToken>>> }
  | { ok: false; reason: AccessTokenFailure }
> {
  const link = await prisma.candidateAccessLink.findUnique({
    where: { tokenHash: sha256(token) },
    include: {
      candidate: true,
      case: { include: { payments: { orderBy: { installmentNumber: 'asc' } } } },
    },
  })
  if (!link) return { ok: false, reason: 'invalid' }
  if (link.revokedAt) return { ok: false, reason: 'revoked' }
  if (link.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' }
  return { ok: true, link }
}

export async function revokeCandidateAccessLinks(candidateId: string) {
  await prisma.candidateAccessLink.updateMany({
    where: { candidateId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export function maskEmail(email: string) {
  const [user, domain] = email.split('@')
  if (!domain) return '***'
  const visible = user.slice(0, 1)
  return `${visible}****@${domain}`
}

export async function issueEmailVerificationCode(accessLinkId: string, candidateId: string) {
  const code = String(Math.floor(100000 + Math.random() * 900000))
  await prisma.emailVerificationCode.create({
    data: {
      accessLinkId,
      candidateId,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  })
  return code
}

export async function verifyEmailCode(accessLinkId: string, code: string) {
  const record = await prisma.emailVerificationCode.findFirst({
    where: {
      accessLinkId,
      codeHash: sha256(code.trim()),
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!record) return false
  await prisma.emailVerificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  })
  return true
}
