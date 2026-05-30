import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { airtableFetch } from '@/lib/airtable/client'

const API_BASE = 'https://api.airtable.com/v0'
const TABLE = encodeURIComponent(TABLES.NOTES)

function getCredentials() {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) throw new Error('Missing Airtable credentials')
  return { apiKey, baseId }
}

type AirtableRecord = { id: string; fields: Record<string, unknown> }

/**
 * Two note types:
 *   - general_note: standalone coaching observations not tied to a specific
 *     interaction (profile-level context, ink notes, free-form observations).
 *   - interaction_note: notes attached to a specific Interaction record.
 *
 * Legacy values `general_context`, `meeting_note`, `follow_up`, and
 * `private_observation` may still exist on older Airtable records and
 * round-trip safely (TypeScript widens to string at the boundary), but all
 * new writes use the two canonical values above.
 */
export type NoteType = 'general_note' | 'interaction_note' | 'ink_note' | 'prep_note' | 'quick_notes'

export interface Note {
  id: string
  content: string
  noteTitle?: string
  inkImageUrl?: string
  inkNoteData?: string
  date: string
  humanId?: string
  coachName?: string
  authorPersonId?: string
  subjectPersonId?: string
  interactionId?: string
  relationshipContextId?: string
  noteType?: NoteType
  visibility: 'private_to_author'
}

function firstLinkedId(val: unknown): string | undefined {
  return Array.isArray(val) && val.length > 0 ? (val[0] as string) : undefined
}

function mapRecord(r: AirtableRecord): Note {
  return {
    id: r.id,
    content: (r.fields[FIELDS.NOTES.BODY] as string) ?? '',
    noteTitle: (r.fields[FIELDS.NOTES.NOTE_TITLE] as string) || undefined,
    inkImageUrl: (r.fields[FIELDS.NOTES.INK_IMAGE_URL] as string) || undefined,
    inkNoteData: (r.fields[FIELDS.NOTES.INK_NOTE_DATA] as string) || undefined,
    date: (r.fields[FIELDS.NOTES.DATE] as string) ?? '',
    humanId: firstLinkedId(r.fields[FIELDS.NOTES.HUMAN]),
    coachName: (r.fields[FIELDS.NOTES.COACH_NAME] as string) || undefined,
    authorPersonId: firstLinkedId(r.fields[FIELDS.NOTES.AUTHOR_PERSON]),
    subjectPersonId: firstLinkedId(r.fields[FIELDS.NOTES.SUBJECT_PERSON]),
    // Prefer the linked MEETING_LINK field (multipleRecordLinks); fall back to
    // the legacy singleLineText MEETING field for older records.
    interactionId: firstLinkedId(r.fields[FIELDS.NOTES.MEETING_LINK]) ||
      (r.fields[FIELDS.NOTES.MEETING] as string) || undefined,
    relationshipContextId: firstLinkedId(r.fields[FIELDS.NOTES.RELATIONSHIP_CONTEXT]),
    noteType: (r.fields[FIELDS.NOTES.NOTE_TYPE] as NoteType) || undefined,
    visibility: 'private_to_author',
  }
}

const SORT_DATE_DESC =
  `sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.NOTES.DATE)}&sort%5B0%5D%5Bdirection%5D=desc`

// ── Read functions ────────────────────────────────────────────────────────────

/**
 * Fetch all notes sorted by Date desc.
 * Used by the dashboard and users list to build per-client note counts.
 */
export async function getAllRecentNotes(limit = 100): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=${limit}`
  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) {
    console.error('[getAllRecentNotes] failed:', res.status, await res.text())
    return []
  }
  const data = await res.json()
  return (data.records ?? []).map(mapRecord)
}

/**
 * Fetch notes where Subject Person (or Human) = humanAirtableId.
 * JS-filtered because linked record fields can't be filtered by ID in Airtable formulas.
 */
export async function getNotesByHuman(humanAirtableId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=500`
  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .map(mapRecord)
    .filter(
      (n: Note) =>
        n.subjectPersonId === humanAirtableId || n.humanId === humanAirtableId,
    )
}

/**
 * Fetch notes authored by a specific person.
 * Uses Author Person linked field (JS-filtered), falling back to all notes
 * if the field isn't populated yet.
 */
export async function getNotesByAuthor(authorAirtableId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=500`
  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  const all = (data.records ?? []).map(mapRecord) as Note[]
  // Filter by Author Person linked field
  const byAuthor = all.filter((n) => n.authorPersonId === authorAirtableId)
  // If Author Person isn't populated on any records yet, return all (backward compat)
  return byAuthor.length > 0 ? byAuthor : all
}

/**
 * Fetch notes attached to a specific Interaction.
 * JS-filtered because the link field is not filterable via formula.
 */
export async function getNotesByInteractionId(interactionId: string): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=500`
  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .map(mapRecord)
    .filter((n: Note) => n.interactionId === interactionId)
}

