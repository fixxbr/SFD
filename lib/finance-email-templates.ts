/** Professional Afterstem finance email HTML templates (Gmail-compatible). */

export type FinanceTemplateKey =
  | 'AGREED_QUOTE'
  | 'PAYMENT_SCHEDULE'
  | 'PAYMENT_DUE'
  | 'PAYMENT_REMINDER'
  | 'PAYMENT_OVERDUE'
  | 'PAYMENT_RECEIVED'
  | 'ADDITIONAL_PAYMENT_RECEIVED'
  | 'PAID_IN_FULL'

export type FinanceEmailVars = Record<string, string>

function fill(html: string, vars: FinanceEmailVars) {
  let out = html
  for (const [key, value] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, value ?? '')
  }
  return out
}

const SHELL_START = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{{TITLE}} | Afterstem</title>
</head>
<body style="margin:0;padding:0;background:#edf3f6;font-family:Arial,Helvetica,sans-serif;color:#17324d;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf3f6;">
<tr><td align="center" style="padding:34px 14px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#ffffff;border-radius:22px;overflow:hidden;box-shadow:0 12px 36px rgba(13,45,82,.10);">
<tr><td align="center" style="padding:30px 30px 16px;">
<a href="https://www.afterstem.ai/" target="_blank">
<img src="https://www.afterstem.ai/afterstem-full.png" alt="Afterstem" width="230" style="display:block;width:230px;max-width:76%;height:auto;border:0;margin:0 auto;">
</a>
</td></tr>`

const SHELL_END = `<tr><td style="padding:0 42px 30px;">
<div style="font-size:15px;line-height:25px;color:#607589;">{{CLOSING}}<br><br>
Best regards,<br><br>
<strong style="color:#0d2d52;">Afterstem Team</strong><br>
<a href="mailto:clients@afterstem.ai" style="color:#177d80;text-decoration:none;">clients@afterstem.ai</a><br>
<a href="https://www.afterstem.ai/" style="color:#177d80;text-decoration:none;">afterstem.ai</a>
</div>
</td></tr>
<tr><td style="background:#f8fafc;padding:24px 38px;text-align:center;border-top:1px solid #e6edf2;">
<div style="font-size:11px;line-height:18px;color:#94a3af;">Afterstem is a technology and consulting platform, not a law firm. Legal advice and immigration legal services are provided by licensed immigration attorneys where applicable.</div>
<div style="font-size:11px;line-height:18px;color:#a6b2bc;margin-top:9px;">© 2026 Afterstem. All rights reserved.</div>
</td></tr>
</table></td></tr></table></body></html>`

function badgeHeadline(badge: string, headline: string) {
  return `<tr><td style="padding:8px 42px 0;text-align:center;">
<div style="display:inline-block;background:#e8f8f7;color:#177d80;font-size:11px;line-height:16px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;padding:8px 12px;border-radius:999px;">${badge}</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:35px;line-height:43px;font-weight:700;color:#0d2d52;margin:18px auto 12px;">${headline}</div>
</td></tr>`
}

function intro(text: string) {
  return `<tr><td style="padding:18px 42px 8px;">
<div style="font-size:17px;line-height:27px;color:#17324d;">Hi <strong>{{Client Name}}</strong>,</div>
<div style="font-size:15px;line-height:26px;color:#5e7486;margin-top:12px;">${text}</div>
</td></tr>`
}

function idCard() {
  return `<tr><td style="padding:18px 42px 8px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7fafc;border:1px solid #e1e9ee;border-radius:14px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#7b8d9a;padding-bottom:6px;">Candidate ID</td><td align="right" style="font-size:14px;font-weight:700;color:#0d2d52;padding-bottom:6px;">{{Candidate ID}}</td></tr>
<tr><td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#7b8d9a;padding-top:6px;">Visa Type</td><td align="right" style="font-size:14px;font-weight:700;color:#0d2d52;padding-top:6px;">{{Visa Type}}</td></tr>
</table></td></tr></table></td></tr>`
}

function rowsCard(rowsHtml: string) {
  return `<tr><td style="padding:18px 42px 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7fafc;border:1px solid #e1e9ee;border-radius:14px;">
<tr><td style="padding:20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rowsHtml}</table>
</td></tr></table></td></tr>`
}

function row(label: string, value: string) {
  return `<tr>
