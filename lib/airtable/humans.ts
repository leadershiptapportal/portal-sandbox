import type { Human } from "@/lib/types";
import { airtableFetch } from "@/lib/airtable/client";
import { TABLES, FIELDS } from "@/lib/airtable/constants";

const API_BASE = "https://api.airtable.com/v0";
const HUMANS_TABLE = encodeURIComponent(TABLES.HUMANS);

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error("Missing Airtable credentials");
  return { apiKey, baseId };
}

// Airtable lookup fields return either a string[] or a plain string.
// This helper normalises both to a single string value.
function readLookup(val: unknown): string | undefined {
  if (!val) return undefined;
  if (Array.isArray(val)) return (val[0] as string) || undefined;
  if (typeof val === "string") return val || undefined;
  return undefined;
}

// Zip two lookup arrays into strength objects
function readStrengths(
  names: unknown,
  domains: unknown
): Array<{ name: string; domain?: string }> {
  const ns = Array.isArray(names) ? (names as string[]) : [];
  const ds = Array.isArray(domains) ? (domains as string[]) : [];
  return ns.filter(Boolean).map((name, i) => ({ name, domain: ds[i] || undefined }));
}

function mapRecord(record: { id: string; fields: Record<string, unknown> }): Human {
  const f = record.fields
  return {
    id: record.id,
    fullName: f[FIELDS.HUMANS.FULL_NAME] as string | undefined,
    preferredName: f[FIELDS.HUMANS.PREFERRED_NAME] as string | undefined,
    firstName: f[FIELDS.HUMANS.FIRST_NAME] as string | undefined,
    lastName: f[FIELDS.HUMANS.LAST_NAME] as string | undefined,
    workEmail: f[FIELDS.HUMANS.WORK_EMAIL] as string | undefined,
    role: f[FIELDS.HUMANS.ROLE] as string | undefined,
    organizationName: readLookup(f[FIELDS.HUMANS.ORGANIZATION_NAME]),
    profilePhoto: Array.isArray(f[FIELDS.HUMANS.PROFILE_PHOTO])
      ? (f[FIELDS.HUMANS.PROFILE_PHOTO] as Array<{ url: string }>)[0]?.url
      : undefined,
    timeAtOrganization: f[FIELDS.HUMANS.TIME_AT_ORGANIZATION] as string | undefined,
    coachIds: Array.isArray(f[FIELDS.HUMANS.COACH])
      ? (f[FIELDS.HUMANS.COACH] as string[])
      : [],
    teamLeadIds: Array.isArray(f[FIELDS.HUMANS.TEAM_LEAD])
      ? (f[FIELDS.HUMANS.TEAM_LEAD] as string[])
      : [],
    quickNotes: f[FIELDS.HUMANS.QUICK_NOTES] as string | undefined,
    enneagramType: readLookup(f[FIELDS.HUMANS.ENNEAGRAM_TYPE_FROM_ENNEAGRAM]),
    enneagramDescriptor: readLookup(f[FIELDS.HUMANS.DESCRIPTOR_FROM_ENNEAGRAM]),
    mbtiType: readLookup(f[FIELDS.HUMANS.MBTI_FROM_MBTI]),
    mbtiDescriptor: readLookup(f[FIELDS.HUMANS.DESCRIPTOR_FROM_MBTI]),
    conflictPosture: undefined,
    conflictPostureDescriptor: readLookup(f[FIELDS.HUMANS.DESCRIPTOR_FROM_CONFLICT_POSTURE]),
    apologyLanguage: readLookup(f[FIELDS.HUMANS.APOLOGY_LANGUAGE_FROM_APOLOGY_LANGUAGE]),
    apologyLanguageDescriptor: readLookup(f[FIELDS.HUMANS.DESCRIPTOR_FROM_APOLOGY_LANGUAGE]),
    strengths: readStrengths(
      f[FIELDS.HUMANS.STRENGTH_NAME_FROM_STRENGTHS],
      f[FIELDS.HUMANS.DOMAIN_FROM_STRENGTHS]
    ),
    associatedMeetingIds: Array.isArray(f[FIELDS.HUMANS.ASSOCIATED_MEETINGS])
      ? (f[FIELDS.HUMANS.ASSOCIATED_MEETINGS] as string[])
      : [],
    teamMemberIds: Array.isArray(f[FIELDS.HUMANS.TEAM_MEMBERS])
      ? (f[FIELDS.HUMANS.TEAM_MEMBERS] as string[])
      : [],
    enneagramIds: Array.isArray(f[FIELDS.HUMANS.ENNEAGRAM])
      ? (f[FIELDS.HUMANS.ENNEAGRAM] as string[]) : [],
    mbtiIds: Array.isArray(f[FIELDS.HUMANS.MBTI])
      ? (f[FIELDS.HUMANS.MBTI] as string[]) : [],
    conflictPostureIds: Array.isArray(f[FIELDS.HUMANS.CONFLICT_POSTURE])
      ? (f[FIELDS.HUMANS.CONFLICT_POSTURE] as string[]) : [],
    apologyLanguageIds: Array.isArray(f[FIELDS.HUMANS.APOLOGY_LANGUAGE])
      ? (f[FIELDS.HUMANS.APOLOGY_LANGUAGE] as string[]) : [],
    strengthIds: Array.isArray(f[FIELDS.HUMANS.STRENGTHS])
      ? (f[FIELDS.HUMANS.STRENGTHS] as string[]) : [],
    organizationLinkedIds: Array.isArray(f[FIELDS.HUMANS.ORGANIZATION])
      ? (f[FIELDS.HUMANS.ORGANIZATION] as string[]) : [],
    birthday: f[FIELDS.HUMANS.BIRTHDAY] as string | undefined,
    workCellNumber: f[FIELDS.HUMANS.WORK_CELL_NUMBER] as string | undefined,
    personalCellNumber: f[FIELDS.HUMANS.PERSONAL_CELL_NUMBER] as string | undefined,
    title: f[FIELDS.HUMANS.TITLE] as string | undefined,
    startDate: f[FIELDS.HUMANS.START_DATE] as string | undefined,
    theme: (f[FIELDS.HUMANS.THEME] as 'light' | 'dark' | 'system' | undefined) || undefined,
  };
}

