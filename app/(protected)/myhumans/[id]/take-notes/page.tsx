import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getAllUsers, fetchProfileOptions } from '@/lib/airtable/users'
import { getCoachPersonContext } from '@/lib/airtable/coachPersonContext'
import { getInteractionsForUser } from '@/lib/services/interactionsService'
import { getInteractionById } from '@/lib/airtable/interactions'
import { getMostRecentInteractionNoteByClient } from '@/lib/airtable/notes'
import { getPermissionLevel, canWrite } from '@/lib/auth/permissions'
import TakeNotesWorkspace from './TakeNotesWorkspace'
import type { Interaction } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ interactionId?: string }>
}

export default async function TakeNotesPage({ params, searchParams }: Props) {
  const { id } = await params
  const { interactionId } = await searchParams

  const [user, sessionUser, currentUserRecord] = await Promise.all([
    getUserById(id),
    getSessionUser(),
    getCurrentUserRecord(),
  ])

  if (!user) notFound()

  const contactEmail = user.workEmail ?? user.email
  const displayName =
    user.fullName ??
    ([user.firstName, user.lastName].filter(Boolean).join(' ') || user.email)

  const [profileOptions, coachContext, interactions, initialInteraction, permissionLevel] =
    await Promise.all([
      getAllUsers().then((allUsers) => fetchProfileOptions(allUsers)),
      currentUserRecord.airtableId
        ? getCoachPersonContext(currentUserRecord.airtableId, id).catch(() => null)
        : Promise.resolve(null),
      getInteractionsForUser(
        contactEmail,
        sessionUser,
        id,
        currentUserRecord.email || undefined,
        displayName,
      ).catch(() => ({ upcoming: [] as Interaction[], past: [] as Interaction[] })),
      interactionId ? getInteractionById(interactionId).catch(() => null) : Promise.resolve(null),
      getPermissionLevel(currentUserRecord.airtableId, currentUserRecord.role, id),
    ])

  const lastInteractionNote = await getMostRecentInteractionNoteByClient(
    id,
    interactionId ?? undefined,
  ).catch(() => null)

  const userCanWrite = canWrite(permissionLevel)

  // Combine upcoming + recent past for the interaction picker (capped for perf)
  const allInteractions: Interaction[] = [
    ...interactions.upcoming,
    ...interactions.past.slice(0, 30),
  ]

  return (
    <TakeNotesWorkspace
      person={user}
      coachContext={coachContext}
      profileOptions={profileOptions}
      meetings={allInteractions}
      initialInteraction={initialInteraction ?? null}
      userCanWrite={userCanWrite}
      lastInteractionNote={lastInteractionNote}
    />
  )
}
