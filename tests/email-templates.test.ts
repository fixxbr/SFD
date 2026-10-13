import { describe, expect, it } from 'vitest'
import { buildMergeVars, gmailComposeUrl, mergeTemplate } from '@/lib/email-templates'

describe('email templates', () => {
  it('replaces merge tokens like {{Client Name}}', () => {
    const vars = buildMergeVars({
      fullLegalName: 'Ada Lovelace',
      candidateNumber: 'ASM-1001',
      email: 'ada@example.com',
      visaLabel: 'O-1A',
      caseNumber: 'O1A-1001',
      quotedCents: 2000000,
      paymentCents: 500000,
      paymentNumber: 1,
      currency: 'usd',
      paymentLink: 'https://pay.example/1',
      documentLink: 'https://docs.example/1',
    })
    const merged = mergeTemplate(
      'Hi {{Client Name}}, {{Candidate ID}} {{Visa Type}} {{Case Number}} {{Quoted Amount}} {{Payment Amount}} {{Payment Number}} {{Email}} {{Payment Link}} {{Document Link}}',
      vars,
    )
    expect(merged).toContain('Ada Lovelace')
    expect(merged).toContain('ASM-1001')
    expect(merged).toContain('ada@example.com')
    expect(merged).toContain('O-1A')
    expect(merged).toContain('O1A-1001')
    expect(merged).toContain('$20,000.00')
    expect(merged).toContain('$5,000.00')
    expect(merged).toContain('1')
    expect(merged).toContain('https://pay.example/1')
    expect(merged).toContain('https://docs.example/1')
    expect(merged).not.toContain('{{Client Name}}')
  })

  it('gmailComposeUrl includes to=', () => {
    const url = gmailComposeUrl('ada@example.com', 'Hello', 'Body text')
    expect(url).toContain('https://mail.google.com/mail/?')
    expect(url).toContain('to=ada%40example.com')
  })
})
