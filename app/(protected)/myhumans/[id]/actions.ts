'use server'

import { revalidatePath } from 'next/cache'
import { createNote, updateNote, getNotesByInteractionId, upsertGeneralNoteForRC } from '@/lib/airtable/notes'
import { createTask, updateTaskStatus } from '@/lib/airtable/tasks'
import {
  updateUserProfile,
  type UserProfileFields,
  fetchProfileOptions,
  type ProfileOption,
  searchUsersByName,
  createUserRecord,
  patchTeamMembers,
  getAllUsers,
} from '@/lib/airtable/users'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import {
  resolveContextForSubject,
  createRelationshipContext,
  updateRelationshipContext,
  deleteRelationshipContext,
  type CreateRCInput,
  type UpdateRCInput,
  type RelationshipType,
} from '@/lib/airtable/relationships'
import { upsertCoachPersonContext } from '@/lib/airtable/coachPersonContext'

// ── Edit Profile ──────────────────────────────────────────────────────────────

export async function updateProfileAction(
  userId: string,
  changed: UserProfileFields,
): Promise<{ success: true } | { error: string }> {
  console.log('[updateProfileAction] userId:', userId)
  console.log('[updateProfileAction] fields being sent:', JSON.stringify(changed, null, 2))
  try {
    await updateUserProfile(userId, changed)
    revalidatePath(`/myhumans/${userId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateProfileAction] error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg.includes('Airtable PATCH failed') ? msg : 'Failed to update profile — please try again' }
  }
}

// ── Fetch profile dropdown options (called when Edit Profile modal opens) ──────

export async function fetchProfileOptionsAction(): Promise<{
  companies: ProfileOption[]
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  conflictPostures: ProfileOption[]
  apologyLanguages: ProfileOption[]
  strengths: ProfileOption[]
  coaches: ProfileOption[]
  allUsers: ProfileOption[]
}> {
  const allUsers = await getAllUsers()
  return fetchProfileOptions(allUsers)
}

// ── Team Members ──────────────────────────────────────────────────────────────

export async function searchUsersAction(
  query: string,
): Promise<Array<{ id: string; name: string; jobTitle?: string }>> {
  if (!query.trim()) return []
  return searchUsersByName(query.trim())
}

export async function linkExistingTeamMember(
  leaderId: string,
  existingMemberIds: string[],
  newMemberId: string,
): Promise<{ success: true } | { error: string }> {
  if (existingMemberIds.includes(newMemberId)) return { success: true }
  try {
    const newIds = [...existingMemberIds, newMemberId]
    console.log('[linkExistingTeamMember] PATCH leaderId:', leaderId, '| Team Members:', newIds)
    await patchTeamMembers(leaderId, newIds)
    revalidatePath(`/myhumans/${leaderId}`)
    return { success: true }
  } catch (err) {
    console.error('[linkExistingTeamMember] error:', err)
    return { error: 'Failed to link team member — please try again' }
  }
}

export async function createAndLinkTeamMember(
  leaderId: string,
  existingMemberIds: string[],
  memberData: {
    firstName: string
    lastName?: string
    jobTitle?: string
  },
): Promise<{ success: true } | { error: string }> {
  try {
    console.log('[createAndLinkTeamMember] creating user:', memberData)
    const newId = await createUserRecord({
      'First Name': memberData.firstName || undefined,
      'Last Name': memberData.lastName || undefined,
      'Title': memberData.jobTitle || undefined,
    })
    console.log('[createAndLinkTeamMember] created record id:', newId, '| linking to leader:', leaderId)
    await patchTeamMembers(leaderId, [...existingMemberIds, newId])
    revalidatePath(`/myhumans/${leaderId}`)
    return { success: true }
  } catch (err) {
    console.error('[createAndLinkTeamMember] error:', err)
    return { error: String(err instanceof Error ? err.message : err) }
  }
}

// ── Log a Note ────────────────────────────────────────────────────────────────
export async function saveNoteAction(
  subjectPersonId: string,
  content: string,
): Promise<void> {
  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) throw new Error('SAVE_FAILED')

  const rc = await resolveContextForSubject(userRecord.airtableId, subjectPersonId)
  if (!rc) throw new Error('NO_RELATIONSHIP')

  try {
    await createNote({
      content: content.trim(),
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId,
      humanId: subjectPersonId,
      relationshipContextId: rc.id,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('TABLE_NOT_FOUND') || msg.includes('Could not find table')) {
      throw new Error('NOTES_TABLE_MISSING')
    }
    console.error('[saveNoteAction] Airtable error:', msg)
    throw new Error('SAVE_FAILED')
  }
  revalidatePath(`/myhumans/${subjectPersonId}`)
}

// ── Save Ink Note ─────────────────────────────────────────────────────────────

/**
 * Persists a handwritten ink note. The image is already uploaded to Cloudinary
 * by the caller. Caption goes to the Body field; image URL goes to the
 * dedicated Ink Image URL field (no embedded markdown).
 */
export async function saveInkNoteAction(
  subjectPersonId: string,
  imageUrl: string,
  caption?: string,
  interactionId?: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { error: 'Could not resolve your user record.' }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, subjectPersonId)
    if (!rc) {
      return { error: 'No active coaching or reporting relationship reaches this person.' }
    }

    await createNote({
      content: (caption ?? '').trim(),
      inkImageUrl: imageUrl,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId,
      humanId: subjectPersonId,
      relationshipContextId: rc.id,
      interactionId: interactionId || undefined,
      noteType: 'ink_note',
    })
    revalidatePath(`/myhumans/${subjectPersonId}`)
    return { success: true }
  } catch (err) {
    console.error('[saveInkNoteAction]', err)
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Edit / Delete Note ────────────────────────────────────────────────────────

export async function updateNoteAction(
  noteId: string,
  body: string,
  subjectPersonId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const result = await updateNote(noteId, body)
    if ('error' in result) {
      console.error('[updateNoteAction] Airtable error:', result.error)
      return { success: false, error: result.error }
    }
    if (subjectPersonId) revalidatePath(`/myhumans/${subjectPersonId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateNoteAction] error:', err)
    return { success: false, error: String(err) }
  }
}

export async function deleteNoteAction(
  noteId: string,
  subjectPersonId?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { deleteNote } = await import('@/lib/airtable/notes')
    const result = await deleteNote(noteId)
    if ('error' in result) {
      console.error('[deleteNoteAction] Airtable error:', result.error)
      return { success: false, error: result.error }
    }
    if (subjectPersonId) revalidatePath(`/myhumans/${subjectPersonId}`)
    return { success: true }
  } catch (err) {
    console.error('[deleteNoteAction] error:', err)
    return { success: false, error: String(err) }
  }
}

