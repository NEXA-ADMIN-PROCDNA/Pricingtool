import { MainLayout } from '@/components/layout/MainLayout'
import { getClientsForSelect } from '@/lib/db/clients'
import { getUsersForSelect } from '@/lib/db/users'
import { NewOpportunityForm } from './NewOpportunityForm'

export default async function NewOpportunityPage() {
  const [clients, users] = await Promise.all([
    getClientsForSelect(),
    getUsersForSelect(),
  ])

  return (
    <MainLayout title="New Opportunity" scrollable>
      <div className="max-w-3xl mx-auto">
        <p className="text-sm text-slate-500 mb-6">
          Fill in the details below. The BD ID will be auto-assigned on save.
        </p>
        <NewOpportunityForm clients={clients} users={users} />
      </div>
    </MainLayout>
  )
}
