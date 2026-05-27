import type { Interaction } from "@/lib/types";
import { TABLES, FIELDS } from "@/lib/airtable/constants";
import { airtableFetch } from "@/lib/airtable/client";
import { log } from "@/lib/utils/logger";

const API_BASE = "https://api.airtable.com/v0";
const TABLE = encodeURIComponent(TABLES.INTERACTIONS);

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) throw new Error("Missing Airtable credentials");
  return { apiKey, baseId };
}

function firstLinkedId(val: unknown): string | undefined {
  return Array.isArray(val) && val.length > 0 ? (val[0] as string) : undefined;
}

function parseEmails(raw: unknown): string[] {
  if (!raw) return [];
  const items: string[] = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
    ? raw.split(/[,;]/)
    : [];
  return items.map((e) => e.trim()).filter(Boolean);
}

// Maps a record from the Interactions table
function mapRecord(record: { id: string; fields: Record<string, unknown> }): Interaction {
  return {
    id: record.id,
    providerEventId: record.fields[FIELDS.INTERACTIONS.PROVIDER_EVENT_ID] as string | undefined,
    title: (record.fields[FIELDS.INTERACTIONS.TITLE] as string) ?? "",
    startTime: (record.fields[FIELDS.INTERACTIONS.START] as string) ?? "",
    endTime: record.fields[FIELDS.INTERACTIONS.END] as string | undefined,
    timezone: (record.fields[FIELDS.INTERACTIONS.TIMEZONE] as string) || undefined,
    senderEmail: undefined,
    participantEmails: parseEmails(record.fields[FIELDS.INTERACTIONS.ATTENDEES]),
    notes: (record.fields[FIELDS.INTERACTIONS.NOTES_TEXT] as string) || undefined,
    sessionStatus: null,
    actionItems: null,
    clientName: (record.fields[FIELDS.INTERACTIONS.CLIENT_NAME] as string) || undefined,
    relationshipContextId: firstLinkedId(record.fields[FIELDS.INTERACTIONS.RELATIONSHIP_CONTEXT]),
    interactionType: (record.fields[FIELDS.INTERACTIONS.INTERACTION_TYPE] as string) || undefined,
    source: (record.fields[FIELDS.INTERACTIONS.SOURCE] as string) || undefined,
  };
}

// All upcoming interactions in the next N days (used by dashboard "Upcoming This Week")
// ownerEmail: when provided, only returns events where {Calendar Owner} matches this email.
export async function getAllUpcomingInteractions(daysAhead = 7, ownerEmail?: string): Promise<Interaction[]> {
  const { apiKey, baseId } = getCredentials();
  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000).toISOString();
  const timeFilter = `AND(IS_AFTER({${FIELDS.INTERACTIONS.START}}, "${now}"), IS_BEFORE({${FIELDS.INTERACTIONS.START}}, "${cutoff}"))`;
  const safeOwner = ownerEmail ? ownerEmail.toLowerCase().replace(/"/g, '\\"') : null;
  const formula = safeOwner
    ? `AND(${timeFilter}, LOWER({${FIELDS.INTERACTIONS.CALENDAR_OWNER}}) = "${safeOwner}")`
    : timeFilter;
  log.debug('[getAllUpcomingInteractions] table:', TABLES.INTERACTIONS, 'filter:', formula);
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.INTERACTIONS.START)}&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=50`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text();
    log.error('[getAllUpcomingInteractions] failed status:', res.status, 'body:', text);
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

// Past interactions within the last N days, sorted by Start desc.
// Used by the dashboard "Recent Interactions" widget to surface interactions the
// coach may need to log notes for. Filters on Calendar Owner so Coach A
// never sees Coach B's events.
export async function getRecentPastInteractions(daysBack = 14, ownerEmail?: string): Promise<Interaction[]> {
  const { apiKey, baseId } = getCredentials();
  const nowIso = new Date().toISOString();
  const earliestIso = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();
  const timeFilter = `AND(IS_AFTER({${FIELDS.INTERACTIONS.START}}, "${earliestIso}"), IS_BEFORE({${FIELDS.INTERACTIONS.START}}, "${nowIso}"))`;
  const safeOwner = ownerEmail ? ownerEmail.toLowerCase().replace(/"/g, '\\"') : null;
  const formula = safeOwner
    ? `AND(${timeFilter}, LOWER({${FIELDS.INTERACTIONS.CALENDAR_OWNER}}) = "${safeOwner}")`
    : timeFilter;
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.INTERACTIONS.START)}&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=100`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  if (!res.ok) {
    log.error('[getRecentPastInteractions] failed status:', res.status, 'body:', await res.text());
    return [];
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

// All interactions sorted by Start desc (used by dashboard client activity section)
// ownerEmail: when provided, only returns events where {Calendar Owner} matches this email.
export async function getAllInteractions(ownerEmail?: string): Promise<Interaction[]> {
  const { apiKey, baseId } = getCredentials();
  const safeOwner = ownerEmail ? ownerEmail.toLowerCase().replace(/"/g, '\\"') : null;
  const filterParam = safeOwner
    ? `filterByFormula=${encodeURIComponent(`LOWER({${FIELDS.INTERACTIONS.CALENDAR_OWNER}}) = "${safeOwner}"`)}&`
    : '';
  log.debug('[getAllInteractions] table:', TABLES.INTERACTIONS, 'ownerEmail:', ownerEmail ?? '(all)');
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}?${filterParam}sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.INTERACTIONS.START)}&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=500`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text();
    log.error('[getAllInteractions] failed status:', res.status, 'body:', text);
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

// Interactions where Attendees contains the given email OR Client Name contains
// the given displayName. Both checks are case-insensitive substring matches.
//
// We accept either or both because the data has two write paths:
//   - Calendar sync writes Client Name (per the RC lookup) but historically
//     hasn't always written Attendees. Until every interaction has Attendees
//     populated, the email-only query misses sessions the Clients list shows.
//   - Manual sessions now write both, so they'll match either way.
//
// ownerEmail: when provided, scopes results to one coach's calendar.
export async function getInteractionsByUserEmail(
  email: string,
  ownerEmail?: string,
  displayName?: string,
): Promise<Interaction[]> {
  const { apiKey, baseId } = getCredentials();
  const safeEmail = email.toLowerCase().trim().replace(/"/g, '\\"');
  const matchClauses: string[] = []
  if (safeEmail) {
    matchClauses.push(`SEARCH("${safeEmail}", LOWER({${FIELDS.INTERACTIONS.ATTENDEES}}))`)
  }
  if (displayName && displayName.trim()) {
    const safeName = displayName.toLowerCase().trim().replace(/"/g, '\\"')
    matchClauses.push(`SEARCH("${safeName}", LOWER({${FIELDS.INTERACTIONS.CLIENT_NAME}}))`)
  }
  if (matchClauses.length === 0) return []
  const matchFilter = matchClauses.length === 1 ? matchClauses[0] : `OR(${matchClauses.join(', ')})`

  const safeOwner = ownerEmail ? ownerEmail.toLowerCase().replace(/"/g, '\\"') : null;
  const formula = safeOwner
    ? `AND(${matchFilter}, LOWER({${FIELDS.INTERACTIONS.CALENDAR_OWNER}}) = "${safeOwner}")`
    : matchFilter;
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.INTERACTIONS.START)}&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=100`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable GET failed: ${text}`);
  }
  const data = await res.json();
  return (data.records ?? []).map(mapRecord);
}

// Fetch a single Interactions record by Airtable record ID
export async function getInteractionById(interactionId: string): Promise<Interaction | null> {
  const { apiKey, baseId } = getCredentials();
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}/${interactionId}`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: "no-store" },
  );
  if (!res.ok) return null;
  const data = await res.json();
  return mapRecord(data);
}

