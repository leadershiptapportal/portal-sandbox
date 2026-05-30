import { getAllUsers, fetchProfileOptions } from '@/lib/airtable/users'
import PageHeader from '@/components/layout/PageHeader'
import NewPersonForm from './NewPersonForm'

export default async function NewPersonPage() {
  const allUsers = await getAllUsers()
  const { coaches, companies } = await fetchProfileOptions(allUsers)

  const nameOf = (u: { id: string; fullName?: string; firstName?: string; lastName?: string; workEmail?: string }) =>
    (u.fullName ?? [u.firstName, u.lastName].filter(Boolean).join(' ')) || u.workEmail || u.id

  const allUserOptions = allUsers.map((u) => ({
    id: u.id,
    name: nameOf(u),
    companyId: u.companyLinkedIds?.[0],
  }))

  return (
    <>
      <PageHeader
        title="Add Person"
        description="Relationship context rows are created automatically based on the selections below."
      />
      <div className="max-w-2xl mx-auto py-6 px-4">
        <NewPersonForm
          coaches={coaches}
          allUsers={allUserOptions}
          companies={companies}
        />
      </div>
    </>
  )
}
