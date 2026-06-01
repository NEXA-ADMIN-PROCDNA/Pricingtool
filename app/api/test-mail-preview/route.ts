import { NextRequest } from 'next/server'
import { signEmailAction } from '@/lib/approval-tokens'

const BASE_URL = (process.env.MAIL_BASE_URL ?? 'https://procdnanexa.vercel.app').replace(/\/$/, '')

// Dummy IDs — email-action route will return "Not Found" which proves no auth needed
const DUMMY_APPROVAL_ID = 'test-approval-preview-id'
const DUMMY_APPROVER_ID = 'test-approver-preview-id'

export async function GET(_req: NextRequest) {
  const approveUrl = `${BASE_URL}/api/approvals/email-action?token=${signEmailAction(DUMMY_APPROVAL_ID, DUMMY_APPROVER_ID, 'approve')}`
  const rejectUrl  = `${BASE_URL}/api/approvals/email-action?token=${signEmailAction(DUMMY_APPROVAL_ID, DUMMY_APPROVER_ID, 'reject')}`

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>NEXA — Mail Preview</title></head>
<body style="margin:0;padding:20px;background:#e8ecf4;font-family:'Segoe UI',system-ui,sans-serif;">

  <!-- Status banner -->
  <div style="max-width:600px;margin:0 auto 16px;padding:12px 16px;background:#fff8e1;border:1px solid #f59e0b;border-radius:8px;font-size:12px;color:#92400e;">
    <strong>Test Preview</strong> — Buttons point to dummy approval ID. Clicking them will show "Not Found" (proving no login required). Auth status: <span id="authStatus" style="font-weight:600;">checking…</span>
  </div>

  <!-- Auth check result -->
  <div id="authResult" style="max-width:600px;margin:0 auto 16px;display:none;padding:12px 16px;border-radius:8px;font-size:12px;font-weight:600;"></div>

  <!-- Exact email HTML as it would appear in inbox -->
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #D6DCE8;">
        <tr><td style="background:#0A1F44;padding:20px 32px;">
          <span style="font-family:Georgia,serif;font-weight:800;font-size:22px;letter-spacing:0.18em;color:#F4F6FB;text-transform:uppercase;">NEXA</span>
          <span style="display:inline-block;width:6px;height:6px;background:#1E5BB8;transform:rotate(45deg);margin-left:8px;"></span>
        </td></tr>
        <tr><td style="padding:32px 32px 24px;">
          <h2 style="margin:0 0 6px;font-size:20px;color:#0A1F44;">New approval request</h2>
          <p style="margin:0 0 20px;font-size:13px;color:#6B7591;">Hi <strong style="color:#0A1F44;">Approver Name</strong>, <strong style="color:#0A1F44;">Requester Name</strong> has requested your approval.</p>
          <table cellpadding="0" cellspacing="0" style="width:100%;background:#F4F6FB;border-radius:8px;padding:16px;border:1px solid #D6DCE8;">
            <tr>
              <td style="padding:5px 0;font-size:12px;color:#6B7591;width:140px;vertical-align:top;">Opportunity</td>
              <td style="padding:5px 0;font-size:13px;color:#0A1F44;font-weight:500;"><strong>Test Opportunity</strong> <span style="color:#6B7591;">(BD-001)</span></td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:12px;color:#6B7591;width:140px;vertical-align:top;">Client</td>
              <td style="padding:5px 0;font-size:13px;color:#0A1F44;font-weight:500;">Test Client</td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:12px;color:#6B7591;width:140px;vertical-align:top;">Type</td>
              <td style="padding:5px 0;font-size:13px;color:#0A1F44;font-weight:500;"><span style="display:inline-block;padding:2px 10px;border-radius:99px;font-size:11px;font-weight:600;background:#1E5BB820;color:#1E5BB8;border:1px solid #1E5BB840;">Pricing Approval</span></td>
            </tr>
            <tr>
              <td style="padding:5px 0;font-size:12px;color:#6B7591;width:140px;vertical-align:top;">Total Revenue</td>
              <td style="padding:5px 0;font-size:13px;color:#0A1F44;font-weight:500;"><strong>$1.20M</strong></td>
            </tr>
          </table>

          <!-- Action buttons — table layout (mobile safe) -->
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
          <a href="${BASE_URL}/approvals" style="display:inline-block;margin-top:20px;padding:10px 24px;background:#1E5BB8;color:#ffffff;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;">Open in NEXA →</a>
        </td></tr>
        <tr><td style="padding:16px 32px 28px;border-top:1px solid #D6DCE8;">
          <p style="margin:0;font-size:11px;color:#9AA3B8;">This is an automated message from NEXA · Business Development &amp; Pricing Tool. Do not reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>

  <script>
    // Check if the current session is authenticated by hitting a protected route
    fetch('/api/users')
      .then(r => {
        const banner = document.getElementById('authResult')
        const status = document.getElementById('authStatus')
        banner.style.display = 'block'
        if (r.status === 401) {
          status.textContent = 'NOT logged in'
          status.style.color = '#16A34A'
          banner.style.background = '#f0fdf4'
          banner.style.border = '1px solid #86efac'
          banner.style.color = '#15803d'
          banner.textContent = '✓ You are NOT logged in to NEXA. Clicking Approve/Reject should still work (no auth required). If you get the login page — the route has an auth issue.'
        } else {
          status.textContent = 'logged in'
          status.style.color = '#dc2626'
          banner.style.background = '#fef2f2'
          banner.style.border = '1px solid #fca5a5'
          banner.style.color = '#dc2626'
          banner.textContent = '⚠ You ARE logged in to NEXA. To properly test auth-free access, open this page in incognito or on a device where you are not logged in.'
        }
      })
      .catch(() => {
        document.getElementById('authStatus').textContent = 'unknown'
      })
  </script>
</body></html>`

  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
}
