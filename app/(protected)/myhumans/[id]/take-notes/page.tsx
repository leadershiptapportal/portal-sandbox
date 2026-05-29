import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getAllUsers, fetchProfileOptions } from '@/lib/airtable/users'
import { getCoachPersonContext } from '@/lib/airtable/coachPersonContext'
import { getInteractionsForUser } from '@/lib/services/interactionsService'
import { getInteractionById } from '@/lib/airtable/interactions'
import { getMostRecentInteractionNoteByHuman, getInteractionNotesGrouped, getGeneralNotesByRCIds } from '@/lib/airtable/notes'
import { getRelationshipsForPerson } from '@/lib/airtable/relationships'
import { getPermissionLevel, canWrite } from '@/lib/auth/permissions'
import TakeNotesWorkspace from './TakeNotesWorkspace'
import type { Interaction } from '@/lib/types'
import type { NoteCategory } from '../actions'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ interactionId?: string; noteCategory?: string }>
}

export default async function TakeNotesPage({ params, searchParams }: Props) {
  const { id } = await params
  const { interactionId, noteCategory: noteCategoryParam } = await searchParams

  // Resolve note category — default to 'interaction' when an interaction is linked, 'general' otherwise
  const noteCategory: NoteCategory =
    noteCategoryParam === 'prep' ? 'prep'
    : noteCategoryParam === 'general' ? 'general'
    : interactionId ? 'interaction'
    : 'general'

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

  const [profileOptions, coachContext, interactions, initialInteraction, permissionLevel, relationships] =
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
      getRelationshipsForPerson(id).catch(() => []),
    ])

  // Load grouped notes for this interaction + author, plus sidebar RC notes
  const [lastInteractionNote, rcNotes, notesGroup] = await Promise.all([
    getMostRecentInteractionNoteByHuman(id, interactionId ?? undefined).catch(() => null),
    currentUserRecord.airtableId
      ? getGeneralNotesByRCIds(
          relationships.map((rc) => rc.id),
          currentUserRecord.airtableId,
        ).catch(() => new Map())
      : Promise.resolve(new Map()),
    interactionId && currentUserRecord.airtableId
      ? getInteractionNotesGrouped(interactionId, currentUserRecord.airtableId).catch(() => null)
      : Promise.resolve(null),
  ])

  const userCanWrite = canWrite(permissionLevel)

  const allInteractions: Interaction[] = [
    ...interactions.upcoming,
    ...interactions.past.slice(0, 30),
  ]

  // Pick the right existing notes based on category
  const existingTypedNote = noteCategory === 'prep'
    ? (notesGroup?.prepTyped ?? null)
    : noteCategory === 'interaction'
    ? (notesGroup?.interactionTyped ?? null)
    : null

  const existingInkNote = noteCategory === 'prep'
    ? (notesGroup?.prepInk ?? null)
    : noteCategory === 'interaction'
    ? (notesGroup?.interactionInk ?? null)
    : null

  return (
    <TakeNotesWorkspace
      person={user}
      coachContext={coachContext}
      profileOptions={profileOptions}
      meetings={allInteractions}
      initialInteraction={initialInteraction ?? null}
      userCanWrite={userCanWrite}
      lastInteractionNote={lastInteractionNote}
      relationships={relationships}
      rcNotes={rcNotes}
      noteCategory={noteCategory}
      existingTypedNote={existingTypedNote}
      existingInkNote={existingInkNote}
    />
  )
}
