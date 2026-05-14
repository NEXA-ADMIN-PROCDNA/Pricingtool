import { MainLayout } from '@/components/layout/MainLayout'
import { ApprovalsInbox } from './ApprovalsInbox'

export default function ApprovalsPage() {
  return (
    <MainLayout title="Approvals" scrollable>
      <ApprovalsInbox />
    </MainLayout>
  )
}
