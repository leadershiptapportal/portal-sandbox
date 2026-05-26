import { getUsers, getClientsByRelationship } from '@/lib/services/usersService'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getAllUpcomingMeetings, getRecentPastMeetings } from '@/lib/airtable/meetings'
import { buildEmailToUserMap } from '@/lib/services/meetingsService'
import { getNotesByAuthor } from '@/lib/airtable/notes'
import { meetingsToUpcomingItems } from './meetingMappers'
import InteractionsCard from '../InteractionsCard'
import type { CurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'

interface Props {
  userRecord: CurrentUserRecord
}

export default async function UpcomingThisWeekRegion({ userRecord }: Props) {
  const sessionUser = await getSessionUser()
  const isAdmin = userRecord.role === 'admin'
  const ownerEmail = userRecord.email || undefined

  const [users, upcomingMeetings, recentMeetings, coachContexts, coachNotes] = await Promise.all([
    isAdmin || !userRecord.airtableId
      ? getUsers(sessionUser)
      : getClientsByRelationship(userRecord.airtableId),
    getAllUpcomingMeetings(30, ownerEmail),
    getRecentPastMeetings(30, ownerEmail),
    !isAdmin && userRecord.airtableId
      ? getRelationshipContexts(userRecord.airtableId)
      : Promise.resolve([]),
    userRecord.airtableId
      ? getNotesByAuthor(userRecord.airtableId)
      : Promise.resolve([]),
  ])

  const emailToUser = buildEmailToUserMap(users)
  const notedMeetingIds = new Set(coachNotes.map((n) => n.meetingId).filter(Boolean) as string[])
  const activeContextIds = isAdmin ? null : new Set(coachContexts.map((c) => c.id))
  const coachEmail = sessionUser?.email?.toLowerCase() ?? ''

  const mapOpts = { emailToUser, notedMeetingIds, coachEmail, activeContextIds }
  const now = new Date()

  const upcomingItems = meetingsToUpcomingItems(upcomingMeetings, mapOpts)
    .filter((item) => new Date(item.startTime) >= now)
    .slice(0, 10)

  const recentItems = meetingsToUpcomingItems(recentMeetings, mapOpts)
    .filter((item) => new Date(item.startTime) < now)
    .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
    .slice(0, 10)

  return <InteractionsCard recentItems={recentItems} upcomingItems={upcomingItems} />
}
