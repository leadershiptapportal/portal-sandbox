import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Calendar, Clock, Users, ClipboardList, NotebookPen, Pencil } from 'lucide-react'
import { notFound } from 'next/navigation'
import { getHumanById } from '@/lib/services/humansService'
import { getInteractionById } from '@/lib/airtable/interactions'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getInteractionNotesGrouped } from '@/lib/airtable/notes'
import { formatEastern, resolveDisplayTz } from '@/lib/utils/dateFormat'
import InteractionNotesEditor from './InteractionNotesEditor'
import PrepNotesEditor from './PrepNotesEditor'

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

export default async function InteractionDetailPage({ params, searchParams }: Props) {
  const { id, interactionId } = await params
  const { edit } = await searchParams
  const autoEdit = edit === '1'

  const [user, interaction, currentUserRecord] = await Promise.all([
    getHumanById(id),
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

  const takeNotesBase = `/myhumans/${id}/take-notes?interactionId=${interactionId}`

  return (
    <div className="px-4 py-5 md:p-8 max-w-3xl mx-auto space-y-6">

      <Link
        href={`/myhumans/${id}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {userName}
      </Link>

      {/* ── Interaction header ─────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl shadow-sm p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <h1 className="text-xl font-bold text-foreground leading-snug">
            {interaction.title || 'Untitled Interaction'}
          </h1>
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

        {/* Note action buttons — each hidden only when both note types for it exist */}
        {(!(notesGroup?.prepTyped && notesGroup?.prepInk) || !(notesGroup?.interactionTyped && notesGroup?.interactionInk)) && (
          <div className="pt-3 border-t border-border mt-4 flex flex-wrap gap-2">
            {!(notesGroup?.prepTyped && notesGroup?.prepInk) && (
              <Link
                href={`${takeNotesBase}&noteCategory=prep`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Edit Pre-Notes
              </Link>
            )}
            {!(notesGroup?.interactionTyped && notesGroup?.interactionInk) && (
              <Link
                href={`${takeNotesBase}&noteCategory=interaction`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[hsl(213,70%,30%)] text-white text-xs font-medium hover:bg-[hsl(213,70%,25%)] transition-colors"
              >
                <NotebookPen className="h-3.5 w-3.5" />
                Edit Interaction Notes
              </Link>
            )}
          </div>
        )}
      </div>

      {/* ── Prep Notes ────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-xl shadow-sm p-5 md:p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Pre-Notes</h2>
        </div>

        <PrepNotesEditor
          interactionId={interactionId}
          userId={id}
          initialNotes={notesGroup?.prepTyped?.content}
        />

        {notesGroup?.prepInk && (
          <div className="space-y-2 pt-2 border-t border-border">
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

    </div>
  )
}
