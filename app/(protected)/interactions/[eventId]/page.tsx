import Link from 'next/link'
import { NotebookPen } from 'lucide-react'
import BackLink from '@/components/BackLink'
import { getInteractionById } from '@/lib/airtable/interactions'
import { getCurrentUserRecord } from '@/lib/auth/getCurrentUserRecord'
import { getRelationshipContexts } from '@/lib/airtable/relationships'
import { getNotesByInteractionId, getMostRecentInteractionNoteByHuman } from '@/lib/airtable/notes'
import { getPermissionLevel, canWrite } from '@/lib/auth/permissions'
import { formatEastern, resolveDisplayTz } from '@/lib/utils/dateFormat'
import InteractionNoteForm from './InteractionNoteForm'
import LastInteractionNotesDialog from '@/components/LastInteractionNotesDialog'

interface Props {
  params: Promise<{ eventId: string }>
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
  }, resolveDisplayTz(timezone)) + ' ET'
}

export default async function SessionPage({ params }: Props) {
  const { eventId } = await params

  const userRecord = await getCurrentUserRecord()

  const [interaction, contexts] = await Promise.all([
    getInteractionById(eventId),
    userRecord.airtableId
      ? getRelationshipContexts(userRecord.airtableId)
      : Promise.resolve([]),
  ])

  if (!interaction) {
    return (
      <div className="px-4 py-8 max-w-2xl mx-auto">
        <p className="text-muted-foreground">Interaction not found.</p>
      </div>
    )
  }

  // Resolve the client from the matched Relationship Context
  const matchedContext = interaction.relationshipContextId
    ? contexts.find((c) => c.id === interaction.relationshipContextId)
    : null
  const clientAirtableId = matchedContext?.humanId ?? undefined

  // Permission level for this session's client
  const permissionLevel = clientAirtableId
    ? await getPermissionLevel(userRecord.airtableId, userRecord.role, clientAirtableId)
    : userRecord.role === 'admin' ? 'internal_admin' : 'coach_owner'

  const userCanWrite = canWrite(permissionLevel)

  // Fetch the interaction note for this interaction written by this author
  const allMeetingNotes = await getNotesByInteractionId(eventId)
  const existingNote = userRecord.airtableId
    ? allMeetingNotes.find((n) => n.authorPersonId === userRecord.airtableId) ?? null
    : null

  // Last interaction note for this client (for the "previous notes" popup)
  const lastInteractionNote = clientAirtableId
    ? await getMostRecentInteractionNoteByHuman(clientAirtableId, eventId)
    : null

  return (
    <div className="px-4 py-5 md:p-8 max-w-2xl mx-auto space-y-6">

      {/* Back — goes to wherever the user came from. */}
      <BackLink fallbackHref="/dashboard" label="Back" />

      {/* Event header */}
      <div className="bg-card rounded-xl shadow-sm p-5 space-y-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-[hsl(213,70%,40%)]">
          Interaction
        </p>
        <h1 className="text-xl font-bold text-foreground leading-snug">
          {interaction.title || 'Untitled Interaction'}
        </h1>
        {interaction.startTime && (
          <p className="text-sm text-muted-foreground">{formatDateTime(interaction.startTime, interaction.timezone)}</p>
        )}
        {interaction.humanName && (
          <p className="text-sm font-medium text-[hsl(213,70%,30%)] mt-1">
            with {interaction.humanName}
          </p>
        )}
        {userCanWrite && clientAirtableId && (
          <div className="pt-2 flex flex-wrap gap-2">
            <Link
              href={`/myhumans/${clientAirtableId}/take-notes?interactionId=${eventId}&noteCategory=prep`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              <NotebookPen className="h-3.5 w-3.5" />
              Prep Notes
            </Link>
            <Link
              href={`/myhumans/${clientAirtableId}/take-notes?interactionId=${eventId}&noteCategory=interaction`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[hsl(213,70%,30%)] text-white text-xs font-medium hover:bg-[hsl(213,70%,25%)] transition-colors"
            >
              <NotebookPen className="h-3.5 w-3.5" />
              Interaction Notes
            </Link>
          </div>
        )}
      </div>

      {/* Interaction note — create or edit */}
      <div className="bg-card rounded-xl shadow-sm p-5">
        <h2 className="text-base font-semibold text-foreground mb-1">
          {existingNote ? 'Edit Interaction Note' : 'Add Interaction Note'}
        </h2>
        {existingNote && (
          <p className="text-xs text-muted-foreground mb-5">
            Last updated{' '}
            {existingNote.date
              ? new Date(existingNote.date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : ''}
          </p>
        )}

        {userCanWrite ? (
          <InteractionNoteForm
            interactionId={eventId}
            subjectPersonId={clientAirtableId}
            relationshipContextId={matchedContext?.id}
            existingNote={existingNote ?? undefined}
          />
        ) : existingNote ? (
          // Read-only view for non-coaches
          <div className="space-y-3">
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {existingNote.content}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No interaction note yet.</p>
        )}
      </div>

    </div>
  )
}
