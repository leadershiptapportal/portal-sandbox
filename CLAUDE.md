# LeadershipTap Portal — Claude Context

## Terminology & data model

These terms have specific meanings in this codebase. Use them consistently.

| Term | Definition |
|---|---|
| **Human** | A person record in the Humans table (`TABLES.HUMANS`). The fundamental entity — everyone tracked in the app is a Human. Distinctions like "who is coaching whom" or "what org someone belongs to" come from Relationship Contexts and Affiliations, not from a type or role field on the Human itself. |
| **Relationship Context** | A directed link between two Humans: `Human` (the other party) ↔ `Lead` (the app user who owns the relationship). Typed by `Relationship Type`: `coaching`, `reports_to`, `client`, `prospect`, `personal`, `peer`. These type labels exist **only** on Relationship Contexts — never as a field on the Human record itself. |
| **Affiliation** | A Human ↔ Organization join record. Typed by `Affiliation Type`: `employee`, `contractor`, `member`, `client`, `founder`, `alum`, `other`. A human can have multiple affiliations over time. These type labels exist **only** on Affiliations — never as a field on the Human record itself. |
| **Interaction** | A calendar event, meeting, call, email, or other touchpoint. Lives in `TABLES.INTERACTIONS`. |
| **Note** | Any written observation — general note, session note, ink note, prep note, or quick note. All note types live in `TABLES.NOTES`, distinguished by `Note Type`. There is no notes field on the Human record. |
| **Organization** | An org record in `TABLES.ORGANIZATIONS`. Humans connect to orgs via Affiliations. A Relationship Context may also link to an Organization as the sponsoring org of the engagement. |
| **Permission Profile** | Determines what a logged-in human can do in the app. Linked from the Human record via `FIELDS.HUMANS.PERMISSION_PROFILE`. Currently two profiles exist: `admin` and `coach`. There is no `Role` field on Humans — access level is always derived from the linked Permission Profile name (`FIELDS.PERMISSION_PROFILES.PROFILE_NAME`). |

## Key files at a glance

| File | What it does |
|---|---|
| `lib/auth/getCurrentUserRecord.ts` | Resolves Clerk session → Airtable Humans record. Supports admin impersonation. Always call this in server actions that need the human's Airtable ID. |
| `lib/airtable/humans.ts` | CRUD for Humans table. `updateHumanProfile()` is the main write path for profile edits. |
| `lib/airtable/relationships.ts` | Relationship Contexts table — maps one Human to another with a typed, directed relationship. Replaces the old Coach-Person Context and Coach Session tables. |
| `lib/airtable/affiliations.ts` | Affiliations table — Human ↔ Organization join with type/status/dates/primary. Replaces the flat `Humans.Organization` link so a human can have multiple orgs over time. `getAffiliationsForHuman()`, `getMembers()`, `getPrimaryAffiliationMap()`, `pickPrimaryAffiliation()`, CRUD. |
| `lib/airtable/notes.ts` | All notes: general observations, interaction notes, ink notes, prep notes, quick notes. `createNote()`, `upsertGeneralNoteForRC()`, `upsertQuickNoteForRC()`, `getInteractionNotesGrouped()`. |
| `lib/airtable/interactions.ts` | Interactions table access (formerly meetings/Portal Calendar Events): read, write notes, create manual interactions. Legacy aliases (`getAllUpcomingMeetings` etc.) are exported for backwards compat. |
| `lib/airtable/messages.ts` | Messages table access. |
| `lib/airtable/tasks.ts` | Tasks table access. |
| `lib/airtable/constants.ts` | **Single source of truth for all Airtable table and field IDs.** Use `TABLES.X` and `FIELDS.X.Y` everywhere — never hardcode string field names. |
| `app/api/calendar/sync/route.ts` | POST — syncs Microsoft Graph calendar events for all @leadershiptap.com coaches into the Interactions table. Requires Clerk session or SYNC_SECRET header. Does NOT overwrite the `Notes` field on existing records. |

## Airtable field map

