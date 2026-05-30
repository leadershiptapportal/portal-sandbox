'use server'

import { revalidatePath } from 'next/cache'
import { createNote, updateNote, updateInkNoteFields, getNotesByInteractionId, upsertGeneralNoteForRC, upsertQuickNoteForRC } from '@/lib/airtable/notes'
import { createTask, updateTaskStatus } from '@/lib/airtable/tasks'
import {
  updateHumanProfile,
  type HumanProfileFields,
  fetchProfileOptions,
  type ProfileOption,
  searchHumansByName,
  createHumanRecord,
  patchTeamMembers,
  getAllHumans,
} from '@/lib/airtable/humans'
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
import {
  createAffiliation,
  updateAffiliation,
  deleteAffiliation,
  type UpdateAffiliationInput,
} from '@/lib/airtable/affiliations'
import { createOrganization } from '@/lib/airtable/organizations'
import type { AffiliationType, AffiliationStatus } from '@/lib/types'

// ── Edit Profile ──────────────────────────────────────────────────────────────

export async function updateProfileAction(
  userId: string,
  changed: HumanProfileFields,
): Promise<{ success: true } | { error: string }> {
  console.log('[updateProfileAction] userId:', userId)
  console.log('[updateProfileAction] fields being sent:', JSON.stringify(changed, null, 2))
  try {
    await updateHumanProfile(userId, changed)
    revalidatePath(`/myhumans/${userId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateProfileAction] error:', err)
    const msg = err instanceof Error ? err.message : String(err)
    return { error: msg.includes('Airtable PATCH failed') ? msg : 'Failed to update profile — please try again' }
  }
}

// ── Affiliations (Human ↔ Organization) ──────────────────────────────────────
// Mirrors the Relationship Context add/edit/delete actions.

export interface AddAffiliationInput {
  subjectHumanId: string
  organizationId: string
  type: AffiliationType
  status?: AffiliationStatus
  startDate?: string
  titleAtOrg?: string
  workCellAtOrg?: string
  primary?: boolean
}

export async function addAffiliationAction(
  input: AddAffiliationInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    await createAffiliation({
      humanId: input.subjectHumanId,
      organizationId: input.organizationId,
      type: input.type,
      status: input.status,
      startDate: input.startDate,
      titleAtOrg: input.titleAtOrg,
      workCellAtOrg: input.workCellAtOrg,
      primary: input.primary,
    })
    revalidatePath(`/myhumans/${input.subjectHumanId}`)
    return { success: true }
  } catch (err) {
    console.error('[addAffiliationAction] error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to add organization' }
  }
}

export interface AddAffiliationWithNewOrgInput {
  subjectHumanId: string
  orgName: string
  orgDomain?: string
  orgType?: string
  type: AffiliationType
  status?: AffiliationStatus
  startDate?: string
  titleAtOrg?: string
  workCellAtOrg?: string
  primary?: boolean
}

export async function addAffiliationWithNewOrgAction(
  input: AddAffiliationWithNewOrgInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    const organizationId = await createOrganization({
      name: input.orgName,
      domain: input.orgDomain,
      type: input.orgType,
    })
    await createAffiliation({
      humanId: input.subjectHumanId,
      organizationId,
      type: input.type,
      status: input.status,
      startDate: input.startDate,
      titleAtOrg: input.titleAtOrg,
      workCellAtOrg: input.workCellAtOrg,
      primary: input.primary,
    })
    revalidatePath(`/myhumans/${input.subjectHumanId}`)
    return { success: true }
  } catch (err) {
    console.error('[addAffiliationWithNewOrgAction] error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to create organization' }
  }
}

export async function updateAffiliationAction(input: {
  affiliationId: string
  subjectHumanId: string
  fields: UpdateAffiliationInput
}): Promise<{ success: boolean; error?: string }> {
  try {
    await updateAffiliation(input.affiliationId, input.fields)
    revalidatePath(`/myhumans/${input.subjectHumanId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateAffiliationAction] error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to update organization' }
  }
}

export async function deleteAffiliationAction(input: {
  affiliationId: string
  subjectHumanId: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    await deleteAffiliation(input.affiliationId)
    revalidatePath(`/myhumans/${input.subjectHumanId}`)
    return { success: true }
  } catch (err) {
    console.error('[deleteAffiliationAction] error:', err)
    return { success: false, error: err instanceof Error ? err.message : 'Failed to remove organization' }
  }
}

// ── Fetch profile dropdown options (called when Edit Profile modal opens) ──────

export async function fetchProfileOptionsAction(): Promise<{
  organizations: ProfileOption[]
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  conflictPostures: ProfileOption[]
  apologyLanguages: ProfileOption[]
  strengths: ProfileOption[]
  coaches: ProfileOption[]
  allHumans: ProfileOption[]
}> {
  const allHumans = await getAllHumans()
  return fetchProfileOptions(allHumans)
}

// ── Team Members ──────────────────────────────────────────────────────────────

export async function searchUsersAction(
  query: string,
): Promise<Array<{ id: string; name: string; jobTitle?: string }>> {
  if (!query.trim()) return []
  return searchHumansByName(query.trim())
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
    const newId = await createHumanRecord({
      firstName: memberData.firstName || undefined,
      lastName: memberData.lastName || undefined,
      title: memberData.jobTitle || undefined,
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
  inkNoteData: string,
  caption?: string,
  interactionId?: string,
  existingNoteId?: string,
  noteCategory: NoteCategory = 'interaction',
): Promise<{ success: true; noteId: string } | { error: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { error: 'Could not resolve your user record.' }
    }

    if (existingNoteId) {
      const result = await updateInkNoteFields(existingNoteId, imageUrl, inkNoteData, caption?.trim())
      if ('error' in result) return result
      revalidatePath(`/myhumans/${subjectPersonId}`)
      return { success: true, noteId: existingNoteId }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, subjectPersonId)
    if (!rc) {
      return { error: 'No active coaching or reporting relationship reaches this person.' }
    }

    const noteType =
      noteCategory === 'prep' ? 'prep_note' as const
      : noteCategory === 'interaction' ? 'interaction_note' as const
      : 'general_note' as const

    const created = await createNote({
      content: (caption ?? '').trim(),
      inkImageUrl: imageUrl,
      inkNoteData,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId,
      humanId: subjectPersonId,
      relationshipContextId: rc.id,
      interactionId: interactionId || undefined,
      noteType,
    })
    revalidatePath(`/myhumans/${subjectPersonId}`)
    return { success: true, noteId: created.id }
  } catch (err) {
    console.error('[saveInkNoteAction]', err)
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Save Typed Note ───────────────────────────────────────────────────────────

export type NoteCategory = 'general' | 'prep' | 'interaction'

export async function saveTypedNoteAction(
  subjectPersonId: string,
  content: string,
  noteCategory: NoteCategory,
  interactionId?: string,
  noteTitle?: string,
): Promise<{ success: true; noteId: string } | { error: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { error: 'Could not resolve your user record.' }
    }

    const noteType =
      noteCategory === 'prep' ? 'prep_note' as const
      : noteCategory === 'interaction' && interactionId ? 'interaction_note' as const
      : 'general_note' as const

    // For general notes, default title to a timestamp if none provided
    const resolvedTitle = noteCategory === 'general'
      ? (noteTitle?.trim() || new Date().toLocaleString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true,
        }))
      : undefined

    // Upsert: if this is an interaction-scoped note, patch existing instead of creating duplicate
    if (interactionId && noteType !== 'general_note') {
      const existing = await getNotesByInteractionId(interactionId)
      const myNote = existing.find(
        (n) => n.authorPersonId === userRecord.airtableId && n.noteType === noteType && !n.inkImageUrl,
      )
      if (myNote) {
        const result = await updateNote(myNote.id, content)
        if ('error' in result) return result
        revalidatePath(`/myhumans/${subjectPersonId}`)
        return { success: true, noteId: myNote.id }
      }
    }

    const rc = await resolveContextForSubject(userRecord.airtableId, subjectPersonId)
    if (!rc) {
      return { error: 'No active coaching or reporting relationship reaches this person.' }
    }

    const created = await createNote({
      content,
      noteTitle: resolvedTitle,
      authorPersonId: userRecord.airtableId,
      coachName: userRecord.name || undefined,
      subjectPersonId,
      humanId: subjectPersonId,
      relationshipContextId: rc.id,
      interactionId: interactionId || undefined,
      noteType,
    })
    revalidatePath(`/myhumans/${subjectPersonId}`)
    return { success: true, noteId: created.id }
  } catch (err) {
    console.error('[saveTypedNoteAction]', err)
    return { error: err instanceof Error ? err.message : String(err) }
  }
}