// Patch the Notes field on an Interactions record
export async function updatePortalEventNotes(
  recordId: string,
  notes: string,
): Promise<void> {
  const { apiKey, baseId } = getCredentials();
  const res = await airtableFetch(
    `${API_BASE}/${baseId}/${TABLE}/${recordId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields: { [FIELDS.INTERACTIONS.NOTES_TEXT]: notes } }),
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable PATCH failed for ${recordId}: ${text}`);
  }
}

// Interactions for a client's profile page — same as getInteractionsByUserEmail
// (kept as a named alias for clarity at the call site)
export async function getPortalEventsByClientEmail(
  email: string,
  ownerEmail?: string,
  displayName?: string,
): Promise<Interaction[]> {
  return getInteractionsByUserEmail(email, ownerEmail, displayName);
}

// ── Manual interaction creation ──────────────────────────────────────────────────

export interface CreateManualInteractionData {
  title: string
  startIso: string
  endIso: string
  timezone: string
  calendarOwnerEmail: string
  relationshipContextId: string
  clientName: string
  /** Comma-joined participant emails (excluding coach). Required for the
   *  profile page email-match query to pick up this interaction. */
  attendeeEmails?: string
  interactionType?: string
}

export async function createManualInteraction(data: CreateManualInteractionData): Promise<string> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = {
    [FIELDS.INTERACTIONS.TITLE]: data.title,
    [FIELDS.INTERACTIONS.START]: data.startIso,
    [FIELDS.INTERACTIONS.END]: data.endIso,
    [FIELDS.INTERACTIONS.TIMEZONE]: data.timezone,
    [FIELDS.INTERACTIONS.MEETING_STATUS]: 'Completed',
    [FIELDS.INTERACTIONS.CALENDAR_PROVIDER]: 'Manual',
    [FIELDS.INTERACTIONS.CALENDAR_OWNER]: data.calendarOwnerEmail,
    [FIELDS.INTERACTIONS.ATTENDEES]: data.attendeeEmails ?? '',
    [FIELDS.INTERACTIONS.RELATIONSHIP_CONTEXT]: [data.relationshipContextId],
    [FIELDS.INTERACTIONS.CLIENT_NAME]: data.clientName,
    [FIELDS.INTERACTIONS.SOURCE]: 'Manual',
  }
  if (data.interactionType) fields[FIELDS.INTERACTIONS.INTERACTION_TYPE] = data.interactionType
  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(`Manual interaction POST failed: ${JSON.stringify(result)}`)
  return result.id as string
}

// ── Legacy compatibility exports (keep old function names as aliases) ──────────

/** @deprecated Use getAllUpcomingInteractions instead */
export const getAllUpcomingMeetings = getAllUpcomingInteractions
/** @deprecated Use getRecentPastInteractions instead */
export const getRecentPastMeetings = getRecentPastInteractions
/** @deprecated Use getAllInteractions instead */
export const getAllMeetings = getAllInteractions
/** @deprecated Use getInteractionsByUserEmail instead */
export const getMeetingsByUserEmail = getInteractionsByUserEmail
/** @deprecated Use getInteractionById instead */
export const getMeetingById = getInteractionById
/** @deprecated Use createManualInteraction instead */
export const createManualMeeting = createManualInteraction
