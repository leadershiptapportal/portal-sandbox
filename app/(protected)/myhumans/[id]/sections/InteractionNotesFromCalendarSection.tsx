import { BookOpen } from 'lucide-react'
import { SectionHeading } from './helpers'
import { formatEastern } from '@/lib/utils/dateFormat'
import type { Interaction } from '@/lib/types'

interface Props {
  portalSessionEvents: Interaction[]
}

export default function InteractionNotesFromCalendarSection({ portalSessionEvents }: Props) {
  if (portalSessionEvents.length === 0) return null

  return (
    <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
      <SectionHeading icon={BookOpen} title="Interaction Notes (from Calendar)" />
      <div className="space-y-3">
        {portalSessionEvents.map((event) => (
          <div
            key={event.id}
            className="border border-border rounded-lg p-4 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-foreground">{event.title || 'Untitled Interaction'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {formatEastern(event.startTime, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }, event.timezone)}
                </p>
              </div>
            </div>
            {event.notes ? (
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {event.notes}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">No notes yet</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
