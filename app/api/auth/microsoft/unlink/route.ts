import { NextResponse } from 'next/server'
import { requireCurrentPortalPerson } from '@/lib/auth/requireCurrentPortalPerson'
import { getConnectedCalendarsByClerkUserId } from '@/lib/airtable/connectedCalendars'
import { TABLES } from '@/lib/airtable/constants'

const AIRTABLE_API = 'https://api.airtable.com/v0'

export async function POST() {
  const person = await requireCurrentPortalPerson()

  const calendars = await getConnectedCalendarsByClerkUserId(person.clerkUserId)
  const outlook = calendars.find((c) => c.provider === 'Outlook')

  if (!outlook) {
    return NextResponse.json({ ok: true })
  }

  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) {
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
  }

  const res = await fetch(
    `${AIRTABLE_API}/${baseId}/${TABLES.CONNECTED_CALENDARS}/${outlook.id}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${apiKey}` },
    },
  )

  if (!res.ok) {
    console.error('[ms-unlink] delete failed:', await res.text())
    return NextResponse.json({ error: 'Failed to unlink calendar' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
