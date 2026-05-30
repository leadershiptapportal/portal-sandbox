import { getAllHumans, getHumanById as fetchHumanById } from "@/lib/airtable/humans";
import { getRelationshipContexts } from "@/lib/airtable/relationships";
import { enrichHumansWithAffiliations } from "@/lib/airtable/affiliations";
import type { Human } from "@/lib/types";
import type { SessionUser } from "@/lib/auth/getSessionUser";

function dataScore(human: Human): number {
  let score = 0
  if (human.profilePhoto) score += 2
  if (human.coachIds?.length) score += human.coachIds.length
  if (human.strengths?.length) score += human.strengths.length
  if (human.quickNotes) score++
  if (human.enneagramType) score++
  if (human.mbtiType) score++
  if (human.title) score++
  if (human.organizationName) score++
  if (human.teamMemberIds?.length) score += human.teamMemberIds.length
  return score
}

function deduplicateHumans(humans: Human[]): Human[] {
  const seen = new Map<string, Human>()
  const unkeyed: Human[] = []

  for (const human of humans) {
    const name = (human.fullName ?? '').toLowerCase().trim()
    const email = (human.workEmail ?? '').toLowerCase().trim()

    if (!name || !email) {
      unkeyed.push(human)
      continue
    }

    const key = `${name}|${email}`
    const existing = seen.get(key)
    if (!existing || dataScore(human) > dataScore(existing)) {
      seen.set(key, human)
    }
  }

  return [...seen.values(), ...unkeyed]
}

/**
 * Returns the list of humans visible to the caller, with duplicates removed.
 *
 * - Admin (or no sessionUser): all humans
 * - Coach: only humans whose "Coach" linked-record field contains the coach's
 *   Airtable record ID.
 *
 * Pass `filterByCoachId` to override the role-based logic with an explicit
 * Airtable record ID filter (used by the Coach View / Admin View toggle).
 */
export async function getHumans(
  sessionUser?: SessionUser | null,
  filterByCoachId?: string,
): Promise<Human[]> {
  const all = await getAllHumans();
  const deduped = deduplicateHumans(all)

  if (filterByCoachId) {
    return enrichHumansWithAffiliations(deduped.filter((h) => h.coachIds?.includes(filterByCoachId)))
  }

  if (!sessionUser || sessionUser.role === 'admin') return enrichHumansWithAffiliations(deduped);

  const coachRecord = deduped.find(
    (h) => h.workEmail?.toLowerCase() === sessionUser.email.toLowerCase(),
  );

  if (!coachRecord) return enrichHumansWithAffiliations(deduped);

  const scoped = deduped.filter((h) => h.coachIds?.includes(coachRecord.id));

  return enrichHumansWithAffiliations(scoped.length > 0 ? scoped : deduped);
}

export async function getHumanById(id: string): Promise<Human | null> {
  const human = await fetchHumanById(id);
  if (!human) return null;
  const [enriched] = await enrichHumansWithAffiliations([human]);
  return enriched;
}

/**
 * Returns the humans a coach has an active Relationship Context with,
 * sorted by relationship type (coaching before reports_to) then by name.
 */
export async function getHumansByRelationship(coachAirtableId: string): Promise<Human[]> {
  const [contexts, all] = await Promise.all([
    getRelationshipContexts(coachAirtableId),
    getAllHumans(),
  ])
  const deduped = deduplicateHumans(all)

  if (contexts.length === 0) return []

  const typeByHumanId = new Map(contexts.map((c) => [c.humanId, c.relationshipType]))
  const humanIds = new Set(contexts.map((c) => c.humanId))
  const humans = deduped.filter((h) => humanIds.has(h.id))

  const typeOrder = (id: string) => (typeByHumanId.get(id) === 'coaching' ? 0 : 1)
  const nameOf = (h: Human) =>
    (h.fullName ?? ([h.firstName, h.lastName].filter(Boolean).join(' ') || h.workEmail || '')).toLowerCase()

  const sorted = humans.sort((a, b) => {
    const diff = typeOrder(a.id) - typeOrder(b.id)
    return diff !== 0 ? diff : nameOf(a).localeCompare(nameOf(b))
  })
  return enrichHumansWithAffiliations(sorted)
}

/**
 * Returns all portal humans with a @leadershiptap.com work email (i.e. coaches),
 * optionally excluding a specific coach by Airtable record ID.
 */
export async function getPortalCoaches(excludeId?: string): Promise<Human[]> {
  const all = await getAllHumans()
  const deduped = deduplicateHumans(all)
  return deduped.filter((h) => {
    const email = (h.workEmail ?? '').toLowerCase()
    return email.includes('@leadershiptap.com') && (!excludeId || h.id !== excludeId)
  })
}
