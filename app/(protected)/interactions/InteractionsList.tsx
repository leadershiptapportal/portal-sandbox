'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import {
  Search, Calendar, X, NotebookPen, ClipboardList, Plus,
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
              <div className="space-y-2">
                {rows.map((item) => {
                  const subjectName = item.humanName ?? item.displayLabel ?? 'Unknown'
                  const href = item.humanId
                    ? `/myhumans/${item.humanId}/interactions/${item.interactionId}`
                    : `/interactions/${item.interactionId}`
                  const itype = item.interactionType ?? 'Calendar Event'
                  const typeLabel = TYPE_OPTIONS.find((t) => t.key === itype)?.label ?? itype
                  return (
                    <div
                      key={item.interactionId}
                      className="relative rounded-lg border border-border bg-card overflow-hidden"
                    >
                      {/* Stretched link to interaction detail */}
                      <Link
                        href={href}
                        className="absolute inset-0 hover:bg-muted/50 transition-colors"
                        aria-label={item.title || 'View interaction'}
                      />

                      {/* Main content row */}
                      <div className="relative z-10 flex items-center gap-3 px-4 py-3 pointer-events-none">
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
                          {item.humanId ? (
                            <Link
                              href={`/myhumans/${item.humanId}`}
                              className="pointer-events-auto text-sm font-medium text-foreground hover:underline truncate block"
                            >
                              {subjectName}
                            </Link>
                          ) : (
                            <p className="text-sm font-medium text-foreground truncate">{subjectName}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {item.title || typeLabel}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.timeRange}</p>
                        </div>

                        <span className="flex-shrink-0 text-muted-foreground/60 text-sm">›</span>
                      </div>

                      {/* Note action buttons */}
                      {item.humanId && (
                        <div className="relative z-10 flex items-center gap-2 flex-wrap px-4 pb-2.5 pt-2 border-t border-border">
                          <Link
                            href={`/myhumans/${item.humanId}/take-notes?interactionId=${item.interactionId}&noteCategory=prep`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                          >
                            <ClipboardList className="h-3 w-3" />
                            Edit Pre-Notes
                          </Link>
                          <Link
                            href={`/myhumans/${item.humanId}/take-notes?interactionId=${item.interactionId}&noteCategory=interaction`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                          >
                            <NotebookPen className="h-3 w-3" />
                            Edit Interaction Notes
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
