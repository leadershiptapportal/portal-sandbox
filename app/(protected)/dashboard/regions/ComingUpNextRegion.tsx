import Link from 'next/link'
import { FileText } from 'lucide-react'
import { getUsers, getHumansByRelationship } from '@/lib/services/usersService'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllUpcomingInteractions, getRecentPastInteractions } from '@/lib/airtable/interactions'
import { buildEmailToUserMap } from '@/lib/services/interactionsService'
import { getNotesByAuthor } from '@/lib/airtable/notes'
import { getDateInTimezone, resolveDisplayTz } from '@/lib/utils/dateFormat'
import { interactionsToUpcomingItems } from './interactionMappers'
import type { CurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'

interface Props {
  userRecord: CurrentUserRecord
}

export default async function ComingUpNextRegion({ userRecord }: Props) {
  const sessionUser = await getSessionUser()
  const isAdmin = userRecord.role === 'admin'
  const ownerEmail = userRecord.email || undefined

  const [users, upcomingInteractions, pastDay, coachContexts, coachNotes] =
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
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
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
                      : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                    : 'bg-card border-border hover:border-[hsl(213,60%,70%)] hover:text-[hsl(213,70%,30%)]'
                }`}
                title={item.title}
              >
                <span className="text-xs font-medium text-muted-foreground">{item.timeRange}</span>
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
    </>
  )
}
