import { withAuth } from 'next-auth/middleware'

export const proxy = withAuth

export const config = {
  matcher: ['/((?!login|api/auth|api/approvals/email-action|api/emergency|_next/static|_next/image|favicon.ico).*)'],
}
