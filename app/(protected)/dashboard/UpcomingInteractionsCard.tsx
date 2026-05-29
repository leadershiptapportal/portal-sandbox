'use client'

import Link from 'next/link'
import { NotebookPen, ClipboardList } from 'lucide-react'

export interface UpcomingItem {
  interactionId: string
  providerEventId: string | null
  title: string
  startTime: string
  endTime?: string
  timezone: string
  weekday: string
  day: number
  month: string
  timeRange: string
  humanId: string | null
  humanName: string | null
  displayLabel: string | null
  participantEmails: string[]
  hasNote: boolean
  interactionType?: string
  source?: string
}

interface Props {
  items: UpcomingItem[]
  emptyMessage?: string
}

export default function UpcomingInteractionsCard({ items, emptyMessage }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {emptyMessage ?? 'No upcoming interactions.'}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const href = item.humanId
          ? `/myhumans/${item.humanId}/interactions/${item.interactionId}`
          : `/interactions/${item.interactionId}`

        return (
          <div
            key={item.interactionId}
            className="rounded-lg border border-border hover:border-border transition-colors overflow-hidden"
          >
            {/* Main row */}
            <Link href={href} className="flex items-center gap-3 px-3 py-2.5">
              {/* Date block */}
              <div className="flex-shrink-0 w-9 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(213,70%,30%)]">
                  {item.weekday}
                </p>
                <p className="text-xl font-bold text-foreground leading-none mt-0.5">
                  {item.day}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.month}</p>
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {item.title || 'Untitled Interaction'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{item.timeRange}</p>
                {item.humanName ? (
                  <p className="text-xs font-medium text-[hsl(213,70%,30%)] mt-0.5">
                    with {item.humanName}
                  </p>
                ) : item.displayLabel ? (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.displayLabel}</p>
                ) : (
                  <p className="text-xs text-muted-foreground/60 italic mt-0.5">No person linked</p>
                )}
              </div>

              <span className="flex-shrink-0 text-muted-foreground/60 text-sm">›</span>
            </Link>

            {/* Note actions */}
            {item.humanId && (
              <div className="flex items-center gap-3 px-3 pb-2 pt-1 border-t border-border">
                <Link
                  href={`/myhumans/${item.humanId}/take-notes?interactionId=${item.interactionId}&noteCategory=prep`}
                  className="text-xs font-medium text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <ClipboardList className="h-3 w-3" />
                  Add/Edit Prep Notes
                </Link>
                <Link
                  href={`/myhumans/${item.humanId}/take-notes?interactionId=${item.interactionId}&noteCategory=interaction`}
                  className="text-xs font-medium text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                >
                  <NotebookPen className="h-3 w-3" />
                  Add/Edit Interaction Notes
                </Link>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
