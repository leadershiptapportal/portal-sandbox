import { cache } from 'react'
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { airtableFetch } from '@/lib/airtable/client'
import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { log } from '@/lib/utils/logger'
import { getImpersonatedRecordId } from './impersonation'

const AIRTABLE_API = 'https://api.airtable.com/v0'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PortalPermissions {
  canWriteNotes: boolean
  canCreateMeetings: boolean
  canViewPersonProfile: boolean
  canViewDirectReports: boolean
  notesDefaultVisibility: string
}

export interface PortalPerson {
  airtableRecordId: string
  clerkUserId: string          // always the real logged-in admin's Clerk ID
  realAirtableId: string       // real admin's Airtable ID (same as airtableRecordId when not impersonating)
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'coach' | 'unknown'
  permissionProfileIds: string[]
  permissions: PortalPermissions
  isImpersonated: boolean
}

type AirtableRecord = { id: string; fields: Record<string, unknown> }

const DEFAULT_PERMISSIONS: PortalPermissions = {
  canWriteNotes: false,
  canCreateMeetings: false,
  canViewPersonProfile: false,
  canViewDirectReports: false,
  notesDefaultVisibility: 'internal_only',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEnv() {
  const baseId = process.env.AIRTABLE_BASE_ID
  const token = process.env.AIRTABLE_API_KEY
  if (!baseId || !token) throw new Error('Missing AIRTABLE_BASE_ID or AIRTABLE_API_KEY')
  return { baseId, token }
}

function peopleUrl(baseId: string) {
  return `${AIRTABLE_API}/${baseId}/${TABLES.HUMANS}`
}

function personFields() {
  return [
    FIELDS.HUMANS.CLERK_USER_ID,
    FIELDS.HUMANS.PERMISSION_PROFILE,
    FIELDS.HUMANS.WORK_EMAIL,
    FIELDS.HUMANS.FIRST_NAME,
    FIELDS.HUMANS.LAST_NAME,
  ]
    .map((f) => `fields[]=${encodeURIComponent(f)}`)
    .join('&')
}

async function fetchByFormula(
  baseId: string,
  token: string,
  formula: string,
): Promise<AirtableRecord | null> {
  const url = `${peopleUrl(baseId)}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1&${personFields()}`
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

async function fetchByRecordId(
  baseId: string,
  token: string,
  recordId: string,
): Promise<AirtableRecord | null> {
  const url = `${peopleUrl(baseId)}/${recordId}?${personFields()}`
  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  return await res.json() as AirtableRecord
}

async function loadProfile(
  baseId: string,
  token: string,
  profileId: string,
): Promise<{ permissions: PortalPermissions; profileName: string }> {
  const url = `${AIRTABLE_API}/${baseId}/${TABLES.PERMISSION_PROFILES}/${profileId}?` +
    [
      FIELDS.PERMISSION_PROFILES.PROFILE_NAME,
      FIELDS.PERMISSION_PROFILES.CAN_WRITE_NOTES,
      FIELDS.PERMISSION_PROFILES.CAN_CREATE_MEETINGS,
      FIELDS.PERMISSION_PROFILES.CAN_VIEW_PERSON_PROFILE,
      FIELDS.PERMISSION_PROFILES.CAN_VIEW_DIRECT_REPORTS,
      FIELDS.PERMISSION_PROFILES.NOTES_DEFAULT_VISIBILITY,
    ].map((f) => `fields[]=${encodeURIComponent(f)}`).join('&')

  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!res.ok) return { permissions: DEFAULT_PERMISSIONS, profileName: '' }
  const data = await res.json()
  const f = (data.fields ?? {}) as Record<string, unknown>
  return {
    profileName: (f[FIELDS.PERMISSION_PROFILES.PROFILE_NAME] as string | undefined) ?? '',
    permissions: {
      canWriteNotes: Boolean(f[FIELDS.PERMISSION_PROFILES.CAN_WRITE_NOTES]),
      canCreateMeetings: Boolean(f[FIELDS.PERMISSION_PROFILES.CAN_CREATE_MEETINGS]),
      canViewPersonProfile: Boolean(f[FIELDS.PERMISSION_PROFILES.CAN_VIEW_PERSON_PROFILE]),
      canViewDirectReports: Boolean(f[FIELDS.PERMISSION_PROFILES.CAN_VIEW_DIRECT_REPORTS]),
      notesDefaultVisibility:
        (f[FIELDS.PERMISSION_PROFILES.NOTES_DEFAULT_VISIBILITY] as string | undefined) ?? 'internal_only',
    },
  }
}

function profileNameToRole(name: string): PortalPerson['role'] {
  const n = name.toLowerCase().trim()
  if (n === 'admin') return 'admin'
  if (n === 'coach') return 'coach'
  return 'unknown'
}

async function writeClerkUserId(
  baseId: string,
  token: string,
  recordId: string,
  clerkUserId: string,
): Promise<void> {
  const res = await fetch(`${peopleUrl(baseId)}/${recordId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [FIELDS.HUMANS.CLERK_USER_ID]: clerkUserId } }),
  })
  if (!res.ok) {
    const text = await res.text()
    log.warn(`[requireCurrentPortalPerson] failed to write Clerk User ID: ${text}`)
  }
}

function mapRecord(
  record: AirtableRecord,
  clerkUserId: string,
  email: string,
  permissions: PortalPermissions,
  isImpersonated: boolean,
  realAirtableId: string,
  role: PortalPerson['role'],
): PortalPerson {
  const f = record.fields
  const profileIds = Array.isArray(f[FIELDS.HUMANS.PERMISSION_PROFILE])
    ? (f[FIELDS.HUMANS.PERMISSION_PROFILE] as string[])
    : []
  return {
    airtableRecordId: record.id,
    clerkUserId,
    realAirtableId,
    email: (f[FIELDS.HUMANS.WORK_EMAIL] as string | undefined) ?? email,
    firstName: (f[FIELDS.HUMANS.FIRST_NAME] as string | undefined) ?? '',
    lastName: (f[FIELDS.HUMANS.LAST_NAME] as string | undefined) ?? '',
    role,
    permissionProfileIds: profileIds,
    permissions,
    isImpersonated,
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Resolves the current session to a fully-loaded PortalPerson (role +
 * permission flags). Supports admin impersonation via cookie.
 *
 * Redirects to /access-denied if no People record or no Permission Profile.
 * Wrapped in React cache() so multiple callers share one round-trip per render.
 */
export const requireCurrentPortalPerson = cache(async (): Promise<PortalPerson> => {
  const clerkUser = await currentUser()
  if (!clerkUser) redirect('/sign-in')

  const clerkUserId = clerkUser.id
  const email = clerkUser.primaryEmailAddress?.emailAddress ?? ''
  const { baseId, token } = getEnv()

  // ── 1. Resolve the REAL admin's record first ──────────────────────────────
  const safeClerkId = clerkUserId.replace(/"/g, '\\"')
  let realRecord = await fetchByFormula(
    baseId, token, `{${FIELDS.HUMANS.CLERK_USER_ID}} = "${safeClerkId}"`,
  )

  if (!realRecord && email) {
    const safeEmail = email.toLowerCase().replace(/"/g, '\\"')
    realRecord = await fetchByFormula(
      baseId, token, `LOWER({${FIELDS.HUMANS.WORK_EMAIL}}) = "${safeEmail}"`,
    )
    if (realRecord) {
      await writeClerkUserId(baseId, token, realRecord.id, clerkUserId)
    }
  }

  if (!realRecord) {
    log.warn(`[requireCurrentPortalPerson] no record found email=${email}`)
    redirect('/access-denied')
  }

  const realAirtableId = realRecord.id

  // ── 2. Load real user's profile — role is derived from profile name ───────
  const realProfileIds = Array.isArray(realRecord.fields[FIELDS.HUMANS.PERMISSION_PROFILE])
    ? (realRecord.fields[FIELDS.HUMANS.PERMISSION_PROFILE] as string[])
    : []

  if (realProfileIds.length === 0) {
    log.warn(`[requireCurrentPortalPerson] no Permission Profile recordId=${realAirtableId}`)
    redirect('/access-denied')
  }

  const { permissions: realPermissions, profileName: realProfileName } =
    await loadProfile(baseId, token, realProfileIds[0])

  const realRole = profileNameToRole(realProfileName)

  // ── 3. Check impersonation (admin-only) ───────────────────────────────────
  let targetRecord = realRecord
  let isImpersonated = false

  if (realRole === 'admin') {
    const impersonateId = await getImpersonatedRecordId()
    if (impersonateId && impersonateId !== realAirtableId) {
      const impersonatedRecord = await fetchByRecordId(baseId, token, impersonateId)
      if (impersonatedRecord) {
        targetRecord = impersonatedRecord
        isImpersonated = true
        log.debug(`[requireCurrentPortalPerson] admin ${realAirtableId} impersonating ${impersonateId}`)
      }
    }
  }

  // ── 4. Resolve target permissions (load target profile when impersonating) ─
  let permissions = realPermissions
  let targetRole = realRole

  if (isImpersonated) {
    const targetProfileIds = Array.isArray(targetRecord.fields[FIELDS.HUMANS.PERMISSION_PROFILE])
      ? (targetRecord.fields[FIELDS.HUMANS.PERMISSION_PROFILE] as string[])
      : []
    if (targetProfileIds.length === 0) {
      log.warn(`[requireCurrentPortalPerson] impersonated record has no profile id=${targetRecord.id}`)
      redirect('/access-denied')
    }
    const { permissions: targetPermissions, profileName: targetProfileName } =
      await loadProfile(baseId, token, targetProfileIds[0])
    permissions = targetPermissions
    targetRole = profileNameToRole(targetProfileName)
  }

  const targetEmail = (targetRecord.fields[FIELDS.HUMANS.WORK_EMAIL] as string | undefined) ?? email

  return mapRecord(targetRecord, clerkUserId, targetEmail, permissions, isImpersonated, realAirtableId, targetRole)
})
