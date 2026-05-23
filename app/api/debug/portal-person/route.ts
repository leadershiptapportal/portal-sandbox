import { auth, currentUser } from '@clerk/nextjs/server'
import { airtableFetch } from '@/lib/airtable/client'
import { TABLES, FIELDS } from '@/lib/airtable/constants'

/**
 * Temporary diagnostic endpoint — does NOT redirect on failure, just returns
 * JSON showing exactly what the portal-person lookup finds for your account.
 *
 * DELETE this file once the access issue is resolved.
 */
export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return Response.json({ error: 'Not authenticated with Clerk' }, { status: 401 })
  }

  const clerkUser = await currentUser()
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? ''

  const baseId = process.env.AIRTABLE_BASE_ID
  const token = process.env.AIRTABLE_API_KEY
  if (!baseId || !token) {
    return Response.json({ error: 'Missing AIRTABLE_BASE_ID or AIRTABLE_API_KEY env vars' }, { status: 500 })
  }

  const tableUrl = `https://api.airtable.com/v0/${baseId}/${TABLES.PEOPLE}`
  const fields = [
    FIELDS.USERS.CLERK_USER_ID,
    FIELDS.USERS.PERMISSION_PROFILE,
    FIELDS.USERS.WORK_EMAIL,
    FIELDS.USERS.FIRST_NAME,
    FIELDS.USERS.LAST_NAME,
  ].map((f) => `fields[]=${encodeURIComponent(f)}`).join('&')

  // Step 1: lookup by Clerk User ID
  const safeClerkId = userId.replace(/"/g, '\\"')
  const byIdUrl = `${tableUrl}?filterByFormula=${encodeURIComponent(`{${FIELDS.USERS.CLERK_USER_ID}} = "${safeClerkId}"`)}&maxRecords=1&${fields}`
  const byIdRes = await airtableFetch(byIdUrl, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const byIdData = await byIdRes.json()
  const byIdRecord = byIdData.records?.[0] ?? null

  // Step 2: lookup by Work Email
  const safeEmail = email.toLowerCase().replace(/"/g, '\\"')
  const byEmailUrl = `${tableUrl}?filterByFormula=${encodeURIComponent(`LOWER({${FIELDS.USERS.WORK_EMAIL}}) = "${safeEmail}"`)}&maxRecords=1&${fields}`
  const byEmailRes = await airtableFetch(byEmailUrl, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' })
  const byEmailData = await byEmailRes.json()
  const byEmailRecord = byEmailData.records?.[0] ?? null

  const summarise = (record: { id: string; fields: Record<string, unknown> } | null) => {
    if (!record) return null
    const profileIds = Array.isArray(record.fields[FIELDS.USERS.PERMISSION_PROFILE])
      ? record.fields[FIELDS.USERS.PERMISSION_PROFILE]
      : []
    return {
      recordId: record.id,
      workEmail: record.fields[FIELDS.USERS.WORK_EMAIL] ?? null,
      clerkUserIdOnRecord: record.fields[FIELDS.USERS.CLERK_USER_ID] ?? null,
      firstName: record.fields[FIELDS.USERS.FIRST_NAME] ?? null,
      lastName: record.fields[FIELDS.USERS.LAST_NAME] ?? null,
      permissionProfileIds: profileIds,
      hasPermissionProfile: (profileIds as unknown[]).length > 0,
    }
  }

  return Response.json({
    clerkUserId: userId,
    clerkEmail: email,
    lookupByClerkId: {
      status: byIdRes.ok ? 'ok' : `error ${byIdRes.status}`,
      airtableError: byIdRes.ok ? undefined : byIdData,
      record: summarise(byIdRecord),
    },
    lookupByEmail: {
      status: byEmailRes.ok ? 'ok' : `error ${byEmailRes.status}`,
      airtableError: byEmailRes.ok ? undefined : byEmailData,
      record: summarise(byEmailRecord),
    },
    diagnosis: (() => {
      const record = byIdRecord ?? byEmailRecord
      if (!record) return 'NO_PEOPLE_RECORD — no match by Clerk User ID or Work Email'
      const ids = Array.isArray(record.fields[FIELDS.USERS.PERMISSION_PROFILE])
        ? record.fields[FIELDS.USERS.PERMISSION_PROFILE] as unknown[]
        : []
      if (ids.length === 0) return 'NO_PERMISSION_PROFILE — People record found but Portal Permission Profile is blank'
      return 'OK — record found and Permission Profile is set; access should work'
    })(),
  })
}
