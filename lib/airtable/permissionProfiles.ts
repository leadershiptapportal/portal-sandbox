import { airtableFetch } from '@/lib/airtable/client'
import { TABLES, FIELDS } from '@/lib/airtable/constants'

const API_BASE = 'https://api.airtable.com/v0'

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

export interface PermissionProfile {
  id: string
  name: string
  description: string
  canWriteNotes: boolean
  canCreateMeetings: boolean
  canViewPersonProfile: boolean
  canViewDirectReports: boolean
  notesDefaultVisibility: string
}

export async function getPermissionProfiles(): Promise<PermissionProfile[]> {
  const { apiKey, baseId } = getCredentials()
  const fields = [
    FIELDS.PERMISSION_PROFILES.PROFILE_NAME,
    FIELDS.PERMISSION_PROFILES.DESCRIPTION,
    FIELDS.PERMISSION_PROFILES.CAN_WRITE_NOTES,
    FIELDS.PERMISSION_PROFILES.CAN_CREATE_MEETINGS,
    FIELDS.PERMISSION_PROFILES.CAN_VIEW_PERSON_PROFILE,
    FIELDS.PERMISSION_PROFILES.CAN_VIEW_DIRECT_REPORTS,
    FIELDS.PERMISSION_PROFILES.NOTES_DEFAULT_VISIBILITY,
  ].map((f) => `fields[]=${encodeURIComponent(f)}`).join('&')

  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLES.PERMISSION_PROFILES}?${fields}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()

  return (data.records ?? []).map((r: { id: string; fields: Record<string, unknown> }) => {
    const f = r.fields
    return {
      id: r.id,
      name: (f[FIELDS.PERMISSION_PROFILES.PROFILE_NAME] as string | undefined) ?? '',
      description: (f[FIELDS.PERMISSION_PROFILES.DESCRIPTION] as string | undefined) ?? '',
      canWriteNotes: Boolean(f[FIELDS.PERMISSION_PROFILES.CAN_WRITE_NOTES]),
      canCreateMeetings: Boolean(f[FIELDS.PERMISSION_PROFILES.CAN_CREATE_MEETINGS]),
      canViewPersonProfile: Boolean(f[FIELDS.PERMISSION_PROFILES.CAN_VIEW_PERSON_PROFILE]),
      canViewDirectReports: Boolean(f[FIELDS.PERMISSION_PROFILES.CAN_VIEW_DIRECT_REPORTS]),
      notesDefaultVisibility:
        (f[FIELDS.PERMISSION_PROFILES.NOTES_DEFAULT_VISIBILITY] as string | undefined) ?? 'internal_only',
    }
  })
}