export async function searchHumansByName(
  query: string,
): Promise<Array<{ id: string; name: string; jobTitle?: string }>> {
  const { apiKey, baseId } = getCredentials()
  const q = query.toLowerCase().replace(/"/g, '')
  const formula = encodeURIComponent(
    `OR(` +
    `SEARCH("${q}",LOWER(IF({${FIELDS.HUMANS.FULL_NAME}},{${FIELDS.HUMANS.FULL_NAME}},"")),0),` +
    `SEARCH("${q}",LOWER(IF({${FIELDS.HUMANS.FIRST_NAME}},{${FIELDS.HUMANS.FIRST_NAME}},"")&" "&IF({${FIELDS.HUMANS.LAST_NAME}},{${FIELDS.HUMANS.LAST_NAME}},"")),0)` +
    `)`,
  )
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${HUMANS_TABLE}?filterByFormula=${formula}&maxRecords=20`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map((r: { id: string; fields: Record<string, unknown> }) => {
    const f = r.fields
    const name =
      (f[FIELDS.HUMANS.FULL_NAME] as string | undefined) ||
      [f[FIELDS.HUMANS.FIRST_NAME], f[FIELDS.HUMANS.LAST_NAME]].filter(Boolean).join(' ') ||
      (f[FIELDS.HUMANS.WORK_EMAIL] as string | undefined) ||
      r.id
    return { id: r.id, name }
  })
}

export interface CreateHumanFields {
  firstName?: string
  lastName?: string
  title?: string
  workEmail?: string
  role?: string
  coachIds?: string[]
  /** @deprecated Organizations are now modelled as Affiliations. Create an
   *  Affiliation row (lib/airtable/affiliations.ts) instead of writing the flat
   *  Humans.Organization link. Kept only for rollback; no caller should set it. */
  organizationIds?: string[]
}

export async function createHumanRecord(fields: CreateHumanFields): Promise<string> {
  const { apiKey, baseId } = getCredentials()

  const body = {
    fields: {
      ...(fields.firstName ? { [FIELDS.HUMANS.FIRST_NAME]: fields.firstName } : {}),
      ...(fields.lastName ? { [FIELDS.HUMANS.LAST_NAME]: fields.lastName } : {}),
      ...(fields.title ? { [FIELDS.HUMANS.TITLE]: fields.title } : {}),
      ...(fields.workEmail ? { [FIELDS.HUMANS.WORK_EMAIL]: fields.workEmail } : {}),
      ...(fields.role ? { [FIELDS.HUMANS.ROLE]: fields.role } : {}),
      ...(fields.coachIds?.length ? { [FIELDS.HUMANS.COACH]: fields.coachIds } : {}),
      ...(fields.organizationIds?.length ? { [FIELDS.HUMANS.ORGANIZATION]: fields.organizationIds } : {}),
    },
  }
  console.log('[createHumanRecord] POST body:', JSON.stringify(body, null, 2))
  const res = await airtableFetch(`${API_BASE}/${baseId}/${HUMANS_TABLE}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  console.log('[createHumanRecord] status:', res.status, '| response:', JSON.stringify(data, null, 2))
  if (!res.ok) {
    throw new Error(`Airtable POST failed: ${JSON.stringify(data)}`)
  }
  return data.id as string
}

export async function patchTeamMembers(
  humanId: string,
  memberIds: string[],
): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const body = { fields: { [FIELDS.HUMANS.TEAM_MEMBERS]: memberIds } }
  console.log('[patchTeamMembers] PATCH humanId:', humanId, 'body:', JSON.stringify(body))
  const res = await airtableFetch(`${API_BASE}/${baseId}/${HUMANS_TABLE}/${humanId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  console.log('[patchTeamMembers] status:', res.status, 'response:', JSON.stringify(data))
  if (!res.ok) {
    throw new Error(`Airtable PATCH failed: ${JSON.stringify(data)}`)
  }
}

export async function getAllHumans(): Promise<Human[]> {
  let apiKey: string, baseId: string;
  try {
    ({ apiKey, baseId } = getCredentials());
  } catch (e) {
    console.error('[getAllHumans] Missing Airtable credentials:', e);
    return [];
  }

  try {
    const res = await airtableFetch(`${API_BASE}/${baseId}/${HUMANS_TABLE}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[getAllHumans] failed status: ${res.status} body: ${text}`);
      return [];
    }

    const data = await res.json();
    return (data.records ?? []).map(mapRecord);
  } catch (e) {
    console.error('[getAllHumans] Unexpected error:', e);
    return [];
  }
}

export interface HumanProfileFields {
  'First Name'?: string
  'Last Name'?: string
  'Preferred Name'?: string
  'Work Email'?: string
  'Title'?: string
  'Start Date'?: string
  'Birthday'?: string
  'Work Cell Number'?: string
  'Personal Cell Number'?: string
  'Role'?: string
  'Enneagram'?: string[]
  'MBTI'?: string[]
  'Conflict Posture'?: string[]
  'Apology Language'?: string[]
  'Strengths'?: string[]
  'Coach'?: string[]
  'Team Lead'?: string[]
  /** @deprecated Use an Affiliation (lib/airtable/affiliations.ts) /
   *  setPrimaryOrgAction instead of the flat Humans.Organization link. */
  'Organization'?: string[]
}

export async function updateHumanProfile(
  humanId: string,
  fields: HumanProfileFields,
): Promise<void> {
  const { apiKey, baseId } = getCredentials()

  const NAME_TO_ID: Record<string, string> = {
    'First Name': FIELDS.HUMANS.FIRST_NAME,
    'Last Name': FIELDS.HUMANS.LAST_NAME,
    'Preferred Name': FIELDS.HUMANS.PREFERRED_NAME,
    'Work Email': FIELDS.HUMANS.WORK_EMAIL,
    'Title': FIELDS.HUMANS.TITLE,
    'Start Date': FIELDS.HUMANS.START_DATE,
    'Birthday': FIELDS.HUMANS.BIRTHDAY,
    'Work Cell Number': FIELDS.HUMANS.WORK_CELL_NUMBER,
    'Personal Cell Number': FIELDS.HUMANS.PERSONAL_CELL_NUMBER,
    'Role': FIELDS.HUMANS.ROLE,
    'Enneagram': FIELDS.HUMANS.ENNEAGRAM,
    'MBTI': FIELDS.HUMANS.MBTI,
    'Conflict Posture': FIELDS.HUMANS.CONFLICT_POSTURE,
    'Apology Language': FIELDS.HUMANS.APOLOGY_LANGUAGE,
    'Strengths': FIELDS.HUMANS.STRENGTHS,
    'Coach': FIELDS.HUMANS.COACH,
    'Team Lead': FIELDS.HUMANS.TEAM_LEAD,
    'Organization': FIELDS.HUMANS.ORGANIZATION,
  }
  const remapped = Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [NAME_TO_ID[k] ?? k, v])
  )
  const sanitized = Object.fromEntries(
    Object.entries(remapped).filter(([, v]) => {
      if (v === undefined || v === null) return false
      if (typeof v === 'string') return v !== ''
      if (Array.isArray(v)) return v.length > 0
      return true
    })
  )

  console.log('[updateHumanProfile] humanId:', humanId)
  console.log('[updateHumanProfile] fields to write:', JSON.stringify(sanitized, null, 2))

  const res = await airtableFetch(`${API_BASE}/${baseId}/${HUMANS_TABLE}/${humanId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields: sanitized }),
  })

  const responseText = await res.text()
  console.log('[updateHumanProfile] Airtable status:', res.status)
  console.log('[updateHumanProfile] Airtable response:', responseText)

  if (!res.ok) {
    console.error('[updateHumanProfile] Full Airtable error:', res.status, responseText)
    throw new Error(`Airtable PATCH failed (${res.status}): ${responseText}`)
  }
}

