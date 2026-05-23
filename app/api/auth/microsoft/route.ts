import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'crypto'

export async function GET() {
  const tenantId = process.env.AZURE_TENANT_ID
  const clientId = process.env.AZURE_CLIENT_ID
  const appUrl = process.env.NEXT_PUBLIC_APP_URL

  if (!tenantId || !clientId || !appUrl) {
    return NextResponse.json({ error: 'OAuth not configured' }, { status: 500 })
  }

  const state = crypto.randomUUID()

  const cookieStore = await cookies()
  cookieStore.set('ms_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
  })

  const authUrl = new URL(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize`,
  )
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('redirect_uri', `${appUrl}/api/auth/microsoft/callback`)
  authUrl.searchParams.set('scope', 'Calendars.ReadBasic offline_access User.Read')
  authUrl.searchParams.set('state', state)
  authUrl.searchParams.set('prompt', 'select_account')

  return NextResponse.redirect(authUrl.toString())
}
