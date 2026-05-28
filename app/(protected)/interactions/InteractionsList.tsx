'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Search, ChevronRight, FileText, Calendar, X, NotebookPen, Plus,
  Users, Phone, Video, MessageSquare, Mail, Package, MoreHorizontal,
} from 'lucide-react'
import AddInteractionDialog from '@/components/AddInteractionDialog'
import type { UpcomingItem } from '../dashboard/UpcomingInteractionsCard'

type Filter = 'needs-notes' | 'upcoming' | 'past' | 'all'
type TypeFilter = 'all' | string

interface Human {
  id: string
  name: string
}

interface ListItem extends UpcomingItem {
  startMs: number
  isPast: boolean
}

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'needs-notes', label: 'Needs Notes' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'all', label: 'All' },
]

// All interaction types from Airtable
const TYPE_OPTIONS: { key: string; label: string; icon: React.ReactNode }[] = [
  { key: 'Calendar Event', label: 'Calendar', icon: <Calendar className="h-3.5 w-3.5" /> },
  { key: 'In-Person', label: 'In-Person', icon: <Users className="h-3.5 w-3.5" /> },
  { key: 'Phone Call', label: 'Phone', icon: <Phone className="h-3.5 w-3.5" /> },
  { key: 'Video Call', label: 'Video', icon: <Video className="h-3.5 w-3.5" /> },
  { key: 'Text', label: 'Text', icon: <MessageSquare className="h-3.5 w-3.5" /> },
  { key: 'Email', label: 'Email', icon: <Mail className="h-3.5 w-3.5" /> },
  { key: 'Mail', label: 'Mail', icon: <Package className="h-3.5 w-3.5" /> },
  { key: 'Other', label: 'Other', icon: <MoreHorizontal className="h-3.5 w-3.5" /> },
]


const EMPTY_COPY: Record<Filter, { title: string; message: string }> = {
  'needs-notes': {
    title: 'All caught up.',
    message: 'No past interactions are missing notes.',
  },
  upcoming: {
    title: 'Nothing on the calendar.',
    message: 'No upcoming interactions in the next 60 days.',
  },
  past: {
    title: 'No past interactions yet.',
    message: 'Interactions you have already had will show up here.',
  },
  all: {
    title: 'No interactions found.',
    message: 'Try a different filter or run a calendar sync from Settings.',
  },
}

function formatRowDate(item: ListItem): string {
  return `${item.weekday} ${item.month} ${item.day}`
}

function groupByMonth(items: ListItem[]): { label: string; rows: ListItem[] }[] {
  const groups = new Map<string, ListItem[]>()
  const labels = new Map<string, string>()
  for (const item of items) {
    const d = new Date(item.startMs)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (!groups.has(key)) {
      groups.set(key, [])
      labels.set(key, d.toLocaleString('en-US', { month: 'long', year: 'numeric' }))
    }
    groups.get(key)!.push(item)
  }
  return [...groups.entries()].map(([key, rows]) => ({ label: labels.get(key) ?? key, rows }))
}

interface Props {
  items: ListItem[]
  initialFilter: Filter
  humans?: Human[]
}

