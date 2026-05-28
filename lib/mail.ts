import { ClientSecretCredential } from '@azure/identity'
import { signEmailAction } from '@/lib/approval-tokens'

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

  const toList = (Array.isArray(to) ? to : [to]).map(a => ({ emailAddress: { address: a } }))
  const ccList = (Array.isArray(cc) ? cc : cc ? [cc] : []).map(a => ({ emailAddress: { address: a } }))

  try {
    const token = await getToken()
    const res   = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject,
          body:         { contentType: 'HTML', content: html },
          toRecipients: toList,
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
const BASE_URL = (process.env.MAIL_BASE_URL ?? 'https://pricingtoolprimero.vercel.app').replace(/\/$/, '')

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

export type ApprovalMailContext = {
  versionNumber?: number
  startDate?: string | null
  endDate?:   string | null
  a?:    number
  d?:    number
  dPct?: number
  ePct?: number
  f?:    number
  g?:    number
  h?:    number
}

function fmtMoney(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}
function fmtDate2(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}
function financialRows(ctx: ApprovalMailContext): string {
  const sign = (n: number) => n > 0 ? `+${n.toFixed(1)}%` : `${n.toFixed(1)}%`
  const color = (n: number) => n >= 0 ? '#16A34A' : '#DC2626'
  return [
    ctx.versionNumber != null ? metaRow('Pricing Version', `<strong>V${ctx.versionNumber}</strong>`) : '',
    metaRow('Start Date', fmtDate2(ctx.startDate)),
    metaRow('End Date',   fmtDate2(ctx.endDate)),
    ctx.a    != null ? metaRow('Total Revenue',       `<strong>${fmtMoney(ctx.a)}</strong>`) : '',
    ctx.d    != null ? metaRow('Gross Margin',        `<strong>${fmtMoney(ctx.d)}</strong>${ctx.dPct != null ? ` <span style="color:${color(ctx.dPct)};font-size:11px;">(${ctx.dPct.toFixed(1)}%)</span>` : ''}`) : '',
    ctx.ePct != null ? metaRow('Discount / Premium',  `<span style="color:${color(ctx.ePct)};font-weight:600;">${sign(ctx.ePct)}</span> vs recommended`) : '',
    ctx.f    != null ? metaRow('Total Hours',         `${ctx.f.toFixed(1)} h`) : '',
    ctx.g    != null ? metaRow('Offshore Ratio',      `${ctx.g.toFixed(1)}%`) : '',
    ctx.h    != null ? metaRow('Blended Rate / hr',   `$${ctx.h.toFixed(2)}/hr`) : '',
  ].join('')
}

export async function mailApprovalRequested({
  approverEmail,
  approverName,
  requesterEmail,
  requesterName,
  ccEmails,
  opportunityId,
  opportunityName,
  clientName,
  approvalType,
  approvalRecordId,
  approverId,
  businessJustification,
  context,
}: {
  approverEmail:    string
  approverName:     string
  requesterEmail:   string
  requesterName:    string
  ccEmails?:        string[]
  opportunityId:    string
  opportunityName:  string
  clientName:       string
  approvalType:     string
  approvalRecordId:      string
  approverId:            string
  businessJustification?: string | null
  context?:              ApprovalMailContext
}) {
  const typeLabel  = approvalType === 'SOW_VERIFICATION' ? 'SOW Verification' : 'Pricing Approval'
  const approveUrl = `${BASE_URL}/api/approvals/email-action?token=${signEmailAction(approvalRecordId, approverId, 'approve')}`
  const rejectUrl  = `${BASE_URL}/api/approvals/email-action?token=${signEmailAction(approvalRecordId, approverId, 'reject')}`

  // Shared details table used by approver + CC emails
  const detailsTable = `
    <table cellpadding="0" cellspacing="0" style="width:100%;background:#F4F6FB;border-radius:8px;padding:16px;border:1px solid #D6DCE8;">
      ${metaRow('Opportunity', `<strong>${opportunityName}</strong> <span style="color:#6B7591;">(${opportunityId})</span>`)}
      ${metaRow('Client', clientName)}
      ${metaRow('Type', pill(typeLabel, approvalType === 'SOW_VERIFICATION' ? '#7C3AED' : '#1E5BB8'))}
      ${metaRow('Requested by', requesterName)}
      ${businessJustification?.trim() ? metaRow('Business Justification', `<em style="color:#3A4A6A;">${businessJustification}</em>`) : ''}
      ${context ? financialRows(context) : ''}
    </table>`

  const subjectLine = approvalType === 'SOW_VERIFICATION'
    ? `[NEXA] SOW Verification · ${opportunityId} · ${opportunityName}`
    : `[NEXA] Pricing Approval · ${opportunityId} · ${opportunityName}`

  const headingLabel = approvalType === 'SOW_VERIFICATION'
    ? 'SOW Verification Request'
    : 'Pricing Approval Request'

  const approverIntro = approvalType === 'SOW_VERIFICATION'
    ? `Hi ${approverName}, <strong style="color:#0A1F44;">${requesterName}</strong> has requested your approval to verify the SOW &amp; PO documents for this opportunity.`
    : `Hi ${approverName}, <strong style="color:#0A1F44;">${requesterName}</strong> has requested your approval for the <strong style="color:#0A1F44;">pricing stage</strong> of this opportunity.`

  // Approver — full email with Approve / Reject buttons
  await sendMail({
    to:      approverEmail,
    subject: subjectLine,
    html: wrap(`
      <h2 style="margin:0 0 6px;font-size:20px;color:#0A1F44;">${headingLabel}</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#6B7591;">${approverIntro}</p>
      ${detailsTable}
      <table cellpadding="0" cellspacing="0" style="margin-top:24px;width:100%;">
        <tr>
          <td style="padding-right:6px;">
            <a href="${approveUrl}" style="display:block;text-align:center;padding:12px 0;background:#16A34A;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">&#10003; Approve</a>
          </td>
          <td style="padding-left:6px;">
            <a href="${rejectUrl}" style="display:block;text-align:center;padding:12px 0;background:#DC2626;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">&#10005; Reject</a>
          </td>
        </tr>
      </table>
      <p style="margin:16px 0 0;font-size:11px;color:#9AA3B8;">You can also review this request in the app.</p>
      ${btn('Open in NEXA →', `${BASE_URL}/approvals`)}
    `),
  })

  // CC recipients — same details as approver, no action buttons (thread reply)
  if (ccEmails && ccEmails.length > 0) {
    await sendMail({
      to:      ccEmails,
      subject: subjectLine,
      html: wrap(`
        <h2 style="margin:0 0 6px;font-size:20px;color:#0A1F44;">${headingLabel}</h2>
        <p style="margin:0 0 20px;font-size:13px;color:#6B7591;">You have been CC'd on this request. <strong style="color:#0A1F44;">${requesterName}</strong> has requested approval from <strong style="color:#0A1F44;">${approverName}</strong>.</p>
        ${detailsTable}
        ${btn('Open in NEXA →', `${BASE_URL}/approvals`)}
      `),
    })
  }

  // Requester — notification only, no action links (thread reply)
  await sendMail({
    to:      requesterEmail,
    subject: subjectLine,
    html: wrap(`
      <h2 style="margin:0 0 6px;font-size:20px;color:#0A1F44;">${headingLabel} submitted</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#6B7591;">Hi ${requesterName}, your <strong style="color:#0A1F44;">${typeLabel}</strong> request has been sent to <strong style="color:#0A1F44;">${approverName}</strong> for review.</p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#F4F6FB;border-radius:8px;padding:16px;border:1px solid #D6DCE8;">
        ${metaRow('Opportunity', `<strong>${opportunityName}</strong> <span style="color:#6B7591;">(${opportunityId})</span>`)}
        ${metaRow('Client', clientName)}
        ${metaRow('Type', pill(typeLabel, approvalType === 'SOW_VERIFICATION' ? '#7C3AED' : '#1E5BB8'))}
        ${metaRow('Sent to', approverName)}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#6B7591;">You will be notified by email once a decision is made.</p>
      ${btn('Open in NEXA →', `${BASE_URL}/opportunities/${opportunityId}`)}
    `),
  })

}

export async function mailApprovalApproved({
  requesterEmail,
  requesterName,
  approverEmail,
  approverName,
  opportunityId,
  opportunityName,
  approvalType,
}: {
  requesterEmail:  string
  requesterName:   string
  approverEmail:   string
  approverName:    string
  opportunityId:   string
  opportunityName: string
  approvalType:    string
}) {
  const typeLabel   = approvalType === 'SOW_VERIFICATION' ? 'SOW Verification' : 'Pricing Approval'
  const subjectLine = approvalType === 'SOW_VERIFICATION'
    ? `[NEXA] SOW Verification · ${opportunityId} · ${opportunityName}`
    : `[NEXA] Pricing Approval · ${opportunityId} · ${opportunityName}`
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

  await sendMail({
    to:      requesterEmail,
    cc:      approverEmail,
    subject: subjectLine,
    html,
  })
}

export async function mailApprovalRejected({
  requesterEmail,
  requesterName,
  approverEmail,
  approverName,
  opportunityId,
  opportunityName,
  approvalType,
  reason,
}: {
  requesterEmail:  string
  requesterName:   string
  approverEmail:   string
  approverName:    string
  opportunityId:   string
  opportunityName: string
  approvalType:    string
  reason?:         string
}) {
  const typeLabel   = approvalType === 'SOW_VERIFICATION' ? 'SOW Verification' : 'Pricing Approval'
  const subjectLine = approvalType === 'SOW_VERIFICATION'
    ? `[NEXA] SOW Verification · ${opportunityId} · ${opportunityName}`
    : `[NEXA] Pricing Approval · ${opportunityId} · ${opportunityName}`
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

  await sendMail({
    to:      requesterEmail,
    cc:      approverEmail,
    subject: subjectLine,
    html,
  })
}

export async function mailApprovalWithdrawn({
  approverEmail,
  approverName,
  requesterEmail,
  requesterName,
  opportunityId,
  opportunityName,
  approvalType,
}: {
  approverEmail:   string
  approverName:    string
  requesterEmail:  string
  requesterName:   string
  opportunityId:   string
  opportunityName: string
  approvalType:    string
}) {
  const typeLabel   = approvalType === 'SOW_VERIFICATION' ? 'SOW Verification' : 'Pricing Approval'
  const subjectLine = approvalType === 'SOW_VERIFICATION'
    ? `[NEXA] SOW Verification · ${opportunityId} · ${opportunityName}`
    : `[NEXA] Pricing Approval · ${opportunityId} · ${opportunityName}`

  await sendMail({
    to:      [approverEmail, requesterEmail],
    subject: subjectLine,
    html: wrap(`
      <h2 style="margin:0 0 6px;font-size:20px;color:#0A1F44;">Request withdrawn</h2>
      <p style="margin:0 0 20px;font-size:13px;color:#6B7591;">
        <strong style="color:#0A1F44;">${requesterName}</strong> has withdrawn the
        <strong style="color:#0A1F44;">${typeLabel}</strong> request.
        Hi ${approverName}, no action is needed — the approve / reject links in the earlier email are now invalid.
      </p>
      <table cellpadding="0" cellspacing="0" style="width:100%;background:#F8FAFC;border-radius:8px;padding:16px;border:1px solid #D6DCE8;">
        ${metaRow('Opportunity', `<strong>${opportunityName}</strong> <span style="color:#6B7591;">(${opportunityId})</span>`)}
        ${metaRow('Status', pill('Withdrawn', '#6B7591'))}
        ${metaRow('Withdrawn by', requesterName)}
      </table>
      ${btn('Open in NEXA →', `${BASE_URL}/opportunities/${opportunityId}`)}
    `),
  })
}
