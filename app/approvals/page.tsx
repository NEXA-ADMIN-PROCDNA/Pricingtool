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
