import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronRight, Calendar, NotebookPen, FileText } from 'lucide-react'
import BackLink from '@/components/BackLink'
import { getUserById } from '@/lib/services/usersService'
import { getInteractionsForUser } from '@/lib/services/interactionsService'
import { getSessionUser } from '@/lib/auth/getSessionUser'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getPermissionLevel, canWrite } from '@/lib/auth/permissions'
import { formatEastern } from '@/lib/utils/dateFormat'
import type { Interaction } from '@/lib/types'

interface Props {
  params: Promise<{ id: string }>
}

function formatRowDate(m: Interaction): string {
  if (!m.startTime) return ''
  return formatEastern(
    m.startTime,
    { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true },
    m.timezone,
  )
}

function groupByMonth(interactions: Interaction[]): { label: string; items: Interaction[] }[] {
  const groups = new Map<string, Interaction[]>()
  const labels = new Map<string, string>()
  for (const m of interactions) {
    if (!m.startTime) continue
    const d = new Date(m.startTime)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!groups.has(key)) {
      groups.set(key, [])
      labels.set(key, d.toLocaleString('en-US', { month: 'long', year: 'numeric' }))
    }
    groups.get(key)!.push(m)
  }
  return [...groups.entries()].map(([key, items]) => ({ label: labels.get(key) ?? key, items }))
}

export default async function PersonInteractionsPage({ params }: Props) {
  const { id } = await params

  const [user, sessionUser, currentUserRecord] = await Promise.all([
    getUserById(id),
    getSessionUser(),
    getCurrentUserRecord(),
  ])

  if (!user) notFound()

  const contactEmail = user.workEmail ?? user.email
  const displayName =
    user.fullName ??
    ([user.firstName, user.lastName].filter(Boolean).join(' ') || user.email)

  const [{ past, upcoming }, permissionLevel] = await Promise.all([
    getInteractionsForUser(
      contactEmail,
      sessionUser,
      id,
      currentUserRecord.email || undefined,
      displayName,
    ).catch(() => ({ upcoming: [] as Interaction[], past: [] as Interaction[] })),
    getPermissionLevel(currentUserRecord.airtableId, currentUserRecord.role, id),
  ])

  const userCanWrite = canWrite(permissionLevel)

  const pastSorted = [...past].sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  )
  const upcomingSorted = [...upcoming].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
  )

  const totalCount = pastSorted.length + upcomingSorted.length
  const pastGroups = groupByMonth(pastSorted)

  function InteractionRow({ interaction, isFirst }: { interaction: Interaction; isFirst?: boolean }) {
    const meeting = interaction
    return (
      <li className={`relative flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors group ${isFirst ? 'bg-[hsl(213,60%,98%)]' : ''}`}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-slate-900 truncate">
              {meeting.title || 'Untitled Interaction'}
            </p>
            {isFirst && (
              <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-[hsl(213,70%,30%)] text-white">
                Most Recent
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">{formatRowDate(meeting)}</p>
        </div>

        {/* Quick actions */}
        {userCanWrite && (
          <div className="flex items-center gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 sm:opacity-100 transition-opacity">
            <Link
              href={`/myhumans/${id}/take-notes?interactionId=${meeting.id}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-slate-200 text-xs text-slate-500 hover:bg-white hover:border-slate-300 transition-colors"
            >
              <NotebookPen className="h-3 w-3 text-[hsl(213,70%,40%)]" />
              Take Notes
            </Link>
          </div>
        )}

        {/* Navigate to detail */}
        <Link
          href={`/myhumans/${id}/interactions/${meeting.id}`}
          className="absolute inset-0"
          aria-label={`View ${meeting.title || 'interaction'}`}
        />
        <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors relative z-10 pointer-events-none" />
      </li>
    )
  }

  return (
    <div className="px-4 py-5 md:p-8 max-w-3xl mx-auto space-y-6">
      <BackLink fallbackHref={`/myhumans/${id}`} label={`Back to ${displayName}`} />

      <div>
        <h1 className="text-2xl font-bold text-slate-900">All Interactions</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {displayName} · {totalCount} interaction{totalCount !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Upcoming */}
      {upcomingSorted.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">
            Upcoming
          </p>
          <ul className="bg-white rounded-xl shadow-sm divide-y divide-slate-100 overflow-hidden">
            {upcomingSorted.map((m) => (
              <InteractionRow key={m.id} interaction={m} />
            ))}
          </ul>
        </div>
      )}

      {/* Past — grouped by month */}
      {pastGroups.length > 0 ? (
        <div className="space-y-5">
          {pastGroups.map(({ label, items }, groupIdx) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2 px-1">
                {label}
              </p>
              <ul className="bg-white rounded-xl shadow-sm divide-y divide-slate-100 overflow-hidden">
                {items.map((m, itemIdx) => (
                  <InteractionRow
                    key={m.id}
                    interaction={m}
                    isFirst={groupIdx === 0 && itemIdx === 0}
                  />
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm p-10 text-center">
          <Calendar className="h-8 w-8 text-slate-200 mx-auto mb-3" />
          <p className="text-sm font-medium text-slate-600">No past interactions yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Interactions will appear here once they&apos;re recorded or synced from your calendar.
          </p>
        </div>
      )}
    </div>
  )
}
