import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { airtableFetch } from '@/lib/airtable/client'
import { log } from '@/lib/utils/logger'
import type { Affiliation, AffiliationStatus, AffiliationType, Human } from '@/lib/types'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent(TABLES.AFFILIATIONS)

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

const AFFILIATION_TYPES: AffiliationType[] = [
  'employee', 'contractor', 'member', 'client', 'founder', 'alum', 'other',
]

function normalizeType(raw: unknown): AffiliationType {
  const s = (typeof raw === 'string' ? raw : '').toLowerCase().trim()
  return (AFFILIATION_TYPES as string[]).includes(s) ? (s as AffiliationType) : 'employee'
}

function normalizeStatus(raw: unknown): AffiliationStatus {
  const s = (typeof raw === 'string' ? raw : '').trim()
  if (s === 'Active' || s === 'Inactive' || s === 'Paused' || s === 'Ended') return s
  return 'Active'
}

// ── Name maps (avoid per-record lookups) ──────────────────────────────────────

async function buildNameMap(
  apiKey: string,
  baseId: string,
  table: string,
  nameField: string,
): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${encodeURIComponent(table)}` +
      `?fields[]=${encodeURIComponent(nameField)}&maxRecords=5000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return map
  const data = await res.json()
  for (const r of data.records ?? []) {
    const name = (r.fields?.[nameField] as string | undefined)?.trim()
    if (name) map.set(r.id as string, name)
  }
  return map
}

function mapRecord(
  r: { id: string; fields: Record<string, unknown> },
  humanNames: Map<string, string>,
  orgNames: Map<string, string>,
): Affiliation | null {
  const f = r.fields
  const humanIds = Array.isArray(f[FIELDS.AFFILIATIONS.HUMAN]) ? (f[FIELDS.AFFILIATIONS.HUMAN] as string[]) : []
  const orgIds = Array.isArray(f[FIELDS.AFFILIATIONS.ORGANIZATION]) ? (f[FIELDS.AFFILIATIONS.ORGANIZATION] as string[]) : []
  if (humanIds.length === 0 || orgIds.length === 0) return null

  const humanId = humanIds[0]
  const organizationId = orgIds[0]
  return {
    id: r.id,
    humanId,
    humanName: humanNames.get(humanId),
    organizationId,
    organizationName: orgNames.get(organizationId),
    type: normalizeType(f[FIELDS.AFFILIATIONS.TYPE]),
    status: normalizeStatus(f[FIELDS.AFFILIATIONS.STATUS]),
    startDate: (f[FIELDS.AFFILIATIONS.START_DATE] as string) ?? undefined,
    endDate: (f[FIELDS.AFFILIATIONS.END_DATE] as string) ?? undefined,
    titleAtOrg: (f[FIELDS.AFFILIATIONS.TITLE_AT_ORG] as string) ?? undefined,
    workCellAtOrg: (f[FIELDS.AFFILIATIONS.WORK_CELL_AT_ORG] as string) ?? undefined,
    primary: f[FIELDS.AFFILIATIONS.PRIMARY] === true,
  }
}

/** Formats a tenure string ("2 years, 3 months" / "5 months") from a start date. */
function formatTenure(startISO?: string): string | undefined {
  if (!startISO) return undefined
  const start = new Date(startISO)
  if (Number.isNaN(start.getTime())) return undefined
  const now = new Date()
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  if (months < 0) return undefined
  const years = Math.floor(months / 12)
  const rem = months % 12
  const yPart = years > 0 ? `${years} year${years !== 1 ? 's' : ''}` : ''
  const mPart = rem > 0 ? `${rem} month${rem !== 1 ? 's' : ''}` : ''
  return [yPart, mPart].filter(Boolean).join(', ') || 'Less than a month'
}

// ── Visibility / currency helpers ─────────────────────────────────────────────

/**
 * Visibility rule (per design): Status is the source of truth; dates are
 * informational. Show an affiliation UNLESS its Status is Ended/Inactive, or it
 * has an End Date in the past. Missing dates default to visible.
 */
export function isAffiliationVisible(a: Affiliation): boolean {
  if (a.status === 'Ended' || a.status === 'Inactive') return false
  if (a.endDate && a.endDate < todayISO()) return false
  return true
}

