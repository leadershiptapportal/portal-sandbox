# LeadershipTap Portal

An internal coaching portal for the LeadershipTap team. Coaches use it to track client relationships, session notes, interactions, and follow-up tasks. Built with Next.js, Clerk, and Airtable.

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, React 19) |
| Auth | Clerk v7 (Microsoft 365 / Google SSO) |
| Calendar | Microsoft Graph API (app-only, reads coach calendar events) |
| Data | Airtable (server-side only — API key never reaches the browser) |
| UI | Tailwind CSS v4 + shadcn/ui (Radix) |
| Canvas notes | tldraw + perfect-freehand |
| File uploads | Cloudinary (profile photos, ink images) |
| Hosting | Render (web service + hourly cron) |

## Prerequisites

- Node.js 18+
- A [Clerk](https://clerk.com) account with an application created
- An Airtable base with the LeadershipTap schema and a Personal Access Token
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
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...
AZURE_CLIENT_SECRET=...

# Calendar sync tuning (optional — defaults shown)
SYNC_SECRET=...                   # Shared secret for cron-triggered syncs
SYNC_PAST_DAYS=90
SYNC_FUTURE_DAYS=60

# Cloudinary (profile photo and ink image uploads)
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
| **Humans** | All people — coaches, admins, clients. `Role` field distinguishes them. |
| **Portal Calendar Events** | Active calendar table. Synced from Microsoft Graph via `/api/calendar/sync`. |
| **Relationship Contexts** | Per coach ↔ client pair: type (`coaching` or `reports_to`), status, start date. The join table for all coach-scoped queries. |
| **Interactions** | Logged sessions between a coach and client, linked to a meeting or created manually. |
| **Notes** | All coaching notes — general context, prep notes, meeting notes — anchored to a Relationship Context. |
| **Messages** | Follow-up email drafts. Status: `"Pending"` or `"Sent"` (never `"Draft"`). |
| **Tasks** | Portal action items linked to clients. |
| **Companies** | Company records linked from Humans. |
| **Connected Calendars** | OAuth calendar connections per coach (for future calendar sync improvements). |
| **Permission Profiles** | Single "standard" profile record — scaffold for v2 permission model. |
| **Enneagram / 16Personalities / Conflict Postures / Apology Languages / Strengths** | Lookup tables for personality fields on Human profiles. |
| **Calendar Events** | Archived — historical snapshot only. Never queried by the portal. |

### Auth

**Clerk** handles app login. Every browser session is authenticated via Clerk. `getCurrentUserRecord()` resolves the Clerk session to an Airtable Human record by email. Role (`admin` / `coach`) comes from Clerk `publicMetadata.role` as the source of truth.

**Microsoft Graph** is used for calendar data only, via client credentials (app-only) flow — no user OAuth needed. Called exclusively from `/api/calendar/sync`. The access token is fetched fresh on each sync and never stored.

### Note model

Notes always go to the **Notes** table, anchored to a Relationship Context. `Note Type` determines the kind:

| Note Type | When used |
|---|---|
| `general_context` | General coaching notes from the dashboard or profile |
| `meeting_note` | Notes attached to a specific interaction/meeting |
| `prep_note` | Pre-session preparation notes |

### View modes

Coaches can toggle between **Coach View** (own clients only) and **Admin View** (all clients). The toggle is in the sidebar.

- Current mode is stored in the `lt_view_mode` cookie (readable server-side).
- `ViewModeProvider` (client component) syncs the cookie with `localStorage` and exposes `useViewMode()`.
- Server components read the cookie directly via `next/headers` to filter data before rendering.

### Calendar sync

`POST /api/calendar/sync` fetches events for all `@leadershiptap.com` coaches from Microsoft Graph and upserts them into Portal Calendar Events using `Provider Event ID` as the dedup key. It runs hourly via a Render cron job and can be triggered manually from the Settings page.

---

## Project Structure

```
app/
├── (protected)/
│   ├── layout.tsx                  # ViewModeProvider + auth wrapper
│   ├── dashboard/                  # Main coaching dashboard
│   ├── myhumans/                   # People directory
│   │   ├── page.tsx                # Grid of coach's clients
│   │   └── [id]/                   # Person profile
│   │       ├── page.tsx
│   │       ├── interactions/       # Interaction detail view
│   │       ├── take-notes/         # Split-panel session note-taking (typed + canvas)
│   │       ├── messages/           # Message drafts for this person
│   │       └── notes/              # Notes list for this person
│   ├── interactions/               # All interactions list
│   ├── meetings/                   # Calendar meetings list
│   │   └── [eventId]/              # Meeting detail
│   ├── people/
│   │   └── new/                    # New person onboarding form
│   ├── settings/                   # Account settings + calendar setup
│   └── admin/                      # Admin-only pages (profiles, relationships, users)
├── api/
│   ├── calendar/sync/              # Microsoft Graph → Portal Calendar Events upsert
│   ├── humans/                     # Human record CRUD
│   ├── notes/                      # Notes CRUD
│   ├── people/                     # People-related endpoints
│   ├── permissions/                # Permission checks
│   ├── search/                     # Global search
│   ├── upload-photo/               # Cloudinary → Airtable avatar
│   └── upload-image/               # Cloudinary generic image upload (ink notes)
├── context/
│   └── ViewModeContext.tsx         # Coach/Admin view toggle
└── actions/
    └── viewMode.ts                 # Server action: set lt_view_mode cookie

lib/
├── airtable/                       # Low-level Airtable fetch functions (direct fetch, no SDK mutations)
│   ├── humans.ts                   # Humans table CRUD
│   ├── interactions.ts             # Interactions table
│   ├── meetings.ts                 # Portal Calendar Events (single source of truth for meetings)
│   ├── notes.ts                    # Notes table
│   ├── messages.ts                 # Messages table
│   ├── tasks.ts                    # Tasks table
│   ├── relationships.ts            # Relationship Contexts CRUD + resolveContextForSubject
│   ├── calendarEvents.ts           # Connected calendar events
│   ├── connectedCalendars.ts       # OAuth calendar connections
│   ├── permissionProfiles.ts       # Permission profiles lookup
│   ├── constants.ts                # Field name string constants
│   └── schema.generated.ts        # Auto-generated field IDs (run dump-airtable-schema.ts to refresh)
├── microsoft/                      # Microsoft Graph helpers
│   ├── auth.ts                     # getGraphAccessToken (client credentials flow)
│   └── graph.ts                    # fetchCalendarEvents
├── services/                       # Business logic layer (composes lib/airtable/*)
│   ├── humansService.ts
│   ├── interactionsService.ts
│   ├── meetingsService.ts
│   └── messagesService.ts
└── auth/
    ├── getCurrentUserRecord.ts     # Clerk session → Airtable Human record resolver
    ├── getSessionUser.ts
    ├── isAuthorized.ts
    ├── permissions.ts
    ├── impersonation.ts
    └── requireCurrentPortalPerson.ts

components/                         # Shared UI components
scripts/
├── dump-airtable-schema.ts         # Regenerates lib/airtable/schema.generated.ts from live Airtable schema
└── sync-calendar.mjs               # Entry point for the Render cron calendar sync job
middleware.ts                       # Clerk route protection middleware
```

---

## Key Conventions

- **All Airtable access is server-side only** — API key must never reach the browser.
- **Mutations use direct `fetch()`** to the Airtable REST API — no SDK (SDK doesn't support PATCH cleanly).
- **Server actions** live in `actions.ts` co-located with the page or component that uses them.
- **Upsert pattern**: fetch existing record(s) → filter in JS → PATCH if found, POST if not. See `lib/airtable/relationships.ts` for the pattern.
- **Never write to formula or read-only fields**: `Full Name`, `Calculation`, `Created`, `Company Name`, `Company ID`.
- **Message status**: always `"Pending"` for unsent drafts. Never `"Draft"`.
- **Profile photos** upload via browser → `/api/upload-photo` → Cloudinary → Airtable PATCH `Avatar URL`.

---

## Deployment

Hosted on **Render**. The web service auto-deploys on push to `main`.

A separate Render cron job (`render.yaml`) runs `scripts/sync-calendar.mjs` hourly to keep Portal Calendar Events up to date. The cron job authenticates to the web service via the `SYNC_SECRET` header.

Add all `.env.local` variables to the Render service's Environment tab. `SYNC_SECRET` must match between the cron job env and the web service env.
