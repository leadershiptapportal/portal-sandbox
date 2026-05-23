# LeadershipTap Portal

An internal coaching portal for a small leadership team. Built with Next.js 16, Clerk authentication, and Airtable as the data source.

## Stack

- **Framework**: Next.js 16 (App Router, TypeScript)
- **Auth**: Clerk (Microsoft 365 / Google SSO)
- **Calendar**: Microsoft Graph API (app-only, reads coach calendar events)
- **Data**: Airtable (server-side only — API key never exposed to browser)
- **UI**: Tailwind CSS + shadcn/ui
- **File uploads**: Cloudinary (profile photos)
- **Hosting**: Render

## Prerequisites

- Node.js 18+
- A [Clerk](https://clerk.com) account with an application created
- An [Airtable](https://airtable.com) base with the LeadershipTap schema and a Personal Access Token
- An Azure app registration with `Calendars.Read` (application permission) granted

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/gabrielasie/leadershiptap-portal.git
cd leadershiptap-portal
npm install
```

### 2. Environment variables

Create `.env.local`:

```env
# Airtable
AIRTABLE_API_KEY=pat...           # Personal Access Token (starts with "pat")
AIRTABLE_BASE_ID=app...           # Base ID from Airtable URL

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard

# Microsoft Graph (calendar sync only)
AZURE_TENANT_ID=...               # Azure AD tenant ID
AZURE_CLIENT_ID=...               # App registration client ID
AZURE_CLIENT_SECRET=...           # App registration client secret

# Calendar sync tuning (optional — defaults shown)
SYNC_SECRET=...                   # Shared secret for cron-triggered syncs
SYNC_PAST_DAYS=90                 # How far back to sync (default 90)
SYNC_FUTURE_DAYS=60               # How far forward to sync (default 60)

# Cloudinary (profile photo uploads)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_UPLOAD_PRESET=...
```

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). You will be redirected to `/sign-in`.

---

## Architecture

### Airtable tables

| Table | Purpose |
|---|---|
| **Users** | All people — coaches, admins, clients. `Role` field distinguishes them. |
| **Portal Calendar Events** | Active calendar table. Synced from Microsoft Graph via `/api/calendar/sync`. Fields: Subject, Start, End, Provider Event ID, Participant Emails, Notes, Note Name. |
| **Calendar Events** | Archived — historical snapshot only. Never queried by the portal. |
| **Relationship Contexts** | Per coach ↔ client pair: type (`coaching` or `reports_to`), status, start date. One row per pair. The join table for everything coach-scoped. |
| **Coach-Person Context** | Legacy per coach ↔ client pair: Quick Notes, Family Details. Still read/written but not in spec v2. |
| **Coach Session** | Legacy per coach ↔ meeting pair: Session Notes, Action Items. Still read/written but not in spec v2. |
| **Notes** | RC-scoped coaching notes with Author Person, Subject Person, Relationship Context anchors. The spec v2 canonical notes store. |
| **Messages** | Follow-up email drafts. Status: `"Pending"` or `"Sent"` (never `"Draft"`). |
| **Tasks** | Portal action items linked to clients. |
| **Companies** | Company records linked from Users. |
| **Permission Profiles** | Single "standard" profile record used as a scaffold for v2 permission model. |
| **Enneagram / 16Personalities / Conflict Postures / Apology Languages / Strengths** | Lookup tables for personality fields. |

### Auth layers

There are two separate auth systems that never interact:

**Clerk** — app login. Every browser session is authenticated via Clerk. `getCurrentUserRecord()` resolves the Clerk session to an Airtable Users record by email. Role (`admin` / `coach`) comes from Clerk `publicMetadata.role` as the source of truth.

**Microsoft Graph** — calendar data only. Uses client credentials (app-only) flow — no user login required. Called exclusively from the `/api/calendar/sync` route handler. The access token is never stored; it is fetched fresh on each sync.

### Note model

Notes live in three places depending on their scope:

| Scope | Table | When to use |
|---|---|---|
| General client facts | **Users** record | Persistent profile fields (name, birthday, etc.) |
| Coach ↔ client context | **Coach-Person Context** | Quick Notes, Family Details — per coach/person pair (legacy) |
| Session notes | **Coach Session** | Notes captured during or after a specific meeting (legacy) |
| All scoped notes | **Notes** | RC-anchored notes — the spec v2 canonical store |

Session notes written via the dashboard note panel go to the **Notes** table with `Note Type = meeting_note` and a Meeting link. Coach Session records are legacy and not written to for new sessions.

### View modes

Coaches can toggle between **Coach View** (sees only their own clients) and **Admin View** (sees all clients). The toggle is in the sidebar.

- The current mode is stored in the `lt_view_mode` cookie (readable server-side).
- `ViewModeProvider` (client) syncs the cookie with `localStorage` and exposes `useViewMode()`.
- Server components read the cookie directly via `next/headers` cookies to filter data before rendering.

### Calendar sync

`POST /api/calendar/sync` fetches events for all `@leadershiptap.com` coach accounts from the Airtable Users table, syncing from `SYNC_PAST_DAYS` days back to `SYNC_FUTURE_DAYS` days ahead, then upserts them into Portal Calendar Events using `Provider Event ID` as the stable identity key. Events are only synced if the attendee has an active Relationship Context with the calendar owner.

The sync runs hourly as a Render cron job (`render.yaml`) and can also be triggered manually from the Settings page (Clerk session auth) or via the `SYNC_SECRET` header.

---

## Project Structure

```
app/
├── (protected)/
│   ├── layout.tsx            # ViewModeProvider + auth
│   ├── dashboard/            # Main dashboard
│   ├── users/
│   │   ├── page.tsx          # Clients directory
│   │   └── [id]/
│   │       ├── page.tsx      # Client profile
│   │       └── sessions/[meetingId]/   # Session detail
│   ├── people/               # New person onboarding
│   ├── meetings/[id]/        # Meeting detail (coach-view)
│   ├── sessions/             # Sessions list
│   ├── settings/             # Settings + manual calendar sync trigger
│   └── admin/                # Admin-only pages
├── api/
│   ├── calendar/sync/        # Microsoft Graph → Airtable upsert
│   ├── upload-photo/         # Cloudinary → Airtable avatar
│   └── upload-image/         # Cloudinary generic image upload
├── context/
│   └── ViewModeContext.tsx   # Coach/Admin view toggle
└── actions/
    └── viewMode.ts           # Server action: set lt_view_mode cookie

lib/
├── airtable/                 # Low-level Airtable fetch functions (no SDK)
│   ├── users.ts
│   ├── meetings.ts
│   ├── relationships.ts      # Relationship Contexts CRUD + resolveContextForSubject
│   ├── notes.ts
│   ├── tasks.ts
│   ├── messages.ts
│   ├── coachPersonContext.ts
│   ├── coachSessions.ts
│   ├── constants.ts          # Field name constants
│   └── schema.generated.ts  # Auto-generated field IDs (run dump-airtable-schema.ts to refresh)
├── graph/                    # Microsoft Graph helpers
│   ├── auth.ts               # getGraphAccessToken (client credentials)
│   └── calendar.ts           # fetchCalendarEvents
├── services/                 # Business logic (uses lib/airtable/*)
│   ├── usersService.ts
│   ├── meetingsService.ts
│   └── messagesService.ts
└── auth/
    ├── getCurrentUserRecord.ts   # Clerk → Airtable record resolver
    ├── getSessionUser.ts
    ├── isAuthorized.ts
    └── permissions.ts
```

## Deployment

Hosted on **Render**. The web service auto-deploys on push to `main`. A separate Render cron job (`render.yaml`) runs `scripts/sync-calendar.mjs` hourly to keep calendar events up to date.

Add all `.env.local` variables to the Render service's Environment tab. The `SYNC_SECRET` must match between the cron job env and the web service env.