export interface AdminPortalHuman {
  id: string
  name: string
  email: string
  role: string
  permissionProfileIds: string[]
  clerkUserId: string
  lastPortalLogin: string | null
}

export async function getAdminPortalHumans(): Promise<AdminPortalHuman[]> {
  const { apiKey, baseId } = getCredentials()
  const fields = [
    FIELDS.HUMANS.FIRST_NAME, FIELDS.HUMANS.LAST_NAME, FIELDS.HUMANS.FULL_NAME,
    FIELDS.HUMANS.WORK_EMAIL, FIELDS.HUMANS.ROLE, FIELDS.HUMANS.PERMISSION_PROFILE,
    FIELDS.HUMANS.CLERK_USER_ID, FIELDS.HUMANS.LAST_PORTAL_LOGIN,
  ].map((f) => `fields[]=${encodeURIComponent(f)}`).join('&')
  const formula = encodeURIComponent(`{${FIELDS.HUMANS.CLERK_USER_ID}} != ""`)
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${HUMANS_TABLE}?filterByFormula=${formula}&${fields}&sort[0][field]=${encodeURIComponent(FIELDS.HUMANS.FULL_NAME)}&sort[0][direction]=asc`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map((r: { id: string; fields: Record<string, unknown> }) => {
    const f = r.fields
    const name = (f[FIELDS.HUMANS.FULL_NAME] as string | undefined) ||
      [f[FIELDS.HUMANS.FIRST_NAME], f[FIELDS.HUMANS.LAST_NAME]].filter(Boolean).join(' ') ||
      (f[FIELDS.HUMANS.WORK_EMAIL] as string | undefined) || r.id
    return {
      id: r.id,
      name,
      email: (f[FIELDS.HUMANS.WORK_EMAIL] as string | undefined) ?? '',
      role: (f[FIELDS.HUMANS.ROLE] as string | undefined) ?? 'unknown',
      permissionProfileIds: Array.isArray(f[FIELDS.HUMANS.PERMISSION_PROFILE])
        ? (f[FIELDS.HUMANS.PERMISSION_PROFILE] as string[])
        : [],
      clerkUserId: (f[FIELDS.HUMANS.CLERK_USER_ID] as string | undefined) ?? '',
      lastPortalLogin: (f[FIELDS.HUMANS.LAST_PORTAL_LOGIN] as string | undefined) ?? null,
    }
  })
}

export async function getPortalLoginHumans(): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
  const { apiKey, baseId } = getCredentials()
  const fields = [FIELDS.HUMANS.FIRST_NAME, FIELDS.HUMANS.LAST_NAME, FIELDS.HUMANS.FULL_NAME, FIELDS.HUMANS.WORK_EMAIL, FIELDS.HUMANS.ROLE, FIELDS.HUMANS.CLERK_USER_ID]
    .map((f) => `fields[]=${encodeURIComponent(f)}`).join('&')
  // Filter to Humans that have a Clerk User ID (i.e. actual portal login users)
  const formula = encodeURIComponent(`{${FIELDS.HUMANS.CLERK_USER_ID}} != ""`)
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${HUMANS_TABLE}?filterByFormula=${formula}&${fields}&maxRecords=100`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map((r: { id: string; fields: Record<string, unknown> }) => {
    const f = r.fields
    const name = (f[FIELDS.HUMANS.FULL_NAME] as string | undefined) ||
      [f[FIELDS.HUMANS.FIRST_NAME], f[FIELDS.HUMANS.LAST_NAME]].filter(Boolean).join(' ') ||
      (f[FIELDS.HUMANS.WORK_EMAIL] as string | undefined) || r.id
    return {
      id: r.id,
      name,
      email: (f[FIELDS.HUMANS.WORK_EMAIL] as string | undefined) ?? '',
      role: (f[FIELDS.HUMANS.ROLE] as string | undefined) ?? 'unknown',
    }
  })
}

