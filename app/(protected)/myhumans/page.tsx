import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { airtableFetch } from '@/lib/airtable/client'
import { getUsers } from '@/lib/services/usersService'
import { formatEastern } from '@/lib/utils/dateFormat'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getAllRecentNotes } from '@/lib/airtable/notes'
import { getAllOpenTasks } from '@/lib/airtable/tasks'
import { fetchProfileOptions, getAllUsers } from '@/lib/airtable/users'
import PageHeader from '@/components/layout/PageHeader'
import HumansGrid, { type EnrichedHuman } from './HumansGrid'
import type { User } from '@/lib/types'

function getDisplayName(user: User): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.email
}

function formatInteractionDate(iso: string): string {
  return formatEastern(iso, { month: 'short', day: 'numeric' })
}

// Fetch all Interactions for one coach — only the fields needed
// for last/next interaction computation. One call, filtered server-side.
interface CoachInteraction {
  humanName: string
  startTime: string
  endTime: string
}

async function getCoachCalendarInteractions(ownerEmail: string): Promise<CoachInteraction[]> {
  const apiKey = process.env.AIRTABLE_API_KEY
  const baseId = process.env.AIRTABLE_BASE_ID
  if (!apiKey || !baseId) return []
  const safeEmail = ownerEmail.toLowerCase().replace(/"/g, '\\"')
  const formula = encodeURIComponent(`AND(LOWER({${FIELDS.MEETINGS.CALENDAR_OWNER}})="${safeEmail}",{${FIELDS.MEETINGS.CLIENT_NAME}}!="")`)
  const res = await airtableFetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLES.MEETINGS)}` +
      `?filterByFormula=${formula}` +
      `&fields[]=${encodeURIComponent(FIELDS.MEETINGS.CLIENT_NAME)}&fields[]=${encodeURIComponent(FIELDS.MEETINGS.START)}&fields[]=${encodeURIComponent(FIELDS.MEETINGS.END)}` +
      `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.MEETINGS.START)}&sort%5B0%5D%5Bdirection%5D=desc` +
      `&maxRecords=2000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map((r: { fields: Record<string, unknown> }) => ({
    humanName: (r.fields[FIELDS.MEETINGS.CLIENT_NAME] as string) ?? '',
    startTime: (r.fields[FIELDS.MEETINGS.START] as string) ?? '',
    endTime: (r.fields[FIELDS.MEETINGS.END] as string) ?? '',
  }))
}

export default async function UsersPage() {
  const [sessionUser, userRecord] = await Promise.all([
    getSessionUser(),
    getCurrentUserRecord(),
  ])

  const isAdmin = userRecord.role === 'admin'
  const filterByCoachId = isAdmin ? undefined : (userRecord.airtableId ?? undefined)

  const [users, allRecentNotes, openTasks, allUsersForOptions, coachInteractions] = await Promise.all([
    getUsers(sessionUser, filterByCoachId),
    getAllRecentNotes(300),
    getAllOpenTasks(),
    getAllUsers(),
    userRecord.email ? getCoachCalendarInteractions(userRecord.email) : Promise.resolve([]),
  ])

  const profileOptions = await fetchProfileOptions(allUsersForOptions)

  // ── Notes count per user ─────────────────────────────────────────────────
  const noteCountByUser = new Map<string, number>()
  for (const note of allRecentNotes) {
    const personId = note.subjectPersonId ?? note.humanId
    if (!personId) continue
    noteCountByUser.set(personId, (noteCountByUser.get(personId) ?? 0) + 1)
  }

  // ── Open tasks count per user ────────────────────────────────────────────
  const openTaskCountByUser = new Map<string, number>()
  for (const task of openTasks) {
    if (!task.assignedToPersonId) continue
    openTaskCountByUser.set(task.assignedToPersonId, (openTaskCountByUser.get(task.assignedToPersonId) ?? 0) + 1)
  }

  // ── Last & next interaction per client name ──────────────────────────────────
  // coachInteractions is sorted Start DESC: future events first, then past.
  // For nextInteraction (nearest upcoming): overwrite on each future event → ends on nearest.
  // For lastInteraction (most recent past): only set once on first past event encountered.
  const now = new Date()
  const lastInteractionByName = new Map<string, string>() // name → formatted date
  const nextInteractionByName = new Map<string, string>()

  for (const interaction of coachInteractions) {
    if (!interaction.startTime) continue
    const start = new Date(interaction.startTime)
    const end = interaction.endTime ? new Date(interaction.endTime) : start
    // Split comma-separated client names (set during sync for multi-client events)
    const names = interaction.humanName.split(',').map((n) => n.trim().toLowerCase()).filter(Boolean)

    for (const name of names) {
      if (end < now) {
        // Past event — first one encountered (DESC order) is most recent
        if (!lastInteractionByName.has(name)) {
          lastInteractionByName.set(name, formatInteractionDate(interaction.startTime))
        }
      } else if (start > now) {
        // Future event — overwrite to keep nearest (we walk from far future → near future)
        nextInteractionByName.set(name, formatInteractionDate(interaction.startTime))
      }
    }
  }

  // ── Enrich users — interaction count from linked "Associated Meetings" field ──
  const enrichedHumans: EnrichedHuman[] = users.map((user) => {
    const interactionCount = user.associatedMeetingIds?.length ?? 0
    const displayNameLower = getDisplayName(user).toLowerCase()
    return {
      user,
      noteCount: noteCountByUser.get(user.id) ?? 0,
      openTaskCount: openTaskCountByUser.get(user.id) ?? 0,
      interactionCount,
      lastInteraction: lastInteractionByName.get(displayNameLower) ?? null,
      nextInteraction: nextInteractionByName.get(displayNameLower) ?? null,
    }
  })

  console.log('[ClientsPage] Users with interaction counts:',
    users.map((u) => ({
      name: getDisplayName(u),
      interactionCount: u.associatedMeetingIds?.length ?? 0,
      associatedMeetings: u.associatedMeetingIds,
    }))
  )

  // ── Header stats (Part G) ────────────────────────────────────────────────
  const coachCount = users.filter((u) => u.role?.toLowerCase() === 'coach').length
  const humansWithOpenTasks = users.filter((u) => (openTaskCountByUser.get(u.id) ?? 0) > 0).length

  const statParts = [
    `${users.length} ${users.length !== 1 ? 'people' : 'person'}`,
    coachCount > 0 ? `${coachCount} coach${coachCount !== 1 ? 'es' : ''}` : null,
    humansWithOpenTasks > 0 ? `${humansWithOpenTasks} with open tasks` : null,
  ].filter(Boolean)

  const description =
    process.env.NODE_ENV === 'development'
      ? `${userRecord.role} view  ·  ${statParts.join('  ·  ')}`
      : statParts.join('  ·  ')

  // ── Coaches for filter dropdown and Add Client dialog ────────────────────
  const coaches = users
    .filter((u) => u.role?.toLowerCase() === 'coach')
    .map((u) => ({ id: u.id, name: getDisplayName(u) }))

  console.log('[ClientsPage] role:', userRecord.role, '— airtableId:', userRecord.airtableId, '— showing:', users.length, 'clients')

  return (
    <>
      <PageHeader
        title="My People"
        description={description}
      />
      <HumansGrid
        users={enrichedHumans}
        coaches={coaches}
        companies={profileOptions.companies}
      />
    </>
  )
}
