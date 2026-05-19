import { createHmac } from 'crypto'

const TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

function secret(): string {
  return process.env.NEXTAUTH_SECRET ?? ''
}

export function signEmailAction(
  approvalId: string,
  approverId: string,
  action: 'approve' | 'reject',
): string {
  const exp  = Date.now() + TTL_MS
  const data = `${approvalId}|${approverId}|${action}|${exp}`
  const sig  = createHmac('sha256', secret()).update(data).digest('base64url')
  return Buffer.from(data).toString('base64url') + '.' + sig
}

export function verifyEmailAction(token: string): {
  approvalId: string
  approverId: string
  action: 'approve' | 'reject'
} | null {
  try {
    const dot = token.lastIndexOf('.')
    if (dot < 0) return null
    const dataPart = token.slice(0, dot)
    const sig      = token.slice(dot + 1)
    const data     = Buffer.from(dataPart, 'base64url').toString()
    const expected = createHmac('sha256', secret()).update(data).digest('base64url')
    if (sig !== expected) return null
    const parts = data.split('|')
    if (parts.length !== 4) return null
    const [approvalId, approverId, action, expStr] = parts
    if (Date.now() > parseInt(expStr, 10)) return null
    if (action !== 'approve' && action !== 'reject') return null
    return { approvalId, approverId, action }
  } catch {
    return null
  }
}
