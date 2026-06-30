// /api/health — ECS/ALB target-group health check. PUBLIC (excluded from proxy auth).
// No DB/auth calls on purpose: must answer fast even if downstream deps are down,
// so ECS doesn't kill a task that's actually fine.
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ status: 'ok' })
}
