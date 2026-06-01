import { withAuth } from 'next-auth/middleware'

export const proxy = withAuth({
  secret: process.env.NEXTAUTH_SECRET,
})

export const config = {
  matcher: ['/((?!login|login2|api/auth|api/approvals/email-action|api/emergency|_next/static|_next/image|favicon.ico).*)'],
}
