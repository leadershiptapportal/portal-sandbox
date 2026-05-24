import { type ConnectedCalendar, updateCalendarTokens } from '@/lib/airtable/connectedCalendars'

const TOKEN_ENDPOINT = `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}/oauth2/v2.0/token`
const REFRESH_BUFFER_MS = 5 * 60 * 1000 // refresh if expiring within 5 minutes

/**
 * Exchanges a refresh token for a new access token and persists the result
 * to the Connected Calendars record.
 */
export async function refreshAccessToken(record: ConnectedCalendar): Promise<string> {
  if (!record.refreshToken) throw new Error(`No refresh token for record ${record.id}`)

  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Missing MICROSOFT_CLIENT_ID or MICROSOFT_CLIENT_SECRET')

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: record.refreshToken,
      scope: 'Calendars.ReadBasic offline_access User.Read',
    }),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Token refresh failed for record ${record.id}: ${detail}`)
  }

  const data = await res.json()
  const tokenExpiresAt = new Date(Date.now() + (data.expires_in as number) * 1000).toISOString()

  await updateCalendarTokens(record.id, {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    tokenExpiresAt,
  })

  return data.access_token as string
}

/**
 * Returns a valid access token for the given Connected Calendar record,
 * refreshing automatically if the token is missing or expiring within 5 minutes.
 */
export async function getValidAccessToken(record: ConnectedCalendar): Promise<string> {
  const expiresAt = record.tokenExpiresAt ? new Date(record.tokenExpiresAt).getTime() : 0

  if (!record.accessToken || Date.now() + REFRESH_BUFFER_MS >= expiresAt) {
    return refreshAccessToken(record)
  }

  return record.accessToken
}
