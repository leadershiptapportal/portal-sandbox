'use server'

import { requireCurrentPortalPerson } from '@/lib/auth/requireCurrentPortalPerson'
import {
  getConnectedCalendarsByClerkUserId,
  updateCalendarSetup,
} from '@/lib/airtable/connectedCalendars'

export async function saveCalendarSetup(
  selectedCalendarIds: string[],
  syncPastDays: number,
  syncFutureDays: number,
): Promise<{ ok: true } | { error: string }> {
  const person = await requireCurrentPortalPerson()

  const calendars = await getConnectedCalendarsByClerkUserId(person.clerkUserId)
  const record = calendars.find(c => c.provider === 'Outlook')
  if (!record) return { error: 'No linked Outlook calendar found' }
  if (selectedCalendarIds.length === 0) return { error: 'Select at least one calendar' }

  await updateCalendarSetup(record.id, {
    selectedCalendarIds,
    syncPastDays: Math.max(1, Math.min(365, syncPastDays)),
    syncFutureDays: Math.max(1, Math.min(365, syncFutureDays)),
  })

  return { ok: true }
}
