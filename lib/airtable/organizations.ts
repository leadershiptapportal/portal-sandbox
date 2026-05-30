import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { airtableFetch } from '@/lib/airtable/client'
import { log } from '@/lib/utils/logger'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent(TABLES.ORGANIZATIONS)

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

export interface OrganizationOption {
  id: string
  name: string
  domain?: string
  logo?: string
}

/** All organizations except those explicitly marked Inactive, sorted by name. */
export async function listOrganizations(): Promise<OrganizationOption[]> {
  const { apiKey, baseId } = getCredentials()
  const formula = encodeURIComponent(`NOT({${FIELDS.ORGANIZATIONS.STATUS}}="Inactive")`)
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${formula}&maxRecords=1000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) {
    log.warn('[listOrganizations] fetch failed:', res.status)
    return []
  }
  const data = await res.json()
  return (data.records ?? [])
    .map((r: { id: string; fields: Record<string, unknown> }) => ({
      id: r.id,
      name: ((r.fields[FIELDS.ORGANIZATIONS.NAME] as string) ?? '').trim() || r.id,
      domain: (r.fields[FIELDS.ORGANIZATIONS.DOMAIN_NAME] as string) ?? undefined,
      logo: (r.fields[FIELDS.ORGANIZATIONS.LOGO] as string) ?? undefined,
    }))
    .sort((a: OrganizationOption, b: OrganizationOption) => a.name.localeCompare(b.name))
}

export interface CreateOrganizationInput {
  name: string
  domain?: string
  type?: string
}

/**
 * Creates an Organization. Returns the new record ID, or an existing org's ID
 * if one already matches by name (case-insensitive) — so "Add new" can't
 * silently create duplicates.
 */
export async function createOrganization(input: CreateOrganizationInput): Promise<string> {
  const { apiKey, baseId } = getCredentials()
  const name = input.name.trim()
  if (!name) throw new Error('Organization name is required')

  // Dedup by name
  const existing = await listOrganizations()
  const dupe = existing.find((o) => o.name.toLowerCase() === name.toLowerCase())
  if (dupe) {
    log.warn(`[createOrganization] reusing existing org "${name}" (${dupe.id})`)
    return dupe.id
  }

  const fields: Record<string, unknown> = {
    [FIELDS.ORGANIZATIONS.NAME]: name,
    [FIELDS.ORGANIZATIONS.STATUS]: 'Active',
  }
  if (input.domain) fields[FIELDS.ORGANIZATIONS.DOMAIN_NAME] = input.domain.trim()
  if (input.type) fields[FIELDS.ORGANIZATIONS.ORGANIZATION_TYPE] = input.type

  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(`Organization POST failed: ${JSON.stringify(result)}`)
  return result.id as string
}
