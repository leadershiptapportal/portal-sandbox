import { TABLES, FIELDS } from '@/lib/airtable/constants'
import { airtableFetch } from '@/lib/airtable/client'
import { getHumans } from '@/lib/services/humansService'
import { formatEastern } from '@/lib/utils/dateFormat'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getAllRecentNotes } from '@/lib/airtable/notes'
import { getAllOpenTasks } from '@/lib/airtable/tasks'
import { fetchProfileOptions, getAllHumans } from '@/lib/airtable/humans'
import PageHeader from '@/components/layout/PageHeader'
import HumansGrid, { type EnrichedHuman } from './HumansGrid'
import type { Human } from '@/lib/types'

function getDisplayName(user: Human): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.workEmail ?? ''
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
  const formula = encodeURIComponent(`AND(LOWER({${FIELDS.INTERACTIONS.CALENDAR_OWNER}})="${safeEmail}",{${FIELDS.INTERACTIONS.CLIENT_NAME}}!="")`)
  const res = await airtableFetch(
    `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(TABLES.INTERACTIONS)}` +
      `?filterByFormula=${formula}` +
      `&fields[]=${encodeURIComponent(FIELDS.INTERACTIONS.CLIENT_NAME)}&fields[]=${encodeURIComponent(FIELDS.INTERACTIONS.START)}&fields[]=${encodeURIComponent(FIELDS.INTERACTIONS.END)}` +
      `&sort%5B0%5D%5Bfield%5D=${encodeURIComponent(FIELDS.INTERACTIONS.START)}&sort%5B0%5D%5Bdirection%5D=desc` +
      `&maxRecords=2000`,
    { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store' },
  )
  if (!res.ok) return []
  const data = await res.json()
  return (data.records ?? []).map((r: { fields: Record<string, unknown> }) => ({
    humanName: (r.fields[FIELDS.INTERACTIONS.CLIENT_NAME] as string) ?? '',
    startTime: (r.fields[FIELDS.INTERACTIONS.START] as string) ?? '',
    endTime: (r.fields[FIELDS.INTERACTIONS.END] as string) ?? '',
  }))
}

export default async function UsersPage() {
  const [sessionUser, userRecord] = await Promise.all([
    getSessionUser(),
    getCurrentUserRecord(),
  ])

  const isAdmin = userRecord.role === 'admin'
  const filterByCoachId = isAdmin ? undefined : (userRecord.airtableId ?? undefined)

  const [users, allRecentNotes, openTasks, allHumansForOptions, coachInteractions] = await Promise.all([
    getHumans(sessionUser, filterByCoachId),
    getAllRecentNotes(300),
    getAllOpenTasks(),
    getAllHumans(),
    userRecord.email ? getCoachCalendarInteractions(userRecord.email) : Promise.resolve([]),
  ])

  const profileOptions = await fetchProfileOptions(allHumansForOptions)

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

  const enrichedHumans: EnrichedHuman[] = users.map((user) => {
    const displayNameLower = getDisplayName(user).toLowerCase()
    return {
      user,
      noteCount: noteCountByUser.get(user.id) ?? 0,
      openTaskCount: openTaskCountByUser.get(user.id) ?? 0,
      interactionCount: 0,
      lastInteraction: lastInteractionByName.get(displayNameLower) ?? null,
      nextInteraction: nextInteractionByName.get(displayNameLower) ?? null,
    }
  })

  const humansWithOpenTasks = users.filter((u) => (openTaskCountByUser.get(u.id) ?? 0) > 0).length
  const statParts = [
    `${users.length} ${users.length !== 1 ? 'humans' : 'human'}`,
    humansWithOpenTasks > 0 ? `${humansWithOpenTasks} with open tasks` : null,
  ].filter(Boolean)
  const description = statParts.join('  ·  ')

  return (
    <>
      <PageHeader
        title="My Humans"
        description={description}
      />
      <HumansGrid
        users={enrichedHumans}
        coaches={profileOptions.coaches}
        organizations={profileOptions.organizations}
        currentCoachId={userRecord.airtableId ?? undefined}
        currentCoachName={userRecord.name}
      />
    </>
  )
}
