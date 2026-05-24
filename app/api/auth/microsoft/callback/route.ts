import { type NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { requireCurrentPortalPerson } from '@/lib/auth/requireCurrentPortalPerson'
import { getConnectedCalendarsByClerkUserId, upsertConnectedCalendar } from '@/lib/airtable/connectedCalendars'

export async function GET(req: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const successUrl = `${appUrl}/settings`
  const failureUrl = `${appUrl}/settings?calendar_error=1`


  const { searchParams } = req.nextUrl
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError || !code || !state) {
    return NextResponse.redirect(failureUrl)
  }

  // Validate CSRF state cookie
  const cookieStore = await cookies()
  const savedState = cookieStore.get('ms_oauth_state')?.value
  cookieStore.delete('ms_oauth_state')
  if (!savedState || savedState !== state) {
    return NextResponse.redirect(failureUrl)
  }

  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI
  if (!tenantId || !clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(failureUrl)
  }

  // Exchange authorization code for tokens
  let accessToken: string
  let refreshToken: string
  let expiresIn: number
  let scope: string
  try {
    const tokenRes = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      },
    )
    if (!tokenRes.ok) {
      console.error('[ms-callback] token exchange failed:', await tokenRes.text())
      return NextResponse.redirect(failureUrl)
    }
    const tokenData = await tokenRes.json()
    accessToken = tokenData.access_token
    refreshToken = tokenData.refresh_token
    expiresIn = tokenData.expires_in
    scope = tokenData.scope
  } catch (err) {
    console.error('[ms-callback] token exchange error:', err)
    return NextResponse.redirect(failureUrl)
  }

  // Fetch Microsoft account profile
  let providerUserId: string
  let providerAccountEmail: string
  try {
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!profileRes.ok) {
      console.error('[ms-callback] graph /me failed:', await profileRes.text())
      return NextResponse.redirect(failureUrl)
    }
    const profile = await profileRes.json()
    providerUserId = profile.id as string
    providerAccountEmail = (profile.mail ?? profile.userPrincipalName ?? '') as string
  } catch (err) {
    console.error('[ms-callback] graph /me error:', err)
    return NextResponse.redirect(failureUrl)
  }

  // Resolve portal person — may throw NEXT_REDIRECT to /sign-in or /access-denied
  const person = await requireCurrentPortalPerson()

  // Check if this is a new connection before upserting (determines post-auth destination)
  const existingCalendars = await getConnectedCalendarsByClerkUserId(person.clerkUserId)
  const isNewConnection = !existingCalendars.find(c => c.provider === 'Outlook')

  // Persist the connection
  try {
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    const environment = process.env.NODE_ENV === 'production' ? 'Production' : 'Local'
    await upsertConnectedCalendar({
      clerkUserId: person.clerkUserId,
      clerkEmail: person.email,
      personId: person.airtableRecordId,
      provider: 'Outlook',
      providerAccountEmail,
      providerUserId,
      providerTenantId: tenantId,
      accessToken,
      refreshToken,
      tokenExpiresAt,
      scopes: scope,
      syncStatus: 'Connected',
      environment,
    })
  } catch (err) {
    console.error('[ms-callback] upsert failed:', err)
    return NextResponse.redirect(failureUrl)
  }

  // New connections → calendar setup; re-links → settings
  const destination = isNewConnection ? `${appUrl}/settings/calendar-setup` : successUrl
  return NextResponse.redirect(destination)
}
