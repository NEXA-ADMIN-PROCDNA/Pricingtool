import { ClientSecretCredential } from '@azure/identity'

// ── Singleton credential ─────────────────────────────────────────
const g = globalThis as unknown as { _mailCredential?: ClientSecretCredential }

function getCredential(): ClientSecretCredential {
  if (!g._mailCredential) {
    const tenantId     = process.env.AZURE_AD_TENANT_ID
    const clientId     = process.env.AZURE_AD_CLIENT_ID
    const clientSecret = process.env.AZURE_AD_CLIENT_SECRET
    if (!tenantId || !clientId || !clientSecret)
      throw new Error('Missing AZURE_AD_TENANT_ID / AZURE_AD_CLIENT_ID / AZURE_AD_CLIENT_SECRET')
    g._mailCredential = new ClientSecretCredential(tenantId, clientId, clientSecret)
  }
  return g._mailCredential
}

async function getToken(): Promise<string> {
  const { token } = await getCredential().getToken('https://graph.microsoft.com/.default')
  return token
}

// ── Core send function ───────────────────────────────────────────
async function sendMail({
  to,
  cc,
  subject,
  html,
}: {
  to: string | string[]
  cc?: string | string[]
  subject: string
  html: string
}) {
  const sender = process.env.MAIL_SENDER
  if (!sender) { console.warn('[mail] MAIL_SENDER not set — skipping'); return }

  const toList  = (Array.isArray(to)  ? to  : [to ]).map(a => ({ emailAddress: { address: a } }))
  const ccList  = (Array.isArray(cc)  ? cc  : cc ? [cc] : []).map(a => ({ emailAddress: { address: a } }))

  try {
    const token = await getToken()
    const res   = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject,
          body:          { contentType: 'HTML', content: html },
          toRecipients:  toList,
          ...(ccList.length ? { ccRecipients: ccList } : {}),
        },
        saveToSentItems: false,
      }),
    })
    if (!res.ok) {
      const err = await res.text()
      console.error('[mail] Graph sendMail error:', err)
    }
  } catch (e) {
    console.error('[mail] sendMail threw:', e)
  }
}

// ── Brand helpers ────────────────────────────────────────────────
const BASE_URL = process.env.NEXTAUTH_URL ?? 'https://nexabd.vercel.app'

function wrap(body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#F4F6FB;font-family:'Segoe UI',system-ui,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #D6DCE8;">
      <!-- Header -->
      <tr><td style="background:#0A1F44;padding:20px 32px;display:flex;align-items:center;">
        <span style="font-family:Georgia,serif;font-weight:800;font-size:22px;letter-spacing:0.18em;color:#F4F6FB;text-transform:uppercase;">NEXA</span>
        <span style="display:inline-block;width:6px;height:6px;background:#1E5BB8;transform:rotate(45deg);margin-left:8px;"></span>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:32px 32px 24px;">${body}</td></tr>
      <!-- Footer -->
      <tr><td style="padding:16px 32px 28px;border-top:1px solid #D6DCE8;">
        <p style="margin:0;font-size:11px;color:#9AA3B8;">This is an automated message from NEXA · Business Development &amp; Pricing Tool. Do not reply to this email.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

function btn(label: string, url: string): string {
  return `<a href="${url}" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#1E5BB8;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">${label}</a>`
}

function pill(text: string, color: string): string {
  return `<span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600;background:${color}20;color:${color};border:1px solid ${color}40;">${text}</span>`
}

function metaRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:5px 0;font-size:12px;color:#6B7591;width:140px;vertical-align:top;">${label}</td>
    <td style="padding:5px 0;font-size:13px;color:#0A1F44;font-weight:500;">${value}</td>
  </tr>`
}

// ── Email templates ──────────────────────────────────────────────

export async function mailApprovalRequested({
  approverEmail,
  approverName,
  requesterName,
  opportunityId,
  opportunityName,
  clientName,
  approvalType,
}: {
  approverEmail: string
  approverName:  string
  requesterName: string
  opportunityId: string
  opportunityName: string
  clientName: string
  approvalType: string
}) {
  const typeLabel = approvalType === 'SOW_VERIFICATION' ? 'SOW Verification' : 'Pricing Approval'
  const html = wrap(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#0A1F44;">New approval request</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#6B7591;">Hi ${approverName}, <strong style="color:#0A1F44;">${requesterName}</strong> has requested your approval.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F4F6FB;border-radius:8px;padding:16px;border:1px solid #D6DCE8;">
      ${metaRow('Opportunity', `<strong>${opportunityName}</strong> <span style="color:#6B7591;">(${opportunityId})</span>`)}
      ${metaRow('Client', clientName)}
      ${metaRow('Type', pill(typeLabel, approvalType === 'SOW_VERIFICATION' ? '#7C3AED' : '#1E5BB8'))}
      ${metaRow('Requested by', requesterName)}
    </table>
    ${btn('Review in NEXA →', `${BASE_URL}/approvals`)}
  `)

  await sendMail({ to: approverEmail, subject: `[NEXA] ${typeLabel} requested — ${opportunityId}`, html })
}

