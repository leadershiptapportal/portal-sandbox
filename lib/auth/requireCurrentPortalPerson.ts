import { cache } from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { airtableFetch } from '@/lib/airtable/client'
import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { log } from '@/lib/utils/logger'

const AIRTABLE_API = 'https://api.airtable.com/v0'

export interface PortalPerson {
  airtableRecordId: string
  clerkUserId: string
  email: string
  firstName: string
  lastName: string
  permissionProfileIds: string[]
}

type AirtableRecord = { id: string; fields: Record<string, unknown> }

function getEnv() {
  const baseId = process.env.AIRTABLE_BASE_ID
  const token = process.env.AIRTABLE_API_KEY
  if (!baseId || !token) throw new Error('Missing AIRTABLE_BASE_ID or AIRTABLE_API_KEY')
  return { baseId, token }
}

function tableUrl(baseId: string) {
  return `${AIRTABLE_API}/${baseId}/${TABLES.PEOPLE}`
}

function personFields() {
  return [
    FIELDS.USERS.CLERK_USER_ID,
    FIELDS.USERS.PERMISSION_PROFILE,
    FIELDS.USERS.WORK_EMAIL,
    FIELDS.USERS.FIRST_NAME,
    FIELDS.USERS.LAST_NAME,
  ]
    .map((f) => `fields[]=${encodeURIComponent(f)}`)
    .join('&')
}

async function fetchByFormula(
  baseId: string,
  token: string,
  formula: string,
): Promise<AirtableRecord | null> {
  const url =
    `${tableUrl(baseId)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1&${personFields()}`
  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Airtable lookup failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  return (data.records as AirtableRecord[] | undefined)?.[0] ?? null
}

async function writeClerkUserId(
  baseId: string,
  token: string,
  recordId: string,
  clerkUserId: string,
): Promise<void> {
  const res = await fetch(`${tableUrl(baseId)}/${recordId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: { [FIELDS.USERS.CLERK_USER_ID]: clerkUserId } }),
  })
  if (!res.ok) {
    const text = await res.text()
    log.warn(`[requireCurrentPortalPerson] failed to write Clerk User ID to ${recordId}: ${text}`)
  }
}

function mapRecord(record: AirtableRecord, clerkUserId: string, email: string): PortalPerson {
  const f = record.fields
  const permissionProfileIds = Array.isArray(f[FIELDS.USERS.PERMISSION_PROFILE])
    ? (f[FIELDS.USERS.PERMISSION_PROFILE] as string[])
    : []
  return {
    airtableRecordId: record.id,
    clerkUserId,
    email,
    firstName: (f[FIELDS.USERS.FIRST_NAME] as string | undefined) ?? '',
    lastName: (f[FIELDS.USERS.LAST_NAME] as string | undefined) ?? '',
    permissionProfileIds,
  }
}

/**
 * Resolves the current Clerk session to a People record and enforces access.
 *
 * Lookup order:
 *   1. Clerk User ID field (fast path after first login)
 *   2. Work Email (first login — writes Clerk User ID back on match)
 *
 * Redirects to /access-denied if:
 *   - No matching People record
 *   - People record exists but Portal Permission Profile is blank
 *
 * Wrapped in React cache() so multiple callers in the same render share
 * one Airtable round-trip.
 */
export const requireCurrentPortalPerson = cache(async (): Promise<PortalPerson> => {
  const clerkUser = await currentUser()
  if (!clerkUser) redirect('/sign-in')

  const clerkUserId = clerkUser.id
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? ''

  const { baseId, token } = getEnv()

  // ── 1. Look up by Clerk User ID (fast path) ───────────────────────────────
  const safeClerkId = clerkUserId.replace(/"/g, '\\"')
  let record = await fetchByFormula(
    baseId,
    token,
    `{${FIELDS.USERS.CLERK_USER_ID}} = "${safeClerkId}"`,
  )

  if (record) {
    log.debug(`[requireCurrentPortalPerson] matched by Clerk ID clerkId=${clerkUserId} recordId=${record.id}`)
  } else {
    // ── 2. Fall back to Work Email ─────────────────────────────────────────
    if (!email) {
      log.warn(`[requireCurrentPortalPerson] no email on Clerk user clerkId=${clerkUserId}`)
      redirect('/access-denied')
    }

    const safeEmail = email.toLowerCase().replace(/"/g, '\\"')
    record = await fetchByFormula(
      baseId,
      token,
      `LOWER({${FIELDS.USERS.WORK_EMAIL}}) = "${safeEmail}"`,
    )

    if (!record) {
      log.warn(`[requireCurrentPortalPerson] no People record found email=${email} clerkId=${clerkUserId}`)
      redirect('/access-denied')
    }

    log.debug(`[requireCurrentPortalPerson] matched by email email=${email} recordId=${record.id} — writing Clerk ID`)
    // Write Clerk ID so future lookups hit the fast path.
    await writeClerkUserId(baseId, token, record.id, clerkUserId)
  }

  // ── 3. Enforce permission profile ─────────────────────────────────────────
  const profileIds = Array.isArray(record.fields[FIELDS.USERS.PERMISSION_PROFILE])
    ? (record.fields[FIELDS.USERS.PERMISSION_PROFILE] as string[])
    : []

  if (profileIds.length === 0) {
    log.warn(`[requireCurrentPortalPerson] no Permission Profile recordId=${record.id} email=${email}`)
    redirect('/access-denied')
  }

  return mapRecord(record, clerkUserId, email)
})
