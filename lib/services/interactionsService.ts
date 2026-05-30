import { getAllInteractions, getInteractionsByUserEmail, getInteractionById, updatePortalEventNotes } from "@/lib/airtable/interactions";
import { canAccessUser } from "@/lib/auth/isAuthorized";
import type { SessionUser } from "@/lib/auth/getSessionUser";
import type { Interaction, Human } from "@/lib/types";

interface SplitInteractions {
  upcoming: Interaction[];
  past: Interaction[];
}

// Dedup by Provider Event ID when available; fall back to title+startTime
function deduplicateInteractions(interactions: Interaction[]): Interaction[] {
  const seenById = new Set<string>()
  const seenByKey = new Set<string>()
  return interactions.filter((m) => {
    if (m.providerEventId) {
      if (seenById.has(m.providerEventId)) return false
      seenById.add(m.providerEventId)
      return true
    }
    const key = `${m.title ?? ''}|${m.startTime ?? ''}`
    if (seenByKey.has(key)) return false
    seenByKey.add(key)
    return true
  })
}

export async function getInteractions(): Promise<SplitInteractions> {
  const raw = await getAllInteractions();
  const all = deduplicateInteractions(raw);
  const now = new Date();

  const upcoming = all
    .filter((m) => m.startTime && new Date(m.startTime) >= now)
    .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  const past = all
    .filter((m) => m.startTime && new Date(m.startTime) < now);
  // past is already sorted desc from getAllInteractions

  return { upcoming, past };
}

/**
 * Fetch interactions for a client by their email address.
 *
 * Pass sessionUser + userId to enforce visibility scoping:
 * - Admin: proceeds normally
 * - Coach: returns empty if userId is not in their assigned client list
 * - No sessionUser: proceeds (open-access dev mode)
 *
 * ownerEmail: when provided, only returns events where {Calendar Owner} matches
 * this address, preventing Coach A from seeing Coach B's events.
 */
export async function getInteractionsForUser(
  userEmail: string,
  sessionUser?: SessionUser | null,
  userId?: string,
  ownerEmail?: string,
  displayName?: string,
): Promise<SplitInteractions> {
  if (sessionUser && userId) {
    const allowed = await canAccessUser(userId, sessionUser);
    if (!allowed) return { upcoming: [], past: [] };
  }

  const interactions = deduplicateInteractions(
    await getInteractionsByUserEmail(userEmail, ownerEmail, displayName),
  );
  const now = new Date();

  const upcoming: Interaction[] = [];
  const past: Interaction[] = [];

  for (const interaction of interactions) {
    const startTime = new Date(interaction.startTime);
    if (startTime >= now) {
      upcoming.push(interaction);
    } else {
      past.push(interaction);
    }
  }

  return { upcoming, past };
}

export async function getInteractionDetail(interactionId: string): Promise<Interaction | null> {
  return getInteractionById(interactionId);
}

export async function updateInteractionNotes(interactionId: string, notes: string): Promise<void> {
  return updatePortalEventNotes(interactionId, notes);
}

// ── Email-based matching helpers ──────────────────────────────────────────────

// Normalise: lowercase, remove all whitespace (Airtable sometimes stores
// "j  barton@..." with stray spaces), trim.
function normalizeEmail(email: string): string {
  return email.replace(/\s+/g, '').toLowerCase().trim()
}

// Strip the last TLD segment so "nmayorga@specializedstaffing.com" also matches
// a stored value of "nmayorga@specializedstaffing" (missing-TLD data quality issue).
function stripTld(email: string): string {
  return email.replace(/\.[a-z]{2,6}$/, '')
}

// Index both the normalised email and its TLD-stripped variant so fuzzy lookups work.
export function buildEmailToUserMap(users: Human[]): Map<string, Human> {
  const map = new Map<string, Human>()
  for (const user of users) {
    for (const raw of [user.workEmail]) {
      if (!raw) continue
      const norm = normalizeEmail(raw)
      if (!norm) continue
      map.set(norm, user)
      // Also index the TLD-stripped form so a stored "user@domain" matches
      // an interaction participant "user@domain.com".
      const noTld = stripTld(norm)
      if (noTld !== norm) map.set(noTld, user)
    }
  }
  return map
}

// Look up an interaction participant email with exact-then-TLD-stripped fallback.
function lookupEmail(email: string, emailToUser: Map<string, Human>): Human | null {
  const norm = normalizeEmail(email)
  return emailToUser.get(norm) ?? emailToUser.get(stripTld(norm)) ?? null
}

// Returns the first Human whose email matches any participant in the interaction.
export function findClientForInteraction(
  interaction: Interaction,
  emailToUser: Map<string, Human>
): Human | null {
  for (const email of interaction.participantEmails) {
    const user = lookupEmail(email, emailToUser)
    if (user) return user
  }
  return null
}

// Returns a Map<userId, Interaction[]> — each interaction appears under every matched
// participant, capped at the first non-duplicate match per interaction.
export function groupInteractionsByUser(
  interactions: Interaction[],
  users: Human[]
): Map<string, Interaction[]> {
  const emailToUser = buildEmailToUserMap(users)
  const result = new Map<string, Interaction[]>()
  for (const interaction of interactions) {
    for (const email of interaction.participantEmails) {
      const user = lookupEmail(email, emailToUser)
      if (user) {
        if (!result.has(user.id)) result.set(user.id, [])
        result.get(user.id)!.push(interaction)
        break // stop at first match so the interaction isn't counted twice
      }
    }
  }
  return result
}

// ── Legacy compatibility exports ──────────────────────────────────────────────

/** @deprecated Use getInteractions instead */
export const getMeetings = getInteractions
/** @deprecated Use getInteractionsForUser instead */
export const getMeetingsForUser = getInteractionsForUser
/** @deprecated Use getInteractionDetail instead */
export const getMeetingDetail = getInteractionDetail
/** @deprecated Use updateInteractionNotes instead */
export const updateMeetingNotes = updateInteractionNotes
/** @deprecated Use findClientForInteraction instead */
export const findClientForMeeting = findClientForInteraction
/** @deprecated Use groupInteractionsByUser instead */
export const groupMeetingsByUser = groupInteractionsByUser
