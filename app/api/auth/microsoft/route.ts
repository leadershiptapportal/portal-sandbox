import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function GET() {
  const tenantId = process.env.MICROSOFT_TENANT_ID
  const clientId = process.env.MICROSOFT_CLIENT_ID
  const redirectUri = process.env.MICROSOFT_REDIRECT_URI

  const missing = [
    !tenantId && 'MICROSOFT_TENANT_ID',
    !clientId && 'MICROSOFT_CLIENT_ID',
    !redirectUri && 'MICROSOFT_REDIRECT_URI',
  ].filter(Boolean)
  if (missing.length > 0) {
    return NextResponse.json({ error: 'OAuth not configured', missing }, { status: 500 })
  }

  const state = crypto.randomUUID()

  // Non-null safe — all three are guaranteed by the missing check above
  const authUrl = new URL(
    `https://login.microsoftonline.com/${tenantId!}/oauth2/v2.0/authorize`,
  )
  authUrl.searchParams.set('client_id', clientId!)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', redirectUri!)
  authUrl.searchParams.set('scope', 'Calendars.ReadBasic offline_access User.Read')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('prompt', 'select_account')

  // Set cookie on the redirect response directly — cookies().set() does not
  // attach to a NextResponse.redirect() returned from the same handler.
  const response = NextResponse.redirect(authUrl.toString())
  response.cookies.set('ms_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })
  return response
}
