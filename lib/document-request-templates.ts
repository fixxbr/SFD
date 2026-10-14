/** Professional Afterstem HTML document-request email templates (navy/teal + logo). */
import { BRAND_DOMAIN, BRAND_NAME } from '@/lib/brand'
import { EMAIL_LOGO_URL, EMAIL_SITE_URL, EMAIL_FROM_NAME, EMAIL_SUPPORT } from '@/lib/email-html'

export type DocRequestTemplateKey = 'FULL_O1' | 'CUSTOM' | 'SINGLE'

export type DocRequestTemplateVars = {
  clientName: string
  candidateId: string
  visaType: string
  documentRequestLink: string
  customDocumentListHtml?: string
  checklistHtml?: string
  documentName?: string
  documentRequestNote?: string
}

function fill(html: string, vars: DocRequestTemplateVars) {
  return html
    .replaceAll('{{Client Name}}', vars.clientName)
    .replaceAll('{{Candidate ID}}', vars.candidateId)
    .replaceAll('{{Visa Type}}', vars.visaType)
    .replaceAll('{{DOCUMENT_REQUEST_LINK}}', vars.documentRequestLink)
    .replaceAll('{{CUSTOM_DOCUMENT_LIST}}', vars.customDocumentListHtml ?? '')
    .replaceAll('{{CHECKLIST_HTML}}', vars.checklistHtml ?? '')
    .replaceAll('{{DOCUMENT_NAME}}', vars.documentName ?? '')
    .replaceAll('{{DOCUMENT_REQUEST_NOTE}}', vars.documentRequestNote ?? '')
}

const FULL_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Complete Your {{Visa Type}} Documentation | Afterstem</title>
</head>
<body style="margin:0;padding:0;background:#edf3f6;font-family:Arial,Helvetica,sans-serif;color:#17324d;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf3f6;">
<tr><td align="center" style="padding:34px 14px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 12px 36px rgba(13,45,82,.10);">
<tr><td align="center" style="padding:30px 30px 16px;">
<a href="${EMAIL_SITE_URL}/" target="_blank">
<img src="${EMAIL_LOGO_URL}" alt="Afterstem" width="230" style="display:block;width:230px;max-width:76%;height:auto;border:0;margin:0 auto;">
</a>
</td></tr>
<tr><td style="padding:8px 42px 0;text-align:center;">
<div style="display:inline-block;background:#e8f8f7;color:#177d80;font-size:11px;line-height:16px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;padding:8px 12px;border-radius:999px;">Complete Documentation Request</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:44px;font-weight:700;color:#0d2d52;margin:18px auto 12px;">Complete Your {{Visa Type}} Documentation</div>
</td></tr>
<tr><td style="padding:18px 42px 8px;">
<div style="font-size:17px;line-height:27px;color:#17324d;">Hi <strong>{{Client Name}}</strong>,</div>
<div style="font-size:15px;line-height:26px;color:#5e7486;margin-top:12px;">We're ready for the documentation stage of your {{Visa Type}} case. Please use the secure link below to provide the information and supporting evidence currently available to you.</div>
</td></tr>
<tr><td style="padding:18px 42px 6px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7fafc;border:1px solid #e1e9ee;border-radius:14px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#7b8d9a;padding-bottom:6px;">Candidate ID</td><td align="right" style="font-size:14px;font-weight:700;color:#0d2d52;padding-bottom:6px;">{{Candidate ID}}</td></tr>
<tr><td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#7b8d9a;padding-top:6px;">Visa Type</td><td align="right" style="font-size:14px;font-weight:700;color:#0d2d52;padding-top:6px;">{{Visa Type}}</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:26px 42px 8px;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:33px;font-weight:700;color:#0d2d52;">Your {{Visa Type}} Documentation Checklist</div>
<div style="font-size:14px;line-height:22px;color:#718493;margin-top:7px;">Please upload everything currently available. You do not need to qualify under every category.</div>
</td></tr>
<tr><td style="padding:14px 42px 24px;">
<div style="font-size:14px;line-height:26px;color:#3f596c;">{{CHECKLIST_HTML}}</div>
</td></tr>
<tr><td style="padding:18px 42px 30px;text-align:center;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
<tr><td bgcolor="#0d2d52" style="border-radius:10px;">
<a href="{{DOCUMENT_REQUEST_LINK}}" target="_blank" style="display:inline-block;padding:15px 26px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;border-radius:10px;">Open Complete Documentation Request →</a>
</td></tr>
</table>
<div style="font-size:11px;line-height:18px;color:#8a9aa6;margin-top:12px;">Secure submission link associated with Candidate ID {{Candidate ID}}.</div>
</td></tr>
<tr><td style="padding:0 42px 30px;">
<div style="border-left:4px solid #62c6c7;background:#f1fafa;border-radius:10px;padding:16px 18px;">
<div style="font-size:13px;line-height:21px;color:#5f7587;">Please use the secure submission link above so the documents are automatically stored under the correct Afterstem candidate profile.</div>
</div>
</td></tr>
<tr><td style="padding:0 42px 30px;">
<div style="font-size:15px;line-height:25px;color:#607589;">
If you have any questions regarding this request, simply reply to this email.<br><br>
Best regards,<br><br>
<strong style="color:#0d2d52;">${EMAIL_FROM_NAME}</strong><br>
<a href="mailto:${EMAIL_SUPPORT}" style="color:#177d80;text-decoration:none;">${EMAIL_SUPPORT}</a><br>
<a href="${EMAIL_SITE_URL}/" style="color:#177d80;text-decoration:none;">${BRAND_DOMAIN}</a>
</div>
</td></tr>
<tr><td style="background:#f8fafc;padding:24px 38px;text-align:center;border-top:1px solid #e6edf2;">
<div style="font-size:11px;line-height:18px;color:#94a3af;">${BRAND_NAME} is a technology and consulting platform, not a law firm. Legal advice and immigration legal services are provided by licensed immigration attorneys where applicable.</div>
<div style="font-size:11px;line-height:18px;color:#a6b2bc;margin-top:9px;">© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