// ── Update Task Status ────────────────────────────────────────────────────────

export async function updateTaskStatusAction(
  taskId: string,
  status: import('@/lib/types').TaskStatus,
): Promise<{ success: boolean }> {
  const result = await updateTaskStatus(taskId, status)
  if ('error' in result) {
    console.error('[updateTaskStatusAction] error:', result.error)
    return { success: false }
  }
  return { success: true }
}

// ── Interaction Notes ──────────────────────────────────────────────────────────

export async function getNotesByInteractionIdAction(interactionId: string) {
  return getNotesByInteractionId(interactionId).catch(() => [])
}

export async function updateInteractionNotesAction(
  interactionId: string,
  notes: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { success: false, error: 'Could not resolve your coach record.' }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, userId)
    if (!rc) {
      return { success: false, error: 'No active coaching or reporting relationship reaches this person.' }
    }

    // Upsert: find an existing note for this interaction authored by this coach;
    // PATCH it if found, POST a new one if not. Prevents accumulating duplicate
    // notes records every time an interaction note is saved.
    const existingNotes = await getNotesByInteractionId(interactionId)
    const myNote = existingNotes.find((n) => n.authorPersonId === userRecord.airtableId)
    if (myNote) {
      const result = await updateNote(myNote.id, notes)
      if ('error' in result) throw new Error(result.error)
    } else {
      await createNote({
        content: notes,
        authorPersonId: userRecord.airtableId,
        coachName: userRecord.name || undefined,
        subjectPersonId: userId,
        humanId: userId,
        relationshipContextId: rc.id,
        interactionId,
        noteType: 'interaction_note',
      })
    }
    revalidatePath(`/myhumans/${userId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateInteractionNotesAction]', err)
    return { success: false, error: 'Failed to save notes — please try again' }
  }
}

// ── Coach-Person Context (Quick Notes / Family Details) ──────────────────────

export async function updateCoachContextAction(
  personId: string,
  fields: { quickNotes?: string; familyDetails?: string },
): Promise<{ success: true } | { error: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) return { error: 'Could not resolve your user record.' }
    await upsertCoachPersonContext(userRecord.airtableId, personId, fields)
    revalidatePath(`/myhumans/${personId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateCoachContextAction]', err)
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Upload Profile Photo ──────────────────────────────────────────────────────

// ── Add Task ──────────────────────────────────────────────────────────────────

export async function saveTaskAction(
  subjectPersonId: string,
  taskName: string,
  dueDate: string | null,
  notes: string | null,
): Promise<void> {
  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) throw new Error('Could not resolve your user record.')
  await createTask({
    title: taskName,
    notes: notes ?? undefined,
    dueDate: dueDate ?? undefined,
    humanId: subjectPersonId,
    createdByPersonId: userRecord.airtableId,
    assignedToPersonId: subjectPersonId,
  })
  revalidatePath(`/myhumans/${subjectPersonId}`)
}

