import { currentUser } from '@clerk/nextjs/server'
import { log } from '@/lib/utils/logger'
import { airtableFetch } from '@/lib/airtable/client'
import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { getImpersonatedRecordId } from './impersonation'

async function fetchProfileRole(
  baseId: string,
  token: string,
  profileId: string,
): Promise<CurrentUserRecord['role']> {
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLES.PERMISSION_PROFILES)}/${profileId}?fields[]=${encodeURIComponent(FIELDS.PERMISSION_PROFILES.PROFILE_NAME)}`
  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'force-cache',
  })
  if (!res.ok) return 'unknown'
  const data = await res.json()
  const name = ((data.fields?.[FIELDS.PERMISSION_PROFILES.PROFILE_NAME] as string | undefined) ?? '').toLowerCase().trim()
  if (name === 'admin') return 'admin'
  if (name === 'coach') return 'coach'
  return 'unknown'
}

export interface CurrentUserRecord {
  clerkId: string
  email: string
  airtableId: string | null
  role: 'admin' | 'coach' | 'unknown'
  realRole: 'admin' | 'coach' | 'unknown'  // always the actual logged-in user's role
  name: string
  isImpersonated: boolean
  realAirtableId: string | null  // admin's own ID when impersonating, otherwise same as airtableId
}

/**
 * Resolves the current Clerk session user to their Airtable record.
 * Role is read from the Airtable "Role" field (falls back to Clerk
 * publicMetadata.role if Airtable lookup fails).
 *
 * Always returns a usable object — never throws. On any failure the
 * role defaults to 'admin' so the portal doesn't go blank.
 */
export async function getCurrentUserRecord(): Promise<CurrentUserRecord> {
  try {
    const clerkUser = await currentUser()
    if (!clerkUser) {
      return { clerkId: "", email: "", airtableId: null, role: "unknown", realRole: "unknown", name: "", isImpersonated: false, realAirtableId: null }
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress ?? ''
    const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ')

    const baseId = process.env.AIRTABLE_BASE_ID
    const token = process.env.AIRTABLE_API_KEY
    if (!baseId || !token) {
      const clerkRole = (clerkUser.publicMetadata as { role?: string })?.role
      const role = clerkRole === 'admin' ? 'admin' : clerkRole === 'coach' ? 'coach' : 'unknown'
      return { clerkId: clerkUser.id, email, airtableId: null, role, realRole: role, name, isImpersonated: false, realAirtableId: null }
    }

    const searchEmail = email.toLowerCase().trim()
    const usersTable = encodeURIComponent(TABLES.HUMANS)

    // ── Step 1: formula lookup (fast, handles most cases) ──────────────────
    const safeEmail = searchEmail.replace(/"/g, '\\"')
    const formula = encodeURIComponent(`LOWER({${FIELDS.HUMANS.WORK_EMAIL}}) = "${safeEmail}"`)
    const formulaRes = await airtableFetch(
      `https://api.airtable.com/v0/${baseId}/${usersTable}?filterByFormula=${formula}&maxRecords=1`,
      { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
    )
    const formulaData = await formulaRes.json()
    let match = (formulaData.records ?? [])[0] as
      | { id: string; fields: Record<string, unknown> }
      | undefined

    if (match) {
      log.debug(`[getCurrentUserRecord] found via formula email=${searchEmail} airtableId=${match.id}`)
    } else {
      // ── Step 2: paginated scan fallback (catches records past position 100) ─
      log.warn(`[getCurrentUserRecord] formula returned nothing for ${searchEmail} — falling back to paginated scan`)
      let offset: string | undefined
      let firstRecordLogged = false
      scan: do {
        const url = `https://api.airtable.com/v0/${baseId}/${usersTable}?pageSize=100${offset ? `&offset=${offset}` : ''}`
        const pageRes = await airtableFetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        })
        const pageData = await pageRes.json()
        // Log field names from the first record once — shows exact Airtable field names
        if (!firstRecordLogged && pageData.records?.length > 0) {
          log.debug('[getCurrentUserRecord] Airtable Users field names:', Object.keys(pageData.records[0].fields))
          firstRecordLogged = true
        }
        for (const r of pageData.records ?? []) {
          // Check all string fields for an email match (catches unexpected field names)
          const fields = r.fields as Record<string, unknown>
          const emailMatch = Object.entries(fields).some(([, v]) =>
            typeof v === 'string' && v.toLowerCase().trim() === searchEmail
          )
          if (emailMatch) {
            match = r as { id: string; fields: Record<string, unknown> }
            // Log which field(s) contained the match
            const matchingFields = Object.entries(fields)
              .filter(([, v]) => typeof v === 'string' && v.toLowerCase().trim() === searchEmail)
              .map(([k]) => k)
            log.debug(`[getCurrentUserRecord] found via paginated scan email=${searchEmail} airtableId=${match.id} matched fields=${matchingFields.join(', ')}`)
            break scan
          }
        }
        offset = pageData.offset as string | undefined
      } while (offset)

      if (!match) {
        log.debug(`[getCurrentUserRecord] email=${searchEmail} airtableId=NOT FOUND`)
      }
    }

    if (!match) {
      log.warn('[getCurrentUserRecord] No Airtable record found for:', searchEmail)
      const clerkRole = (clerkUser.publicMetadata as { role?: string })?.role
      const role = clerkRole === 'admin' ? 'admin' : clerkRole === 'coach' ? 'coach' : 'unknown'
      return { clerkId: clerkUser.id, email, airtableId: null, role, realRole: role, name, isImpersonated: false, realAirtableId: null }
    }

    const realAirtableId = match.id as string

    // Derive role from linked Permission Profile name
    const profileIds = Array.isArray(match.fields[FIELDS.HUMANS.PERMISSION_PROFILE])
      ? (match.fields[FIELDS.HUMANS.PERMISSION_PROFILE] as string[])
      : []
    const role: CurrentUserRecord['role'] = profileIds.length > 0
      ? await fetchProfileRole(baseId, token, profileIds[0])
      : 'unknown'

    // ── Impersonation: admins can view the portal as another user ─────────
    if (role === 'admin') {
      const impersonateId = await getImpersonatedRecordId()
      if (impersonateId && impersonateId !== realAirtableId) {
        const { apiKey: impKey, baseId: impBase } = (() => {
          const k = process.env.AIRTABLE_API_KEY
          const b = process.env.AIRTABLE_BASE_ID
          if (!k || !b) return { apiKey: null, baseId: null }
          return { apiKey: k, baseId: b }
        })()
        if (impKey && impBase) {
          const usersTable = encodeURIComponent(TABLES.HUMANS)
          const impRes = await airtableFetch(
            `https://api.airtable.com/v0/${impBase}/${usersTable}/${impersonateId}`,
            { headers: { Authorization: `Bearer ${impKey}` }, cache: 'no-store' },
          )
          if (impRes.ok) {
            const impData = await impRes.json()
            const f = impData.fields as Record<string, unknown>
            const impProfileIds = Array.isArray(f[FIELDS.HUMANS.PERMISSION_PROFILE])
              ? (f[FIELDS.HUMANS.PERMISSION_PROFILE] as string[])
              : []
            const impRole: CurrentUserRecord['role'] = impProfileIds.length > 0
              ? await fetchProfileRole(impBase, impKey, impProfileIds[0])
              : 'unknown'
            const impEmail = (f[FIELDS.HUMANS.WORK_EMAIL] as string | undefined) ?? email
            const impName = [f[FIELDS.HUMANS.FIRST_NAME], f[FIELDS.HUMANS.LAST_NAME]].filter(Boolean).join(' ')
            return {
              clerkId: clerkUser.id,
              email: impEmail,
              airtableId: impersonateId,
              role: impRole,
              realRole: role,
              name: impName || impEmail,
              isImpersonated: true,
              realAirtableId,
            }
          }
        }
      }
    }

    return {
      clerkId: clerkUser.id,
      email,
      airtableId: realAirtableId,
      role,
      realRole: role,
      name,
      isImpersonated: false,
      realAirtableId,
    }
  } catch (err) {
    log.error('[getCurrentUserRecord] error:', err)
    return { clerkId: '', email: '', airtableId: null, role: 'admin', realRole: 'admin', name: '', isImpersonated: false, realAirtableId: null }
  }
}
