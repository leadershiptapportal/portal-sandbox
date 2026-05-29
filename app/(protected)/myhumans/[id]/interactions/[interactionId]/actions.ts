'use server'

import { revalidatePath } from 'next/cache'
import { getNotesByInteractionId, createNote, updateNote } from '@/lib/airtable/notes'
import { resolveContextForSubject } from '@/lib/airtable/relationships'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'

/**
 * Saves interaction notes to the Notes table (note_type = 'interaction_note').
 * Upserts: patches the coach's existing note for this interaction if one exists,
 * otherwise creates a new one. Uses the same path as the profile-page popout.
 *
 * Previously wrote to Coach Session, which failed because that table's
 * "Calendar Event" linked field points to the archived Calendar Events table,
 * not Portal Calendar Events.
 */
export async function updateInteractionNotes(
  interactionId: string,
  notes: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { error: 'Could not resolve your coach record — please try again.' }
    }

    // Look for an existing note from this coach for this interaction
    const existingNotes = await getNotesByInteractionId(interactionId)
    const myNote = existingNotes.find(
      (n) => n.authorPersonId === userRecord.airtableId && n.noteType === 'interaction_note' && !n.inkImageUrl,
    )

    if (myNote) {
      const result = await updateNote(myNote.id, notes)
      if ('error' in result) throw new Error(result.error)
    } else {
      // Need an RC to link the new note to the relationship
      const rc = await resolveContextForSubject(userRecord.airtableId, userId)
      if (!rc) {
        return { error: 'No active coaching or reporting relationship found for this person.' }
      }
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

    revalidatePath(`/myhumans/${userId}/interactions/${interactionId}`)
    revalidatePath(`/myhumans/${userId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateInteractionNotes]', err)
    const detail = err instanceof Error ? err.message : String(err)
    return { error: detail || 'Failed to save — please try again' }
  }
}

export async function updatePrepNotes(
  interactionId: string,
  notes: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { error: 'Could not resolve your coach record — please try again.' }
    }

    const existingNotes = await getNotesByInteractionId(interactionId)
    const myNote = existingNotes.find(
      (n) => n.authorPersonId === userRecord.airtableId && n.noteType === 'prep_note' && !n.inkImageUrl,
    )

    if (myNote) {
      const result = await updateNote(myNote.id, notes)
      if ('error' in result) throw new Error(result.error)
    } else {
      const rc = await resolveContextForSubject(userRecord.airtableId, userId)
      if (!rc) {
        return { error: 'No active coaching or reporting relationship found for this person.' }
      }
      await createNote({
        content: notes,
        authorPersonId: userRecord.airtableId,
        coachName: userRecord.name || undefined,
        subjectPersonId: userId,
        humanId: userId,
        relationshipContextId: rc.id,
        interactionId,
        noteType: 'prep_note',
      })
    }

    revalidatePath(`/myhumans/${userId}/interactions/${interactionId}`)
    revalidatePath(`/myhumans/${userId}`)
    return { success: true }
  } catch (err) {
    console.error('[updatePrepNotes]', err)
    const detail = err instanceof Error ? err.message : String(err)
    return { error: detail || 'Failed to save — please try again' }
  }
}
