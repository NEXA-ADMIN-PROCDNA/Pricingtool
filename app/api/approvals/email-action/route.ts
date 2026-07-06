// /api/approvals/email-action — the endpoint behind the email Approve/Reject links.
// PUBLIC (excluded from proxy); the signed token IS the authorisation.
//
// GET  — verifies the token, shows an "are you sure" confirm page. Never mutates
//        (deliberate: prevents Safe-Links pre-scanners from silently auto-approving).
// POST — the actual action. For dual approvals the token may carry either Approver 1's
//        or Approver 2's ID; each slot is handled sequentially.
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyEmailAction } from '@/lib/approval-tokens'
import { mailApprovalRequested, mailApprovalApproved, mailApprovalRejected } from '@/lib/mail'

// ── Branded HTML shell ───────────────────────────────────────────
function page(body: string): Response {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>ProcDNA NEXA</title></head>
<body style="margin:0;padding:0;background:#F4F6FB;font-family:'Segoe UI',system-ui,sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:16px;box-shadow:0 8px 40px rgba(10,31,68,0.12);max-width:460px;width:90%;overflow:hidden;">
    <div style="background:#001E96;padding:16px 28px;display:flex;align-items:center;gap:8px;">
      <span style="font-family:Georgia,serif;font-weight:800;font-size:18px;letter-spacing:0.18em;color:#F4F6FB;text-transform:uppercase;">ProcDNA NEXA</span>
      <span style="display:inline-block;width:5px;height:5px;background:#005CD9;transform:rotate(45deg);"></span>
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
      <h1 style="margin:0 0 8px;font-size:20px;color:#001E96;">${title}</h1>
      <p style="margin:0;font-size:13px;color:#7B7C7F;line-height:1.6;">${message}</p>
    </div>`)
}

type ResultVariant = 'approved' | 'rejected' | 'info'

function resultPage(variant: ResultVariant, title: string, oppId: string, message: string) {
  const palette = {
    approved: { accent: '#36A463', title: '#1F6B3C' },
    rejected: { accent: '#D6454A', title: '#8A2A1F' },
    info:     { accent: '#005CD9', title: '#001E96' },
  }[variant]

  return page(`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:22px;
                font-family:'IBM Plex Mono','Courier New',monospace;
                font-size:10.5px;letter-spacing:0.18em;text-transform:uppercase;
                color:#7B7C7F;font-weight:500;">
      <span style="display:inline-block;width:5px;height:5px;background:${palette.accent};transform:rotate(45deg);"></span>
      ProcDNA NEXA · Approval · ${oppId}
    </div>
    <h1 style="margin:0 0 18px;font-family:'Instrument Serif','Fraunces',Georgia,serif;
               font-size:46px;font-weight:400;letter-spacing:-0.02em;line-height:1;color:${palette.title};">
      ${title}
    </h1>
    <div style="height:3px;background:${palette.accent};width:56px;margin:0 0 20px;"></div>
    <p style="margin:0;font-size:13.5px;line-height:1.55;color:#3A4A6A;">${message}</p>
    <p style="margin:24px 0 0;font-family:'IBM Plex Mono','Courier News',monospace;
              font-size:9.5px;letter-spacing:0.16em;text-transform:uppercase;color:#A5A7AA;">
      Decision recorded · You may close this window.
    </p>
  `)
}

function approveConfirmPage(token: string, opportunityName: string, approverName: string) {
  return page(`
    <h2 style="margin:0 0 4px;font-size:20px;color:#001E96;">Confirm approval</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#7B7C7F;">
      Hi <strong style="color:#001E96;">${approverName}</strong>, you are approving the request for
      <strong style="color:#001E96;">${opportunityName}</strong>.
    </p>
    <form method="POST" action="/api/approvals/email-action">
      <input type="hidden" name="token" value="${token}" />
      <button type="submit" style="width:100%;padding:11px 0;background:#16A34A;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;letter-spacing:0.02em;">
        ✓ Confirm Approval
      </button>
    </form>
    <p style="margin:12px 0 0;font-size:11px;color:#A5A7AA;text-align:center;">Changed your mind? Close this tab — no action will be taken.</p>`)
}

function rejectFormPage(token: string, opportunityName: string, approverName: string) {
  return page(`
    <h2 style="margin:0 0 4px;font-size:20px;color:#001E96;">Reject request</h2>
    <p style="margin:0 0 20px;font-size:13px;color:#7B7C7F;">
      Hi <strong style="color:#001E96;">${approverName}</strong>, you are rejecting the approval request for
      <strong style="color:#001E96;">${opportunityName}</strong>.
    </p>
    <form method="POST" action="/api/approvals/email-action">
      <input type="hidden" name="token" value="${token}" />
      <label style="display:block;font-size:12px;color:#7B7C7F;margin-bottom:6px;font-weight:600;">
        Reason for rejection <span style="color:#A5A7AA;font-weight:400;">(optional)</span>
      </label>
      <textarea name="reason" rows="4" placeholder="Enter your reason here…"
        style="width:100%;box-sizing:border-box;border:1px solid #D6DCE8;border-radius:8px;padding:10px 12px;font-size:13px;color:#001E96;font-family:inherit;resize:vertical;outline:none;"></textarea>
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
      approver2:   { select: { name: true, email: true } },
      opportunity: { select: { opportunityId: true, opportunityName: true, client: { select: { name: true } } } },
    },
  })
}

