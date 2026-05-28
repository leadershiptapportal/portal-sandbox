import { currentUser } from '@clerk/nextjs/server'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getConnectedCalendarsByClerkUserId } from '@/lib/airtable/connectedCalendars'
import { getUserById, getPortalUsers } from '@/lib/airtable/users'
import ManageAccountButton from './ManageAccountButton'
import SyncCalendarSection from './SyncCalendarSection'
import { ThemeToggle } from './ThemeToggle'
import { ImpersonateSection } from './ImpersonateSection'

const ROLE_BADGE: Record<string, string> = {
  admin:   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  coach:   'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  client:  'bg-muted text-muted-foreground',
  unknown: 'bg-muted text-muted-foreground',
}

export default async function SettingsPage() {
  const [user, userRecord] = await Promise.all([
    currentUser(),
    getCurrentUserRecord(),
  ])

  const isAdmin = userRecord.role === 'admin'

  const [connectedCalendars, airtableUser, portalUsers] = await Promise.all([
    userRecord.clerkId
      ? getConnectedCalendarsByClerkUserId(userRecord.clerkId)
      : Promise.resolve([]),
    // Use realAirtableId for theme so impersonating admin saves their own preference
    (userRecord.realAirtableId ?? userRecord.airtableId)
      ? getUserById((userRecord.realAirtableId ?? userRecord.airtableId)!)
      : Promise.resolve(null),
    isAdmin ? getPortalUsers() : Promise.resolve([]),
  ])

  const outlookCalendar = connectedCalendars.find((c) => c.provider === 'Outlook')
  const calendarLinked = !!outlookCalendar
  const calendarSetupComplete = !!(outlookCalendar?.selectedCalendarIds?.length)
  const lastSyncedAt = outlookCalendar?.lastSyncedAt

  const rawBaseId = process.env.AIRTABLE_BASE_ID ?? ''
  const maskedBaseId = rawBaseId
    ? rawBaseId.slice(0, 8) + '••••••••'
    : '(not set)'

  return (
    <div className="max-w-2xl mx-auto px-4 md:px-6 py-8">
      <h1 className="text-2xl font-bold text-foreground mb-8">Settings</h1>

      {/* ── My Account ─────────────────────────────────────────────────── */}
      <section className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground mb-4">My Account</h2>
        <div className="flex items-center gap-4">
          {user?.imageUrl ? (
            <img
              src={user.imageUrl}
              alt="Profile photo"
              className="w-16 h-16 rounded-full object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold text-muted-foreground flex-shrink-0">
              {(user?.firstName ?? user?.emailAddresses[0]?.emailAddress ?? '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground text-base">
              {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || '—'}
            </p>
            <p className="text-sm text-muted-foreground mt-0.5">
              {user?.emailAddresses[0]?.emailAddress ?? '—'}
            </p>
          </div>
        </div>

        {/* Access level row */}
        <div className="mt-4 pt-4 border-t border-border space-y-2 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Access Level</span>
            <span className={`font-medium px-2.5 py-0.5 rounded-full text-xs capitalize ${ROLE_BADGE[userRecord.role] ?? ROLE_BADGE.unknown}`}>
              {userRecord.role}
            </span>
          </div>
          {userRecord.airtableId && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Airtable Record</span>
              <code className="font-mono text-xs text-muted-foreground">
                {userRecord.airtableId.slice(0, 10)}…
              </code>
            </div>
          )}
        </div>

        <ManageAccountButton />
      </section>

      {/* ── Appearance ──────────────────────────────────────────────────── */}
      <section className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground mb-1">Appearance</h2>
        <p className="text-sm text-muted-foreground mb-4">Choose your preferred color theme.</p>
        <ThemeToggle initialTheme={airtableUser?.theme} />
      </section>

      {/* ── Admin: Impersonate User ─────────────────────────────────────── */}
      {isAdmin && (
        <section className="bg-card rounded-xl border border-amber-200 dark:border-amber-900/50 p-6 mb-6">
          <h2 className="text-base font-semibold text-foreground mb-1">View as User</h2>
          <ImpersonateSection users={portalUsers} />
        </section>
      )}

      {/* ── Portal Info ─────────────────────────────────────────────────── */}
      <section className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Portal</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Version</span>
            <span className="font-medium text-foreground">v1.0 — April 2026</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Airtable</span>
            <span className="flex items-center gap-2 font-medium text-foreground">
              <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
              Connected
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Hosting</span>
            <a
              href="https://myhumans.app"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-[hsl(213,70%,30%)] dark:text-[hsl(213,70%,65%)] hover:underline"
            >
              myhumans.app ↗
            </a>
          </div>
        </div>
      </section>

      {/* ── Airtable Connection ─────────────────────────────────────────── */}
      <section className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Airtable Connection</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Base ID</span>
            <code className="font-mono text-xs bg-muted text-muted-foreground px-2 py-1 rounded">
              {maskedBaseId}
            </code>
          </div>
          <p className="text-xs text-muted-foreground">
            Data syncs in real-time with Airtable. Changes made here are reflected
            immediately in your Airtable base.
          </p>
        </div>
      </section>

      {/* ── Calendar Sync ───────────────────────────────────────────────── */}
      <section className="bg-card rounded-xl border border-border p-6 mb-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Calendar</h2>
        <SyncCalendarSection
          calendarLinked={calendarLinked}
          calendarSetupComplete={calendarSetupComplete}
          lastSyncedAt={lastSyncedAt}
        />
      </section>

      {/* ── Help & Support ──────────────────────────────────────────────── */}
      <section className="bg-card rounded-xl border border-border p-6">
        <h2 className="text-base font-semibold text-foreground mb-4">Help &amp; Support</h2>
        <div className="space-y-3 text-sm">
          <a
            href="mailto:gsierock@nd.edu"
            className="flex items-center justify-between text-foreground hover:text-[hsl(213,70%,30%)] dark:hover:text-[hsl(213,70%,65%)] transition-colors"
          >
            <span>Report a bug</span>
            <span className="text-muted-foreground">→</span>
          </a>
          <a
            href="mailto:gsierock@nd.edu?subject=LeadershipTap%20Portal%20Support"
            className="flex items-center justify-between text-foreground hover:text-[hsl(213,70%,30%)] dark:hover:text-[hsl(213,70%,65%)] transition-colors"
          >
            <span>Contact support</span>
            <span className="text-muted-foreground">→</span>
          </a>
        </div>
      </section>
    </div>
  )
}
