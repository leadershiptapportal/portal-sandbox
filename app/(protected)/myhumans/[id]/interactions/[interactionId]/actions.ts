'use server'

import { revalidatePath } from 'next/cache'
import { upsertCoachSession } from '@/lib/airtable/coachSessions'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'

/**
 * Saves interaction notes to the Coach Session table (not Portal Calendar Events.Notes).
 * Requires the focal person's Airtable record ID (= the user profile ID, which
 * is always available from the URL on the interaction detail page).
 */
export async function updateSessionNotes(
  meetingId: string,
  notes: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  try {
    const userRecord = await getCurrentUserRecord()
    if (!userRecord.airtableId) {
      return { error: 'Could not resolve your coach record — please try again.' }
    }
    await upsertCoachSession(userRecord.airtableId, meetingId, userId, {
      sessionNotes: notes,
    })
    revalidatePath(`/myhumans/${userId}/interactions/${meetingId}`)
    revalidatePath(`/myhumans/${userId}`)
    return { success: true }
  } catch (err) {
    console.error('[updateSessionNotes]', err)
    return { error: 'Failed to save — please try again' }
  }
}
