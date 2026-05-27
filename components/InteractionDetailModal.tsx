'use client'

import type { Interaction } from '@/lib/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatEastern } from '@/lib/utils/dateFormat'

function formatDateTime(iso: string, timezone: string = 'America/New_York'): string {
  return formatEastern(iso, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }, timezone) + ' ET'
}

interface InteractionDetailModalProps {
  interaction: Interaction | null
  onClose: () => void
}

export default function InteractionDetailModal({ interaction, onClose }: InteractionDetailModalProps) {
  return (
    <Dialog open={!!interaction} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-lg">
        {interaction && (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg leading-snug">{interaction.title || 'Untitled Event'}</DialogTitle>
              <p className="text-sm text-muted-foreground pt-1">
                {formatDateTime(interaction.startTime, interaction.timezone)}
                {interaction.endTime && ` — ${formatDateTime(interaction.endTime, interaction.timezone)}`}
              </p>
            </DialogHeader>

            <div className="space-y-5 pt-2">
              {/* Participants */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Participants
                </h3>
                {interaction.participantEmails.length > 0 ? (
                  <ul className="space-y-1">
                    {interaction.participantEmails.map((email) => (
                      <li key={email} className="text-sm">{email}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No participants listed.</p>
                )}
              </div>

              {/* Summary / Notes */}
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                  Transcript / Notes
                </h3>
                {interaction.notes ? (
                  <p className="text-sm whitespace-pre-wrap">{interaction.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    Not yet available.
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
