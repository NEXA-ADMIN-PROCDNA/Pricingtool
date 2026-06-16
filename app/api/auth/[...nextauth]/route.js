// /api/auth/[...nextauth] — the NextAuth handler. Mounts every auth endpoint
// (signin, callback, signout, session, csrf) for both providers using the shared
// authOptions. PUBLIC (excluded from proxy). The real config + risks live in lib/auth.js.
import NextAuth from "next-auth"
import { authOptions } from "@/lib/auth"

const handler = NextAuth(authOptions)
export { handler as GET, handler as POST }