import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasOnboardingForm } from '@/lib/onboarding-visa'
import { buildMergeVars, mergeTemplate, templateByKey, templatesForVisa } from '@/lib/email-templates'
import { buildOnboardingOverview } from '@/lib/onboarding-overview'
import { buildChecklist } from '@/lib/documents-checklist'
import { SEED_VISA_TEMPLATES } from '@/lib/visa-template-seed-data'

const prismaMock = {
  case: { findUnique: vi.fn() },
  onboardingInvite: { create: vi.fn(), findUnique: vi.fn() },
  o1OnboardingSubmission: { findFirst: vi.fn(), create: vi.fn() },
}
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/email', () => ({ sendClientEmail: vi.fn() }))
vi.mock('@/lib/activity', () => ({ logActivity: vi.fn(), ActivityType: {} }))

describe('the onboarding form is O-1A only', () => {
  afterEach(() => vi.clearAllMocks())

  it('is offered only for O-1A', () => {
    expect(hasOnboardingForm('O_1A')).toBe(true)
    for (const visa of ['O_1B', 'EB_1A', 'EB_2_NIW', 'EB_5', 'H_1B', 'L_1A', 'L_1B', 'OTHER', null]) {
      expect(hasOnboardingForm(visa), String(visa)).toBe(false)
    }
  })

  it('refuses to create an invite for a non-O-1A case, without writing anything', async () => {
    prismaMock.case.findUnique.mockResolvedValue({ visaType: 'H_1B' })
    const { createOnboardingInvite } = await import('@/lib/onboarding')
    await expect(
      createOnboardingInvite({ candidateId: 'c', caseId: 'k', recipientEmail: 'a@b.co' }),
    ).rejects.toThrow('only for O-1A')
    expect(prismaMock.onboardingInvite.create).not.toHaveBeenCalled()
  })

  it('stops an existing invite from opening once the case is not O-1A', async () => {
    prismaMock.onboardingInvite.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      case: { visaType: 'EB_1A' },
    })
    const { resolveInvite, isInviteForOtherVisa } = await import('@/lib/onboarding')
    await expect(resolveInvite('tok')).resolves.toBeNull()
    await expect(isInviteForOtherVisa('tok')).resolves.toBe(true)
  })

  it('shows no invite actions in Overview for other visa types', () => {
    const h1b = SEED_VISA_TEMPLATES.find((t) => t.visaTypeCode === 'H_1B')!
    const checklist = buildChecklist([], [], { templateItems: h1b.items })
    const other = buildOnboardingOverview({ checklist, onboardingForm: false })
    expect(other.showSendInvite).toBe(false)
    expect(other.showResendInvite).toBe(false)
    const o1 = buildOnboardingOverview({ checklist, onboardingForm: true })
    expect(o1.showSendInvite).toBe(true)
  })
})

describe('emails follow the case visa type', () => {
  it('offers "O-1 Process Started" only to O-1A cases', () => {
    expect(templatesForVisa('O_1A').some((t) => t.key === 'O1_PROCESS_STARTED')).toBe(true)
    expect(templatesForVisa('H_1B').some((t) => t.key === 'O1_PROCESS_STARTED')).toBe(false)
    expect(templatesForVisa('H_1B').some((t) => t.key === 'DOCUMENTATION_REQUEST')).toBe(true)
  })

  it('documentation request names the visa and lists its own categories', () => {
    const t = templateByKey('DOCUMENTATION_REQUEST')
    const vars = buildMergeVars({
      fullLegalName: 'Ana Lee', email: 'a@b.co', visaLabel: 'H-1B', caseNumber: 'H1B-1', quotedCents: 0, visaTypeCode: 'H_1B',
    })
    const body = mergeTemplate(t.body, vars)
    const subject = mergeTemplate(t.subject, vars)
    expect(subject).toContain('H-1B')
    expect(body).toContain('Employer documents')
    expect(body).not.toMatch(/O-1|Judging Experience|Awards & Recognition/)
    expect(body).not.toContain('{{')
  })

  it('uses the live template categories when they are passed in', () => {
    const vars = buildMergeVars({
      fullLegalName: 'Ana Lee', email: 'a@b.co', visaLabel: 'EB-5', caseNumber: 'x', quotedCents: 0,
      visaTypeCode: 'EB_5', documentCategories: ['Source of funds', 'Custom category'],
    })
    expect(vars.documentCategories).toBe('- Source of funds\n- Custom category')
  })
})