/** Current = visible AND status Active (Paused is visible but not "current"). */
export function isAffiliationCurrent(a: Affiliation): boolean {
  return a.status === 'Active' && isAffiliationVisible(a)
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Picks the affiliation to treat as a human's primary/current org:
 *   1. an explicit Primary flag that is still visible
 *   2. otherwise the current (Active) one with the latest Start Date
 *   3. otherwise the most recent visible one
 * Returns null if the human has no visible affiliations.
 */
export function pickPrimaryAffiliation(affiliations: Affiliation[]): Affiliation | null {
  const visible = affiliations.filter(isAffiliationVisible)
  if (visible.length === 0) return null

  const flagged = visible.find((a) => a.primary)
  if (flagged) return flagged

  const byStartDesc = (a: Affiliation, b: Affiliation) => (b.startDate ?? '').localeCompare(a.startDate ?? '')
  const current = visible.filter(isAffiliationCurrent).sort(byStartDesc)
  if (current.length > 0) return current[0]

  return [...visible].sort(byStartDesc)[0]
}

// ── Read functions ────────────────────────────────────────────────────────────

/** All affiliations for one human (any status). Sorted primary-first, newest-first. */
export async function getAffiliationsForHuman(humanId: string): Promise<Affiliation[]> {
  const { apiKey, baseId } = getCredentials()
  const [res, humanNames, orgNames] = await Promise.all([
    airtableFetch(`${API_BASE}/${baseId}/${TABLE}?maxRecords=5000`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store',
    }),
    buildNameMap(apiKey, baseId, TABLES.HUMANS, FIELDS.HUMANS.FULL_NAME),
    buildNameMap(apiKey, baseId, TABLES.ORGANIZATIONS, FIELDS.ORGANIZATIONS.NAME),
  ])
  if (!res.ok) {
    log.warn('[getAffiliationsForHuman] fetch failed:', res.status)
    return []
  }
  const data = await res.json()
  return (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, humanNames, orgNames))
    .filter((a: Affiliation | null): a is Affiliation => a !== null && a.humanId === humanId)
    .sort((a: Affiliation, b: Affiliation) =>
      Number(b.primary) - Number(a.primary) || (b.startDate ?? '').localeCompare(a.startDate ?? ''),
    )
}

/** All humans affiliated with one organization (any status). */
export async function getMembers(organizationId: string): Promise<Affiliation[]> {
  const { apiKey, baseId } = getCredentials()
  const [res, humanNames, orgNames] = await Promise.all([
    airtableFetch(`${API_BASE}/${baseId}/${TABLE}?maxRecords=5000`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store',
    }),
    buildNameMap(apiKey, baseId, TABLES.HUMANS, FIELDS.HUMANS.FULL_NAME),
    buildNameMap(apiKey, baseId, TABLES.ORGANIZATIONS, FIELDS.ORGANIZATIONS.NAME),
  ])
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => mapRecord(r, humanNames, orgNames))
    .filter((a: Affiliation | null): a is Affiliation => a !== null && a.organizationId === organizationId)
}

/**
 * Returns a map of humanId → primary/current affiliation for the given humans.
 * Use this to enrich human lists (cards, grid) without an N+1 fetch.
 */
export async function getPrimaryAffiliationMap(
  humanIds: string[],
): Promise<Map<string, Affiliation>> {
  const out = new Map<string, Affiliation>()
  if (humanIds.length === 0) return out
  const { apiKey, baseId } = getCredentials()
  const [res, humanNames, orgNames] = await Promise.all([
    airtableFetch(`${API_BASE}/${baseId}/${TABLE}?maxRecords=5000`, {
      headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store',
    }),
    buildNameMap(apiKey, baseId, TABLES.HUMANS, FIELDS.HUMANS.FULL_NAME),
    buildNameMap(apiKey, baseId, TABLES.ORGANIZATIONS, FIELDS.ORGANIZATIONS.NAME),
  ])
  if (!res.ok) return out
  const data = await res.json()
  const wanted = new Set(humanIds)
  const byHuman = new Map<string, Affiliation[]>()
  for (const r of data.records ?? []) {
    const a = mapRecord(r, humanNames, orgNames)
    if (!a || !wanted.has(a.humanId)) continue
    const list = byHuman.get(a.humanId) ?? []
    list.push(a)
    byHuman.set(a.humanId, list)
  }
  for (const [humanId, list] of byHuman) {
    const primary = pickPrimaryAffiliation(list)
    if (primary) out.set(humanId, primary)
  }
  return out
}

/**
 * Enriches a list of humans so `organizationName` reflects the primary/current
 * affiliation. Affiliations are authoritative; falls back to whatever was
 * already on the human (the legacy `Organization Name` lookup) when a human has
 * no visible affiliation yet. One Airtable fetch regardless of list size.
 */