export default function InteractionsList({ items, initialFilter, humans = [] }: Props) {
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [query, setQuery] = useState('')
  const router = useRouter()

  useEffect(() => {
    const url = new URL(window.location.href)
    if (filter === 'needs-notes') url.searchParams.delete('filter')
    else url.searchParams.set('filter', filter)
    window.history.replaceState({}, '', url.toString())
  }, [filter])

  // Only show type pills that actually appear in the current dataset
  const presentTypes = useMemo(() => {
    const types = new Set(items.map((i) => i.interactionType ?? 'Calendar Event'))
    return TYPE_OPTIONS.filter((t) => types.has(t.key))
  }, [items])

  const counts = useMemo(() => {
    const all = items.length
    const upcoming = items.filter((i) => !i.isPast).length
    const past = items.filter((i) => i.isPast).length
    const needsNotes = items.filter((i) => i.isPast && !i.hasNote).length
    return { all, upcoming, past, 'needs-notes': needsNotes }
  }, [items])

  const filtered = useMemo(() => {
    let result = items
    if (filter === 'needs-notes') result = result.filter((i) => i.isPast && !i.hasNote)
    else if (filter === 'upcoming') result = result.filter((i) => !i.isPast)
    else if (filter === 'past') result = result.filter((i) => i.isPast)

    if (typeFilter !== 'all') {
      result = result.filter((i) => (i.interactionType ?? 'Calendar Event') === typeFilter)
    }

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(
        (i) =>
          (i.humanName ?? '').toLowerCase().includes(q) ||
          (i.title ?? '').toLowerCase().includes(q) ||
          (i.displayLabel ?? '').toLowerCase().includes(q),
      )
    }

    if (filter === 'upcoming') return [...result].sort((a, b) => a.startMs - b.startMs)
    return [...result].sort((a, b) => b.startMs - a.startMs)
  }, [items, filter, typeFilter, query])

  const grouped = useMemo(() => groupByMonth(filtered), [filtered])
  const empty = EMPTY_COPY[filter]

  return (
    <div className="space-y-4">
      {/* Row 1: status filter + log button + search */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        {/* Status filter pills */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none items-center">
          {FILTER_LABELS.map(({ key, label }) => {
            const count = counts[key]
            const active = filter === key
            return (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground hover:bg-muted'
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`ml-1.5 text-xs ${active ? 'text-muted-foreground/60' : 'text-muted-foreground'}`}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Log Interaction button */}
        <AddInteractionDialog
          humans={humans}
          trigger={
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-[hsl(213,70%,30%)] text-white hover:bg-[hsl(213,70%,25%)] transition-colors whitespace-nowrap flex-shrink-0">
              <Plus className="h-3.5 w-3.5" />
              Log Interaction
            </button>
          }
        />

        {/* Search */}
        <div className="relative sm:ml-auto sm:max-w-xs sm:flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or title…"
            className="w-full rounded-lg border border-border bg-card pl-9 pr-9 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 focus:border-[hsl(213,70%,30%)]"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: type filter — only shown when >1 type present */}
      {presentTypes.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setTypeFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              typeFilter === 'all'
                ? 'bg-[hsl(213,70%,30%)] text-white'
                : 'bg-muted text-muted-foreground hover:bg-muted'
            }`}
          >
            All Types
          </button>
          {presentTypes.map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setTypeFilter(typeFilter === key ? 'all' : key)}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                typeFilter === key
                  ? 'bg-[hsl(213,70%,30%)] text-white'
                  : 'bg-muted text-muted-foreground hover:bg-muted'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-xl shadow-sm p-10 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Calendar className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">{empty.title}</p>
          <p className="text-xs text-muted-foreground">{empty.message}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ label, rows }) => (
            <div key={label}>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
                {label}
              </p>
              <ul className="bg-card rounded-xl shadow-sm divide-y divide-border overflow-hidden">
                {rows.map((item) => {
                  const subjectName = item.humanName ?? item.displayLabel ?? 'Unknown'
                  const needsNotes = item.isPast && !item.hasNote
                  const href = item.humanId
                    ? `/myhumans/${item.humanId}/interactions/${item.interactionId}`
                    : `/interactions/${item.interactionId}`
                  const takeNotesHref = item.humanId
                    ? `/myhumans/${item.humanId}/take-notes?interactionId=${item.interactionId}`
                    : null
                  const itype = item.interactionType ?? 'Calendar Event'
                  return (
                    <li key={item.interactionId}>
                      {/*
                        Row uses a plain div + router.push so we can include a
                        separate <Link> for Take Notes without nesting <a> in <a>.
                      */}
                      <div
                        role="link"
                        tabIndex={0}
                        onClick={() => router.push(href)}
                        onKeyDown={(e) => e.key === 'Enter' && router.push(href)}
                        className="flex items-center gap-3 py-3 px-4 hover:bg-muted/50 transition-colors cursor-pointer"
                      >
                        <div className="text-xs font-medium text-muted-foreground w-20 flex-shrink-0">
                          {formatRowDate(item)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {subjectName}
                            {item.title && (
                              <span className="text-muted-foreground font-normal">
                                {' · '}
                                {item.title}
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.timeRange}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            <span className="text-muted-foreground">Interaction Type: </span>
                            {TYPE_OPTIONS.find((t) => t.key === itype)?.label ?? itype}
                          </p>
                        </div>

                        {/* Take Notes — always visible when a human is linked */}
                        {takeNotesHref && (
                          <Link
                            href={takeNotesHref}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[hsl(213,70%,40%)] hover:text-[hsl(213,70%,25%)] whitespace-nowrap transition-colors"
                          >
                            <NotebookPen className="h-3 w-3" />
                            Take Notes
                          </Link>
                        )}

                        {needsNotes ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                            <FileText className="h-3 w-3" />
                            Add notes
                          </span>
                        ) : item.hasNote ? (
                          <span className="text-xs text-muted-foreground whitespace-nowrap">Noted</span>
                        ) : null}

                        <ChevronRight className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
