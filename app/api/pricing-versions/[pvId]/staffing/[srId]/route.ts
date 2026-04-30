import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ pvId: string; srId: string }> }
) {
  try {
    const { srId } = await params
    await prisma.staffingResource.delete({ where: { id: srId } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: 'Failed to remove staffing resource' }, { status: 500 })
  }
}