const CUSTOM_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Documents Requested for Your Case | Afterstem</title>
</head>
<body style="margin:0;padding:0;background:#edf3f6;font-family:Arial,Helvetica,sans-serif;color:#17324d;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf3f6;">
<tr><td align="center" style="padding:34px 14px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 12px 36px rgba(13,45,82,.10);">
<tr><td align="center" style="padding:30px 30px 16px;">
<a href="${EMAIL_SITE_URL}/" target="_blank">
<img src="${EMAIL_LOGO_URL}" alt="Afterstem" width="230" style="display:block;width:230px;max-width:76%;height:auto;border:0;margin:0 auto;">
</a>
</td></tr>
<tr><td style="padding:8px 42px 0;text-align:center;">
<div style="display:inline-block;background:#e8f8f7;color:#177d80;font-size:11px;line-height:16px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;padding:8px 12px;border-radius:999px;">Custom Document Request</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:44px;font-weight:700;color:#0d2d52;margin:18px auto 12px;">Documents Requested for Your Case</div>
</td></tr>
<tr><td style="padding:18px 42px 8px;">
<div style="font-size:17px;line-height:27px;color:#17324d;">Hi <strong>{{Client Name}}</strong>,</div>
<div style="font-size:15px;line-height:26px;color:#5e7486;margin-top:12px;">We're continuing the review of your case and need a specific set of documents or supporting evidence from you.</div>
</td></tr>
<tr><td style="padding:18px 42px 6px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7fafc;border:1px solid #e1e9ee;border-radius:14px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#7b8d9a;padding-bottom:6px;">Candidate ID</td><td align="right" style="font-size:14px;font-weight:700;color:#0d2d52;padding-bottom:6px;">{{Candidate ID}}</td></tr>
<tr><td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#7b8d9a;padding-top:6px;">Visa Type</td><td align="right" style="font-size:14px;font-weight:700;color:#0d2d52;padding-top:6px;">{{Visa Type}}</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:26px 42px 8px;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:33px;font-weight:700;color:#0d2d52;">Documents requested for your case</div>
<div style="font-size:14px;line-height:22px;color:#718493;margin-top:7px;">Our team has selected the specific items below for this request.</div>
</td></tr>
<tr><td style="padding:14px 42px 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7fafc;border:1px solid #e1e9ee;border-radius:14px;">
<tr><td style="padding:20px;">
<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#6f8392;">Requested Documents</div>
<div style="font-size:14px;line-height:24px;color:#3f596c;margin-top:10px;">{{CUSTOM_DOCUMENT_LIST}}</div>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:18px 42px 30px;text-align:center;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
<tr><td bgcolor="#0d2d52" style="border-radius:10px;">
<a href="{{DOCUMENT_REQUEST_LINK}}" target="_blank" style="display:inline-block;padding:15px 26px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;border-radius:10px;">Upload Requested Documents →</a>
</td></tr>
</table>
<div style="font-size:11px;line-height:18px;color:#8a9aa6;margin-top:12px;">Secure submission link associated with Candidate ID {{Candidate ID}}.</div>
</td></tr>
<tr><td style="padding:0 42px 30px;">
<div style="border-left:4px solid #62c6c7;background:#f1fafa;border-radius:10px;padding:16px 18px;">
<div style="font-size:13px;line-height:21px;color:#5f7587;">Please use the secure submission link above so the documents are automatically stored under the correct Afterstem candidate profile.</div>
</div>
</td></tr>
<tr><td style="padding:0 42px 30px;">
<div style="font-size:15px;line-height:25px;color:#607589;">
If you have any questions regarding this request, simply reply to this email.<br><br>
Best regards,<br><br>
<strong style="color:#0d2d52;">${EMAIL_FROM_NAME}</strong><br>
<a href="mailto:${EMAIL_SUPPORT}" style="color:#177d80;text-decoration:none;">${EMAIL_SUPPORT}</a><br>
<a href="${EMAIL_SITE_URL}/" style="color:#177d80;text-decoration:none;">${BRAND_DOMAIN}</a>
</div>
</td></tr>
<tr><td style="background:#f8fafc;padding:24px 38px;text-align:center;border-top:1px solid #e6edf2;">
<div style="font-size:11px;line-height:18px;color:#94a3af;">${BRAND_NAME} is a technology and consulting platform, not a law firm. Legal advice and immigration legal services are provided by licensed immigration attorneys where applicable.</div>
<div style="font-size:11px;line-height:18px;color:#a6b2bc;margin-top:9px;">© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

