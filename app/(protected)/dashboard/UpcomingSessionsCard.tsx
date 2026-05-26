'use client'

import Link from 'next/link'
import { FileText, NotebookPen } from 'lucide-react'
import LogNoteDialog from '@/app/(protected)/myhumans/[id]/LogNoteDialog'

export interface UpcomingItem {
  meetingId: string
  providerEventId: string | null
  title: string
  startTime: string
  endTime?: string
  timezone: string
  weekday: string
  day: number
  month: string
  timeRange: string
  clientId: string | null
  clientName: string | null
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

export default function UpcomingSessionsCard({ items, emptyMessage }: Props) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-slate-400">
        {emptyMessage ?? 'No upcoming interactions.'}
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const href = item.clientId
          ? `/myhumans/${item.clientId}/interactions/${item.meetingId}`
          : `/interactions/${item.meetingId}`

        return (
          <div
            key={item.meetingId}
            className="rounded-lg border border-slate-100 hover:border-slate-200 transition-colors overflow-hidden"
          >
            {/* Main row */}
            <Link href={href} className="flex items-center gap-3 px-3 py-2.5">
              {/* Date block */}
              <div className="flex-shrink-0 w-9 text-center">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[hsl(213,70%,30%)]">
                  {item.weekday}
                </p>
                <p className="text-xl font-bold text-slate-900 leading-none mt-0.5">
                  {item.day}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.month}</p>
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {item.title || 'Untitled Meeting'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">{item.timeRange}</p>
                {item.clientName ? (
                  <p className="text-xs font-medium text-[hsl(213,70%,30%)] mt-0.5">
                    with {item.clientName}
                  </p>
                ) : item.displayLabel ? (
                  <p className="text-xs text-slate-400 mt-0.5">{item.displayLabel}</p>
                ) : (
                  <p className="text-xs text-slate-300 italic mt-0.5">No person linked</p>
                )}
              </div>

              <span className="flex-shrink-0 text-slate-300 text-sm">›</span>
            </Link>

            {/* Note actions */}
            {item.clientId && (
              <div className="flex items-center gap-3 px-3 pb-2 border-t border-slate-50">
                {item.hasNote ? (
                  <Link
                    href={href}
                    className="text-xs font-medium text-[hsl(213,70%,40%)] flex items-center gap-1 hover:underline"
                  >
                    <FileText className="h-3 w-3" />
                    Edit Note
                  </Link>
                ) : (
                  <>
                    <LogNoteDialog
                      userId={item.clientId}
                      trigger={
                        <button className="text-xs font-medium text-slate-500 flex items-center gap-1 hover:text-slate-700 transition-colors pt-2">
                          <FileText className="h-3 w-3" />
                          Add Note
                        </button>
                      }
                    />
                    <Link
                      href={`/myhumans/${item.clientId}/take-notes`}
                      className="text-xs font-medium text-slate-500 flex items-center gap-1 hover:text-slate-700 transition-colors pt-2"
                    >
                      <NotebookPen className="h-3 w-3" />
                      Take Notes
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
