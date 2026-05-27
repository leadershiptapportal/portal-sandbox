import Link from 'next/link'
import { CalendarDays, FileText } from 'lucide-react'
import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { airtableFetch } from '@/lib/airtable/client'
import { log } from '@/lib/utils/logger'
import { getUsers, getHumansByRelationship } from '@/lib/services/usersService'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllUpcomingInteractions, getRecentPastInteractions } from '@/lib/airtable/interactions'
import { buildEmailToUserMap } from '@/lib/services/interactionsService'
import { getNotesByAuthor } from '@/lib/airtable/notes'
import { getDateInTimezone, resolveDisplayTz } from '@/lib/utils/dateFormat'
import { interactionsToUpcomingItems } from './interactionMappers'
import type { CurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'

interface PortalCalendarEvent {
  id: string
  subject: string
  start: string
  timezone: string
}

async function getUpcomingPortalEvents(ownerEmail: string): Promise<PortalCalendarEvent[]> {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) return []

  const now = new Date()
  const cutoff = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
  const safeOwner = ownerEmail.toLowerCase().replace(/"/g, '\\"')
  const formula = encodeURIComponent(
    `AND(IS_AFTER({${FIELDS.INTERACTIONS.START}}, "${now.toISOString()}"), IS_BEFORE({${FIELDS.INTERACTIONS.START}}, "${cutoff.toISOString()}"), LOWER({${FIELDS.INTERACTIONS.CALENDAR_OWNER}}) = "${safeOwner}")`,
  )
  try {
    const res = await airtableFetch(
      `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLES.INTERACTIONS)}?filterByFormula=${formula}&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.INTERACTIONS.START)}&sort%5B0%5D%5Bdirection%5D=asc&maxRecords=10`,
      { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
    )
    if (!res.ok) {
      log.error('[getUpcomingPortalEvents] failed status:', res.status, await res.text())
      return []
    }
    const data = await res.json()
    return (data.records ?? []).map((r: { id: string; fields: Record<string, unknown> }) => ({
      id: r.id,
      subject: (r.fields[FIELDS.INTERACTIONS.TITLE] as string) ?? '(No Subject)',
      start: (r.fields[FIELDS.INTERACTIONS.START] as string) ?? '',
      timezone: resolveDisplayTz(r.fields[FIELDS.INTERACTIONS.TIMEZONE] as string | undefined),
    })).filter((e: PortalCalendarEvent) => e.start)
  } catch {
    return []
  }
}

interface Props {
  userRecord: CurrentUserRecord
}

export default async function ComingUpNextRegion({ userRecord }: Props) {
  const sessionUser = await getSessionUser()
  const isAdmin = userRecord.role === 'admin'
  const ownerEmail = userRecord.email || undefined

  const [users, upcomingInteractions, pastDay, coachContexts, coachNotes, portalEvents] =
    await Promise.all([
      isAdmin || !userRecord.airtableId
        ? getUsers(sessionUser)
        : getHumansByRelationship(userRecord.airtableId),
      getAllUpcomingInteractions(7, ownerEmail),
      getRecentPastInteractions(1, ownerEmail),
      !isAdmin && userRecord.airtableId
        ? getRelationshipContexts(userRecord.airtableId)
        : Promise.resolve([]),
      userRecord.airtableId
        ? getNotesByAuthor(userRecord.airtableId)
        : Promise.resolve([]),
      isAdmin && ownerEmail ? getUpcomingPortalEvents(ownerEmail) : Promise.resolve([]),
    ])

  const emailToUser = buildEmailToUserMap(users)
  const now = new Date()
  const notedInteractionIds = new Set(coachNotes.map((n) => n.interactionId).filter(Boolean) as string[])
  const activeContextIds = isAdmin ? null : new Set(coachContexts.map((c) => c.id))
  const coachEmail = sessionUser?.email?.toLowerCase() ?? ''

  const mapOpts = { emailToUser, notedInteractionIds, coachEmail, activeContextIds }
  const upcomingItems = interactionsToUpcomingItems(upcomingInteractions, mapOpts)
  const pastDayItems = interactionsToUpcomingItems(pastDay, mapOpts)

  const todayStr = getDateInTimezone(now.toISOString())
  const futureToday = upcomingItems.filter(
    (item) => getDateInTimezone(item.startTime, resolveDisplayTz(item.timezone)) === todayStr,
  )
  const pastToday = pastDayItems.filter(
    (item) => getDateInTimezone(item.startTime, resolveDisplayTz(item.timezone)) === todayStr,
  )

  const allTodayItems = [
    ...pastToday.map((i) => ({ ...i, isPast: true })),
    ...futureToday.map((i) => ({ ...i, isPast: false })),
  ]

  return (
    <>
      {/* ── Today's Agenda chips ─────────────────────────────────────────────── */}
      {allTodayItems.length > 0 && (
        <div className="mb-4 md:mb-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Today&apos;s Agenda
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {allTodayItems.map((item) => {
            const needsNotes = item.isPast && !item.hasNote
            const inner = (
              <span
                className={`inline-flex items-center gap-2 whitespace-nowrap px-3 py-1.5 rounded-full text-sm transition-colors border ${
                  item.isPast
                    ? needsNotes
                      ? 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                      : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                    : 'bg-white border-slate-200 hover:border-[hsl(213,60%,70%)] hover:text-[hsl(213,70%,30%)]'
                }`}
                title={item.title}
              >
                <span className="text-xs font-medium text-slate-400">{item.timeRange}</span>
                <span className="font-medium">{item.humanName ?? item.title}</span>
                {needsNotes && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide">
                    <FileText className="h-3 w-3" />
                    Note
                  </span>
                )}
              </span>
            )
            const href = item.humanId
              ? `/myhumans/${item.humanId}/interactions/${item.interactionId}`
              : `/interactions/${item.interactionId}`
            return (
              <Link key={item.interactionId} href={href}>
                {inner}
              </Link>
            )
          })}
          </div>
        </div>
      )}

      {/* ── Upcoming Sessions (admin only, from Calendar) ────────────────────── */}
      {isAdmin && portalEvents.length > 0 && (
        <div className="mb-4 md:mb-5 bg-white rounded-xl shadow-sm p-4 md:p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="h-5 w-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-900">Upcoming Interactions (from Calendar)</h2>
            <span className="ml-auto text-xs text-slate-400 font-medium">
              {portalEvents.length} {portalEvents.length === 1 ? 'event' : 'events'}
            </span>
          </div>
          <div className="divide-y divide-slate-100">
            {portalEvents.map((event) => (
              <div key={event.id} className="py-3 flex items-center gap-3">
                <div className="flex-shrink-0 text-center w-10">
                  <p className="text-xs font-medium text-slate-400 uppercase">
                    {new Date(event.start).toLocaleString('en-US', { timeZone: event.timezone, month: 'short' })}
                  </p>
                  <p className="text-lg font-bold text-slate-900 leading-none">
                    {new Date(event.start).toLocaleString('en-US', { timeZone: event.timezone, day: 'numeric' })}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{event.subject}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {new Date(event.start).toLocaleString('en-US', {
                      timeZone: event.timezone,
                      weekday: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })} ET
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
