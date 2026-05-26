'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar, NotebookPen, FileText } from 'lucide-react'
import SessionNotesPopout from '../SessionNotesPopout'
import LogNoteDialog from '../LogNoteDialog'
import { formatEastern } from '@/lib/utils/dateFormat'
import type { Meeting } from '@/lib/types'

interface Props {
  topMeetings: Meeting[]
  totalMeetingCount: number
  userId: string
}

function formatMeetingDate(m: Meeting): string {
  if (!m.startTime) return ''
  return formatEastern(
    m.startTime,
    { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true },
    m.timezone,
  )
}

export default function MostRecentSessionSection({ topMeetings, totalMeetingCount, userId }: Props) {
  const [popoutMeetingId, setPopoutMeetingId] = useState<string | null>(null)

  const popoutMeeting = topMeetings.find((m) => m.id === popoutMeetingId) ?? null

  if (topMeetings.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Most Recent Interactions</h2>
        <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center">
          <Calendar className="h-6 w-6 text-slate-300 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No interactions recorded yet.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white rounded-xl shadow-sm p-4 md:p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Most Recent Interactions</h2>

        <div className="space-y-2.5">
          {topMeetings.map((meeting, idx) => {
            const isMostRecent = idx === 0
            const dateStr = formatMeetingDate(meeting)

            return (
              <div
                key={meeting.id}
                className={`rounded-xl border px-4 py-3.5 transition-colors ${
                  isMostRecent
                    ? 'border-[hsl(213,70%,30%)]/20 bg-[hsl(213,60%,98%)]'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                {/* Header row: title + most-recent badge */}
                <div className="flex items-start gap-2 justify-between">
                  <p className="text-sm font-semibold text-slate-900 leading-snug truncate">
                    {meeting.title || 'Untitled Interaction'}
                  </p>
                  {isMostRecent && (
                    <span className="flex-shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[hsl(213,70%,30%)] text-white">
                      Most Recent
                    </span>
                  )}
                </div>

                {/* Date */}
                {dateStr && (
                  <p className="text-xs text-slate-400 mt-0.5">{dateStr}</p>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                  <button
                    onClick={() => setPopoutMeetingId(meeting.id)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <FileText className="h-3 w-3" />
                    View Notes
                  </button>

                  <LogNoteDialog
                    userId={userId}
                    trigger={
                      <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors">
                        <FileText className="h-3 w-3 text-blue-500" />
                        Log Note
                      </button>
                    }
                  />

                  <Link
                    href={`/myhumans/${userId}/take-notes?interactionId=${meeting.id}`}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                  >
                    <NotebookPen className="h-3 w-3 text-[hsl(213,70%,40%)]" />
                    Take Notes
                  </Link>
                </div>
              </div>
            )
          })}
        </div>

        {/* View all link */}
        {totalMeetingCount > 0 && (
          <Link
            href={`/myhumans/${userId}/interactions`}
            className="inline-flex items-center gap-1 text-sm text-[hsl(213,70%,35%)] hover:text-[hsl(213,70%,25%)] mt-4 font-medium transition-colors"
          >
            View all {totalMeetingCount} interaction{totalMeetingCount !== 1 ? 's' : ''} →
          </Link>
        )}
      </div>

      {/* Notes popout dialog */}
      {popoutMeeting && (
        <SessionNotesPopout
          open={!!popoutMeetingId}
          onOpenChange={(open) => { if (!open) setPopoutMeetingId(null) }}
          meetingId={popoutMeeting.id}
          meetingTitle={popoutMeeting.title || 'Untitled Interaction'}
          meetingDate={formatMeetingDate(popoutMeeting)}
          personId={userId}
        />
      )}
    </>
  )
}
