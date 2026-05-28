import { redirect } from 'next/navigation'
import { requireCurrentPortalPerson } from '@/lib/auth/requireCurrentPortalPerson'
import { getConnectedCalendarsByClerkUserId } from '@/lib/airtable/connectedCalendars'
import { getValidAccessToken } from '@/lib/microsoft/auth'
import { listCalendars } from '@/lib/microsoft/graph'
import CalendarSetupForm from './CalendarSetupForm'

export default async function CalendarSetupPage() {
  const person = await requireCurrentPortalPerson()

  const calendars = await getConnectedCalendarsByClerkUserId(person.clerkUserId)
  const record = calendars.find(c => c.provider === 'Outlook')

  if (!record) redirect('/settings')

  let availableCalendars: Awaited<ReturnType<typeof listCalendars>> = []
  let tokenError = false

  try {
    const token = await getValidAccessToken(record)
    availableCalendars = await listCalendars(token)
  } catch {
    tokenError = true
  }

  // Default: pre-select calendars already saved, or just the primary on first setup
  const defaultSelectedIds =
    record.selectedCalendarIds && record.selectedCalendarIds.length > 0
      ? record.selectedCalendarIds
      : availableCalendars.filter(c => c.isDefaultCalendar).map(c => c.id)

  return (
    <div className="max-w-lg mx-auto px-4 md:px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">Set Up Your Calendar</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Choose which calendars to sync and how far back and forward to pull events.
        Only meetings with people in your relationship contexts will be imported.
      </p>

      {tokenError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-medium mb-1">Could not load your calendars</p>
          <p>Your Microsoft session may have expired. Go back to Settings and re-link your calendar.</p>
          <a
            href="/settings"
            className="mt-3 inline-block text-[hsl(213,70%,30%)] hover:underline font-medium"
          >
            ← Back to Settings
          </a>
        </div>
      ) : availableCalendars.length === 0 ? (
        <div className="rounded-xl border border-border bg-muted/50 p-6 text-sm text-muted-foreground">
          <p>No calendars found in your Microsoft account.</p>
          <a href="/settings" className="mt-3 inline-block text-[hsl(213,70%,30%)] hover:underline font-medium">
            ← Back to Settings
          </a>
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border p-6">
          <CalendarSetupForm
            calendars={availableCalendars}
            defaultSelectedIds={defaultSelectedIds}
            defaultPastDays={record.syncPastDays ?? 90}
            defaultFutureDays={record.syncFutureDays ?? 60}
          />
        </div>
      )}
    </div>
  )
}