<td style="font-size:13px;line-height:21px;color:#718493;padding:8px 0;border-bottom:1px solid #e6edf2;">${label}</td>
<td align="right" style="font-size:14px;line-height:21px;font-weight:700;color:#0d2d52;padding:8px 0;border-bottom:1px solid #e6edf2;">${value}</td>
</tr>`
}

function build(title: string, badge: string, headline: string, introText: string, rows: string, closing: string) {
  return (
    SHELL_START.replace('{{TITLE}}', title) +
    badgeHeadline(badge, headline) +
    intro(introText) +
    idCard() +
    rowsCard(rows) +
    SHELL_END.replace('{{CLOSING}}', closing)
  )
}

export const FINANCE_EMAIL_TEMPLATES: Record<
  FinanceTemplateKey,
  { label: string; subject: string; html: string }
> = {
  AGREED_QUOTE: {
    label: 'Agreed Quote Confirmation',
    subject: 'Afterstem | Your Agreed Engagement Amount – {{Candidate ID}}',
    html: build(
      'Your Agreed Engagement Amount',
      'Engagement Summary',
      'Your Agreed Engagement Amount',
      'Thank you for confirming your engagement with Afterstem. Below is the agreed financial summary for your case.',
      row('Agreed Total Amount', '{{Quoted Amount}}') +
        row('Payment Structure', '{{Payment Structure Summary}}') +
        row('First Due Date', '{{First Due Date}}') +
        row('Case / Visa', '{{Visa Type}}'),
      'Please review the amount and payment structure above. If anything differs from what was agreed, reply to this email so our team can correct it.',
    ),
  },
  PAYMENT_SCHEDULE: {
    label: 'Payment Schedule Confirmation',
    subject: 'Afterstem | Your Payment Schedule – {{Candidate ID}}',
    html: build(
      'Your Payment Schedule',
      'Payment Plan',
      'Your Payment Schedule',
      'Below is the payment schedule currently recorded for your Afterstem engagement.',
      row('Total Engagement Amount', '{{Quoted Amount}}') + '{{SCHEDULE_ROWS}}',
      'If you have any questions, simply reply to this email and our team will be happy to assist.',
    ),
  },
  PAYMENT_DUE: {
    label: 'Payment Due Request',
    subject: 'Afterstem | {{Payment Label}} Is Due – {{Candidate ID}}',
    html: build(
      'Payment Due',
      'Payment Due',
      '{{Payment Label}} Is Due',
      'This is a payment request for the next scheduled amount on your Afterstem engagement.',
      row('Payment', '{{Payment Label}}') +
        row('Amount Due', '{{Amount Due}}') +
        row('Due Date', '{{Due Date}}') +
        row('Total Engagement Amount', '{{Quoted Amount}}') +
        row('Total Received So Far', '{{Total Paid}}') +
        row('Remaining Balance', '{{Remaining Balance}}'),
      'Please use the payment instructions previously provided or reply to this email if you need payment details or assistance.',
    ),
  },
  PAYMENT_REMINDER: {
    label: 'Friendly Payment Reminder',
    subject: 'Afterstem | Friendly Payment Reminder – {{Candidate ID}}',
    html: build(
      'Friendly Payment Reminder',
      'Upcoming Payment',
      'Friendly Payment Reminder',
      'This is a friendly reminder that an upcoming payment is scheduled for your Afterstem engagement.',
      row('Payment', '{{Payment Label}}') +
        row('Amount Due', '{{Amount Due}}') +
        row('Due Date', '{{Due Date}}') +
        row('Total Received', '{{Total Paid}}') +
        row('Remaining Balance', '{{Remaining Balance}}'),
      'If you have any questions, simply reply to this email and our team will be happy to assist.',
    ),
  },
  PAYMENT_OVERDUE: {
    label: 'Payment Overdue',
    subject: 'Afterstem | Payment Past Due – {{Candidate ID}}',
    html: build(
      'Payment Past Due',
      'Payment Follow-Up',
      'Payment Past Due',
      'Our records show that the payment below is currently past its scheduled due date.',
      row('Payment', '{{Payment Label}}') +
        row('Amount Due', '{{Amount Due}}') +
        row('Original Due Date', '{{Due Date}}') +
        row('Days Past Due', '{{Days Overdue}}') +
        row('Total Received', '{{Total Paid}}') +
        row('Remaining Balance', '{{Remaining Balance}}'),
      'If payment has already been made, please reply with the payment date and reference so our team can update the record. Otherwise, please contact us if you need assistance.',
    ),
  },
  PAYMENT_RECEIVED: {
    label: 'Payment Received Confirmation',
    subject: 'Afterstem | Payment Received – {{Candidate ID}}',
    html: build(
      'Payment Received',
      'Payment Confirmation',
      'Payment Received',
      "We're writing to confirm that the payment below has been received and recorded on your Afterstem account.",
      row('Payment / Description', '{{Payment Label}}') +
        row('Amount Received', '{{Amount Received}}') +
        row('Date Received', '{{Date Received}}') +
        row('Payment Method', '{{Payment Method}}') +
        row('Received / Confirmed By', '{{Received By}}') +
        row('Total Received To Date', '{{Total Paid}}') +
        row('Remaining Balance', '{{Remaining Balance}}'),
      'If you have any questions, simply reply to this email and our team will be happy to assist.',
    ),
  },
  ADDITIONAL_PAYMENT_RECEIVED: {
    label: 'Additional Payment Received',
    subject: 'Afterstem | Additional Payment Received – {{Candidate ID}}',
    html: build(
      'Additional Payment Received',
      'Payment Confirmation',
      'Additional Payment Received',
      'We have received and recorded an additional payment toward your Afterstem engagement.',
      row('Amount Received', '{{Amount Received}}') +
        row('Date Received', '{{Date Received}}') +
        row('Payment Method', '{{Payment Method}}') +
        row('Received / Confirmed By', '{{Received By}}') +
        row('Reference', '{{Payment Reference}}') +
        row('Total Received To Date', '{{Total Paid}}') +
        row('Remaining Balance', '{{Remaining Balance}}'),
      'If you have any questions, simply reply to this email and our team will be happy to assist.',
    ),
  },
  PAID_IN_FULL: {
    label: 'Paid in Full',
    subject: 'Afterstem | Payment Schedule Complete – {{Candidate ID}}',
    html: build(
      'Payment Schedule Complete',
      'Paid in Full',
      'Payment Schedule Complete',
      "We're pleased to confirm that the agreed engagement amount has been fully received and your payment schedule is complete.",
      row('Agreed Total Amount', '{{Quoted Amount}}') +
        row('Total Received', '{{Total Paid}}') +
        row('Remaining Balance', '{{Remaining Balance}}') +
        row('Final Payment Date', '{{Date Received}}'),
      'If you have any questions, simply reply to this email and our team will be happy to assist.',
    ),
  },
}

export function renderFinanceEmail(key: FinanceTemplateKey, vars: FinanceEmailVars) {
  const tmpl = FINANCE_EMAIL_TEMPLATES[key]
  return {
    subject: fill(tmpl.subject, vars),
    html: fill(tmpl.html, vars),
    label: tmpl.label,
    plainText: financePlainText(key, vars),
  }
}

function financePlainText(key: FinanceTemplateKey, vars: FinanceEmailVars) {
  const lines = [
    `Hello ${vars['Client Name'] || 'there'},`,
    '',
    FINANCE_EMAIL_TEMPLATES[key].label,
    '',
    'Candidate ID:',
    vars['Candidate ID'] || '',
    '',
    'Visa Type:',
    vars['Visa Type'] || '',
    '',
  ]
  if (vars['Quoted Amount']) {
    lines.push('Agreed Total:', vars['Quoted Amount'], '')
  }
  if (vars['Amount Due']) {
    lines.push('Amount Due:', vars['Amount Due'], '')
  }
  if (vars['Due Date']) {
    lines.push('Due Date:', vars['Due Date'], '')
  }
  if (vars['Total Paid']) {
    lines.push('Total Received:', vars['Total Paid'], '')
  }
  if (vars['Remaining Balance']) {
    lines.push('Outstanding Balance:', vars['Remaining Balance'], '')
  }
  if (vars['Amount Received']) {
    lines.push('Amount Received:', vars['Amount Received'], '')
  }
  lines.push(
    'Payment instructions:',
    'Please follow the payment instructions provided by your Afterstem case team. Reply to this email if you need banking details or a receipt.',
    '',
    'If you have any questions, please reply to this email.',
    '',
    'Best regards,',
    'Afterstem Team',
    'clients@afterstem.ai',
  )
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function scheduleRowsHtml(
  items: Array<{ label: string; amount: string; due: string }>,
) {
  return items
    .map(
      (i) =>
        row(
          i.label.replaceAll('&', '&amp;').replaceAll('<', '&lt;'),
          `${i.amount} — Due ${i.due}`,
        ),
    )
    .join('')
}
