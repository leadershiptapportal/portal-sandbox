import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { airtableFetch } from '@/lib/airtable/client'
import { log } from '@/lib/utils/logger'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent(TABLES.RELATIONSHIP_CONTEXTS)

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

export type RelationshipType = 'coaching' | 'reports_to' | 'client' | 'prospect' | 'personal' | 'peer'

export interface RelationshipContext {
  id: string
  humanId: string        // the coachee / direct report / contact (Person field)
  humanName: string
  humanTitle?: string
  leadId: string          // the coach / manager / professional (Lead field)
  leadName: string
  leadTitle?: string
  relationshipType: RelationshipType
  status: string
  organizationId?: string
  startDate?: string
  endDate?: string
}

export interface OnboardingData {
  newHumanId: string
  coaches?: string[]
  reportsTo?: string[]
  directReports?: string[]
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Normalises a Relationship Type cell value into the two canonical spec values.
 * Tolerates legacy / freeform Airtable values like "Executive Coaching", "Coach",
 * "Reports to", "Direct Report", "manager", etc. Anything that mentions "report"
 * or "manager" maps to reports_to; anything that mentions "coach" maps to
 * coaching; anything else falls back to coaching (and is logged so we notice).
 */
function normalizeRelationshipType(raw: unknown): RelationshipType {
  const s = (typeof raw === 'string' ? raw : '').toLowerCase().trim()
  if (!s) return 'coaching'
  if (s === 'coaching' || s === 'reports_to' || s === 'client' || s === 'prospect' || s === 'personal' || s === 'peer') return s
  if (s.includes('report') || s.includes('manager')) return 'reports_to'
  if (s.includes('coach')) return 'coaching'
  if (s.includes('prospect')) return 'prospect'
  if (s.includes('client')) return 'client'
  if (s.includes('personal') || s.includes('family')) return 'personal'
  if (s.includes('peer')) return 'peer'
  console.warn(`[RC] non-spec Relationship Type "${raw}" — defaulting to coaching`)
  return 'coaching'
}

interface HumanData { name: string; title?: string }

/**
 * Fetches name + title for all People records.
 * Used to populate humanName/leadName/humanTitle/leadTitle without per-record lookups.
 */
async function buildHumanDataMap(apiKey: string, baseId: string): Promise<Map<string, HumanData>> {
  const usersTable = encodeURIComponent(TABLES.HUMANS)
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${usersTable}` +
      `?fields[]=${encodeURIComponent(FIELDS.HUMANS.FULL_NAME)}` +
      `&fields[]=${encodeURIComponent(FIELDS.HUMANS.FIRST_NAME)}` +
      `&fields[]=${encodeURIComponent(FIELDS.HUMANS.LAST_NAME)}` +
      `&fields[]=${encodeURIComponent(FIELDS.HUMANS.TITLE)}` +
      `&maxRecords=5000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  const map = new Map<string, HumanData>()
  if (!res.ok) return map
  const data = await res.json()
  for (const r of data.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const full = (f[FIELDS.HUMANS.FULL_NAME] as string | undefined)?.trim()
    const first = (f[FIELDS.HUMANS.FIRST_NAME] as string | undefined)?.trim()
    const last = (f[FIELDS.HUMANS.LAST_NAME] as string | undefined)?.trim()
    const name = full || [first, last].filter(Boolean).join(' ') || (r.id as string)
    const title = (f[FIELDS.HUMANS.TITLE] as string | undefined)?.trim() || undefined
    map.set(r.id as string, { name, title })
  }
  return map
}

function mapRecord(
  r: { id: string; fields: Record<string, unknown> },
  humanDataMap: Map<string, HumanData>,
): RelationshipContext | null {
  const personIds = Array.isArray(r.fields[FIELDS.RELATIONSHIP_CONTEXTS.HUMAN])
    ? (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.HUMAN] as string[])
    : []
  const leadIds = Array.isArray(r.fields[FIELDS.RELATIONSHIP_CONTEXTS.LEAD])
    ? (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.LEAD] as string[])
    : []
  if (personIds.length === 0 || leadIds.length === 0) return null

  const humanId = personIds[0]
  const leadId = leadIds[0]
  const personData = humanDataMap.get(humanId)
  const leadData = humanDataMap.get(leadId)
  return {
    id: r.id,
    humanId,
    humanName: personData?.name ?? humanId,
    humanTitle: personData?.title,
    leadId,
    leadName: leadData?.name ?? leadId,
    leadTitle: leadData?.title,
    relationshipType: normalizeRelationshipType(r.fields[FIELDS.RELATIONSHIP_CONTEXTS.TYPE]),
    status: (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.STATUS] as string) ?? '',
    organizationId: undefined,
    startDate: (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.START_DATE] as string) ?? undefined,
    endDate: (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.END_DATE] as string) ?? undefined,
  }
}

