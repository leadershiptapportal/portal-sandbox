import Link from 'next/link'
import Image from 'next/image'
import { Calendar, Clock, Users, CheckSquare, ClipboardList, NotebookPen, Pencil } from 'lucide-react'
import BackLink from '@/components/BackLink'
import { notFound } from 'next/navigation'
import { getUserById } from '@/lib/services/usersService'
import { getInteractionById } from '@/lib/airtable/interactions'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getInteractionNotesGrouped } from '@/lib/airtable/notes'
import { formatEastern, resolveDisplayTz } from '@/lib/utils/dateFormat'
import InteractionNotesEditor from './InteractionNotesEditor'

interface Props {
  params: Promise<{ id: string; interactionId: string }>
  searchParams: Promise<{ edit?: string }>
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

export default async function InteractionDetailPage({ params, searchParams }: Props) {
  const { id, interactionId } = await params
  const { edit } = await searchParams
  const autoEdit = edit === '1'

  const [user, interaction, currentUserRecord] = await Promise.all([
    getUserById(id),
    getInteractionById(interactionId),
    getCurrentUserRecord(),
  ])

  if (!interaction) notFound()

  const notesGroup = currentUserRecord.airtableId
    ? await getInteractionNotesGrouped(interactionId, currentUserRecord.airtableId).catch(() => null)
    : null

  const userName = user?.fullName ?? user?.preferredName ?? user?.firstName ?? 'Person'

  const tz = resolveDisplayTz(interaction.timezone)
  const dateLabel = interaction.endTime
    ? `${formatDateTime(interaction.startTime, tz)} – ${formatTime(interaction.endTime, tz)} ET`
    : `${formatDateTime(interaction.startTime, tz)} ET`

  const statusStyle = interaction.sessionStatus
    ? (SESSION_STATUS_STYLES[interaction.sessionStatus] ?? 'bg-muted text-muted-foreground border-border')
    : null

  const takeNotesBase = `/myhumans/${id}/take-notes?interactionId=${interactionId}`

  return (
    <div className="px-4 py-5 md:p-8 max-w-3xl mx-auto space-y-6">

      <BackLink fallbackHref={`/myhumans/${id}`} label={`Back to ${userName}`} />

      {/* ── Interaction header ─────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl shadow-sm p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-foreground leading-snug">
            {interaction.title || 'Untitled Interaction'}
          </h1>
          {interaction.sessionStatus && statusStyle && (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex-shrink-0 ${statusStyle}`}>
              {interaction.sessionStatus}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-start gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{dateLabel}</span>
          </div>

          {interaction.participantEmails.length > 0 && (
            <div className="flex items-start gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1.5">
                {interaction.participantEmails.map((email) => (
                  <span key={email} className="px-2 py-0.5 rounded-full bg-muted text-xs">{email}</span>
                ))}
              </div>
            </div>
          )}

          {interaction.senderEmail && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5 flex-shrink-0" />
              Organised by {interaction.senderEmail}
            </div>
          )}
        </div>

        {/* Note action buttons */}
        <div className="pt-3 border-t border-border mt-4 flex flex-wrap gap-2">
          <Link
            href={`${takeNotesBase}&noteCategory=prep`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            {notesGroup?.prepTyped || notesGroup?.prepInk ? 'Edit Prep Notes' : 'Add Prep Notes'}
          </Link>
          <Link
            href={`${takeNotesBase}&noteCategory=interaction`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[hsl(213,70%,30%)] text-white text-xs font-medium hover:bg-[hsl(213,70%,25%)] transition-colors"
          >
            <NotebookPen className="h-3.5 w-3.5" />
            {notesGroup?.interactionTyped || notesGroup?.interactionInk ? 'Edit Interaction Notes' : 'Add Interaction Notes'}
          </Link>
        </div>
      </div>

      {/* ── Prep Notes ────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl shadow-sm p-5 md:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Prep Notes</h2>
          </div>
          <Link
            href={`${takeNotesBase}&noteCategory=prep`}
            className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
          >
            {notesGroup?.prepTyped || notesGroup?.prepInk ? 'Edit' : 'Add'}
          </Link>
        </div>

        {notesGroup?.prepTyped ? (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {notesGroup.prepTyped.content}
          </p>
        ) : null}

        {notesGroup?.prepInk ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">Handwritten</p>
              <Link
                href={`${takeNotesBase}&noteCategory=prep`}
                className="text-xs text-[hsl(213,70%,30%)] hover:underline flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" /> Edit
              </Link>
            </div>
            <div className="rounded-lg overflow-hidden border border-border">
              <Image
                src={notesGroup.prepInk.inkImageUrl!}
                alt="Handwritten prep notes"
                width={800}
                height={600}
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        ) : null}

        {!notesGroup?.prepTyped && !notesGroup?.prepInk && (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-5 text-center">
            <p className="text-sm text-muted-foreground">No prep notes yet.</p>
            <Link
              href={`${takeNotesBase}&noteCategory=prep`}
              className="text-xs text-[hsl(213,70%,30%)] hover:underline mt-1 inline-block"
            >
              Add prep notes →
            </Link>
          </div>
        )}
      </div>

      {/* ── Interaction Notes ──────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl shadow-sm p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Interaction Notes</h2>
        </div>

        {/* Typed interaction notes — inline editor */}
        <InteractionNotesEditor
          interactionId={interactionId}
          userId={id}
          initialNotes={notesGroup?.interactionTyped?.content}
          autoEdit={autoEdit}
        />

        {/* Handwritten interaction notes */}
        {notesGroup?.interactionInk && (
          <div className="space-y-2 pt-2 border-t border-border">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground font-medium">Handwritten</p>
              <Link
                href={`${takeNotesBase}&noteCategory=interaction`}
                className="text-xs text-[hsl(213,70%,30%)] hover:underline flex items-center gap-1"
              >
                <Pencil className="h-3 w-3" /> Edit
              </Link>
            </div>
            <div className="rounded-lg overflow-hidden border border-border">
              <Image
                src={notesGroup.interactionInk.inkImageUrl!}
                alt="Handwritten interaction notes"
                width={800}
                height={600}
                className="w-full h-auto object-contain"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Action Items ──────────────────────────────────────────────────── */}
      {interaction.actionItems && (
        <div className="bg-card rounded-xl shadow-sm p-5 md:p-6">
          <div className="flex items-center gap-2 mb-3">
            <CheckSquare className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Action Items</h2>
          </div>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {interaction.actionItems}
          </p>
        </div>
      )}

    </div>
  )
}
