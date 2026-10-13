import { describe, expect, it } from 'vitest'
import { prepareGmailCompose, buildStructuredGmailBody, hasBrokenPlaceholders } from '@/lib/email/gmail-prepare'
import { gmailComposeUrl } from '@/lib/email-templates'
import { docRequestPlainText } from '@/lib/document-request-templates'

describe('prepareGmailCompose', () => {
  it('encodes recipient, subject, and multiline body', () => {
    const prepared = prepareGmailCompose({
      to: 'jose.garcia+test@example.com',
      subject: 'Afterstem — Document Request: Passport',
      body: 'Hello José,\n\n• Passport\n• Resume / CV\n\nUpload:\nhttps://afterstem.ai/documents/r/abc',
    })
    expect(prepared.ok).toBe(true)
    if (!prepared.ok) return
    expect(prepared.url).toContain('mail.google.com/mail/')
    expect(prepared.url).toContain('view=cm')
    const decoded = decodeURIComponent(prepared.url.replace(/\+/g, ' '))
    expect(decoded).toContain('Hello José')
    expect(decoded).toContain('• Passport')
    expect(decoded).toContain('jose.garcia+test@example.com')
  })

  it('rejects missing email', () => {
    const prepared = prepareGmailCompose({ to: '', subject: 'Hi', body: 'Body' })
    expect(prepared.ok).toBe(false)
  })

  it('rejects unresolved placeholders and preview links', () => {
    expect(hasBrokenPlaceholders('Hello {{candidate_name}}')).toBe(true)
    expect(
      prepareGmailCompose({
        to: 'a@b.com',
        subject: 'Docs',
        body: 'Upload at https://x.com/documents/r/preview',
      }).ok,
    ).toBe(false)
  })

  it('supports special characters in names and amounts', () => {
    const url = gmailComposeUrl('a@b.com', "O'Connor — $2,500.00", "Hello O'Connor &\nR&D Specialist")
    expect(url).toContain('su=')
    expect(url).toContain('body=')
    const decoded = decodeURIComponent(url.replace(/\+/g, ' '))
    expect(decoded).toContain("O'Connor")
    expect(decoded).toContain('$2,500.00')
  })
})

describe('buildStructuredGmailBody', () => {
  it('keeps paragraphs and bullets readable', () => {
    const body = buildStructuredGmailBody({
      greetingName: 'Priya',
      paragraphs: ['Thank you for working with Afterstem.'],
      bulletIntro: 'We are requesting the following documents for your O-1A case:',
      bulletList: ['Passport', 'Resume / CV', 'I-94'],
      ctaLabel: 'Upload Documents',
      ctaHref: 'https://afterstem.ai/documents/r/token',
      rows: [{ label: 'Candidate ID', value: 'ASM-1037' }],
    })
    expect(body).toContain('Hello Priya,')
    expect(body).toContain('• Passport')
    expect(body).toContain('Upload Documents:')
    expect(body).toContain('https://afterstem.ai/documents/r/token')
    expect(body).toContain('ASM-1037')
    expect(body).toContain('Afterstem Team')
  })
})

describe('docRequestPlainText', () => {
  it('includes upload link and document list', () => {
    const text = docRequestPlainText('CUSTOM', {
      clientName: 'Priya',
      candidateId: 'ASM-1037',
      visaType: 'O-1A',
      documentRequestLink: 'https://afterstem.ai/documents/r/secure',
      documentLabels: ['Passport', 'I-94'],
    })
    expect(text).toContain('• Passport')
    expect(text).toContain('• I-94')
    expect(text).toContain('https://afterstem.ai/documents/r/secure')
    expect(text).not.toContain('/preview')
  })
})