// ── Read functions ────────────────────────────────────────────────────────────

/**
 * Returns all active Relationship Context records where Lead = leadAirtableId.
 * This is the dashboard query: "show me everyone this person coaches / manages".
 *
 * Airtable formulas cannot filter linked record fields by ID, so we fetch all
 * Active records and match in JavaScript.
 */
export async function getRelationshipContexts(
  leadAirtableId: string,
): Promise<RelationshipContext[]> {
  const { apiKey, baseId } = getCredentials()
  const formula = encodeURIComponent(
    `LOWER({${FIELDS.RELATIONSHIP_CONTEXTS.STATUS}}) = "active"`,
  )

  const [res, nameMap] = await Promise.all([
    airtableFetch(
      `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=1000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
    buildHumanDataMap(apiKey, baseId),
  ])

  if (!res.ok) {
    log.warn('[getRelationshipContexts] fetch failed:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  const results = (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, nameMap))
    .filter(
      (r: RelationshipContext | null): r is RelationshipContext =>
        r !== null && r.leadId === leadAirtableId,
    )
  log.debug(`[RC] found ${results.length} active contexts for lead ${leadAirtableId}`)
  return results
}

/**
 * Returns the single Relationship Context for a specific lead–person pair, or null.
 */
export async function getRelationshipContext(
  leadId: string,
  humanId: string,
): Promise<RelationshipContext | null> {
  const contexts = await getRelationshipContexts(leadId)
  return contexts.find((c) => c.humanId === humanId) ?? null
}

/**
 * Returns all active Relationship Contexts where Person = personAirtableId.
 * Used to show who coaches / manages this individual ("upstream" relationships).
 */
export async function getUpstreamContexts(
  personAirtableId: string,
): Promise<RelationshipContext[]> {
  const { apiKey, baseId } = getCredentials()
  const formula = encodeURIComponent(
    `LOWER({${FIELDS.RELATIONSHIP_CONTEXTS.STATUS}}) = "active"`,
  )

  const [res, nameMap] = await Promise.all([
    airtableFetch(
      `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=1000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
    buildHumanDataMap(apiKey, baseId),
  ])

  if (!res.ok) {
    log.warn('[getUpstreamContexts] fetch failed:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  return (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, nameMap))
    .filter(
      (r: RelationshipContext | null): r is RelationshipContext =>
        r !== null && r.humanId === personAirtableId,
    )
}

/**
 * Returns ALL Relationship Context records regardless of status.
 * Intended for the admin overview page only.
 */
export async function getAllRelationshipContexts(): Promise<RelationshipContext[]> {
  const { apiKey, baseId } = getCredentials()

  const [res, nameMap] = await Promise.all([
    airtableFetch(
      `${API_BASE}/${baseId}/${TABLE}?maxRecords=5000` +
        `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.RELATIONSHIP_CONTEXTS.STATUS)}&sort%5B0%5D%5Bdirection%5D=asc`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
    buildHumanDataMap(apiKey, baseId),
  ])

  if (!res.ok) {
    console.warn('[getAllRelationshipContexts] fetch failed:', res.status, await res.text())
    return []
  }

  const data = await res.json()
  return (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, nameMap))
    .filter((r: RelationshipContext | null): r is RelationshipContext => r !== null)
}

// ── Downstream traversal ──────────────────────────────────────────────────────

export interface DirectReport {
  humanId: string
  name: string
  title?: string
  email?: string
  photoUrl?: string
}

/**
 * Returns people who report to `personAirtableId` via reports_to Relationship Contexts.
 * Fetches the Person's Users record for display fields. Capped at 20.
 */
export async function getDirectReports(
  personAirtableId: string,
): Promise<DirectReport[]> {
  const { apiKey, baseId } = getCredentials()
  const formula = encodeURIComponent(
    `LOWER({${FIELDS.RELATIONSHIP_CONTEXTS.STATUS}}) = "active"`,
  )

  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=1000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    console.warn('[getDirectReports] fetch failed:', res.status)
    return []
  }

  const data = await res.json()

  // Filter to reports_to contexts where Lead = personAirtableId
  const personIds: string[] = []
  for (const r of data.records ?? []) {
    const f = r.fields as Record<string, unknown>
    if (normalizeRelationshipType(f[FIELDS.RELATIONSHIP_CONTEXTS.TYPE]) !== 'reports_to') continue
    const leadIds = Array.isArray(f[FIELDS.RELATIONSHIP_CONTEXTS.LEAD])
      ? (f[FIELDS.RELATIONSHIP_CONTEXTS.LEAD] as string[])
      : []
    if (!leadIds.includes(personAirtableId)) continue
    const pIds = Array.isArray(f[FIELDS.RELATIONSHIP_CONTEXTS.HUMAN])
      ? (f[FIELDS.RELATIONSHIP_CONTEXTS.HUMAN] as string[])
      : []
    if (pIds[0]) personIds.push(pIds[0])
  }

  if (personIds.length === 0) return []

  // Cap at 20
  const capped = [...new Set(personIds)].slice(0, 20)

  // Batch-fetch Users records for these person IDs
  const orClauses = capped.map((id) => `RECORD_ID()="${id}"`).join(',')
  const userFormula = encodeURIComponent(`OR(${orClauses})`)
  const usersTable = encodeURIComponent(TABLES.HUMANS)
  const userRes = await airtableFetch(
    `${API_BASE}/${baseId}/${usersTable}` +
      `?filterByFormula=${userFormula}` +
      `&fields[]=${encodeURIComponent(FIELDS.HUMANS.FULL_NAME)}` +
      `&fields[]=${encodeURIComponent(FIELDS.HUMANS.FIRST_NAME)}` +
      `&fields[]=${encodeURIComponent(FIELDS.HUMANS.LAST_NAME)}` +
      `&fields[]=${encodeURIComponent(FIELDS.HUMANS.TITLE)}` +
      `&fields[]=${encodeURIComponent(FIELDS.HUMANS.WORK_EMAIL)}` +
      `&fields[]=${encodeURIComponent(FIELDS.HUMANS.PROFILE_PHOTO)}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!userRes.ok) {
    console.warn('[getDirectReports] user fetch failed:', userRes.status)
    return []
  }

  const userData = await userRes.json()
  const results: DirectReport[] = []
  for (const r of userData.records ?? []) {
    const f = r.fields as Record<string, unknown>
    const fullName = (f[FIELDS.HUMANS.FULL_NAME] as string | undefined)?.trim()
    const first = (f[FIELDS.HUMANS.FIRST_NAME] as string | undefined)?.trim()
    const last = (f[FIELDS.HUMANS.LAST_NAME] as string | undefined)?.trim()
    const name = fullName || [first, last].filter(Boolean).join(' ') || r.id

    const photoArr = f[FIELDS.HUMANS.PROFILE_PHOTO] as Array<{ url: string }> | undefined
    const photoUrl = photoArr?.[0]?.url ?? undefined

    results.push({
      humanId: r.id as string,
      name,
      title: (f[FIELDS.HUMANS.TITLE] as string | undefined)?.trim() || undefined,
      email: (f[FIELDS.HUMANS.WORK_EMAIL] as string | undefined)?.trim() || undefined,
      photoUrl,
    })
  }

  return results
}

/**
 * Returns all people who report to (or are coached by) `personAirtableId`,
 * resolved to full User records so callers can render name, title, avatar, etc.
 *
 * depth = 1  → direct reports only (default, used on profile pages)
 * depth = 2+ → recurse through the org tree; capped at 3 to prevent runaway queries
 *
 * Dynamic import of getAllUsers avoids a circular module dependency.
 */
export async function getDownstreamHumans(
  personAirtableId: string,
  depth: number = 1,
): Promise<import('@/lib/types').Human[]> {
  const safeDepth = Math.min(Math.max(Math.round(depth), 1), 3)

  const contexts = await getRelationshipContexts(personAirtableId)
  if (contexts.length === 0) return []

  // Lazy-load to avoid circular deps (humans.ts ↔ relationships.ts)
  const { getAllHumans } = await import('@/lib/airtable/humans')
  const allHumans = await getAllHumans()
  const byId = new Map(allHumans.map((h) => [h.id, h]))

  const direct = contexts
    .map((c) => byId.get(c.humanId))
    .filter((h): h is import('@/lib/types').Human => h != null)

  if (safeDepth <= 1) return direct

  // Recurse one level deeper, deduplicating by ID
  const seen = new Set([personAirtableId, ...direct.map((u) => u.id)])
  const nested = await Promise.all(direct.map((u) => getDownstreamHumans(u.id, safeDepth - 1)))
  for (const group of nested) {
    for (const u of group) {
      if (!seen.has(u.id)) {
        seen.add(u.id)
        direct.push(u)
      }
    }
  }

  return direct
}

// ── RC resolver for notes ─────────────────────────────────────────────────────

/**
 * Resolves the Relationship Context that connects a coach to a subject person.
 *
 * 1. Direct match: coach is Lead, subject is Person → return that RC.
 * 2. One-hop downstream: for each direct RC (Lead = coach), check if that
 *    person leads the subject via their own RCs. Return the *coach's* RC
 *    (the upstream coaching context), not the downstream row.
 * 3. No match → return null.
 */
export async function resolveContextForSubject(
  coachId: string,
  subjectPersonId: string,
): Promise<RelationshipContext | null> {
  const { apiKey, baseId } = getCredentials()
  const formula = encodeURIComponent(
    `LOWER({${FIELDS.RELATIONSHIP_CONTEXTS.STATUS}}) = "active"`,
  )

  const [res, nameMap] = await Promise.all([
    airtableFetch(
      `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=2000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    ),
    buildHumanDataMap(apiKey, baseId),
  ])

  if (!res.ok) return null

  const data = await res.json()
  const allActive = (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, nameMap))
    .filter((r: RelationshipContext | null): r is RelationshipContext => r !== null)

  // Index by lead → RCs
  const byLead = new Map<string, RelationshipContext[]>()
  for (const rc of allActive) {
    const list = byLead.get(rc.leadId) ?? []
    list.push(rc)
    byLead.set(rc.leadId, list)
  }

  // 1. Direct: coach → subject
  const direct = byLead.get(coachId)?.find((c) => c.humanId === subjectPersonId)
  if (direct) return direct

  // 2. One-hop: coach → intermediate → subject. Return the coach's upstream RC.
  for (const rc of byLead.get(coachId) ?? []) {
    const downstream = byLead.get(rc.humanId) ?? []
    if (downstream.some((d) => d.humanId === subjectPersonId)) return rc
  }

  return null
}