### Interactions (active calendar/event table — `TABLES.INTERACTIONS`)
| Airtable field | TS constant | Notes |
|---|---|---|
| `Note Name` | `FIELDS.INTERACTIONS.NOTE_NAME` | Primary field — auto-set by sync as `YYYY-MM-DD // Attendee Name` |
| `Subject` | `FIELDS.INTERACTIONS.TITLE` | Meeting/event title (from Microsoft Graph) |
| `Start Time` | `FIELDS.INTERACTIONS.START` | ISO 8601 DateTime |
| `End Time` | `FIELDS.INTERACTIONS.END` | ISO 8601 DateTime |
| `Provider Event ID` | `FIELDS.INTERACTIONS.PROVIDER_EVENT_ID` | Stable Microsoft Graph event ID — used for upsert dedup |
| `Attendees` | `FIELDS.INTERACTIONS.ATTENDEES` | Comma-separated emails (calendar owner excluded) — written by sync |
| `Notes` | `FIELDS.INTERACTIONS.NOTES_TEXT` | Long text — written manually by coaches |
| `Interaction Type` | `FIELDS.INTERACTIONS.INTERACTION_TYPE` | singleSelect: `"Calendar Event"` \| `"Email"` \| `"Text"` \| `"In-Person"` \| `"Phone Call"` \| `"Video Call"` \| `"Mail"` \| `"Other"` |
| `Source` | `FIELDS.INTERACTIONS.SOURCE` | singleSelect: `"Synced"` \| `"Manual"` |
| `Calendar Owner` | `FIELDS.INTERACTIONS.CALENDAR_OWNER` | Text email of the calendar owner (coach) |
| `Relationship Context` | `FIELDS.INTERACTIONS.RELATIONSHIP_CONTEXT` | Linked → Relationship Contexts |

### Relationship Contexts (`TABLES.RELATIONSHIP_CONTEXTS`)
Replaces the old Coach-Person Context and Coach Session tables. A Relationship Context connects two Humans in a typed, directed relationship owned by the Lead.