/**
 * Fetch notes linked to a specific Relationship Context, authored by a specific person.
 * JS-filtered on both linked fields.
 */
export async function getNotesByRelationshipContext(
  rcId: string,
  authorPersonId: string,
): Promise<Note[]> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=500`
  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? [])
    .map(mapRecord)
    .filter(
      (n: Note) =>
        n.relationshipContextId === rcId && n.authorPersonId === authorPersonId,
    )
}

/**
 * Returns the most recent interaction note for a given human, optionally
 * excluding a specific interaction (e.g. the one currently open).
 * Only returns notes that are linked to an interaction record.
 */
export async function getMostRecentInteractionNoteByHuman(
  humanAirtableId: string,
  excludeInteractionId?: string,
): Promise<Note | null> {
  const notes = await getNotesByHuman(humanAirtableId)
  // getNotesByHuman returns sorted date desc, so first match is the most recent
  const candidate = notes.find(
    (n) =>
      n.interactionId != null &&
      (excludeInteractionId == null || n.interactionId !== excludeInteractionId),
  )
  return candidate ?? null
}

// Alias for backward compatibility — callers that used getNotesByUser
export const getNotesByUser = getNotesByHuman

// ── Write functions ───────────────────────────────────────────────────────────

export interface CreateNoteData {
  content: string
  noteTitle?: string
  inkImageUrl?: string
  inkNoteData?: string
  date?: string
  humanId?: string
  authorPersonId?: string
  subjectPersonId?: string
  interactionId?: string
  relationshipContextId?: string
  coachName?: string
  noteType?: NoteType
}

export async function createNote(data: CreateNoteData): Promise<Note> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = {
    [FIELDS.NOTES.BODY]: data.content,
    [FIELDS.NOTES.DATE]: data.date ?? new Date().toISOString().split('T')[0],
    [FIELDS.NOTES.VISIBILITY]: 'private_to_author',
    [FIELDS.NOTES.NOTE_TYPE]: data.noteType ?? 'general_note',
  }
  if (data.noteTitle) fields[FIELDS.NOTES.NOTE_TITLE] = data.noteTitle
  if (data.humanId) fields[FIELDS.NOTES.HUMAN] = [data.humanId]
  if (data.authorPersonId) fields[FIELDS.NOTES.AUTHOR_PERSON] = [data.authorPersonId]
  if (data.subjectPersonId) fields[FIELDS.NOTES.SUBJECT_PERSON] = [data.subjectPersonId]
  // Write interactionId to both the linked MEETING_LINK field and the legacy
  // singleLineText MEETING field so older read paths still work.
  if (data.interactionId) {
    fields[FIELDS.NOTES.MEETING_LINK] = [data.interactionId]
    fields[FIELDS.NOTES.MEETING] = data.interactionId
  }
  if (data.relationshipContextId) fields[FIELDS.NOTES.RELATIONSHIP_CONTEXT] = [data.relationshipContextId]
  if (data.coachName) fields[FIELDS.NOTES.COACH_NAME] = data.coachName
  if (data.inkImageUrl) fields[FIELDS.NOTES.INK_IMAGE_URL] = data.inkImageUrl
  if (data.inkNoteData) fields[FIELDS.NOTES.INK_NOTE_DATA] = data.inkNoteData

  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const detail = await res.json()
    throw new Error(`Notes POST failed: ${JSON.stringify(detail)}`)
  }
  return mapRecord(await res.json())
}

export async function updateInkNoteFields(
  noteId: string,
  imageUrl: string,
  inkNoteData: string,
  caption?: string,
): Promise<{ success: true } | { error: string }> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = {
    [FIELDS.NOTES.INK_IMAGE_URL]: imageUrl,
    [FIELDS.NOTES.INK_NOTE_DATA]: inkNoteData,
  }
  if (caption !== undefined) fields[FIELDS.NOTES.BODY] = caption
  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}/${noteId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const data = await res.json()
    return { error: JSON.stringify(data) }
  }
  return { success: true }
}

export async function getMostRecentInkNoteByHuman(
  humanAirtableId: string,
  interactionId?: string,
): Promise<Note | null> {
  const notes = await getNotesByHuman(humanAirtableId)
  const inkNotes = notes.filter((n) => n.noteType === 'ink_note')
  if (interactionId) {
    const match = inkNotes.find((n) => n.interactionId === interactionId)
    if (match) return match
  }
  return inkNotes.find((n) => !n.interactionId) ?? inkNotes[0] ?? null
}

export async function updateNote(
  noteId: string,
  content: string,
  noteTitle?: string,
): Promise<{ success: true } | { error: string }> {
  const { apiKey, baseId } = getCredentials()
  const fields: Record<string, unknown> = { [FIELDS.NOTES.BODY]: content }
  if (noteTitle !== undefined) fields[FIELDS.NOTES.NOTE_TITLE] = noteTitle
  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}/${noteId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  if (!res.ok) {
    const data = await res.json()
    return { error: JSON.stringify(data) }
  }
  return { success: true }
}

export async function deleteNote(
  noteId: string,
): Promise<{ success: true } | { error: string }> {
  const { apiKey, baseId } = getCredentials()
  const res = await airtableFetch(`${API_BASE}/${baseId}/${TABLE}/${noteId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${apiKey}` },
  })
  if (!res.ok) {
    const data = await res.json()
    return { error: JSON.stringify(data) }
  }
  return { success: true }
}

/**
 * Upsert the single general note for a Relationship Context + author pair.
 * If a general_note already exists for this RC+author, patches it in place.
 * If not, creates a new one. This gives a mutable "sticky note" per relationship.
 */
export async function upsertGeneralNoteForRC(
  rcId: string,
  authorPersonId: string,
  content: string,
  subjectPersonId?: string,
): Promise<Note> {
  const existing = await getNotesByRelationshipContext(rcId, authorPersonId)
  const generalNotes = existing.filter(
    (n) => n.noteType === 'general_note' || !n.noteType,
  )

  if (generalNotes.length > 0) {
    const latest = generalNotes[0] // sorted date desc
    const result = await updateNote(latest.id, content)
    if ('error' in result) throw new Error(result.error)
    return { ...latest, content }
  }

  return createNote({
    content,
    relationshipContextId: rcId,
    authorPersonId,
    subjectPersonId,
    noteType: 'general_note',
  })
}

// ── Interaction notes grouped by category + format ───────────────────────────

export interface InteractionNotesGroup {
  prepTyped: Note | null
  prepInk: Note | null
  interactionTyped: Note | null
  interactionInk: Note | null
}

/**
 * Returns all four possible note slots for a given interaction + author.
 * Format (typed vs handwritten) is detected by presence of inkImageUrl.
 * Old ink_note records are treated as handwritten interaction notes.
 */
export async function getInteractionNotesGrouped(
  interactionId: string,
  authorPersonId: string,
): Promise<InteractionNotesGroup> {
  const all = await getNotesByInteractionId(interactionId)
  const mine = all.filter((n) => n.authorPersonId === authorPersonId)

  return {
    prepTyped: mine.find((n) => n.noteType === 'prep_note' && !n.inkImageUrl) ?? null,
    prepInk: mine.find((n) => n.noteType === 'prep_note' && !!n.inkImageUrl) ?? null,
    interactionTyped: mine.find((n) => n.noteType === 'interaction_note' && !n.inkImageUrl) ?? null,
    interactionInk: mine.find((n) =>
      (n.noteType === 'interaction_note' || n.noteType === 'ink_note') && !!n.inkImageUrl
    ) ?? null,
  }
}

/**
 * Batch-fetch the most recent general_note for each RC in `rcIds`, authored
 * by `authorPersonId`. Returns a Map keyed by RC ID. One Airtable call total.
 */
export async function getGeneralNotesByRCIds(
  rcIds: string[],
  authorPersonId: string,
): Promise<Map<string, Note>> {
  if (rcIds.length === 0) return new Map()
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=1000`
  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return new Map()
  const data = await res.json()
  const rcIdSet = new Set(rcIds)
  const result = new Map<string, Note>()
  for (const r of data.records ?? []) {
    const note = mapRecord(r)
    if (
      note.authorPersonId === authorPersonId &&
      note.relationshipContextId &&
      rcIdSet.has(note.relationshipContextId) &&
      (note.noteType === 'general_note' || !note.noteType)
    ) {
      if (!result.has(note.relationshipContextId)) {
        result.set(note.relationshipContextId, note)
      }
    }
  }
  return result
}