// ── Log Manual Interaction ────────────────────────────────────────────────────

export async function logManualSessionAction(params: {
  subjectPersonId: string
  startIso: string
  durationMinutes?: number
  interactionType?: string
  notes?: string
}): Promise<void> {
  const userRecord = await getCurrentUserRecord()
  if (!userRecord.airtableId) throw new Error('SAVE_FAILED')

  const rc = await resolveContextForSubject(userRecord.airtableId, params.subjectPersonId)
  if (!rc) throw new Error('NO_RELATIONSHIP')

  const { getUserById } = await import('@/lib/services/usersService')
  const subject = await getUserById(params.subjectPersonId)
  const subjectName = subject
    ? subject.fullName || [subject.firstName, subject.lastName].filter(Boolean).join(' ')
    : 'Unknown'

  const coachFirst = userRecord.name.split(' ')[0] || 'Coach'
  const typeLabel = params.interactionType ?? 'In-Person'

  const start = new Date(params.startIso)
  const durationMs = (params.durationMinutes ?? 0) * 60_000
  const end = new Date(start.getTime() + Math.max(durationMs, 60_000))

  // Populate Attendees so the profile-page email-match query picks this up.
  const subjectEmail = subject?.workEmail ?? subject?.email ?? ''

  const { createManualInteraction } = await import('@/lib/airtable/interactions')
  const interactionId = await createManualInteraction({
    title: `${coachFirst} / ${subjectName} — ${typeLabel}`,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    timezone: 'America/New_York',
    calendarOwnerEmail: userRecord.email,
    relationshipContextId: rc.id,
    humanName: subjectName,
    attendeeEmails: subjectEmail || undefined,
    interactionType: params.interactionType,
  })

  if (params.notes && params.notes.trim().length > 0) {
    await createNote({
      content: params.notes.trim(),
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId: params.subjectPersonId,
      humanId: params.subjectPersonId,
      relationshipContextId: rc.id,
      interactionId,
      noteType: 'interaction_note',
    })
  }

  revalidatePath(`/myhumans/${params.subjectPersonId}`)
}