export async function mailApprovalApproved({
  requesterEmail,
  requesterName,
  approverName,
  opportunityId,
  opportunityName,
  approvalType,
}: {
  requesterEmail: string
  requesterName:  string
  approverName:   string
  opportunityId:  string
  opportunityName: string
  approvalType:   string
}) {
  const typeLabel = approvalType === 'SOW_VERIFICATION' ? 'SOW Verification' : 'Pricing Approval'
  const html = wrap(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#0A1F44;">Request approved ✓</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#6B7591;">Hi ${requesterName}, your <strong style="color:#0A1F44;">${typeLabel}</strong> request has been approved by <strong style="color:#0A1F44;">${approverName}</strong>.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F0FDF4;border-radius:8px;padding:16px;border:1px solid #86EFAC;">
      ${metaRow('Opportunity', `<strong>${opportunityName}</strong> <span style="color:#6B7591;">(${opportunityId})</span>`)}
      ${metaRow('Decision', pill('Approved', '#16A34A'))}
      ${metaRow('Approved by', approverName)}
    </table>
    ${btn('Open opportunity →', `${BASE_URL}/opportunities/${opportunityId}`)}
  `)

  await sendMail({ to: requesterEmail, subject: `[NEXA] Approved — ${opportunityName} (${opportunityId})`, html })
}

export async function mailApprovalRejected({
  requesterEmail,
  requesterName,
  approverName,
  opportunityId,
  opportunityName,
  approvalType,
  reason,
}: {
  requesterEmail: string
  requesterName:  string
  approverName:   string
  opportunityId:  string
  opportunityName: string
  approvalType:   string
  reason?:        string
}) {
  const typeLabel = approvalType === 'SOW_VERIFICATION' ? 'SOW Verification' : 'Pricing Approval'
  const html = wrap(`
    <h2 style="margin:0 0 6px;font-size:20px;color:#0A1F44;">Request rejected</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#6B7591;">Hi ${requesterName}, your <strong style="color:#0A1F44;">${typeLabel}</strong> request has been rejected by <strong style="color:#0A1F44;">${approverName}</strong>.</p>
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#FEF2F2;border-radius:8px;padding:16px;border:1px solid #FCA5A5;">
      ${metaRow('Opportunity', `<strong>${opportunityName}</strong> <span style="color:#6B7591;">(${opportunityId})</span>`)}
      ${metaRow('Decision', pill('Rejected', '#DC2626'))}
      ${metaRow('Rejected by', approverName)}
      ${reason ? metaRow('Reason', `<em style="color:#6B7591;">${reason}</em>`) : ''}
    </table>
    ${btn('Open opportunity →', `${BASE_URL}/opportunities/${opportunityId}`)}
  `)

  await sendMail({ to: requesterEmail, subject: `[NEXA] Rejected — ${opportunityName} (${opportunityId})`, html })
}