const SINGLE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Additional Document Requested | Afterstem</title>
</head>
<body style="margin:0;padding:0;background:#edf3f6;font-family:Arial,Helvetica,sans-serif;color:#17324d;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf3f6;">
<tr><td align="center" style="padding:34px 14px;">
<table role="presentation" width="640" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 12px 36px rgba(13,45,82,.10);">
<tr><td align="center" style="padding:30px 30px 16px;">
<a href="${EMAIL_SITE_URL}/" target="_blank">
<img src="${EMAIL_LOGO_URL}" alt="Afterstem" width="230" style="display:block;width:230px;max-width:76%;height:auto;border:0;margin:0 auto;">
</a>
</td></tr>
<tr><td style="padding:8px 42px 0;text-align:center;">
<div style="display:inline-block;background:#e8f8f7;color:#177d80;font-size:11px;line-height:16px;letter-spacing:1.5px;font-weight:700;text-transform:uppercase;padding:8px 12px;border-radius:999px;">Additional Document Request</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:44px;font-weight:700;color:#0d2d52;margin:18px auto 12px;">Additional Document Requested</div>
</td></tr>
<tr><td style="padding:18px 42px 8px;">
<div style="font-size:17px;line-height:27px;color:#17324d;">Hi <strong>{{Client Name}}</strong>,</div>
<div style="font-size:15px;line-height:26px;color:#5e7486;margin-top:12px;">Thank you for the information you have already provided. During our review, we identified one additional document or item needed to continue processing your case.</div>
</td></tr>
<tr><td style="padding:18px 42px 6px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7fafc;border:1px solid #e1e9ee;border-radius:14px;">
<tr><td style="padding:18px 20px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
<tr><td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#7b8d9a;padding-bottom:6px;">Candidate ID</td><td align="right" style="font-size:14px;font-weight:700;color:#0d2d52;padding-bottom:6px;">{{Candidate ID}}</td></tr>
<tr><td style="font-size:11px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#7b8d9a;padding-top:6px;">Visa Type</td><td align="right" style="font-size:14px;font-weight:700;color:#0d2d52;padding-top:6px;">{{Visa Type}}</td></tr>
</table>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:26px 42px 8px;">
<div style="font-family:Georgia,'Times New Roman',serif;font-size:25px;line-height:33px;font-weight:700;color:#0d2d52;">Additional document required</div>
<div style="font-size:14px;line-height:22px;color:#718493;margin-top:7px;">During our review, we identified an additional item needed for your case.</div>
</td></tr>
<tr><td style="padding:14px 42px 24px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f1fafa;border-left:4px solid #62c6c7;border-radius:12px;">
<tr><td style="padding:20px;">
<div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700;color:#238789;">Requested Item</div>
<div style="font-size:18px;line-height:28px;font-weight:700;color:#0d2d52;margin-top:7px;">{{DOCUMENT_NAME}}</div>
<div style="font-size:13px;line-height:21px;color:#607589;margin-top:8px;">{{DOCUMENT_REQUEST_NOTE}}</div>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:18px 42px 30px;text-align:center;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
<tr><td bgcolor="#0d2d52" style="border-radius:10px;">
<a href="{{DOCUMENT_REQUEST_LINK}}" target="_blank" style="display:inline-block;padding:15px 26px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;border-radius:10px;">Upload Requested Document →</a>
</td></tr>
</table>
<div style="font-size:11px;line-height:18px;color:#8a9aa6;margin-top:12px;">Secure submission link associated with Candidate ID {{Candidate ID}}.</div>
</td></tr>
<tr><td style="padding:0 42px 30px;">
<div style="border-left:4px solid #62c6c7;background:#f1fafa;border-radius:10px;padding:16px 18px;">
<div style="font-size:13px;line-height:21px;color:#5f7587;">Please use the secure submission link above so the documents are automatically stored under the correct Afterstem candidate profile.</div>
</div>
</td></tr>
<tr><td style="padding:0 42px 30px;">
<div style="font-size:15px;line-height:25px;color:#607589;">
If you have any questions regarding this request, simply reply to this email.<br><br>
Best regards,<br><br>
<strong style="color:#0d2d52;">${EMAIL_FROM_NAME}</strong><br>
<a href="mailto:${EMAIL_SUPPORT}" style="color:#177d80;text-decoration:none;">${EMAIL_SUPPORT}</a><br>
<a href="${EMAIL_SITE_URL}/" style="color:#177d80;text-decoration:none;">${BRAND_DOMAIN}</a>
</div>
</td></tr>
<tr><td style="background:#f8fafc;padding:24px 38px;text-align:center;border-top:1px solid #e6edf2;">
<div style="font-size:11px;line-height:18px;color:#94a3af;">${BRAND_NAME} is a technology and consulting platform, not a law firm. Legal advice and immigration legal services are provided by licensed immigration attorneys where applicable.</div>
<div style="font-size:11px;line-height:18px;color:#a6b2bc;margin-top:9px;">© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</div>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`

export const DOC_REQUEST_TEMPLATES: Record<
  DocRequestTemplateKey,
  { subject: string; html: string; label: string }
> = {
  FULL_O1: {
    label: 'Complete Visa Documentation',
    subject: 'Complete Your Visa Documentation | Afterstem.ai',
    html: FULL_HTML,
  },
  CUSTOM: {
    label: 'Custom Document Request',
    subject: 'Documents Requested for Your Case | Afterstem.ai',
    html: CUSTOM_HTML,
  },
  SINGLE: {
    label: 'Single / Additional Document Request',
    subject: 'Additional Document Requested | Afterstem.ai',
    html: SINGLE_HTML,
  },
}

export function renderDocRequestHtml(key: DocRequestTemplateKey, vars: DocRequestTemplateVars) {
  return fill(DOC_REQUEST_TEMPLATES[key].html, vars)
}

export function docRequestPlainText(key: DocRequestTemplateKey, vars: DocRequestTemplateVars & { documentLabels?: string[] }) {
  const lines = [
    `Hello ${vars.clientName},`,
    '',
    key === 'SINGLE'
      ? `We are requesting the following document for your ${vars.visaType} case:`
      : `We are requesting the following documents for your ${vars.visaType} case:`,
    '',
  ]
  if (key === 'SINGLE' && vars.documentName) {
    lines.push(`• ${vars.documentName}`)
    if (vars.documentRequestNote) {
      lines.push('')
      lines.push(vars.documentRequestNote)
    }
    lines.push('')
  } else if (vars.documentLabels?.length) {
    for (const label of vars.documentLabels) lines.push(`• ${label}`)
    lines.push('')
  }
  lines.push(
    'Please use the secure link below to upload the requested documents:',
    '',
    'Upload Documents:',
    vars.documentRequestLink,
    '',
    'Candidate ID:',
    vars.candidateId,
    '',
    'If you have any questions, please reply to this email.',
    '',
    'Best regards,',
    EMAIL_FROM_NAME,
    EMAIL_SUPPORT,
  )
  return lines.join('\n')
}

export function customListHtml(labels: string[]) {
  return labels.map((l, i) => `${i + 1}. ${escapeHtml(l)}`).join('<br>')
}

/** Category headings for full-package emails (dynamic per visa / request). */
export function categoryChecklistHtml(categories: string[]) {
  const unique = [...new Set(categories.filter(Boolean))]
  return unique.map((c) => escapeHtml(c)).join('<br>')
}

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}
