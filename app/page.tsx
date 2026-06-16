// app/page.tsx — root route. Server component that immediately redirects "/" → /dashboard
// (there is no standalone home page). The proxy enforces auth on /dashboard.
import { redirect } from "next/navigation"

export default function Home() {
  redirect("/dashboard")
}