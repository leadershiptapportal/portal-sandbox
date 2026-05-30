import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/services/usersService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getAllHumans, fetchProfileOptions } from '@/lib/airtable/humans'
import { getInteractionsForUser } from '@/lib/services/interactionsService'
import { getInteractionById } from '@/lib/airtable/interactions'
import { getMostRecentInteractionNoteByHuman, getInteractionNotesGrouped, getGeneralNotesByRCIds, getQuickNoteForRC } from '@/lib/airtable/notes'
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

  const contactEmail = user.workEmail ?? ''
  const displayName =
    user.fullName ??
    ([user.firstName, user.lastName].filter(Boolean).join(' ') || user.workEmail || '')

  const [profileOptions, interactions, initialInteraction, permissionLevel, relationships] =
    await Promise.all([
      getAllHumans().then((allHumans) => fetchProfileOptions(allHumans)),
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

  // Resolve coach's RC with this person, then load notes in parallel
  const coachRC = currentUserRecord.airtableId
    ? relationships.find((rc) => rc.leadId === currentUserRecord.airtableId) ?? null
    : null

  const [lastInteractionNote, rcNotes, notesGroup, quickNote] = await Promise.all([
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
    coachRC && currentUserRecord.airtableId
      ? getQuickNoteForRC(coachRC.id, currentUserRecord.airtableId).catch(() => null)
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
      quickNoteContent={quickNote?.content ?? ''}
      quickNoteRcId={coachRC?.id ?? null}
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
