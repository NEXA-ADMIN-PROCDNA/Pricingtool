import { prisma } from '@/lib/prisma'

// GET
export async function GET() {
  try {
    const users = await prisma.user.findMany()
    return Response.json(users)
  } catch (error) {
    return Response.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST
export async function POST(req: Request) {
  try {
    const body = await req.json()

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email: body.email,
      },
    })

    return Response.json(user)
  } catch (error) {
    return Response.json({ error: 'Failed to create user' }, { status: 500 })
  }
}