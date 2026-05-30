import { notFound } from 'next/navigation'
import { getHumanById } from '@/lib/services/humansService'
import InkNoteComposer from './InkNoteComposer'

interface Props {
  params: Promise<{ id: string }>
}

function getDisplayName(user: {
  fullName?: string | null
  firstName?: string | null
  lastName?: string | null
  preferredName?: string | null
  workEmail?: string | null
}): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.workEmail ?? ''
}

export default async function InkNotePage({ params }: Props) {
  const { id } = await params
  const user = await getHumanById(id)
  if (!user) notFound()

  return (
    <InkNoteComposer
      subjectPersonId={id}
      subjectName={getDisplayName(user)}
    />
  )
}
