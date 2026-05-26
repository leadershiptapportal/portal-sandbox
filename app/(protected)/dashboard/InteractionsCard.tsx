'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Calendar } from 'lucide-react'
import UpcomingSessionsCard from './UpcomingSessionsCard'
import type { UpcomingItem } from './UpcomingSessionsCard'

interface Props {
  recentItems: UpcomingItem[]
  upcomingItems: UpcomingItem[]
}

export default function InteractionsCard({ recentItems, upcomingItems }: Props) {
  const [tab, setTab] = useState<'recent' | 'upcoming'>('recent')

  const items = tab === 'recent' ? recentItems : upcomingItems
  const count = items.length

  return (
    <div id="interactions" className="bg-white rounded-xl shadow-sm p-4 md:p-5 h-full">
      <div className="flex items-center gap-2 mb-3">
        <Calendar className="h-4 w-4 text-slate-400" />
        <h2 className="text-sm font-semibold text-slate-900">My Interactions</h2>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium">
            {count} {count === 1 ? 'interaction' : 'interactions'}
          </span>
          <Link
            href={`/interactions?filter=${tab}`}
            className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
          >
            View All →
          </Link>
        </div>
      </div>

      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setTab('recent')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            tab === 'recent'
              ? 'bg-[hsl(213,70%,30%)] text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          Recent
        </button>
        <button
          onClick={() => setTab('upcoming')}
          className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
            tab === 'upcoming'
              ? 'bg-[hsl(213,70%,30%)] text-white'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          Upcoming
        </button>
      </div>

      <div className="max-h-[430px] overflow-y-auto -mr-1 pr-1">
        <UpcomingSessionsCard
          items={items}
          emptyMessage={
            tab === 'recent' ? 'No recent interactions.' : 'No upcoming interactions.'
          }
        />
      </div>
    </div>
  )
}