/**
 * Returns the single quick_notes Note for a given RC + author pair, or null.
 * Quick notes are private scratch-pad notes scoped to one coach↔person relationship.
 */
export async function getQuickNoteForRC(
  rcId: string,
  authorPersonId: string,
): Promise<Note | null> {
  const { apiKey, baseId } = getCredentials()
  const url = `${API_BASE}/${baseId}/${TABLE}?${SORT_DATE_DESC}&maxRecords=1000`
  const res = await airtableFetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = await res.json()
  const notes = (data.records ?? []).map(mapRecord) as Note[]
  return (
    notes.find(
      (n) =>
        n.noteType === 'quick_notes' &&
        n.authorPersonId === authorPersonId &&
        n.relationshipContextId === rcId,
    ) ?? null
  )
}

/**
 * Creates or replaces the quick_notes Note for a given RC + author pair.
 * Patches in place if one already exists so edits never create duplicates.
 */
export async function upsertQuickNoteForRC(
  rcId: string,
  authorPersonId: string,
  content: string,
  subjectPersonId?: string,
): Promise<void> {
  const existing = await getQuickNoteForRC(rcId, authorPersonId)
  if (existing) {
    const result = await updateNote(existing.id, content)
    if ('error' in result) throw new Error(result.error)
  } else {
    await createNote({
      content,
      relationshipContextId: rcId,
      authorPersonId,
      subjectPersonId,
      noteType: 'quick_notes',
    })
  }
}
