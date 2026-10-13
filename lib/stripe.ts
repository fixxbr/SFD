/**
 * Stripe has been removed from Afterstem payment workflows.
 * Manual receipt recording via FinancialCenter / finance-service is the only payment path.
 * Historical Payment / StripeEvent columns remain in the database for audit safety.
 */

export function stripeClient(): never {
  throw new Error('Stripe is no longer supported. Use Candidate → Payments to record payments manually.')
}

export function stripeConfigured() {
  return false
}

export async function createCheckoutForPayment(_paymentId: string, _createdById?: string | null): Promise<never> {
  throw new Error('Stripe checkout links are disabled. Record payments manually from Candidate → Payments.')
}

export async function sendPaymentEmail(_paymentId: string, _sentById?: string | null): Promise<never> {
  throw new Error('Stripe payment emails are disabled. Use payment request emails from Candidate → Payments.')
}

export async function processStripeEvent(_event: unknown): Promise<{ ignored: true; reason: string }> {
  return { ignored: true, reason: 'Stripe webhooks are disabled' }
}
