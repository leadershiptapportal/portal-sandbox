import { getAllHumans } from '@/lib/airtable/humans'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import type { SessionUser } from './getSessionUser'

/**
 * Returns true if sessionUser may read or write data scoped to the given
 * Airtable record ID. Coach access is determined by Relationship Contexts
 * (the coach is the Lead in an active RC where the target is the Human).
 */
export async function canAccessUser(
  userId: string,
  sessionUser: SessionUser,
): Promise<boolean> {
  if (sessionUser.role === 'admin') return true

  const all = await getAllHumans()
  const coachRecord = all.find(
    (u) => u.workEmail?.toLowerCase() === sessionUser.email.toLowerCase(),
  )

  // Coach not found in Airtable — allow access so the portal doesn't break
  // while the coach record is still being configured.
  if (!coachRecord) return true

  const contexts = await getRelationshipContexts(coachRecord.id)
  const coacheeIds = new Set(contexts.map((c) => c.humanId))

  // No RCs configured yet — allow access as a safety fallback.
  if (coacheeIds.size === 0) return true

  return coacheeIds.has(userId)
}
