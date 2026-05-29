import Link from 'next/link'
import { ClipboardList, NotebookPen } from 'lucide-react'
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
            const href = item.humanId
              ? `/myhumans/${item.humanId}/interactions/${item.interactionId}`
              : `/interactions/${item.interactionId}`
            const startTimeLabel = new Date(item.startTime).toLocaleString('en-US', {
              timeZone: item.timezone,
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            })
            return (
              <div
                key={item.interactionId}
                className={`inline-flex flex-col px-3 py-2 rounded-2xl text-sm transition-colors border flex-shrink-0 ${
                  item.isPast
                    ? 'bg-muted/50 border-border text-muted-foreground'
                    : 'bg-card border-border'
                }`}
              >
                <Link href={href} className="flex items-center gap-2 whitespace-nowrap hover:opacity-70 transition-opacity">
                  <span className="text-xs font-medium text-muted-foreground">{startTimeLabel}</span>
                  <span className="font-medium">{item.humanName ?? item.title}</span>
                </Link>
                {item.humanId && (
                  <div className="flex items-center gap-3 mt-1.5">
                    <Link
                      href={`/myhumans/${item.humanId}/take-notes?interactionId=${item.interactionId}&noteCategory=prep`}
                      className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      <ClipboardList className="h-2.5 w-2.5" />
                      Edit Pre-Notes
                    </Link>
                    <Link
                      href={`/myhumans/${item.humanId}/take-notes?interactionId=${item.interactionId}&noteCategory=interaction`}
                      className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
                    >
                      <NotebookPen className="h-2.5 w-2.5" />
                      Edit Interaction Notes
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
          </div>
        </div>
      )}
    </>
  )
}