// ── Write: onboarding row generation ─────────────────────────────────────────

/**
 * Fetches all Relationship Context rows where Person = humanId and returns
 * a compact list of {leadId, type} for duplicate detection.
 */
async function fetchExistingPairs(
  apiKey: string,
  baseId: string,
  humanId: string,
): Promise<Array<{ leadId: string; type: string }>> {
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}?maxRecords=500`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .filter((r: { id: string; fields: Record<string, unknown> }) => {
      const persons = Array.isArray(r.fields[FIELDS.RELATIONSHIP_CONTEXTS.HUMAN])
        ? (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.HUMAN] as string[])
        : []
      return persons.includes(humanId)
    })
    .map((r: { id: string; fields: Record<string, unknown> }) => ({
      leadId: (
        Array.isArray(r.fields[FIELDS.RELATIONSHIP_CONTEXTS.LEAD])
          ? (r.fields[FIELDS.RELATIONSHIP_CONTEXTS.LEAD] as string[])[0]
          : ''
      ) ?? '',
      type: normalizeRelationshipType(r.fields[FIELDS.RELATIONSHIP_CONTEXTS.TYPE]),
    }))
}

/**
 * Creates Relationship Context rows for a newly onboarded person.
 *
 * Row logic:
 *   coaches[]       → Human=newHumanId,   Lead=coachId,      Type=coaching,    PermissionProfile=standard
 *   reportsTo[]     → Human=newHumanId,   Lead=managerId,    Type=reports_to
 *   directReports[] → Human=directReportId, Lead=newHumanId, Type=reports_to
 *
 * Duplicate rows (same Person+Lead+Type) are silently skipped.
 */
export async function generateRelationshipRows(data: OnboardingData): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const { newHumanId, coaches = [], reportsTo = [], directReports = [] } = data

  type RowSpec = {
    human: string
    lead: string
    type: 'coaching' | 'reports_to'
  }

  const rows: RowSpec[] = [
    ...coaches.map((leadId) => ({
      human: newHumanId,
      lead: leadId,
      type: 'coaching' as const,
    })),
    ...reportsTo.map((leadId) => ({
      human: newHumanId,
      lead: leadId,
      type: 'reports_to' as const,
    })),
    ...directReports.map((humanId) => ({
      human: humanId,
      lead: newHumanId,
      type: 'reports_to' as const,
    })),
  ]

  if (rows.length === 0) return

  // Determine all unique person IDs we need to check for existing rows
  const humanIds = [...new Set(rows.map((r) => r.human))]

  const existingByPerson = await Promise.all(
    humanIds.map((pid) =>
      fetchExistingPairs(apiKey, baseId, pid).then((pairs) => ({ pid, pairs })),
    ),
  )

  // Build a Set of "humanId|leadId|type" keys that already exist
  const existingKeys = new Set<string>()
  for (const { pid, pairs } of existingByPerson) {
    for (const p of pairs) {
      existingKeys.add(`${pid}|${p.leadId}|${p.type}`)
    }
  }

  for (const row of rows) {
    const key = `${row.human}|${row.lead}|${row.type}`
    if (existingKeys.has(key)) {
      console.log(`[generateRelationshipRows] Skipping duplicate: ${key}`)
      continue
    }

    // Permission Level intentionally omitted: the Airtable column is a
    // single-select with values like "full_access", but the app's permission
    // model is RC-existence-based (see lib/auth/permissions.ts) and does not
    // read this field. Writing a record-ID array to a single-select column
    // silently fails. Leave it for the architecture migration.
    const fields: Record<string, unknown> = {
      [FIELDS.RELATIONSHIP_CONTEXTS.HUMAN]: [row.human],
      [FIELDS.RELATIONSHIP_CONTEXTS.LEAD]: [row.lead],
      [FIELDS.RELATIONSHIP_CONTEXTS.TYPE]: row.type,
      [FIELDS.RELATIONSHIP_CONTEXTS.STATUS]: 'Active',
    }

    const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields }),
    })
    if (!res.ok) {
      const detail = await res.json()
      console.error(`[generateRelationshipRows] POST failed for ${key}:`, detail)
    } else {
      console.log(`[generateRelationshipRows] Created: ${key}`)
    }
  }
}

// ── Single-record CRUD on Relationship Contexts ──────────────────────────────

export interface CreateRCInput {
  humanId: string
  leadId: string
  type: RelationshipType
  status?: 'Active' | 'Inactive' | 'Paused' | 'Ended'
  startDate?: string  // YYYY-MM-DD
}

/**
 * Creates a single Relationship Context row. Returns the new record's ID.
 * Skips if a duplicate (same Person+Lead+Type) already exists — returns the
 * existing row's ID instead.
 */
export async function createRelationshipContext(input: CreateRCInput): Promise<string> {
  const { apiKey, baseId } = getCredentials()

  // Dedup: check for existing Person+Lead+Type combo before creating.
  const existingPairs = await fetchExistingPairs(apiKey, baseId, input.humanId)
  const dupe = existingPairs.find((p) => p.leadId === input.leadId && p.type === input.type)
  if (dupe) {
    log.warn(`[createRelationshipContext] duplicate ignored: person=${input.humanId} lead=${input.leadId} type=${input.type}`)
    // Walk RCs to find the existing record ID
    const res = await airtableFetch(
      `${API_BASE}/${baseId}/${TABLE}?maxRecords=1000`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    )
    if (res.ok) {
      const data = await res.json()
      for (const r of data.records ?? []) {
        const f = r.fields as Record<string, unknown>
        const persons = Array.isArray(f[FIELDS.RELATIONSHIP_CONTEXTS.HUMAN]) ? (f[FIELDS.RELATIONSHIP_CONTEXTS.HUMAN] as string[]) : []
        const leads = Array.isArray(f[FIELDS.RELATIONSHIP_CONTEXTS.LEAD]) ? (f[FIELDS.RELATIONSHIP_CONTEXTS.LEAD] as string[]) : []
        if (persons[0] === input.humanId && leads[0] === input.leadId) {
          const t = normalizeRelationshipType(f[FIELDS.RELATIONSHIP_CONTEXTS.TYPE])
          if (t === input.type) return r.id as string
        }
      }
    }
  }

  const fields: Record<string, unknown> = {
    [FIELDS.RELATIONSHIP_CONTEXTS.HUMAN]: [input.humanId],
    [FIELDS.RELATIONSHIP_CONTEXTS.LEAD]: [input.leadId],
    [FIELDS.RELATIONSHIP_CONTEXTS.TYPE]: input.type,
    [FIELDS.RELATIONSHIP_CONTEXTS.STATUS]: input.status ?? 'Active',
  }
  if (input.startDate) fields[FIELDS.RELATIONSHIP_CONTEXTS.START_DATE] = input.startDate

  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(`Relationship Context POST failed: ${JSON.stringify(result)}`)
  return result.id as string
}

export interface UpdateRCInput {
  type?: RelationshipType
  status?: 'Active' | 'Inactive' | 'Paused' | 'Ended'
  startDate?: string | null
  endDate?: string | null
  /**
   * When the editor changes the role (coach↔coachee or manager↔report) we
   * must swap which user sits in the Person vs Lead linked field. Patching
   * `type` alone doesn't move the relationship between buckets in the UI.
   * Provide the new Person/Lead record IDs to apply the direction change.
   */
  humanId?: string
  leadId?: string
}

export async function updateRelationshipContext(
  rcId: string,
  input: UpdateRCInput,
): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = {}
  if (input.type !== undefined) fields[FIELDS.RELATIONSHIP_CONTEXTS.TYPE] = input.type
  if (input.status !== undefined) fields[FIELDS.RELATIONSHIP_CONTEXTS.STATUS] = input.status
  if (input.startDate !== undefined) fields[FIELDS.RELATIONSHIP_CONTEXTS.START_DATE] = input.startDate
  if (input.endDate !== undefined) fields[FIELDS.RELATIONSHIP_CONTEXTS.END_DATE] = input.endDate
  if (input.humanId !== undefined) fields[FIELDS.RELATIONSHIP_CONTEXTS.HUMAN] = [input.humanId]
  if (input.leadId !== undefined) fields[FIELDS.RELATIONSHIP_CONTEXTS.LEAD] = [input.leadId]
  if (Object.keys(fields).length === 0) return

  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}/${rcId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Relationship Context PATCH failed: ${detail}`)
  }
}

export async function deleteRelationshipContext(rcId: string): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}/${rcId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Relationship Context DELETE failed: ${detail}`)
  }
}

/**
 * Returns every RC where the given person is either Person OR Lead.
 * Used by the Relationships section on profile pages to show all of a
 * person's connections in both directions.
 */
export async function getRelationshipsForHuman(humanId: string): Promise<RelationshipContext[]> {
  const { apiKey, baseId } = getCredentials()
  const [res, nameMap] = await Promise.all([
    airtableFetch(`${API_BASE}/${baseId}/${TABLE}?maxRecords=2000`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: 'no-store',
    }),
    buildHumanDataMap(apiKey, baseId),
  ])
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, nameMap))
    .filter((r: RelationshipContext | null): r is RelationshipContext =>
      r !== null && (r.humanId === humanId || r.leadId === humanId),
    )
}

