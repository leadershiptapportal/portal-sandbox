'use client'

import Link from 'next/link'
import { Calendar } from 'lucide-react'
import type { Interaction } from '@/lib/types'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatEastern } from '@/lib/utils/dateFormat'

function getMonthDay(iso: string, timezone: string = 'America/New_York'): { month: string; day: string; time: string } {
  return {
    month: formatEastern(iso, { month: 'short' }, timezone).toUpperCase(),
    day: formatEastern(iso, { day: 'numeric' }, timezone),
    time: formatEastern(iso, { hour: 'numeric', minute: '2-digit', hour12: true }, timezone) + ' ET',
  }
}

function InteractionRow({
  interaction,
  userId,
  upcoming,
}: {
  interaction: Interaction
  userId: string
  upcoming: boolean
}) {
  const { month, day, time } = getMonthDay(interaction.startTime, interaction.timezone)

  return (
    <Link
      href={`/myhumans/${userId}/interactions/${interaction.id}`}
      className={`flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 group ${
        upcoming ? 'border-l-2 border-l-indigo-400' : ''
      }`}
    >
      {/* Left: date block */}
      <div className="flex-shrink-0 w-12 text-center">
        <div className="text-xs text-gray-400">{month}</div>
        <div className="text-lg font-bold text-gray-900 leading-none">{day}</div>
      </div>
      {/* Middle: title + time */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {interaction.title || 'Untitled Event'}
        </p>
        <p className="text-xs text-gray-400 mt-0.5">{time}</p>
      </div>
      {/* Right: arrow */}
      <span className="text-gray-300 group-hover:text-indigo-500 transition-colors text-sm">→</span>
    </Link>
  )
}

function InteractionList({
  interactions,
  userId,
  upcoming,
}: {
  interactions: Interaction[]
  userId: string
  upcoming: boolean
}) {
  if (interactions.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 py-10 text-center">
        <Calendar className="mx-auto h-8 w-8 text-gray-300 mb-2" />
        <p className="text-sm text-gray-400">No interactions found</p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {interactions.map((m) => (
        <InteractionRow key={m.id} interaction={m} userId={userId} upcoming={upcoming} />
      ))}
    </div>
  )
}

interface InteractionsSectionProps {
  upcoming: Interaction[]
  past: Interaction[]
  userId: string
}

export default function InteractionsSection({ upcoming, past, userId }: InteractionsSectionProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Interactions</h2>
      <Tabs defaultValue="upcoming">
        <TabsList className="bg-gray-100 rounded-lg p-1 mb-4">
          <TabsTrigger value="upcoming" className="rounded-md text-sm">
            Upcoming {upcoming.length > 0 && `(${upcoming.length})`}
          </TabsTrigger>
          <TabsTrigger value="past" className="rounded-md text-sm">
            Past {past.length > 0 && `(${past.length})`}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="upcoming">
          <InteractionList interactions={upcoming} userId={userId} upcoming={true} />
        </TabsContent>
        <TabsContent value="past">
          <InteractionList interactions={past} userId={userId} upcoming={false} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
