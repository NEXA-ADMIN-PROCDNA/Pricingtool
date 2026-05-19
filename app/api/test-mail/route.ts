import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { ClientSecretCredential } from '@azure/identity'

export async function GET(req: NextRequest) {
  const token = await getToken({ req })
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result: Record<string, unknown> = {}

  // ── 1. Env var check ─────────────────────────────────────────
  const sender       = process.env.MAIL_SENDER
  const tenantId     = process.env.AZURE_AD_TENANT_ID
  const clientId     = process.env.AZURE_AD_CLIENT_ID
  const clientSecret = process.env.AZURE_AD_CLIENT_SECRET

  result.env = {
    MAIL_SENDER:            sender         ? `✓ set (${sender})`          : '✗ MISSING',
    AZURE_AD_TENANT_ID:     tenantId       ? '✓ set'                      : '✗ MISSING',
    AZURE_AD_CLIENT_ID:     clientId       ? '✓ set'                      : '✗ MISSING',
    AZURE_AD_CLIENT_SECRET: clientSecret   ? '✓ set'                      : '✗ MISSING',
  }

  if (!sender || !tenantId || !clientId || !clientSecret) {
    return NextResponse.json({ step: 'env_check', ...result }, { status: 200 })
  }

  // ── 2. Token acquisition ──────────────────────────────────────
  let accessToken: string
  try {
    const cred = new ClientSecretCredential(tenantId, clientId, clientSecret)
    const tok  = await cred.getToken('https://graph.microsoft.com/.default')
    if (!tok?.token) throw new Error('getToken returned null')
    accessToken = tok.token
    result.tokenAcquired = '✓ success'
  } catch (e) {
    result.tokenAcquired = `✗ failed: ${String(e)}`
    return NextResponse.json({ step: 'token', ...result }, { status: 200 })
  }

  // ── 3. Send test mail to sender itself ────────────────────────
  const testBody = JSON.stringify({
    message: {
      subject: '[NEXA] Test mail — diagnostic',
      body: { contentType: 'HTML', content: '<p>This is a diagnostic test mail from NEXA.</p>' },
      toRecipients: [{ emailAddress: { address: sender } }],
    },
    saveToSentItems: false,
  })

  try {
    const res = await fetch(`https://graph.microsoft.com/v1.0/users/${sender}/sendMail`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body:    testBody,
    })

    if (res.ok) {
      result.mailSent = `✓ success (HTTP ${res.status}) — check ${sender} inbox`
    } else {
      const errText = await res.text()
      result.mailSent = `✗ Graph API error (HTTP ${res.status}): ${errText}`
    }
  } catch (e) {
    result.mailSent = `✗ fetch threw: ${String(e)}`
  }

  return NextResponse.json({ step: 'done', ...result }, { status: 200 })
}