| Airtable field | TS constant | Notes |
|---|---|---|
| `Human` | `FIELDS.RELATIONSHIP_CONTEXTS.HUMAN` | Linked → Humans (the other party in the relationship) |
| `Lead` | `FIELDS.RELATIONSHIP_CONTEXTS.LEAD` | Linked → Humans (the app user who owns/holds the relationship) |
| `Relationship Type` | `FIELDS.RELATIONSHIP_CONTEXTS.TYPE` | singleSelect: `'coaching'` \| `'reports_to'` \| `'client'` \| `'prospect'` \| `'personal'` \| `'peer'` |
| `Permission Level` | `FIELDS.RELATIONSHIP_CONTEXTS.PERMISSION_LEVEL` | **Unimplemented scaffolding — never read or written by code. Access is determined dynamically by relationship traversal, not this field.** |
| `Status` | `FIELDS.RELATIONSHIP_CONTEXTS.STATUS` | |
| `Start Date` | `FIELDS.RELATIONSHIP_CONTEXTS.START_DATE` | |
| `End Date` | `FIELDS.RELATIONSHIP_CONTEXTS.END_DATE` | |
| `Tasks` | `FIELDS.RELATIONSHIP_CONTEXTS.TASKS_LINKED` | Linked → Tasks |
| `Notes` | `FIELDS.RELATIONSHIP_CONTEXTS.NOTES_LINKED` | Linked → Notes |
| `Organization` | `FIELDS.RELATIONSHIP_CONTEXTS.ORGANIZATION` | Linked → Organizations — sponsoring org of the engagement (distinct from a human's own affiliations) |

### Affiliations (`TABLES.AFFILIATIONS`)
Human ↔ Organization join. Replaces the flat `Humans.Organization` link; a human may have multiple affiliations, concurrent or sequential.

| Airtable field | TS constant | Notes |
|---|---|---|
| `Affiliation` | `FIELDS.AFFILIATIONS.NAME` | Primary label |
| `Human` | `FIELDS.AFFILIATIONS.HUMAN` | Linked → Humans |
| `Organization` | `FIELDS.AFFILIATIONS.ORGANIZATION` | Linked → Organizations |
| `Affiliation Type` | `FIELDS.AFFILIATIONS.TYPE` | singleSelect: `employee` \| `contractor` \| `member` \| `client` \| `founder` \| `alum` \| `other` |
| `Status` | `FIELDS.AFFILIATIONS.STATUS` | singleSelect: `Active` \| `Inactive` \| `Paused` \| `Ended` — **source of truth for visibility** |
| `Start Date` / `End Date` | `FIELDS.AFFILIATIONS.START_DATE` / `END_DATE` | Informational; missing dates default to visible |
| `Title at Org` | `FIELDS.AFFILIATIONS.TITLE_AT_ORG` | Role/title held at this org |
| `Primary` | `FIELDS.AFFILIATIONS.PRIMARY` | checkbox — the human's primary/current org for card/grid display |

**Visibility rule:** show an affiliation unless `Status` is `Ended`/`Inactive` or `End Date` is in the past. See `isAffiliationVisible()`.

### Notes (`TABLES.NOTES`)
Central notes system — all note types live here, distinguished by `Note Type`.

| Airtable field | TS constant | Notes |
|---|---|---|
| `Content` | `FIELDS.NOTES.BODY` | Primary text field |
| `Note Title` | `FIELDS.NOTES.NOTE_TITLE` | Optional label (singleLineText) |
| `Date` | `FIELDS.NOTES.DATE` | |
| `Human` | `FIELDS.NOTES.HUMAN` | Linked → Humans |
| `Author Person` | `FIELDS.NOTES.AUTHOR_PERSON` | Linked → Humans (who wrote the note) |
| `Subject Person` | `FIELDS.NOTES.SUBJECT_PERSON` | Linked → Humans (who the note is about) |
| `Meeting Link` | `FIELDS.NOTES.MEETING_LINK` | Linked → Interactions (preferred over legacy `MEETING` text field) |
| `Note Type` | `FIELDS.NOTES.NOTE_TYPE` | `"general_note"` \| `"interaction_note"` \| `"ink_note"` \| `"prep_note"` \| `"quick_notes"` |
| `Ink Image URL` | `FIELDS.NOTES.INK_IMAGE_URL` | Cloudinary URL for handwritten/ink notes |
| `Ink Note Data` | `FIELDS.NOTES.INK_NOTE_DATA` | TLStore JSON snapshot for resumable ink editing |
| `Relationship Context` | `FIELDS.NOTES.RELATIONSHIP_CONTEXT` | Linked → Relationship Contexts |
| `Visibility` | `FIELDS.NOTES.VISIBILITY` | Always write `"private_to_author"` |

### Messages (`TABLES.MESSAGES`)
| Airtable field | TS constant | Notes |
|---|---|---|
| `Message Name` | `FIELDS.MESSAGES.MESSAGE_NAME` | Primary field |
| `Subject` | `FIELDS.MESSAGES.SUBJECT` | Subject line |
| `AI Generated Message Content` | `FIELDS.MESSAGES.AI_GENERATED_MESSAGE_CONTENT` | Body |
| `Draft Content` | `FIELDS.MESSAGES.DRAFT_CONTENT` | Editable draft body |
| `Status` | `FIELDS.MESSAGES.STATUS` | `"Pending"` or `"Sent"` — **never `"Draft"`** |
| `Created` | `FIELDS.MESSAGES.CREATED` | Created time — read-only, never write |

### Humans — key fields (`TABLES.HUMANS`)
| Airtable field | TS constant | Notes |
|---|---|---|
| `Full Name` | `FIELDS.HUMANS.FULL_NAME` | Formula field — **never write to it** |
| `First Name` / `Last Name` | `FIELDS.HUMANS.FIRST_NAME` / `FIELDS.HUMANS.LAST_NAME` | Write these instead |
| `Preferred Name` | `FIELDS.HUMANS.PREFERRED_NAME` | Optional display name override |
| `Work Email` | `FIELDS.HUMANS.WORK_EMAIL` | Used for calendar matching |
| `Portal Permission Profile` | `FIELDS.HUMANS.PERMISSION_PROFILE` | Linked → Permission Profiles — determines app access. Derive role from the linked profile name (`FIELDS.PERMISSION_PROFILES.PROFILE_NAME`). Never store role as a flat field. |
| `Affiliations` | `FIELDS.HUMANS.AFFILIATIONS` | Linked → Affiliations — read org memberships here; write via the Affiliations table, not this field directly |
| `Relationship Contexts (Client)` | `FIELDS.HUMANS.RELATIONSHIP_CONTEXTS_CLIENT` | Linked → Relationship Contexts where this human is the other party |
| `Relationship Contexts (Coach)` | `FIELDS.HUMANS.RELATIONSHIP_CONTEXTS_COACH` | Linked → Relationship Contexts where this human is the Lead |
| `Associated Meetings` | `FIELDS.HUMANS.ASSOCIATED_MEETINGS` | Linked → Interactions — used for session count |
| `Portal Theme` | `FIELDS.HUMANS.THEME` | singleSelect: `"light"` \| `"dark"` \| `"system"` |

### Tasks (`TABLES.TASKS`)
Primary field is `Title` (`FIELDS.TASKS.TITLE`). Client link field is `Human` (`FIELDS.TASKS.HUMAN`, linked → Humans). Not to be confused with "Linked Todoist Tasks", which is a separate Todoist integration field.

## Key conventions

- **All Airtable field access uses IDs — mandatory.** `airtableFetch()` appends `returnFieldsByFieldId=true` to all GETs so responses are keyed by ID. Read fields via `record.fields[FIELDS.X.Y]`; write payloads must use `[FIELDS.X.Y]` as keys too. Never use a string field name as a key in a read or write. Never use string field names in `filterByFormula` — use `{${FIELDS.X.Y}}` syntax. Violation: Airtable renames break silently.
- **All interactions data comes from `TABLES.INTERACTIONS`** — `TABLES.MEETINGS` is a deprecated alias kept only for reference; do not use it in new code.
- **`createHumanRecord` takes `CreateHumanFields`** (camelCase TS keys). All callers must use this typed interface — no string Airtable field name keys at call sites. Mapping to field IDs happens inside `createHumanRecord`.
- **`updateHumanProfile` takes `HumanProfileFields`** (human-readable string keys). The complete name→ID mapping lives inside `updateHumanProfile`. Do not add partial mappings elsewhere.
- **Relationship Contexts replace Coach-Person Context + Coach Session** — the old tables no longer exist. Notes for a relationship are in the Notes table, linked via `FIELDS.NOTES.RELATIONSHIP_CONTEXT`.
- **Org membership lives in Affiliations** — there is no writable org field on the Human record. To read or write a human's organization(s), use `TABLES.AFFILIATIONS` and the functions in `affiliations.ts`.
- **Never write to formula or lookup fields**: `Full Name`, `Created`.
- **Message status**: always `"Pending"` for drafts. Never `"Draft"`.
- **Airtable mutations**: use direct `fetch()` to the REST API. No SDK.
- **All Airtable access is server-side only** — API key must never reach the browser.
- **Server actions** live in `actions.ts` co-located with the page/component that uses them.
- **Linked record filtering**: Airtable `filterByFormula` returns only the primary field value for linked records, not the record ID. Filter by linked record IDs in JavaScript after fetching.
- **Upsert pattern**: fetch existing record(s) → filter in JS → PATCH if found, POST if not. See `notes.ts` (`upsertGeneralNoteForRC`) for canonical examples.

## Known gotchas

- **`Full Name` is a formula** — Airtable rejects writes to it. Always write `First Name` + `Last Name` separately via `FIELDS.HUMANS.FIRST_NAME` / `FIELDS.HUMANS.LAST_NAME`.
- **Org membership lives in Affiliations, not on the Human record** — there is no `Organization` or `Organization Name` field to write on Humans. Read and write org relationships through `TABLES.AFFILIATIONS`.
- **shadcn `<Select>` requires non-empty string values** — never use `value=""`. Use a sentinel like `"none"` and convert back to `undefined`/`null` before saving.
- **Profile photos go through Cloudinary** — Airtable attachment fields can't be written via REST API with a raw file. The upload flow is: browser → `/api/upload-photo` → Cloudinary → get URL → Airtable PATCH `FIELDS.HUMANS.PROFILE_PHOTO`.
- **`FIELDS.INTERACTIONS.ATTENDEES`** is stored in Airtable as a comma-separated string; the app normalises it to `string[]` in `mapRecord`. When writing back, join with `', '`. This field was formerly called `Participant Emails`.
- **Notes linked to interactions** use `FIELDS.NOTES.MEETING_LINK` (multipleRecordLinks). The legacy `MEETING` singleLineText field also exists on older records — `mapRecord` in notes.ts falls back to it automatically.
- **`NoteType` canonical values** for new writes are `'general_note'` and `'interaction_note'`. Legacy values (`general_context`, `meeting_note`, etc.) may exist on older Airtable records and round-trip safely but should never be written by new code.
- **Calendar sync** runs via POST `/api/calendar/sync`. Triggered from Settings (Clerk auth) or cron (SYNC_SECRET header). Never overwrites `Notes` on existing Interaction records.
- **Admin impersonation** — `getCurrentUserRecord()` returns `isImpersonated: true` and swaps `airtableId`/`email` to the impersonated human when an admin has activated impersonation. `realAirtableId` always holds the logged-in admin's own ID.
