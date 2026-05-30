import { Calendar } from 'lucide-react'
import { getHumans, getHumansByRelationship } from '@/lib/services/humansService'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllUpcomingInteractions, getRecentPastInteractions } from '@/lib/airtable/interactions'
import { buildEmailToUserMap } from '@/lib/services/interactionsService'
import { getNotesByAuthor } from '@/lib/airtable/notes'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { interactionsToUpcomingItems } from '../dashboard/regions/interactionMappers'
import InteractionsList from './InteractionsList'

const PAST_DAYS = 90
const FUTURE_DAYS = 60

type Filter = 'needs-notes' | 'upcoming' | 'past' | 'all'

function parseFilter(raw: string | undefined): Filter {
  if (raw === 'upcoming' || raw === 'past' || raw === 'all') return raw
  return 'needs-notes'
}

interface Props {
  searchParams: Promise<{ filter?: string }>
}

export default async function InteractionsIndexPage({ searchParams }: Props) {
  const { filter: filterParam } = await searchParams
  const initialFilter = parseFilter(filterParam)

  const [sessionUser, userRecord] = await Promise.all([
    getSessionUser(),
    getCurrentUserRecord(),
  ])

  const isAdmin = userRecord.role === 'admin'
  const ownerEmail = userRecord.email || undefined

  const [users, upcomingInteractions, pastInteractions, coachContexts, coachNotes] = await Promise.all([
    isAdmin || !userRecord.airtableId
      ? getHumans(sessionUser)
      : getHumansByRelationship(userRecord.airtableId),
    getAllUpcomingInteractions(FUTURE_DAYS, ownerEmail),
    getRecentPastInteractions(PAST_DAYS, ownerEmail),
    !isAdmin && userRecord.airtableId
      ? getRelationshipContexts(userRecord.airtableId)
      : Promise.resolve([]),
    userRecord.airtableId
      ? getNotesByAuthor(userRecord.airtableId)
      : Promise.resolve([]),
  ])

  const emailToUser = buildEmailToUserMap(users)
  const notedInteractionIds = new Set(coachNotes.map((n) => n.interactionId).filter(Boolean) as string[])
  const activeContextIds = isAdmin ? null : new Set(coachContexts.map((c) => c.id))
  const coachEmail = sessionUser?.email?.toLowerCase() ?? ''

  // Human list for the Log Interaction dialog
  const humans = users.map((u) => ({
    id: u.id,
    name: u.fullName || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.workEmail || 'Unknown',
  }))

  const upcomingItems = interactionsToUpcomingItems(upcomingInteractions, {
    emailToUser,
    notedInteractionIds,
    coachEmail,
    activeContextIds,
  }).map((i) => ({ ...i, startMs: new Date(i.startTime).getTime(), isPast: false }))

  const pastItems = interactionsToUpcomingItems(pastInteractions, {
    emailToUser,
    notedInteractionIds,
    coachEmail,
    activeContextIds,
  }).map((i) => ({ ...i, startMs: new Date(i.startTime).getTime(), isPast: true }))

  // Combined, dedup by interactionId in case sync window overlaps
  const seen = new Set<string>()
  const combined = [...upcomingItems, ...pastItems].filter((i) => {
    if (seen.has(i.interactionId)) return false
    seen.add(i.interactionId)
    return true
  })

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center gap-2">
        <Calendar className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Interactions</h1>
        <span className="ml-auto text-sm text-muted-foreground">
          {combined.length} interaction{combined.length === 1 ? '' : 's'}
        </span>
      </div>

      <InteractionsList items={combined} initialFilter={initialFilter} humans={humans} />
    </div>
  )
}