export async function enrichHumansWithAffiliations(humans: Human[]): Promise<Human[]> {
  if (humans.length === 0) return humans
  const primaryMap = await getPrimaryAffiliationMap(humans.map((h) => h.id))
  if (primaryMap.size === 0) return humans
  return humans.map((h) => {
    const primary = primaryMap.get(h.id)
    if (!primary) return h
    // Affiliation is authoritative for org-context fields; fall back to whatever
    // is still on the Human record (legacy values not yet migrated).
    return {
      ...h,
      organizationName: primary.organizationName ?? h.organizationName,
      organizationLinkedIds: [primary.organizationId],
      title: primary.titleAtOrg ?? h.title,
      workCellNumber: primary.workCellAtOrg ?? h.workCellNumber,
      startDate: primary.startDate ?? h.startDate,
      timeAtOrganization: formatTenure(primary.startDate) ?? h.timeAtOrganization,
    }
  })
}

// ── Write functions ───────────────────────────────────────────────────────────

export interface CreateAffiliationInput {
  humanId: string
  organizationId: string
  type?: AffiliationType
  status?: AffiliationStatus
  startDate?: string
  endDate?: string
  titleAtOrg?: string
  workCellAtOrg?: string
  primary?: boolean
}

/**
 * Creates an affiliation row. Returns the new record ID, or the existing row's
 * ID if a matching Human+Organization pair already exists (dedup).
 */
export async function createAffiliation(input: CreateAffiliationInput): Promise<string> {
  const { apiKey, baseId } = getCredentials()

  const existing = await getAffiliationsForHuman(input.humanId)
  const dupe = existing.find((a) => a.organizationId === input.organizationId)
  if (dupe) {
    log.warn(`[createAffiliation] duplicate ignored: human=${input.humanId} org=${input.organizationId}`)
    return dupe.id
  }

  const fields: Record<string, unknown> = {
    [FIELDS.AFFILIATIONS.HUMAN]: [input.humanId],
    [FIELDS.AFFILIATIONS.ORGANIZATION]: [input.organizationId],
    [FIELDS.AFFILIATIONS.TYPE]: input.type ?? 'employee',
    [FIELDS.AFFILIATIONS.STATUS]: input.status ?? 'Active',
  }
  if (input.startDate) fields[FIELDS.AFFILIATIONS.START_DATE] = input.startDate
  if (input.endDate) fields[FIELDS.AFFILIATIONS.END_DATE] = input.endDate
  if (input.titleAtOrg) fields[FIELDS.AFFILIATIONS.TITLE_AT_ORG] = input.titleAtOrg
  if (input.workCellAtOrg) fields[FIELDS.AFFILIATIONS.WORK_CELL_AT_ORG] = input.workCellAtOrg
  if (input.primary) fields[FIELDS.AFFILIATIONS.PRIMARY] = true

  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(`Affiliation POST failed: ${JSON.stringify(result)}`)
  return result.id as string
}

export interface UpdateAffiliationInput {
  type?: AffiliationType
  status?: AffiliationStatus
  startDate?: string | null
  endDate?: string | null
  titleAtOrg?: string | null
  workCellAtOrg?: string | null
  primary?: boolean
  organizationId?: string
}

export async function updateAffiliation(
  affiliationId: string,
  input: UpdateAffiliationInput,
): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = {}
  if (input.type !== undefined) fields[FIELDS.AFFILIATIONS.TYPE] = input.type
  if (input.status !== undefined) fields[FIELDS.AFFILIATIONS.STATUS] = input.status
  if (input.startDate !== undefined) fields[FIELDS.AFFILIATIONS.START_DATE] = input.startDate
  if (input.endDate !== undefined) fields[FIELDS.AFFILIATIONS.END_DATE] = input.endDate
  if (input.titleAtOrg !== undefined) fields[FIELDS.AFFILIATIONS.TITLE_AT_ORG] = input.titleAtOrg
  if (input.workCellAtOrg !== undefined) fields[FIELDS.AFFILIATIONS.WORK_CELL_AT_ORG] = input.workCellAtOrg
  if (input.primary !== undefined) fields[FIELDS.AFFILIATIONS.PRIMARY] = input.primary
  if (input.organizationId !== undefined) fields[FIELDS.AFFILIATIONS.ORGANIZATION] = [input.organizationId]
  if (Object.keys(fields).length === 0) return

  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}/${affiliationId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) throw new Error(`Affiliation PATCH failed: ${await res.text()}`)
}

export async function deleteAffiliation(affiliationId: string): Promise<void> {
  const { apiKey, baseId } = getCredentials()
  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}/${affiliationId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) throw new Error(`Affiliation DELETE failed: ${await res.text()}`)
}
