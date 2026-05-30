/**
 * One-off migration: turn each Human's flat `Organization` link into a row in
 * the new Affiliations join table.
 *
 *   Humans.Organization (link)  →  Affiliations row { Human, Organization,
 *                                   Status=Active, Type=employee, Primary=true,
 *                                   Title at Org = Humans.Title }
 *
 * - Idempotent: skips any Human+Organization pair that already has an
 *   Affiliation row, so it is safe to re-run.
 * - Non-destructive: does NOT touch the flat Humans.Organization link. That
 *   field stays populated as a rollback path until cutover is verified.
 * - Reports humans that carry org *text* (Title / Time at Organization) but no
 *   actual Organization link — those can't be auto-linked and need manual review.
 *
 * Usage:
 *   npx tsx scripts/migrate-org-links-to-affiliations.ts          # dry run (default)
 *   npx tsx scripts/migrate-org-links-to-affiliations.ts --apply  # write rows
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
config()

import { TABLES, FIELDS } from '../lib/airtable/constants'

const API_BASE = 'https://api.airtable.com/v0'
const apiKey = process.env.AIRTABLE_API_KEY
const baseId = process.env.AIRTABLE_BASE_ID
const APPLY = process.argv.includes('--apply')

if (!apiKey || !baseId) {
  console.error('Missing AIRTABLE_API_KEY or AIRTABLE_BASE_ID')
  process.exit(1)
}

const auth = { Authorization: `Bearer ${apiKey}` }

interface AirtableRecord { id: string; fields: Record<string, unknown> }

async function fetchAll(tableId: string, extraQuery = ''): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = []
  let offset: string | undefined
  do {
    const url =
      `${API_BASE}/${baseId}/${encodeURIComponent(tableId)}` +
      `?returnFieldsByFieldId=true&pageSize=100${extraQuery}` +
      (offset ? `&offset=${offset}` : '')
    const res = await fetch(url, { headers: auth })
    if (!res.ok) throw new Error(`GET ${tableId} failed: ${res.status} ${await res.text()}`)
    const data = await res.json()
    out.push(...(data.records ?? []))
    offset = data.offset
  } while (offset)
  return out
}

function firstLink(val: unknown): string | undefined {
  return Array.isArray(val) && val.length ? (val[0] as string) : undefined
}

async function main() {
  console.log(`\n=== Org link → Affiliations migration (${APPLY ? 'APPLY' : 'DRY RUN'}) ===\n`)

  const [humans, affiliations] = await Promise.all([
    fetchAll(TABLES.HUMANS),
    fetchAll(TABLES.AFFILIATIONS),
  ])
  console.log(`Fetched ${humans.length} humans, ${affiliations.length} existing affiliations.`)

  // Existing Human|Org pairs (idempotency guard)
  const existingPairs = new Set<string>()
  for (const a of affiliations) {
    const h = firstLink(a.fields[FIELDS.AFFILIATIONS.HUMAN])
    const o = firstLink(a.fields[FIELDS.AFFILIATIONS.ORGANIZATION])
    if (h && o) existingPairs.add(`${h}|${o}`)
  }

  const toCreate: Array<{ fields: Record<string, unknown>; label: string }> = []
  const orphanText: string[] = [] // org text but no link
  let alreadyMigrated = 0
  let noOrgAtAll = 0

  for (const h of humans) {
    const f = h.fields
    // These flat fields were removed from FIELDS.HUMANS after migration was complete.
    // Script is obsolete — all 47 humans were migrated via the Airtable MCP.
    const orgId = firstLink(f['fldUu6I5aaiIhTVj6' /* [Deprecated] Company */])
    const name = (f[FIELDS.HUMANS.FULL_NAME] as string) || h.id
    const title = (f['fldVwZtWoJjZp920l' /* [Deprecated] Title */] as string | undefined)?.trim()
    const timeAtOrg = (f['fldi1Ez09JdS0tjnb' /* [Deprecated] Time at Company */] as string | undefined)?.trim()

    if (!orgId) {
      if (title || timeAtOrg) orphanText.push(`${name} (title=${title ?? '—'}, timeAtOrg=${timeAtOrg ?? '—'})`)
      else noOrgAtAll++
      continue
    }

    if (existingPairs.has(`${h.id}|${orgId}`)) { alreadyMigrated++; continue }

    const fields: Record<string, unknown> = {
      [FIELDS.AFFILIATIONS.HUMAN]: [h.id],
      [FIELDS.AFFILIATIONS.ORGANIZATION]: [orgId],
      [FIELDS.AFFILIATIONS.TYPE]: 'employee',
      [FIELDS.AFFILIATIONS.STATUS]: 'Active',
      [FIELDS.AFFILIATIONS.PRIMARY]: true,
    }
    if (title) fields[FIELDS.AFFILIATIONS.TITLE_AT_ORG] = title
    toCreate.push({ fields, label: name })
  }

  console.log(`\nWill create ${toCreate.length} affiliation row(s).`)
  console.log(`Skipped — already migrated: ${alreadyMigrated}`)
  console.log(`Skipped — no org link or text: ${noOrgAtAll}`)

  if (orphanText.length) {
    console.log(`\n⚠️  ${orphanText.length} human(s) have org text but NO Organization link — manual review:`)
    for (const o of orphanText) console.log(`   - ${o}`)
  }

  if (!APPLY) {
    console.log('\nDry run complete. Re-run with --apply to write these rows.\n')
    return
  }

  // Airtable allows up to 10 records per create call.
  let created = 0
  for (let i = 0; i < toCreate.length; i += 10) {
    const batch = toCreate.slice(i, i + 10)
    const res = await fetch(`${API_BASE}/${baseId}/${encodeURIComponent(TABLES.AFFILIATIONS)}`, {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ records: batch.map((b) => ({ fields: b.fields })) }),
    })
    if (!res.ok) {
      console.error(`Batch ${i / 10} failed: ${res.status} ${await res.text()}`)
      continue
    }
    created += batch.length
    console.log(`  created ${created}/${toCreate.length}`)
  }

  console.log(`\n✅ Created ${created} affiliation row(s). Flat Organization links left intact.\n`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
