// app/approvals/page.tsx — the /approvals route (server component). Thin shell: renders the
// client <ApprovalsInbox> (which fetches the approver's queue) inside the app layout.
import { MainLayout } from '@/components/layout/MainLayout'
import { ApprovalsInbox } from './ApprovalsInbox'

export const dynamic = 'force-dynamic'

export default function ApprovalsPage() {
  return (
    <MainLayout noPadding scrollable>
      <ApprovalsInbox />
    </MainLayout>
  )
}
