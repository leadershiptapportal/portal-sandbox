import { NextResponse } from 'next/server'
import { requireCurrentPortalPerson } from '@/lib/auth/requireCurrentPortalPerson'
import {
  getConnectedCalendarsByClerkUserId,
  updateCalendarSyncState,
  updateDeltaLinks,
} from '@/lib/airtable/connectedCalendars'
import { getValidAccessToken } from '@/lib/microsoft/auth'
import { fetchCalendarViewWithDelta, fetchDeltaChanges, type GraphEvent } from '@/lib/microsoft/graph'
import { airtableFetch } from '@/lib/airtable/client'
import { TABLES, FIELDS } from '@/lib/airtable/constants'

export const maxDuration = 60

const AIRTABLE_API = 'https://api.airtable.com/v0'
const INTERACTIONS_TABLE = encodeURIComponent(TABLES.INTERACTIONS)

const NOISE_PATTERN =
  /buffer|focus day|recovery day|ooo|out of office|hold|block|haircut|lunch w\//i

// ── Relationship context map ──────────────────────────────────────────────────

type ContextEntry = { contextId: string; personId: string; personName: string }
type ContextMap = Map<string, ContextEntry> // lowercase email → entry

async function buildContextMap(
  apiKey: string,
  baseId: string,
  coachAirtableId: string,
): Promise<ContextMap> {
  const RC = FIELDS.RELATIONSHIP_CONTEXTS

  const [ctxRes, peopleRes] = await Promise.all([
    airtableFetch(
      `${AIRTABLE_API}/${baseId}/${encodeURIComponent(TABLES.RELATIONSHIP_CONTEXTS)}` +
        `?filterByFormula=${encodeURIComponent(`{${RC.STATUS}}="Active"`)}&maxRecords=5000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
    airtableFetch(
      `${AIRTABLE_API}/${baseId}/${encodeURIComponent(TABLES.HUMANS)}` +
        `?fields[]=${encodeURIComponent(FIELDS.HUMANS.WORK_EMAIL)}` +
        `&fields[]=${encodeURIComponent(FIELDS.HUMANS.FIRST_NAME)}` +
        `&fields[]=${encodeURIComponent(FIELDS.HUMANS.LAST_NAME)}` +
        `&maxRecords=5000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
  ])

  const ctxData = ctxRes.ok ? await ctxRes.json() : { records: [] }
  const peopleData = peopleRes.ok ? await peopleRes.json() : { records: [] }

  // Build people lookup: id → { email, name }
  const personLookup = new Map<string, { email: string; name: string }>()
  for (const r of peopleData.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const email = (f[FIELDS.HUMANS.WORK_EMAIL] as string | undefined)?.toLowerCase().trim()
    if (!email) continue
    const first = (f[FIELDS.HUMANS.FIRST_NAME] as string | undefined)?.trim() ?? ''
    const last = (f[FIELDS.HUMANS.LAST_NAME] as string | undefined)?.trim() ?? ''
    personLookup.set(r.id as string, { email, name: [first, last].filter(Boolean).join(' ') || email })
  }

  // Filter contexts to this coach, build email → context map
  const contextMap: ContextMap = new Map()
  for (const r of ctxData.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const leads = Array.isArray(f[RC.LEAD]) ? (f[RC.LEAD] as string[]) : []
    if (!leads.includes(coachAirtableId)) continue
    const persons = Array.isArray(f[RC.HUMAN]) ? (f[RC.HUMAN] as string[]) : []
    for (const personId of persons) {
      const person = personLookup.get(personId)
      if (!person) continue
      contextMap.set(person.email, { contextId: r.id as string, personId, personName: person.name })
    }
  }

  return contextMap
}

// ── Event filters ─────────────────────────────────────────────────────────────

function shouldDiscard(event: GraphEvent, coachEmail: string): boolean {
  const coachLower = coachEmail.toLowerCase()
  const others = (event.attendees ?? [])
    .map(a => a.emailAddress.address.toLowerCase())
    .filter(e => e !== coachLower)
  if (others.length === 0) return true
  if (NOISE_PATTERN.test(event.subject ?? '')) return true
  return false
}

// ── Airtable: upsert one Interaction record ───────────────────────────────────

async function upsertInteraction(
  apiKey: string,
  baseId: string,
  event: GraphEvent,
  coachEmail: string,
  contextId: string,
  personName: string,
): Promise<void> {
  const start = event.start.dateTime ?? event.start.date
  const end = event.end.dateTime ?? event.end.date
  if (!start || !end) return

  const coachLower = coachEmail.toLowerCase()
  const attendeesString = (event.attendees ?? [])
    .map(a => a.emailAddress.address.trim())
    .filter(e => e && e.toLowerCase() !== coachLower)
    .join(', ')

  const F = FIELDS.MEETINGS
  const fields: Record<string, unknown> = {
    [F.TITLE]: event.subject ?? '(No Subject)',
    [F.RELATIONSHIP_CONTEXT]: [contextId],
    [F.START]: start,
    [F.END]: end,
    [F.PROVIDER_EVENT_ID]: event.id,
    [F.CALENDAR_OWNER]: coachEmail,
    [F.CLIENT_NAME]: personName,
    [F.ATTENDEES]: attendeesString,
    [F.MEETING_STATUS]: new Date(end).getTime() < Date.now() ? 'Completed' : 'Scheduled',
    [F.CALENDAR_PROVIDER]: 'Outlook',
    [F.TIMEZONE]: 'America/New_York',
    [F.INTERACTION_TYPE]: 'Calendar Event',
    [F.SOURCE]: 'Synced',
  }

  const safeId = event.id.replace(/"/g, '\\"')
  const formula = encodeURIComponent(`{${F.PROVIDER_EVENT_ID}}="${safeId}"`)
  const findRes = await airtableFetch(
    `${AIRTABLE_API}/${baseId}/${INTERACTIONS_TABLE}?filterByFormula=${formula}&maxRecords=50` +
      `&fields[]=${encodeURIComponent(F.PROVIDER_EVENT_ID)}` +
      `&fields[]=${encodeURIComponent(F.RELATIONSHIP_CONTEXT)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  const findData = findRes.ok ? await findRes.json() : { records: [] }

  const existing = (findData.records ?? []).find((r: { id: string; fields: Record<string, unknown> }) => {
    const ids = Array.isArray(r.fields[F.RELATIONSHIP_CONTEXT])
      ? (r.fields[F.RELATIONSHIP_CONTEXT] as string[])
      : []
    return ids[0] === contextId
  })

  if (existing) {
    await fetch(`${AIRTABLE_API}/${baseId}/${INTERACTIONS_TABLE}/${existing.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
  } else {
    await fetch(`${AIRTABLE_API}/${baseId}/${INTERACTIONS_TABLE}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
  }
}

// ── Airtable: mark existing records cancelled ─────────────────────────────────

async function markCancelled(apiKey: string, baseId: string, providerEventId: string): Promise<void> {
  const safeId = providerEventId.replace(/"/g, '\\"')
  const formula = encodeURIComponent(`{${FIELDS.MEETINGS.PROVIDER_EVENT_ID}}="${safeId}"`)
  const findRes = await airtableFetch(
    `${AIRTABLE_API}/${baseId}/${INTERACTIONS_TABLE}?filterByFormula=${formula}&maxRecords=50` +
      `&fields[]=${encodeURIComponent(FIELDS.MEETINGS.PROVIDER_EVENT_ID)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!findRes.ok) return
  const findData = await findRes.json()
  for (const r of findData.records ?? []) {
    await fetch(`${AIRTABLE_API}/${baseId}/${INTERACTIONS_TABLE}/${r.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields: { [FIELDS.MEETINGS.MEETING_STATUS]: 'Cancelled' } }),
    })
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST() {
  const person = await requireCurrentPortalPerson()

  const calendars = await getConnectedCalendarsByClerkUserId(person.clerkUserId)
  const record = calendars.find(c => c.provider === 'Outlook')

  if (!record) {
    return NextResponse.json({ error: 'No linked Outlook calendar found' }, { status: 400 })
  }

  const selectedIds = record.selectedCalendarIds ?? []
  if (selectedIds.length === 0) {
    return NextResponse.json({ error: 'No calendars selected — complete calendar setup first' }, { status: 400 })
  }

  const apiKey = process.env.AIRTABLE_API_KEY!
  const baseId = process.env.AIRTABLE_BASE_ID!

  let accessToken: string
  try {
    accessToken = await getValidAccessToken(record)
  } catch (err) {
    await updateCalendarSyncState(record.id, {
      syncStatus: 'Needs Reauth',
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: err instanceof Error ? err.message : 'Token refresh failed',
    })
    return NextResponse.json({ error: 'Token refresh failed — please re-link your calendar' }, { status: 401 })
  }

  const contextMap = await buildContextMap(apiKey, baseId, person.airtableRecordId)
  if (contextMap.size === 0) {
    return NextResponse.json({ error: 'No active relationship contexts found for this coach' }, { status: 400 })
  }

  const pastDays = record.syncPastDays ?? 90
  const futureDays = record.syncFutureDays ?? 60
  const start = new Date(Date.now() - pastDays * 24 * 60 * 60 * 1000)
  const end = new Date(Date.now() + futureDays * 24 * 60 * 60 * 1000)

  // Parse stored delta links (JSON keyed by calendar ID)
  let storedDeltaLinks: Record<string, string> = {}
  try {
    if (record.deltaLink) storedDeltaLinks = JSON.parse(record.deltaLink)
  } catch { /* start fresh if unparseable */ }

  const updatedDeltaLinks: Record<string, string> = { ...storedDeltaLinks }
  const errors: string[] = []
  let totalUpserted = 0

  for (const calendarId of selectedIds) {
    try {
      let events: GraphEvent[]
      let newDeltaLink: string

      const existingDelta = storedDeltaLinks[calendarId]
      if (existingDelta) {
        const result = await fetchDeltaChanges(accessToken, existingDelta)
        events = result.events
        newDeltaLink = result.nextDeltaLink
      } else {
        const result = await fetchCalendarViewWithDelta(accessToken, calendarId, start, end)
        events = result.events
        newDeltaLink = result.deltaLink
      }

      updatedDeltaLinks[calendarId] = newDeltaLink

      for (const event of events) {
        // Deleted via delta
        if (event['@removed']) {
          await markCancelled(apiKey, baseId, event.id)
          continue
        }
        // Cancelled in calendar
        if (event.isCancelled || /^cancelled:/i.test(event.subject ?? '')) {
          await markCancelled(apiKey, baseId, event.id)
          continue
        }
        if (shouldDiscard(event, person.email)) continue

        // Match attendees against relationship contexts
        const coachLower = person.email.toLowerCase()
        const matches = (event.attendees ?? [])
          .map(a => a.emailAddress.address.toLowerCase())
          .filter(e => e !== coachLower)
          .map(e => contextMap.get(e))
          .filter(Boolean) as ContextEntry[]

        if (matches.length === 0) continue

        for (const match of matches) {
          await upsertInteraction(apiKey, baseId, event, person.email, match.contextId, match.personName)
          totalUpserted++
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Sync failed for calendar ${calendarId}`
      console.error('[calendar-sync]', msg)
      errors.push(msg)
    }
  }

  await Promise.all([
    updateDeltaLinks(record.id, updatedDeltaLinks),
    updateCalendarSyncState(record.id, {
      syncStatus: errors.length > 0 ? 'Error' : 'Connected',
      lastSyncedAt: new Date().toISOString(),
      lastSyncError: errors.length > 0 ? errors.join('\n') : undefined,
    }),
  ])

  return NextResponse.json({ synced: totalUpserted, errors })
}