// Resolve which approver slot this token belongs to.
// Don't gate on approval.approver2 being populated — match by ID only.
function resolveApprover(
  approval: NonNullable<Awaited<ReturnType<typeof getApproval>>>,
  approverId: string
): { slot: 'A1' | 'A2'; name: string } | null {
  if (approval.approverId === approverId) return { slot: 'A1', name: approval.approver.name }
  if (approval.approverId2 === approverId) return { slot: 'A2', name: approval.approver2?.name ?? 'Approver 2' }
  return null
}

// ── GET — show confirm/reject page ───────────────────────────────
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return errorPage('Invalid Link', 'This link is missing required parameters.')

  const payload = verifyEmailAction(token)
  if (!payload) return errorPage('Link Expired', 'This approval link has expired or is invalid. Please use the ProcDNA NEXA app to take action.')

  const { approvalId, approverId, action } = payload

  const approval = await getApproval(approvalId)
  if (!approval) return errorPage('Not Found', 'This approval request no longer exists.')

  const who = resolveApprover(approval, approverId)
  if (!who) return errorPage('Unauthorised', 'You are not authorised to act on this request.')

  // Check if this slot has already been decided
  if (who.slot === 'A1' && approval.status !== 'PENDING') {
    const past = approval.status === 'APPROVED'  ? 'already been approved'
               : approval.status === 'WITHDRAWN' ? 'been withdrawn by the requester'
               : 'already been rejected'
    return resultPage('info', 'Already Decided.', approval.opportunity.opportunityId, `This request has ${past}. No further action is needed.`)
  }
  if (who.slot === 'A2') {
    if (approval.approver2Status === null) {
      return resultPage('info', 'Not Yet.', approval.opportunity.opportunityId, 'Approver 1 (Finance) has not yet approved. You will receive a new email when it is your turn.')
    }
    if (approval.approver2Status !== 'PENDING') {
      return resultPage('info', 'Already Decided.', approval.opportunity.opportunityId, 'You have already acted on this request. No further action is needed.')
    }
  }

  if (action === 'reject') return rejectFormPage(token, approval.opportunity.opportunityName, who.name)
  return approveConfirmPage(token, approval.opportunity.opportunityName, who.name)
}