// ── Relationship Context management ───────────────────────────────────────────

/**
 * Create a new RC row.
 *  - subjectPersonId: the user whose profile this is being added from
 *  - input: the other person + relationship type + role
 *    - role='subject_is_person' → subject reports to / is coached by otherPersonId
 *    - role='subject_is_lead'   → otherPersonId reports to / is coached by subject
 */
export async function addRelationshipAction(params: {
  subjectPersonId: string
  otherPersonId: string
  type: RelationshipType
  role: 'subject_is_person' | 'subject_is_lead'
  startDate?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) return { success: false, error: 'Could not resolve your user record.' }

    const personId =
      params.role === 'subject_is_person' ? params.subjectPersonId : params.otherPersonId
    const leadId =
      params.role === 'subject_is_person' ? params.otherPersonId : params.subjectPersonId

    const input: CreateRCInput = {
      personId,
      leadId,
      type: params.type,
      status: 'Active',
    }
    if (params.startDate) input.startDate = params.startDate

    await createRelationshipContext(input)
    revalidatePath(`/myhumans/${params.subjectPersonId}`)
    revalidatePath(`/myhumans/${params.otherPersonId}`)
    return { success: true }
  } catch (err) {
    console.error('[addRelationshipAction]', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function updateRelationshipAction(params: {
  rcId: string
  subjectPersonId: string  // for revalidation
  fields: UpdateRCInput
}): Promise<{ success: boolean; error?: string }> {
  try {
    await updateRelationshipContext(params.rcId, params.fields)
    revalidatePath(`/myhumans/${params.subjectPersonId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateRelationshipAction]', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export async function deleteRelationshipAction(params: {
  rcId: string
  subjectPersonId: string  // for revalidation
}): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteRelationshipContext(params.rcId)
    revalidatePath(`/myhumans/${params.subjectPersonId}`)
    return { success: true }
  } catch (err) {
    console.error('[deleteRelationshipAction]', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Creates a new People record and immediately links it to the subject via an RC.
 * Used when adding a relationship to a person who doesn't yet exist in the system.
 */
export async function addRelationshipWithNewPersonAction(params: {
  subjectPersonId: string
  firstName: string
  lastName?: string
  title?: string
  email?: string
  type: RelationshipType
  role: 'subject_is_person' | 'subject_is_lead'
  startDate?: string
}): Promise<{ success: boolean; newPersonId?: string; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) return { success: false, error: 'Could not resolve your user record.' }

    const newPersonId = await createUserRecord({
      'First Name': params.firstName,
      ...(params.lastName ? { 'Last Name': params.lastName } : {}),
      ...(params.title ? { 'Title': params.title } : {}),
      ...(params.email ? { 'Work Email': params.email } : {}),
    })

    const personId = params.role === 'subject_is_person' ? params.subjectPersonId : newPersonId
    const leadId = params.role === 'subject_is_person' ? newPersonId : params.subjectPersonId

    const input: CreateRCInput = {
      personId,
      leadId,
      type: params.type,
      status: 'Active',
    }
    if (params.startDate) input.startDate = params.startDate

    await createRelationshipContext(input)
    revalidatePath(`/myhumans/${params.subjectPersonId}`)
    return { success: true, newPersonId }
  } catch (err) {
    console.error('[addRelationshipWithNewPersonAction]', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Upserts the single general note for a Relationship Context.
 * Creates one if none exists; patches in place if one already does.
 */
export async function upsertRCNoteAction(params: {
  rcId: string
  subjectPersonId: string
  content: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) return { success: false, error: 'Could not resolve your user record.' }

    await upsertGeneralNoteForRC(
      params.rcId,
      userRecord.airtableId,
      params.content,
      params.subjectPersonId,
    )
    return { success: true }
  } catch (err) {
    console.error('[upsertRCNoteAction]', err)
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}
