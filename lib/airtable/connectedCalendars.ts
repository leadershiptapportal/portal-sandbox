import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { airtableFetch } from '@/lib/airtable/client'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent(TABLES.CONNECTED_CALENDARS)

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

export interface ConnectedCalendar {
  id: string
  connectionName: string
  personIds: string[]         // linked → People
  provider: string            // "Outlook" | "Google"
  providerAccountEmail: string
  providerUserId?: string
  providerTenantId?: string
  calendarId?: string
  accessToken?: string
  refreshToken?: string
  tokenExpiresAt?: string     // ISO 8601 dateTime
  scopes?: string
  deltaLink?: string          // JSON map of { calendarId: deltaLink } for incremental sync
  selectedCalendarIds?: string[]  // Graph calendar IDs the user chose to sync
  syncPastDays?: number       // how far back to pull on first sync (default 90)
  syncFutureDays?: number     // how far forward to pull (default 60)
  syncStatus?: string         // "Connected" | "Needs Reauth" | "Error" | "Paused" | "Disconnected" | "Active"
  lastSyncedAt?: string       // ISO 8601 dateTime
  lastSyncError?: string
  environment?: string        // "Production" | "Test" | "Local"
  clerkUserId?: string
  clerkEmail?: string
}

function mapRecord(r: { id: string; fields: Record<string, unknown> }): ConnectedCalendar {
  const f = r.fields
  const CC = FIELDS.CONNECTED_CALENDARS
  return {
    id: r.id,
    connectionName: (f[CC.CONNECTION_NAME] as string) ?? '',
    personIds: Array.isArray(f[CC.PERSON]) ? (f[CC.PERSON] as string[]) : [],
    provider: (f[CC.PROVIDER] as string) ?? '',
    providerAccountEmail: (f[CC.PROVIDER_ACCOUNT_EMAIL] as string) ?? '',
    providerUserId: (f[CC.PROVIDER_USER_ID] as string) || undefined,
    providerTenantId: (f[CC.PROVIDER_TENANT_ID] as string) || undefined,
    calendarId: (f[CC.CALENDAR_ID] as string) || undefined,
    accessToken: (f[CC.ACCESS_TOKEN] as string) || undefined,
    refreshToken: (f[CC.REFRESH_TOKEN] as string) || undefined,
    tokenExpiresAt: (f[CC.TOKEN_EXPIRES_AT] as string) || undefined,
    scopes: (f[CC.SCOPES] as string) || undefined,
    deltaLink: (f[CC.DELTA_LINK] as string) || undefined,
    selectedCalendarIds: (() => {
      const raw = (f[CC.SELECTED_CALENDAR_IDS] as string) || ''
      return raw ? raw.split('\n').map(s => s.trim()).filter(Boolean) : undefined
    })(),
    syncPastDays: typeof f[CC.SYNC_PAST_DAYS] === 'number' ? (f[CC.SYNC_PAST_DAYS] as number) : undefined,
    syncFutureDays: typeof f[CC.SYNC_FUTURE_DAYS] === 'number' ? (f[CC.SYNC_FUTURE_DAYS] as number) : undefined,
    syncStatus: (f[CC.SYNC_STATUS] as string) || undefined,
    lastSyncedAt: (f[CC.LAST_SYNCED_AT] as string) || undefined,
    lastSyncError: (f[CC.LAST_SYNC_ERROR] as string) || undefined,
    environment: (f[CC.ENVIRONMENT] as string) || undefined,
    clerkUserId: (f[CC.CLERK_USER_ID] as string) || undefined,
    clerkEmail: (f[CC.CLERK_EMAIL] as string) || undefined,
  }
}

/**
 * Returns all Connected Calendar records for a given Clerk user ID.
 * Each portal user may have multiple calendars connected (e.g. Outlook + Google).
 */
export async function getConnectedCalendarsByClerkUserId(
  clerkUserId: string,
): Promise<ConnectedCalendar[]> {
  const { apiKey, baseId } = getCredentials()
  const safe = clerkUserId.replace(/"/g, '\\"')
  const formula = encodeURIComponent(`{${FIELDS.CONNECTED_CALENDARS.CLERK_USER_ID}} = "${safe}"`)
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=20`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    console.error('[getConnectedCalendarsByClerkUserId] failed:', res.status, await res.text())
    return []
  }
  const data = await res.json()
  return (data.records ?? []).map(mapRecord)
}

/**
 * Returns all Connected Calendar records for a given People record ID.
 * JS-filtered because linked record fields can't be filtered by ID in Airtable formulas.
 */
export async function getConnectedCalendarsByPersonId(
  personId: string,
): Promise<ConnectedCalendar[]> {
  const { apiKey, baseId } = getCredentials()
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}?maxRecords=100`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    console.error('[getConnectedCalendarsByPersonId] failed:', res.status, await res.text())
    return []
  }
  const data = await res.json()
  return (data.records ?? [])
    .map(mapRecord)
    .filter((c: ConnectedCalendar) => c.personIds.includes(personId))
}

export interface UpsertConnectedCalendarData {
  clerkUserId: string
  clerkEmail: string
  personId: string
  provider: string
  providerAccountEmail: string
  providerUserId?: string
  providerTenantId?: string
  calendarId?: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: string
  scopes?: string
  deltaLink?: string
  syncStatus?: string
  environment?: string
}