// ── POST — execute the action ─────────────────────────────────────
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
  if (!payload) return errorPage('Link Expired', 'This approval link has expired or is invalid.')

  const { approvalId, approverId, action } = payload

  const approval = await getApproval(approvalId)
  if (!approval) return errorPage('Not Found', 'This approval request no longer exists.')

  const who = resolveApprover(approval, approverId)
  if (!who) return errorPage('Unauthorised', 'You are not authorised to act on this request.')

  const isDual = !!approval.approverId2
  const opp    = approval.opportunity

  // ── Approver 2 path ────────────────────────────────────────────
  if (who.slot === 'A2') {
    if (approval.approver2Status === null) {
      return resultPage('info', 'Not Yet.', opp.opportunityId, 'Approver 1 (Finance) has not yet approved. You will receive a new email when it is your turn.')
    }
    if (approval.approver2Status !== 'PENDING') {
      return resultPage('info', 'Already Decided.', opp.opportunityId, 'You have already acted on this request.')
    }

    if (action === 'approve') {
      // Both approved → mark APPROVED and advance stage
      await prisma.approvalRequest.update({
        where: { id: approvalId },
        data:  { status: 'APPROVED', approver2Status: 'APPROVED', decidedAt: new Date() },
      })
      let newStage: 'TO_BE_ARCHIVED' | 'SOW_PENDING'
      if (approval.approvalType === 'SOW_VERIFICATION') {
        newStage = 'TO_BE_ARCHIVED'
      } else {
        const sowApproved = await prisma.approvalRequest.findFirst({
          where:  { opportunityId: approval.opportunityId, approvalType: 'SOW_VERIFICATION', status: 'APPROVED' },
          select: { id: true },
        })
        newStage = sowApproved ? 'TO_BE_ARCHIVED' : 'SOW_PENDING'
      }
      await prisma.opportunity.update({ where: { id: approval.opportunityId }, data: { stage: newStage } })
      await mailApprovalApproved({
        requesterEmail:  approval.requestedBy.email,
        requesterName:   approval.requestedBy.name,
        approverEmail:   approval.approver.email,
        approverName:    approval.approver.name,
        opportunityId:   opp.opportunityId,
        opportunityName: opp.opportunityName,
        clientName:      opp.client?.name ?? '',
        approvalType:    approval.approvalType,
      })
      return resultPage('approved', 'Approved.', opp.opportunityId,
        `You have approved the request for <strong style="color:#001E96;">${opp.opportunityName}</strong>. The requester has been notified.`)
    }

    // action === 'reject'
    await prisma.approvalRequest.update({
      where: { id: approvalId },
      data:  { approver2Status: 'REJECTED', status: 'REJECTED', decidedAt: new Date(), rejectionReason: reason || null },
    })
    const rollbackStage = approval.approvalType === 'SOW_VERIFICATION' ? 'SOW_SUBMITTED' : 'PRICE_LINKED'
    await prisma.opportunity.update({ where: { id: approval.opportunityId }, data: { stage: rollbackStage } })
    await mailApprovalRejected({
      requesterEmail:  approval.requestedBy.email,
      requesterName:   approval.requestedBy.name,
      approverEmail:   approval.approver2!.email,
      approverName:    approval.approver2!.name,
      opportunityId:   opp.opportunityId,
      opportunityName: opp.opportunityName,
      clientName:      opp.client?.name ?? '',
      approvalType:    approval.approvalType,
      reason:          reason || undefined,
    })
    return resultPage('rejected', 'Rejected.', opp.opportunityId,
      `You have rejected the request for <strong style="color:#001E96;">${opp.opportunityName}</strong>. The requester has been notified.`)
  }

  // ── Approver 1 path (single or dual) ──────────────────────────
  if (approval.status !== 'PENDING') {
    const past = approval.status === 'APPROVED'  ? 'already been approved'
               : approval.status === 'WITHDRAWN' ? 'been withdrawn by the requester'
               : 'already been rejected'
    return resultPage('info', 'Already Decided.', opp.opportunityId, `This request has ${past}. No further action is needed.`)
  }

  if (action === 'approve') {
    if (!isDual) {
      // Single approval → advance stage
      await prisma.approvalRequest.update({ where: { id: approvalId }, data: { status: 'APPROVED', decidedAt: new Date() } })
      let newStage: 'TO_BE_ARCHIVED' | 'SOW_PENDING'
      if (approval.approvalType === 'SOW_VERIFICATION') {
        newStage = 'TO_BE_ARCHIVED'
      } else {
        const sowApproved = await prisma.approvalRequest.findFirst({
          where:  { opportunityId: approval.opportunityId, approvalType: 'SOW_VERIFICATION', status: 'APPROVED' },
          select: { id: true },
        })
        newStage = sowApproved ? 'TO_BE_ARCHIVED' : 'SOW_PENDING'
      }
      await prisma.opportunity.update({ where: { id: approval.opportunityId }, data: { stage: newStage } })
      await mailApprovalApproved({
        requesterEmail:  approval.requestedBy.email,
        requesterName:   approval.requestedBy.name,
        approverEmail:   approval.approver.email,
        approverName:    approval.approver.name,
        opportunityId:   opp.opportunityId,
        opportunityName: opp.opportunityName,
        clientName:      opp.client?.name ?? '',
        approvalType:    approval.approvalType,
      })
    } else {
      // Dual: unlock Approver 2, email them
      await prisma.approvalRequest.update({
        where: { id: approvalId },
        data:  { approver2Status: 'PENDING' },
      })
      // Fetch A2 directly in case the included relation wasn't populated
      const a2User = approval.approver2 ?? (
        approval.approverId2
          ? await prisma.user.findUnique({ where: { id: approval.approverId2 }, select: { name: true, email: true } })
          : null
      )
      if (a2User) {
        await mailApprovalRequested({
          approverEmail:         a2User.email,
          approverName:          a2User.name,
          requesterEmail:        approval.requestedBy.email,
          requesterName:         approval.requestedBy.name,
          opportunityId:         opp.opportunityId,
          opportunityName:       opp.opportunityName,
          clientName:            opp.client?.name ?? '',
          approvalType:          approval.approvalType,
          approvalRecordId:      approval.id,
          approverId:            approval.approverId2!,
          businessJustification: approval.businessJustification,
        })
      } else {
        console.error('[email-action] approverId2 set but user not found:', approval.approverId2)
      }
    }
    return resultPage('approved', 'Approved.', opp.opportunityId,
      isDual
        ? `Your approval has been recorded. Approver 2 has been notified and will complete the final sign-off.`
        : `You have approved the request for <strong style="color:#001E96;">${opp.opportunityName}</strong>. The requester has been notified.`)
  }

  // action === 'reject' (Approver 1)
  await prisma.approvalRequest.update({
    where: { id: approvalId },
    data:  { status: 'REJECTED', decidedAt: new Date(), rejectionReason: reason || null },
  })
  if (approval.approvalType === 'PRICING') {
    await prisma.approvalRequest.updateMany({
      where: { opportunityId: approval.opportunityId, approvalType: 'SOW_VERIFICATION', status: { in: ['PENDING', 'APPROVED'] } },
      data:  { status: 'WITHDRAWN', decidedAt: new Date(), withdrawalReason: 'Auto-invalidated — the pricing approval was rejected.' },
    })
  }
  const rollbackStage = approval.approvalType === 'SOW_VERIFICATION' ? 'SOW_SUBMITTED' : 'PRICE_LINKED'
  await prisma.opportunity.update({ where: { id: approval.opportunityId }, data: { stage: rollbackStage } })
  await mailApprovalRejected({
    requesterEmail:  approval.requestedBy.email,
    requesterName:   approval.requestedBy.name,
    approverEmail:   approval.approver.email,
    approverName:    approval.approver.name,
    opportunityId:   opp.opportunityId,
    opportunityName: opp.opportunityName,
    clientName:      opp.client?.name ?? '',
    approvalType:    approval.approvalType,
    reason:          reason || undefined,
  })
  return resultPage('rejected', 'Rejected.', opp.opportunityId,
    `You have rejected the request for <strong style="color:#001E96;">${opp.opportunityName}</strong>. The requester has been notified.`)
}
