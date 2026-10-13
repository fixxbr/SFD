import { describe, expect, it } from 'vitest'
import {
  prepareEmailForCopy,
  formatFullEmailPlain,
  plainTextToClipboardHtml,
  sanitizeEmailHtml,
  buildClipboardHtml,
  wrapInBrandedClipboardLayout,
  extractClipboardHtmlFragment,
} from '@/lib/email/copy-email'
import { EMAIL_LOGO_URL } from '@/lib/email-html'

const sampleBody = `Hello Priya,

We are requesting the following documents for your O-1A case:

• Passport
• Resume / CV
• I-94

Please upload the requested documents using the secure link below:

Upload Documents:
https://afterstem.ai/documents/r/secure-token

Candidate ID:
ASM-1037

If you have any questions, please reply to this email.

Best regards,

Afterstem Team`

const brandedHtml = `<!doctype html><html><body style="background:#edf3f6;">
<table><tr><td align="center">
<img src="${EMAIL_LOGO_URL}" alt="Afterstem" width="230">
</td></tr>
<tr><td><p>Hello Priya,</p><ul><li>Passport</li></ul>
<a href="https://afterstem.ai/documents/r/secure-token">Upload Documents</a>
</td></tr></table>
</body></html>`

describe('prepareEmailForCopy', () => {
  it('copies branded HTML with logo when template is provided', () => {
    const result = prepareEmailForCopy({
      to: 'priya@example.com',
      subject: 'Afterstem — Document Request',
      body: sampleBody,
      htmlBody: brandedHtml,
      mode: 'full',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plain).toContain('Subject: Afterstem — Document Request')
    expect(result.plain).toContain('To: priya@example.com')
    expect(result.plain).toContain('• Passport')
    expect(result.html).toContain(EMAIL_LOGO_URL)
    expect(result.html).toContain('Passport')
    expect(result.html).toContain('https://afterstem.ai/documents/r/secure-token')
    expect(result.html).not.toContain('<script')
    expect(result.plain).not.toContain('<p>')
  })

  it('wraps plain text in branded layout with logo when no HTML template', () => {
    const result = prepareEmailForCopy({
      to: 'priya@example.com',
      subject: 'Afterstem — Document Request',
      body: sampleBody,
      mode: 'full',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.html).toContain(EMAIL_LOGO_URL)
    expect(result.html).toContain('<ul')
    expect(result.html).toContain('Passport')
    expect(result.html).toContain('href="https://afterstem.ai/documents/r/secure-token"')
  })

  it('preserves admin edits in body mode', () => {
    const edited = sampleBody.replace(
      'We are requesting the following documents for your O-1A case:',
      'Please provide the following documents at your earliest convenience:',
    )
    const result = prepareEmailForCopy({
      to: 'priya@example.com',
      subject: 'Afterstem — Documents Required for Your O-1A Case',
      body: edited,
      mode: 'body',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plain).toContain('Please provide the following documents at your earliest convenience:')
    expect(result.plain).not.toContain('Subject:')
    expect(result.html).toContain(EMAIL_LOGO_URL)
    expect(result.html).toContain('earliest convenience')
  })

  it('copies subject only', () => {
    const result = prepareEmailForCopy({
      to: 'a@b.com',
      subject: 'Afterstem — Payment Request',
      body: sampleBody,
      mode: 'subject',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plain).toBe('Afterstem — Payment Request')
  })

  it('rejects unresolved placeholders', () => {
    const result = prepareEmailForCopy({
      to: 'a@b.com',
      subject: 'Hi {{candidate_name}}',
      body: 'Hello {{candidate_name}}',
    })
    expect(result.ok).toBe(false)
  })

  it('rejects preview upload links', () => {
    const result = prepareEmailForCopy({
      to: 'a@b.com',
      subject: 'Docs',
      body: 'Upload: https://afterstem.ai/documents/r/preview',
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toMatch(/upload link/i)
  })

  it('formats payment details cleanly', () => {
    const paymentBody = `Hello Priya,

This is regarding your O-1A case.

Payment Description:
Third Installment

Amount Due:
$2,500.00

Due Date:
Oct 2, 2026

Outstanding Balance:
$2,500.00

Please complete payment using your usual bank transfer instructions.

Candidate ID:
ASM-1037

Please let us know if you have any questions.

Best regards,

Afterstem Team`
    const result = prepareEmailForCopy({
      to: 'priya@example.com',
      subject: 'Afterstem — Payment Request',
      body: paymentBody,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.plain).toContain('$2,500.00')
    expect(result.html).toContain(EMAIL_LOGO_URL)
    expect(result.plain).not.toMatch(/stripe/i)
  })
})

describe('buildClipboardHtml / branded helpers', () => {
  it('extracts body fragment and keeps logo', () => {
    const fragment = extractClipboardHtmlFragment(brandedHtml)
    expect(fragment).toContain(EMAIL_LOGO_URL)
    expect(fragment).not.toContain('<!doctype')
    expect(fragment).not.toContain('<html')
  })

  it('wrapInBrandedClipboardLayout always includes logo', () => {
    const html = wrapInBrandedClipboardLayout('<p>Hello</p>')
    expect(html).toContain(EMAIL_LOGO_URL)
    expect(html).toContain('Hello')
  })

  it('buildClipboardHtml prefers template HTML', () => {
    const html = buildClipboardHtml({ body: sampleBody, htmlBody: brandedHtml })
    expect(html).toContain(EMAIL_LOGO_URL)
    expect(html).toContain('Upload Documents')
  })
})

describe('formatFullEmailPlain', () => {
  it('builds Gmail-friendly structure', () => {
    const plain = formatFullEmailPlain({
      to: 'a@b.com',
      subject: 'Hello',
      body: 'Line one\n\nLine two',
    })
    expect(plain.startsWith('Subject: Hello')).toBe(true)
    expect(plain).toContain('To: a@b.com')
    expect(plain).toContain('Line one')
  })
})

describe('plainTextToClipboardHtml', () => {
  it('turns bullets into list markup and linkifies URLs', () => {
    const html = plainTextToClipboardHtml('Hello\n\n• Passport\n• Resume\n\nhttps://afterstem.ai/documents/r/abc')
    expect(html).toContain('<ul')
    expect(html).toContain('<li')
    expect(html).toContain('href="https://afterstem.ai/documents/r/abc"')
  })
})

describe('sanitizeEmailHtml', () => {
  it('strips scripts and event handlers', () => {
    const dirty = '<p onclick="alert(1)">Hi</p><script>evil()</script><a href="javascript:alert(1)">x</a>'
    const clean = sanitizeEmailHtml(dirty)
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('onclick')
    expect(clean).not.toContain('javascript:')
  })
})
