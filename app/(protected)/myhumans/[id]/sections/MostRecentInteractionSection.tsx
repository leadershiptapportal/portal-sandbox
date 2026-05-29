'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, NotebookPen, FileText } from 'lucide-react'
import InteractionNotesPopout from '../InteractionNotesPopout'
import { formatEastern } from '@/lib/utils/dateFormat'
import type { Interaction } from '@/lib/types'

interface NoteStatus {
  hasNotes: boolean
  hasInk: boolean
}

interface Props {
  topInteractions: Interaction[]
  totalInteractionCount: number
  userId: string
  noteStatusByInteractionId?: Record<string, NoteStatus>
}

function formatMeetingDate(m: Interaction): string {
  if (!m.startTime) return ''
  return formatEastern(
    m.startTime,
    { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true },
    m.timezone,
  )
}

export default function MostRecentInteractionSection({ topInteractions, totalInteractionCount, userId, noteStatusByInteractionId }: Props) {
  const [popoutInteractionId, setPopoutInteractionId] = useState<string | null>(null)

  const popoutInteraction = topInteractions.find((m) => m.id === popoutInteractionId) ?? null

  if (topInteractions.length === 0) {
    return (
      <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Most Recent Interactions</h2>
        <div className="border border-dashed border-border rounded-xl p-6 text-center">
          <Calendar className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No interactions recorded yet.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
        <h2 className="text-lg font-semibold text-foreground mb-4">Most Recent Interactions</h2>

        <div className="space-y-2.5">
          {topInteractions.map((interaction, idx) => {
            const isMostRecent = idx === 0
            const dateStr = formatMeetingDate(interaction)
            const noteStatus = noteStatusByInteractionId?.[interaction.id] ?? { hasNotes: false, hasInk: false }

            return (
              <div
                key={interaction.id}
                className={`relative rounded-xl px-4 py-3.5 transition-colors cursor-pointer ${
                  isMostRecent
                    ? 'border-2 border-white/70 dark:border-white/40 bg-card hover:bg-muted/50'
                    : 'border border-border bg-card hover:border-border hover:bg-muted/50'
                }`}
              >
                {/* Stretched link — covers the whole card; buttons sit above via z-10 */}
                <Link
                  href={`/myhumans/${userId}/interactions/${interaction.id}`}
                  className="absolute inset-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)] focus:ring-offset-1"
                  aria-label={`View interaction: ${interaction.title || 'Untitled Interaction'}`}
                />

                {/* Header row: title + most-recent badge */}
                <div className="flex items-start gap-2 justify-between">
                  <p className="text-sm font-semibold text-foreground leading-snug truncate">
                    {interaction.title || 'Untitled Interaction'}
                  </p>
                  {isMostRecent && (
                    <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(213,70%,30%)] text-white">
                      Most Recent
                    </span>
                  )}
                </div>

                {/* Date */}
                {dateStr && (
                  <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>
                )}

                {/* Action buttons — z-10 so they intercept clicks above the card link */}
                <div className="relative z-10 flex items-center gap-1.5 mt-3 flex-wrap">
                  <button
                    onClick={() => setPopoutInteractionId(interaction.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:border-border transition-colors"
                  >
                    <FileText className="h-3 w-3" />
                    {noteStatus.hasNotes ? 'Edit Notes' : 'Add Notes'}
                  </button>

                  <Link
                    href={`/myhumans/${userId}/take-notes?interactionId=${interaction.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:border-border transition-colors"
                  >
                    <NotebookPen className="h-3 w-3 text-[hsl(213,70%,40%)]" />
                    {noteStatus.hasInk ? 'Continue Taking Notes' : 'Take Notes'}
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* View all link */}
        {totalInteractionCount > 0 && (
          <Link
            href={`/myhumans/${userId}/interactions`}
            className="inline-flex items-center gap-1 text-sm text-[hsl(213,70%,35%)] hover:text-[hsl(213,70%,25%)] mt-4 font-medium transition-colors"
          >
            View all {totalInteractionCount} interaction{totalInteractionCount !== 1 ? 's' : ''} →
          </Link>
        )}
      </div>

      {/* Notes popout dialog */}
      {popoutInteraction && (
        <InteractionNotesPopout
          open={!!popoutInteractionId}
          onOpenChange={(open) => { if (!open) setPopoutInteractionId(null) }}
          interactionId={popoutInteraction.id}
          meetingTitle={popoutInteraction.title || 'Untitled Interaction'}
          meetingDate={formatMeetingDate(popoutInteraction)}
          personId={userId}
        />
      )}
    </>
  )
}
