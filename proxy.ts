import { withAuth } from 'next-auth/middleware'

export const proxy = withAuth

export const config = {
  matcher: ['/((?!login|api/auth|_next/static|_next/image|favicon.ico).*)'],
}
