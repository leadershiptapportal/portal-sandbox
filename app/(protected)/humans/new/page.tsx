import { getAllHumans, fetchProfileOptions } from '@/lib/airtable/humans'
import PageHeader from '@/components/layout/PageHeader'
import NewPersonForm from './NewPersonForm'

export default async function NewPersonPage() {
  const allHumans = await getAllHumans()
  const { coaches, organizations } = await fetchProfileOptions(allHumans)

  const nameOf = (h: { id: string; fullName?: string; firstName?: string; lastName?: string; workEmail?: string }) =>
    (h.fullName ?? [h.firstName, h.lastName].filter(Boolean).join(' ')) || h.workEmail || h.id

  const allHumanOptions = allHumans.map((h) => ({
    id: h.id,
    name: nameOf(h),
    organizationId: h.organizationLinkedIds?.[0],
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
          allHumans={allHumanOptions}
          organizations={organizations}
        />
      </div>
    </>
  )
}
