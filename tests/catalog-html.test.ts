import { describe, expect, it } from 'vitest'
import { renderCatalogEmail, hasUnresolvedMergeTokens, stripCatalogChrome } from '@/lib/email/catalog-html'
import { EMAIL_TEMPLATES, gmailComposeUrl } from '@/lib/email-templates'
import { EMAIL_LOGO_URL } from '@/lib/email-html'

describe('catalog branded HTML', () => {
  it('renders welcome with Afterstem logo and master layout', () => {
    const out = renderCatalogEmail({
      templateKey: 'WELCOME',
      fullLegalName: 'Ada Lovelace',
      candidateNumber: 'ASM-1001',
      email: 'ada@example.com',
      visaType: 'O1A',
    })
    expect(out.subject).toBe('Welcome to Afterstem')
    expect(out.html).toContain(EMAIL_LOGO_URL)
    expect(out.html).toContain('alt="Afterstem"')
    expect(out.html).toContain('ASM-1001')
    expect(out.html).toContain('Afterstem Team')
    expect(out.html).toContain('clients@afterstem.ai')
    expect(out.html).toContain('Welcome to Afterstem')
    // greeting once
    expect(out.html.match(/Hi <strong>Ada<\/strong>/g)?.length).toBe(1)
    expect(out.plainTextForGmail).toContain('Hello Ada,')
    expect(out.plainTextForGmail).not.toContain('<')
    expect(out.version).toBe('welcome_v1')
  })

  it('lists missing documents in reminder HTML', () => {
    const out = renderCatalogEmail({
      templateKey: 'MISSING_DOCUMENT_REMINDER',
      fullLegalName: 'Ada Lovelace',
      candidateNumber: 'ASM-1002',
      email: 'ada@example.com',
      visaType: 'O1A',
      missingDocumentLabels: ['Passport', 'I-94'],
      documentLink: 'https://afterstem.ai/documents/r/x',
    })
    expect(out.html).toContain('Passport')
    expect(out.html).toContain('I-94')
    expect(out.html).toContain('Still Needed')
    expect(out.plainTextForGmail).toContain('https://afterstem.ai/documents/r/x')
  })

  it('includes payment amount card for first payment', () => {
    const out = renderCatalogEmail({
      templateKey: 'PAYMENT_1_DUE',
      fullLegalName: 'Ada Lovelace',
      candidateNumber: 'ASM-1003',
      email: 'ada@example.com',
      visaType: 'O1A',
      paymentCents: 500000,
      paymentNumber: 1,
      currency: 'usd',
      paymentLink: 'https://pay.example/1',
    })
    expect(out.subject).toContain('First Payment Request')
    expect(out.html).toContain('Amount Due')
    expect(out.html).toContain('$5,000.00')
    expect(out.html).toContain('Make Payment')
  })

  it('detects unresolved merge tokens', () => {
    expect(hasUnresolvedMergeTokens('Hello {{Client Name}}')).toBe(true)
    expect(hasUnresolvedMergeTokens('Hello Ada')).toBe(false)
  })

  it('strips greeting chrome for layout', () => {
    expect(stripCatalogChrome('Hi Ada Lovelace,\n\nWelcome.')).toBe('Welcome.')
  })

  it('catalog covers required template keys', () => {
    const keys = EMAIL_TEMPLATES.map((t) => t.key)
    for (const k of [
      'WELCOME',
      'DOCUMENTS_RECEIVED',
      'AGREED_AMOUNT',
      'PAYMENT_SCHEDULE',
      'PAYMENT_OVERDUE',
      'PAYMENT_1_DUE',
      'FINAL_PAYMENT_DUE',
      'CUSTOM',
    ]) {
      expect(keys).toContain(k)
    }
  })

  it('gmailComposeUrl encodes recipient and plain body', () => {
    const url = gmailComposeUrl('ada@example.com', 'Hello', 'Line 1\nLine 2')
    expect(url).toContain('to=ada%40example.com')
    expect(url).toContain('su=Hello')
    expect(url).not.toContain('undefined')
  })
})
