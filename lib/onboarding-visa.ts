/** The onboarding questionnaire is the O-1A form; only O-1A cases receive it. */
export const ONBOARDING_FORM_VISA_TYPES = ['O_1A'] as const

export function hasOnboardingForm(visaType: string | null | undefined): boolean {
  return (ONBOARDING_FORM_VISA_TYPES as readonly string[]).includes(String(visaType ?? ''))
}

export const ONBOARDING_NOT_AVAILABLE =
  'The onboarding form is only for O-1A cases. Use Request Documents to collect documents for this visa type.'
