---
name: project-take-notes-feature
description: Take Notes split-panel page for live session note-taking with person profile sidebar
metadata:
  type: project
---

Take Notes feature is built and shipping.

**Route:** `/myhumans/[id]/take-notes?interactionId=xxx` (interactionId optional)

**Entry points:**
1. Profile page (UserActionsBar) — "Take Notes" button → `/myhumans/${id}/take-notes`
2. Interaction detail page (`/interactions/[eventId]`) — "Take Notes" button → `/myhumans/${clientId}/take-notes?interactionId=${eventId}`
3. Dashboard Quick Actions — TakeNotesDialog (person picker) → navigates to route

**Layout:** `h-[100dvh] flex flex-col` within AppShell (no route group bypass needed)
- Left panel (w-72/xl:w-80): PersonSidebar — scrollable, all profile sections with inline editing
- Right panel (flex-1): TakeNotesCanvas — full ink canvas + interaction picker at bottom

**Key files:**
- `app/(protected)/myhumans/[id]/take-notes/page.tsx` — server component, fetches all data
- `app/(protected)/myhumans/[id]/take-notes/TakeNotesWorkspace.tsx` — client layout
- `app/(protected)/myhumans/[id]/take-notes/PersonSidebar.tsx` — inline-editable profile
- `app/(protected)/myhumans/[id]/take-notes/TakeNotesCanvas.tsx` — adapted InkNoteComposer
- `app/(protected)/dashboard/TakeNotesDialog.tsx` — quick action person picker

**Airtable schema change:**
- Added `Ink Image URL` field (fldxHSSkmAvFsgBKR, url type) to Notes table
- Ink notes now write image URL to `Ink Image URL`, caption to `Body` (not embedded markdown)
- `noteType` for ink notes is now `'ink_note'` (was `'general_note'`)
- Old embedded-markdown ink notes still render correctly via NoteBody backward compat

**Why:** Coaches needed a distraction-free note-taking environment during sessions with quick access to reference/edit the client's profile without leaving the canvas.
