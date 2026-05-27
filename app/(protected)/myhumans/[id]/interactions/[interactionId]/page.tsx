import Link from 'next/link'
import { Calendar, Clock, Users, CheckSquare, NotebookPen } from 'lucide-react'
import BackLink from '@/components/BackLink'
import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/services/usersService'
import { getInteractionById } from '@/lib/airtable/interactions'
import { getCoachSession } from '@/lib/airtable/coachSessions'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getMostRecentInteractionNoteByClient } from '@/lib/airtable/notes'
import { formatEastern, resolveDisplayTz } from '@/lib/utils/dateFormat'
import InteractionNotesEditor from './InteractionNotesEditor'
import LastInteractionNotesDialog from '@/components/LastInteractionNotesDialog'

interface Props {
  params: Promise<{ id: string; interactionId: string }>
}

function formatDateTime(iso: string, timezone?: string): string {
  return formatEastern(iso, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }, resolveDisplayTz(timezone))
}

function formatTime(iso: string, timezone?: string): string {
  return formatEastern(iso, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }, resolveDisplayTz(timezone))
}

const SESSION_STATUS_STYLES: Record<string, string> = {
  Completed:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  Scheduled:  'bg-blue-50 text-blue-700 border-blue-200',
  Cancelled:  'bg-rose-50 text-rose-700 border-rose-200',
}

export default async function InteractionDetailPage({ params }: Props) {
  const { id, interactionId } = await params

  const [user, interaction, currentUserRecord] = await Promise.all([
    getUserById(id),
    getInteractionById(interactionId),
    getCurrentUserRecord(),
  ])

  if (!interaction) notFound()

  const [coachSession, lastInteractionNote] = await Promise.all([
    currentUserRecord.airtableId
      ? getCoachSession(currentUserRecord.airtableId, interactionId).catch(() => null)
      : Promise.resolve(null),
    getMostRecentInteractionNoteByClient(id, interactionId),
  ])

  // Show coach session notes when available; fall back to the Calendar Event's
  // Notes field so that notes entered before the Coach Session table existed
  // still appear.
  const notesForEditor = coachSession?.sessionNotes ?? interaction.notes ?? undefined

  const userName = user?.fullName ?? user?.preferredName ?? user?.firstName ?? 'Person'

  const tz = resolveDisplayTz(interaction.timezone)
  const dateLabel = interaction.endTime
    ? `${formatDateTime(interaction.startTime, tz)} – ${formatTime(interaction.endTime, tz)} ET`
    : `${formatDateTime(interaction.startTime, tz)} ET`

  const statusStyle = interaction.sessionStatus
    ? (SESSION_STATUS_STYLES[interaction.sessionStatus] ?? 'bg-slate-100 text-slate-600 border-slate-200')
    : null

  return (
    <div className="px-4 py-5 md:p-8 max-w-3xl mx-auto space-y-6">

      {/* Back link — goes to wherever the user actually came from. */}
      <BackLink fallbackHref={`/myhumans/${id}`} label={`Back to ${userName}`} />

      {/* Interaction header */}
      <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900 leading-snug">
            {interaction.title || 'Untitled Interaction'}
          </h1>
          {interaction.sessionStatus && statusStyle && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${statusStyle}`}>
              {interaction.sessionStatus}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-start gap-2 text-sm text-slate-600">
            <Calendar className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <span>{dateLabel}</span>
          </div>

          {interaction.participantEmails.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-slate-600">
              <Users className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1.5">
                {interaction.participantEmails.map((email) => (
                  <span
                    key={email}
                    className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs"
                  >
                    {email}
                  </span>
                ))}
              </div>
            </div>
          )}

          {interaction.senderEmail && (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              Organised by {interaction.senderEmail}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="pt-3 border-t border-slate-100 mt-4 flex flex-wrap gap-2">
          <Link
            href={`/myhumans/${id}/take-notes?interactionId=${interactionId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[hsl(213,70%,30%)] text-white text-xs font-medium hover:bg-[hsl(213,70%,25%)] transition-colors"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            Take Notes
          </Link>
          <LastInteractionNotesDialog note={lastInteractionNote} />
        </div>
      </div>

      {/* Interaction Notes */}
      <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
        <InteractionNotesEditor interactionId={interactionId} userId={id} initialNotes={notesForEditor} />
      </div>

      {/* Action Items — prefer coach session, fall back to Calendar Event */}
      {(coachSession?.actionItems || interaction.actionItems) && (
        <div className="bg-white rounded-xl shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Action Items
            </h2>
          </div>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {coachSession?.actionItems ?? interaction.actionItems}
          </p>
        </div>
      )}

    </div>
  )
}