/**
 * Creates or updates a Connected Calendar record for a clerk user + provider pair.
 * Matches on clerkUserId + provider to avoid duplicates.
 */
export async function upsertConnectedCalendar(
  data: UpsertConnectedCalendarData,
): Promise<string> {
  const { apiKey, baseId } = getCredentials()
  const CC = FIELDS.CONNECTED_CALENDARS

  const existing = await getConnectedCalendarsByClerkUserId(data.clerkUserId)
  const match = existing.find((c) => c.provider === data.provider)

  const connectionName = `${data.provider} — ${data.clerkEmail}`
  const fields: Record<string, unknown> = {
    [CC.CONNECTION_NAME]: connectionName,
    [CC.PERSON]: [data.personId],
    [CC.PROVIDER]: data.provider,
    [CC.PROVIDER_ACCOUNT_EMAIL]: data.providerAccountEmail,
    [CC.ACCESS_TOKEN]: data.accessToken,
    [CC.REFRESH_TOKEN]: data.refreshToken,
    [CC.TOKEN_EXPIRES_AT]: data.tokenExpiresAt,
    [CC.SYNC_STATUS]: data.syncStatus ?? 'Connected',
    [CC.CLERK_USER_ID]: data.clerkUserId,
    [CC.CLERK_EMAIL]: data.clerkEmail,
    [CC.ENVIRONMENT]: data.environment ?? (process.env.NODE_ENV === 'production' ? 'Production' : 'Local'),
  }
  if (data.providerUserId) fields[CC.PROVIDER_USER_ID] = data.providerUserId
  if (data.providerTenantId) fields[CC.PROVIDER_TENANT_ID] = data.providerTenantId
  if (data.calendarId) fields[CC.CALENDAR_ID] = data.calendarId
  if (data.scopes) fields[CC.SCOPES] = data.scopes
  if (data.deltaLink) fields[CC.DELTA_LINK] = data.deltaLink

  if (match) {
    const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}/${match.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    if (!res.ok) {
      const detail = await res.json()
      throw new Error(`Connected Calendar PATCH failed: ${JSON.stringify(detail)}`)
    }
    return match.id
  }

  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(`Connected Calendar POST failed: ${JSON.stringify(result)}`)
  return result.id as string
}

/**
 * Updates only the sync-state fields after a successful or failed calendar sync.
 */
export async function updateCalendarSyncState(
  recordId: string,
  state: {
    syncStatus: string
    lastSyncedAt: string
    deltaLink?: string
    lastSyncError?: string
  },
): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const CC = FIELDS.CONNECTED_CALENDARS
  const fields: Record<string, unknown> = {
    [CC.SYNC_STATUS]: state.syncStatus,
    [CC.LAST_SYNCED_AT]: state.lastSyncedAt,
  }
  if (state.deltaLink !== undefined) fields[CC.DELTA_LINK] = state.deltaLink
  if (state.lastSyncError !== undefined) fields[CC.LAST_SYNC_ERROR] = state.lastSyncError

  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Calendar sync state PATCH failed: ${detail}`)
  }
}

/**
 * Updates the access token and related fields after an OAuth token refresh.
 */
export async function updateCalendarTokens(
  recordId: string,
  tokens: {
    accessToken: string
    refreshToken?: string
    tokenExpiresAt: string
  },
): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const CC = FIELDS.CONNECTED_CALENDARS
  const fields: Record<string, unknown> = {
    [CC.ACCESS_TOKEN]: tokens.accessToken,
    [CC.TOKEN_EXPIRES_AT]: tokens.tokenExpiresAt,
  }
  if (tokens.refreshToken) fields[CC.REFRESH_TOKEN] = tokens.refreshToken

  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Calendar token PATCH failed: ${detail}`)
  }
}

/**
 * Saves the user's calendar selection and sync window after the setup step.
 */
export async function updateCalendarSetup(
  recordId: string,
  setup: {
    selectedCalendarIds: string[]
    syncPastDays: number
    syncFutureDays: number
  },
): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const CC = FIELDS.CONNECTED_CALENDARS
  const fields = {
    [CC.SELECTED_CALENDAR_IDS]: setup.selectedCalendarIds.join('\n'),
    [CC.SYNC_PAST_DAYS]: setup.syncPastDays,
    [CC.SYNC_FUTURE_DAYS]: setup.syncFutureDays,
  }
  const res = await fetch(`${API_BASE}/${baseId}/${TABLE}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`Calendar setup PATCH failed: ${await res.text()}`)
}

/**
 * Saves updated delta links (keyed by calendar ID) after a sync run.
 * Delta links are stored as a JSON string in the Delta Link field.
 */
export async function updateDeltaLinks(
  recordId: string,
  deltaLinks: Record<string, string>,
): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const CC = FIELDS.CONNECTED_CALENDARS
  const res = await fetch(`${API_BASE}/${baseId}/${TABLE}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [CC.DELTA_LINK]: JSON.stringify(deltaLinks) } }),
  })
  if (!res.ok) throw new Error(`Delta link PATCH failed: ${await res.text()}`)
}