// ── Check if a typed interaction note already exists (for append-on-link flow) ─

export async function checkInteractionTypedNoteAction(
  interactionId: string,
): Promise<{ note: { id: string; content: string } } | { note: null }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) return { note: null }
    const existing = await getNotesByInteractionId(interactionId)
    const myNote = existing.find(
      (n) => n.authorPersonId === userRecord.airtableId && n.noteType === 'interaction_note' && !n.inkImageUrl,
    )
    if (!myNote) return { note: null }
    return { note: { id: myNote.id, content: myNote.content } }
  } catch {
    return { note: null }
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
    const myNote = existingNotes.find(
      (n) => n.authorPersonId === userRecord.airtableId && n.noteType === 'interaction_note' && !n.inkImageUrl,
    )
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

// ── Quick Notes ───────────────────────────────────────────────────────────────

export async function updateCoachContextAction(
  humanId: string,
  rcId: string,
  content: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) return { error: 'Could not resolve your user record.' }
    await upsertQuickNoteForRC(rcId, userRecord.airtableId, content, humanId)
    revalidatePath(`/myhumans/${humanId}`)
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

  const { getHumanById } = await import('@/lib/services/humansService')
  const subject = await getHumanById(params.subjectPersonId)
  const subjectName = subject
    ? subject.fullName || [subject.firstName, subject.lastName].filter(Boolean).join(' ')
    : 'Unknown'

  const coachFirst = userRecord.name.split(' ')[0] || 'Coach'
  const typeLabel = params.interactionType ?? 'In-Person'

  const start = new Date(params.startIso)
  const durationMs = (params.durationMinutes ?? 0) * 60_000
  const end = new Date(start.getTime() + Math.max(durationMs, 60_000))

  // Populate Attendees so the profile-page email-match query picks this up.
  const subjectEmail = subject?.workEmail ?? ''

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
  organizationId?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) return { success: false, error: 'Could not resolve your user record.' }

    const humanId =
      params.role === 'subject_is_person' ? params.subjectPersonId : params.otherPersonId
    const leadId =
      params.role === 'subject_is_person' ? params.otherPersonId : params.subjectPersonId

    const input: CreateRCInput = {
      humanId,
      leadId,
      type: params.type,
      status: 'Active',
    }
    if (params.startDate) input.startDate = params.startDate
    if (params.organizationId) input.organizationId = params.organizationId

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
}): Promise<{ success: boolean; newHumanId?: string; error?: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) return { success: false, error: 'Could not resolve your user record.' }

    const newHumanId = await createHumanRecord({
      firstName: params.firstName,
      lastName: params.lastName,
      title: params.title,
      workEmail: params.email,
    })

    const humanId = params.role === 'subject_is_person' ? params.subjectPersonId : newHumanId
    const leadId = params.role === 'subject_is_person' ? newHumanId : params.subjectPersonId

    const input: CreateRCInput = {
      humanId,
      leadId,
      type: params.type,
      status: 'Active',
    }
    if (params.startDate) input.startDate = params.startDate

    await createRelationshipContext(input)
    revalidatePath(`/myhumans/${params.subjectPersonId}`)
    return { success: true, newHumanId }
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
