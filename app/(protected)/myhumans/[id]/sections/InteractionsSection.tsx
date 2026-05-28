import Link from 'next/link'
import { Calendar, ChevronRight } from 'lucide-react'
import RecentInteractionCard from '../RecentInteractionCard'
import { formatMeetingDate, formatMeetingDay, relativeDays } from './helpers'
import type { Interaction } from '@/lib/types'

interface Props {
  nextMeeting: Interaction | null
  lastMeeting: Interaction | null
  recentMeetings: Interaction[]
  allMeetings: number
  userId: string
}

export default function InteractionsSection({
  nextMeeting,
  lastMeeting,
  recentMeetings,
  allMeetings,
  userId,
}: Props) {
  return (
    <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex items-center gap-2 mb-5">
        <Calendar className="h-5 w-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Interactions</h2>
        {allMeetings > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">{allMeetings} total</span>
        )}
      </div>

      {allMeetings === 0 ? (
        <p className="text-sm text-muted-foreground">No interactions recorded yet.</p>
      ) : (
        <div className="space-y-6">

          {/* NEXT INTERACTION */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Next Interaction
            </p>
            {nextMeeting ? (() => {
              const { weekday, day, month, time } = formatMeetingDay(nextMeeting.startTime, nextMeeting.timezone)
              const label = relativeDays(nextMeeting.startTime)
              return (
                <Link
                  href={`/myhumans/${userId}/interactions/${nextMeeting.id}`}
                  className="flex items-start gap-4 p-4 rounded-xl border-2 border-[hsl(213,60%,90%)] bg-[hsl(213,60%,97%)] hover:bg-[hsl(213,60%,95%)] transition-colors group"
                >
                  <div className="flex-shrink-0 w-12 text-center bg-[hsl(213,70%,30%)] text-white rounded-lg py-2 px-1">
                    <p className="text-[10px] font-bold uppercase tracking-wide opacity-80">{weekday}</p>
                    <p className="text-2xl font-bold leading-none mt-0.5">{day}</p>
                    <p className="text-[10px] opacity-80 mt-0.5">{month}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {nextMeeting.title || 'Untitled Interaction'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
                    <span className="mt-2 inline-block text-xs font-semibold text-[hsl(213,70%,30%)] bg-[hsl(213,60%,90%)] px-2 py-0.5 rounded-full">
                      {label}
                    </span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-[hsl(213,70%,50%)] group-hover:text-[hsl(213,70%,30%)] flex-shrink-0 mt-1 transition-colors" />
                </Link>
              )
            })() : (
              <p className="text-sm text-muted-foreground pl-1">No upcoming interactions scheduled.</p>
            )}
          </div>

          {/* LAST INTERACTION */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              Last Interaction
            </p>

            {lastMeeting ? (() => {
              const { weekday, day, month, time } = formatMeetingDay(lastMeeting.startTime, lastMeeting.timezone)
              const label = relativeDays(lastMeeting.startTime)
              return (
                <div className="rounded-xl border border-border bg-muted/50 overflow-hidden">
                  <Link
                    href={`/myhumans/${userId}/interactions/${lastMeeting.id}`}
                    className="flex items-start gap-4 p-4 hover:bg-muted transition-colors group"
                  >
                    <div className="flex-shrink-0 w-12 text-center bg-muted text-muted-foreground rounded-lg py-2 px-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide">{weekday}</p>
                      <p className="text-2xl font-bold leading-none mt-0.5">{day}</p>
                      <p className="text-[10px] mt-0.5">{month}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {lastMeeting.title || 'Untitled Interaction'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">{time}</p>
                      <span className="mt-2 inline-block text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {label}
                      </span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-muted-foreground flex-shrink-0 mt-1 transition-colors" />
                  </Link>
                  {(lastMeeting.notes || lastMeeting.actionItems) && (
                    <div className="px-4 pb-4 border-t border-border">
                      <RecentInteractionCard
                        notes={lastMeeting.notes ?? ''}
                        actionItems={lastMeeting.actionItems ?? null}
                      />
                    </div>
                  )}
                </div>
              )
            })() : (
              <p className="text-sm text-muted-foreground pl-1">No past interactions.</p>
            )}
          </div>

          {/* PAST INTERACTIONS */}
          {recentMeetings.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Past Interactions
              </p>
              <div className="rounded-lg border border-border overflow-hidden">
                {recentMeetings.map((m) => (
                  <div
                    key={m.id}
                    className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-0"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {m.title || 'Untitled Interaction'}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <p className="text-xs text-muted-foreground">{formatMeetingDate(m.startTime)}</p>
                        {m.sessionStatus && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground border border-border">
                            {m.sessionStatus}
                          </span>
                        )}
                      </div>
                      {m.notes ? (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{m.notes}</p>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 mt-1 italic">No notes</p>
                      )}
                    </div>
                    <Link
                      href={`/myhumans/${userId}/interactions/${m.id}`}
                      className="flex-shrink-0 mt-0.5 text-xs font-medium text-[hsl(213,70%,30%)] hover:underline whitespace-nowrap"
                    >
                      View Full Notes
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
