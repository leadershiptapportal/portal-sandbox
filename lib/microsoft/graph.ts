const GRAPH = 'https://graph.microsoft.com/v1.0'

export interface GraphCalendar {
  id: string
  name: string
  isDefaultCalendar: boolean
  color?: string
}

export interface GraphAttendee {
  emailAddress: { address: string; name?: string }
  type: string
}

export interface GraphEvent {
  id: string
  subject?: string
  isCancelled?: boolean
  iCalUId?: string
  start: { dateTime?: string; date?: string; timeZone: string }
  end: { dateTime?: string; date?: string; timeZone: string }
  attendees?: GraphAttendee[]
  type?: string
  '@removed'?: { reason: string }
}

export async function listCalendars(accessToken: string): Promise<GraphCalendar[]> {
  const res = await fetch(
    `${GRAPH}/me/calendars?$select=id,name,isDefaultCalendar,color&$top=50`,
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: 'no-store' },
  )
  if (!res.ok) throw new Error(`listCalendars failed (${res.status}): ${await res.text()}`)
  const data = await res.json()
  return (data.value ?? []) as GraphCalendar[]
}

/**
 * Full initial sync for a calendar: fetches all events in the window via the
 * delta endpoint so we also receive the final deltaLink cursor for future
 * incremental syncs. Returns events and the deltaLink to store.
 */
export async function fetchCalendarViewWithDelta(
  accessToken: string,
  calendarId: string,
  start: Date,
  end: Date,
): Promise<{ events: GraphEvent[]; deltaLink: string }> {
  const params = new URLSearchParams({
    startDateTime: start.toISOString(),
    endDateTime: end.toISOString(),
    $select: 'id,subject,isCancelled,iCalUId,start,end,attendees,type',
    $top: '500',
  })

  const events: GraphEvent[] = []
  let url: string | null =
    `${GRAPH}/me/calendars/${encodeURIComponent(calendarId)}/calendarView/delta?${params}`
  let deltaLink = ''

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`calendarView/delta failed (${res.status}): ${await res.text()}`)
    const page: Record<string, unknown> = await res.json()
    events.push(...((page.value ?? []) as GraphEvent[]))
    if (page['@odata.deltaLink']) {
      deltaLink = page['@odata.deltaLink'] as string
      url = null
    } else {
      url = (page['@odata.nextLink'] as string | undefined) ?? null
    }
  }

  return { events, deltaLink }
}

/**
 * Incremental sync: fetches only what changed since the stored deltaLink.
 * Returns the changed/deleted events and the new deltaLink to store.
 */
export async function fetchDeltaChanges(
  accessToken: string,
  storedDeltaLink: string,
): Promise<{ events: GraphEvent[]; nextDeltaLink: string }> {
  const events: GraphEvent[] = []
  let url: string | null = storedDeltaLink
  let nextDeltaLink = ''

  while (url) {
    const res: Response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`delta fetch failed (${res.status}): ${await res.text()}`)
    const page: Record<string, unknown> = await res.json()
    events.push(...((page.value ?? []) as GraphEvent[]))
    if (page['@odata.deltaLink']) {
      nextDeltaLink = page['@odata.deltaLink'] as string
      url = null
    } else {
      url = (page['@odata.nextLink'] as string | undefined) ?? null
    }
  }

  return { events, nextDeltaLink }
}