export async function updateHumanTheme(humanId: string, theme: 'light' | 'dark' | 'system'): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const res = await airtableFetch(`${API_BASE}/${baseId}/${HUMANS_TABLE}/${humanId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { [FIELDS.HUMANS.THEME]: theme } }),
  })
  if (!res.ok) {
    const text = await res.text()
    console.error('[updateHumanTheme] Airtable PATCH failed:', text)
  }
}

// ── Profile options (for the Edit Profile dialog dropdowns) ───────────────────

export interface ProfileOption {
  id: string
  name: string
  typeCode?: string
  descriptor?: string
}

interface FetchTableConfig {
  filterFormula?: string
  codeField?: string
  descriptorField?: string
  nameFormatter?: (name: string, code: string | undefined) => string
}

async function fetchTableOptions(
  tableName: string,
  nameField: string,
  config?: FetchTableConfig,
): Promise<ProfileOption[]> {
  try {
    const { apiKey, baseId } = getCredentials()
    const params = new URLSearchParams()
    params.append('fields[]', nameField)
    if (config?.codeField) params.append('fields[]', config.codeField)
    if (config?.descriptorField) params.append('fields[]', config.descriptorField)
    params.set('maxRecords', '200')
    if (config?.filterFormula) params.set('filterByFormula', config.filterFormula)
    const res = await airtableFetch(
      `${API_BASE}/${baseId}/${encodeURIComponent(tableName)}?${params}`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    )
    if (!res.ok) {
      console.warn(`[fetchTableOptions] ${tableName} failed:`, res.status)
      return []
    }
    const data = await res.json()
    return (data.records ?? [])
      .map((r: { id: string; fields: Record<string, unknown> }) => {
        const rawName = (r.fields[nameField] as string) ?? ''
        const typeCode = config?.codeField
          ? String(r.fields[config.codeField] ?? '').trim() || undefined
          : undefined
        const descriptor = config?.descriptorField
          ? (r.fields[config.descriptorField] as string) || undefined
          : undefined
        const name = config?.nameFormatter ? config.nameFormatter(rawName, typeCode) : rawName
        return { id: r.id, name, typeCode, descriptor }
      })
      .filter((r: ProfileOption) => r.name)
  } catch (e) {
    console.warn(`[fetchTableOptions] ${tableName} error:`, e)
    return []
  }
}

export async function fetchPersonalityOptions(): Promise<{
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  strengths: ProfileOption[]
  conflictPostures: ProfileOption[]
}> {
  const [enneagrams, mbtis, strengths, conflictPostures] = await Promise.all([
    fetchTableOptions(TABLES.ENNEAGRAM, FIELDS.ENNEAGRAM.NAME, {
      codeField: FIELDS.ENNEAGRAM.TYPE_NUMBER,
      descriptorField: FIELDS.ENNEAGRAM.DESCRIPTOR,
      nameFormatter: (name, code) => (code ? `Type ${code} | ${name}` : name),
    }),
    fetchTableOptions(TABLES.PERSONALITIES_16, FIELDS.PERSONALITIES_16.NAME, {
      codeField: FIELDS.PERSONALITIES_16.MBTI_CODE,
      descriptorField: FIELDS.PERSONALITIES_16.DESCRIPTOR,
      nameFormatter: (name, code) => (code ? `${code.split('-')[0]} | ${name}` : name),
    }),
    fetchTableOptions(TABLES.STRENGTHS, FIELDS.STRENGTHS.NAME, {
      descriptorField: FIELDS.STRENGTHS.DESCRIPTOR,
    }),
    fetchTableOptions(TABLES.CONFLICT_POSTURES, FIELDS.CONFLICT_POSTURES.NAME, {
      descriptorField: FIELDS.CONFLICT_POSTURES.DESCRIPTOR,
    }),
  ])
  return { enneagrams, mbtis, strengths, conflictPostures }
}

export async function fetchProfileOptions(allHumans: Human[]): Promise<{
  organizations: ProfileOption[]
  enneagrams: ProfileOption[]
  mbtis: ProfileOption[]
  conflictPostures: ProfileOption[]
  apologyLanguages: ProfileOption[]
  strengths: ProfileOption[]
  coaches: ProfileOption[]
  allHumans: ProfileOption[]
}> {
  const [organizations, enneagrams, mbtis, conflictPostures, apologyLanguages, strengths] =
    await Promise.all([
      fetchTableOptions(TABLES.ORGANIZATIONS, FIELDS.ORGANIZATIONS.NAME, {
        filterFormula: `{${FIELDS.ORGANIZATIONS.STATUS}}="Active"`,
      }),
      fetchTableOptions(TABLES.ENNEAGRAM, FIELDS.ENNEAGRAM.NAME, {
        codeField: FIELDS.ENNEAGRAM.TYPE_NUMBER,
        descriptorField: FIELDS.ENNEAGRAM.DESCRIPTOR,
        nameFormatter: (name, code) => (code ? `Type ${code} | ${name}` : name),
      }),
      fetchTableOptions(TABLES.PERSONALITIES_16, FIELDS.PERSONALITIES_16.NAME, {
        codeField: FIELDS.PERSONALITIES_16.MBTI_CODE,
        descriptorField: FIELDS.PERSONALITIES_16.DESCRIPTOR,
        nameFormatter: (name, code) => (code ? `${code.split('-')[0]} | ${name}` : name),
      }),
      fetchTableOptions(TABLES.CONFLICT_POSTURES, FIELDS.CONFLICT_POSTURES.NAME, {
        descriptorField: FIELDS.CONFLICT_POSTURES.DESCRIPTOR,
      }),
      fetchTableOptions(TABLES.APOLOGY_LANGUAGES, FIELDS.APOLOGY_LANGUAGES.NAME, {
        descriptorField: FIELDS.APOLOGY_LANGUAGES.DESCRIPTOR,
      }),
      fetchTableOptions(TABLES.STRENGTHS, FIELDS.STRENGTHS.NAME, {
        descriptorField: FIELDS.STRENGTHS.DESCRIPTOR,
      }),
    ])

  const nameOf = (h: Human) =>
    (h.fullName ?? [h.firstName, h.lastName].filter(Boolean).join(' ')) || h.workEmail || h.id

  const coaches = allHumans
    .filter((h) => h.role?.toLowerCase() === 'coach' || h.role?.toLowerCase() === 'admin')
    .map((h) => ({ id: h.id, name: nameOf(h) }))

  const humans = allHumans.map((h) => ({ id: h.id, name: nameOf(h) }))

  return { organizations, enneagrams, mbtis, conflictPostures, apologyLanguages, strengths, coaches, allHumans: humans }
}

export async function getHumanById(id: string): Promise<Human | null> {
  let apiKey: string, baseId: string;
  try {
    ({ apiKey, baseId } = getCredentials());
  } catch (e) {
    console.error('[getHumanById] Missing Airtable credentials:', e);
    return null;
  }
  try {
    const res = await airtableFetch(`${API_BASE}/${baseId}/${HUMANS_TABLE}/${id}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return mapRecord(data);
  } catch (e) {
    console.error('[getHumanById] Unexpected error:', e);
    return null;
  }
}
