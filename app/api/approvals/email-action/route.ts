import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyEmailAction } from '@/lib/approval-tokens'
import { mailApprovalApproved, mailApprovalRejected } from '@/lib/mail'

// ── Branded HTML shell ───────────────────────────────────────────
function page(body: string): Response {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>NEXA</title></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(10,31,68,0.12);max-width:460px;width:90%;overflow:hidden;">
    <div style="background:#0A1F44;padding:16px 28px;display:flex;align-items:center;gap:8px;">
      <span style="font-family:Georgia,serif;font-weight:800;font-size:18px;letter-spacing:0.18em;color:#F4F6FB;text-transform:uppercase;">NEXA</span>
      <span style="display:inline-block;width:5px;height:5px;background:#1E5BB8;transform:rotate(45deg);"></span>
    </div>
    <div style="padding:32px 28px 28px;">${body}</div>
  </div>
</body></html>`
  return new Response(html, { headers: { 'Content-Type': 'text/html' } })
}

function errorPage(title: string, message: string) {
  return page(`
    <div style="text-align:center;">
      <div style="font-size:44px;margin-bottom:16px;">⚠️</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#0A1F44;">${title}</h1>
      <p style="margin:0;font-size:13px;color:#6B7591;line-height:1.6;">${message}</p>
    </div>`)
}

function successPage(title: string, icon: string, message: string) {
  return page(`
    <div style="text-align:center;">
      <div style="font-size:44px;margin-bottom:16px;">${icon}</div>
      <h1 style="margin:0 0 8px;font-size:20px;color:#0A1F44;">${title}</h1>
      <p style="margin:0;font-size:13px;color:#6B7591;line-height:1.6;">${message}</p>
    </div>`)
}

function rejectFormPage(token: string, opportunityName: string, approverName: string) {
  return page(`
    <h2 style="margin:0 0 4px;font-size:20px;color:#0A1F44;">Reject request</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#6B7591;">
      Hi <strong style="color:#0A1F44;">${approverName}</strong>, you are rejecting the approval request for
      <strong style="color:#0A1F44;">${opportunityName}</strong>.
    </p>
    <form method="POST" action="/api/approvals/email-action">
      <input type="hidden" name="token" value="${token}" />
      <label style="display:block;font-size:12px;color:#6B7591;margin-bottom:6px;font-weight:600;">
        Reason for rejection <span style="color:#9AA3B8;font-weight:400;">(optional)</span>
      </label>
      <textarea
        name="reason"
        rows="4"
        placeholder="Enter your reason here…"
        style="width:100%;box-sizing:border-box;border:1px solid #D6DCE8;border-radius:8px;padding:10px 12px;font-size:13px;color:#0A1F44;font-family:inherit;resize:vertical;outline:none;"
      ></textarea>
      <div style="margin-top:16px;">
        <button type="submit" style="width:100%;padding:11px 0;background:#DC2626;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.02em;">
          Confirm Rejection
        </button>
      </div>
    </form>`)
}

// ── DB helper ────────────────────────────────────────────────────
async function getApproval(approvalId: string) {
  return prisma.approvalRequest.findUnique({
    where:   { id: approvalId },
    include: {
      requestedBy: { select: { name: true, email: true } },
      approver:    { select: { name: true, email: true } },
      opportunity: { select: { opportunityId: true, opportunityName: true } },
    },
  })
}

// ── GET — approve immediately, or show reject form ───────────────
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return errorPage('Invalid Link', 'This link is missing required parameters.')

  const payload = verifyEmailAction(token)
  if (!payload) return errorPage('Link Expired', 'This approval link has expired or is invalid. Please use the NEXA app to take action.')

  const { approvalId, approverId, action } = payload

  const approval = await getApproval(approvalId)
  if (!approval)                             return errorPage('Not Found',     'This approval request no longer exists.')
  if (approval.approverId !== approverId)    return errorPage('Unauthorised',  'You are not authorised to act on this request.')
  if (approval.status !== 'PENDING') {
    const s    = approval.status as string
    const past = s === 'APPROVED'  ? 'already been approved'
               : s === 'WITHDRAWN' ? 'been withdrawn by the requester'
               : 'already been rejected'
    return successPage('Already Decided', 'ℹ️', `This request has ${past}. No further action is needed.`)
  }

  if (action === 'reject') {
    return rejectFormPage(token, approval.opportunity.opportunityName, approval.approver.name)
  }

  // ── Approve ──────────────────────────────────────────────────
  const newStage = approval.approvalType === 'SOW_VERIFICATION' ? 'TO_BE_ARCHIVED' : 'SOW_PENDING'
  await prisma.approvalRequest.update({
    where: { id: approvalId },
    data:  { status: 'APPROVED', decidedAt: new Date() },
  })
  await prisma.opportunity.update({
    where: { id: approval.opportunityId },
    data:  {
      stage: newStage,
      ...(approval.approvalType === 'SOW_VERIFICATION' ? { status: 'WON' } : {}),
    },
  })

  await mailApprovalApproved({
    requesterEmail:   approval.requestedBy.email,
    requesterName:    approval.requestedBy.name,
    approverEmail:    approval.approver.email,
    approverName:     approval.approver.name,
    opportunityId:    approval.opportunity.opportunityId,
    opportunityName:  approval.opportunity.opportunityName,
    approvalType:     approval.approvalType,
  })

  return successPage(
    'Approved ✓', '✅',
    `You have approved the request for <strong>${approval.opportunity.opportunityName}</strong>. The requester has been notified.`,
  )
}

// ── POST — receive rejection reason form ─────────────────────────
export async function POST(req: NextRequest) {
  let token  = ''
  let reason = ''

  const ct = req.headers.get('content-type') ?? ''
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const fd = await req.formData()
    token  = (fd.get('token')  as string | null) ?? ''
    reason = ((fd.get('reason') as string | null) ?? '').trim()
  } else {
    const body = await req.json().catch(() => ({})) as Record<string, string>
    token  = body.token  ?? ''
    reason = (body.reason ?? '').trim()
  }

  if (!token) return errorPage('Invalid Request', 'Token is missing.')

  const payload = verifyEmailAction(token)
  if (!payload)                    return errorPage('Link Expired',    'This approval link has expired or is invalid.')
  if (payload.action !== 'reject') return errorPage('Invalid Action',  'This link is not for rejection.')

  const { approvalId, approverId } = payload

  const approval = await getApproval(approvalId)
  if (!approval)                          return errorPage('Not Found',    'This approval request no longer exists.')
  if (approval.approverId !== approverId) return errorPage('Unauthorised', 'You are not authorised to act on this request.')
  if (approval.status !== 'PENDING') {
    const s    = approval.status as string
    const past = s === 'APPROVED'  ? 'already been approved'
               : s === 'WITHDRAWN' ? 'been withdrawn by the requester'
               : 'already been rejected'
    return successPage('Already Decided', 'ℹ️', `This request has ${past}. No further action is needed.`)
  }

  await prisma.approvalRequest.update({
    where: { id: approvalId },
    data:  { status: 'REJECTED', decidedAt: new Date(), rejectionReason: reason || null },
  })
  const rollbackStage = approval.approvalType === 'SOW_VERIFICATION' ? 'SOW_SUBMITTED' : 'PRICE_LINKED'
  await prisma.opportunity.update({
    where: { id: approval.opportunityId },
    data:  { stage: rollbackStage },
  })

  await mailApprovalRejected({
    requesterEmail:   approval.requestedBy.email,
    requesterName:    approval.requestedBy.name,
    approverEmail:    approval.approver.email,
    approverName:     approval.approver.name,
    opportunityId:    approval.opportunity.opportunityId,
    opportunityName:  approval.opportunity.opportunityName,
    approvalType:     approval.approvalType,
    reason:           reason || undefined,
  })

  return successPage(
    'Rejected', '✕',
    `You have rejected the request for <strong>${approval.opportunity.opportunityName}</strong>. The requester has been notified.`,
  )
}
