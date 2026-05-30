'use client'

import { useState, useMemo, useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight, Plus, Search, Users, X, LayoutGrid, Building2 } from 'lucide-react'
import type { Human } from '@/lib/types'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface EnrichedHuman {
  user: Human
  noteCount: number
  openTaskCount: number
  interactionCount: number  // from user.associatedMeetingIds.length
  lastInteraction: string | null   // "Mar 12" — most recent past interaction
  nextInteraction: string | null   // "May 2"  — nearest upcoming interaction
}

interface Props {
  users: EnrichedHuman[]
}

type ViewMode = 'humans' | 'organization'

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDisplayName(user: Human): string {
  if (user.fullName) return user.fullName
  if (user.firstName || user.lastName)
    return [user.firstName, user.lastName].filter(Boolean).join(' ')
  return user.preferredName ?? user.workEmail ?? ''
}

function getInitials(user: Human): string {
  if (user.firstName && user.lastName)
    return (user.firstName[0] + user.lastName[0]).toUpperCase()
  if (user.fullName) {
    const parts = user.fullName.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0][0].toUpperCase()
  }
  return user.workEmail?.[0]?.toUpperCase() ?? '?'
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
]

function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

function isRecordId(v: string): boolean {
  return /^rec[A-Za-z0-9]{8,}$/.test(v)
}

// ── Sub-components ────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: string }) {
  if (!role || isRecordId(role)) return null
  const lower = role.toLowerCase()
  if (lower === 'coach')
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">{role}</span>
  if (lower === 'admin')
    return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-foreground text-background whitespace-nowrap">{role}</span>
  return <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-muted text-muted-foreground whitespace-nowrap">{role}</span>
}

function HumanCard({ enriched }: { enriched: EnrichedHuman }) {
  const { user, interactionCount, noteCount, openTaskCount, lastInteraction, nextInteraction } = enriched
  const name = getDisplayName(user)
  const subtitle = [user.title, user.organizationName].filter(Boolean).join(' · ')
  const role = user.role && !isRecordId(user.role) ? user.role : null

  return (
    <Link
      href={`/myhumans/${user.id}`}
      className="block bg-card rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        {user.profilePhoto ? (
          <img
            src={user.profilePhoto}
            alt={name}
            className="w-11 h-11 rounded-full object-cover flex-shrink-0 mt-0.5"
          />
        ) : (
          <div
            className={`w-11 h-11 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 mt-0.5 ${avatarColor(user.id)}`}
          >
            {getInitials(user)}
          </div>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          {/* Name row + role badge + chevron */}
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-foreground truncate flex-1 min-w-0">{name}</p>
            {role && <RoleBadge role={role} />}
            <ChevronRight className="h-4 w-4 text-muted-foreground/60 flex-shrink-0" />
          </div>

          {/* Subtitle: Title · Organization */}
          {subtitle && (
            <p className="text-sm text-muted-foreground truncate mt-0.5">{subtitle}</p>
          )}

          {/* Interaction dates */}
          {(lastInteraction || nextInteraction) && (
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
              {lastInteraction && (
                <span className="text-xs text-muted-foreground">
                  Last: <span className="text-muted-foreground">{lastInteraction}</span>
                </span>
              )}
              {nextInteraction && (
                <span className="text-xs text-[hsl(213,70%,40%)] font-medium">
                  Next: {nextInteraction}
                </span>
              )}
              {lastInteraction && !nextInteraction && (
                <span className="text-xs text-muted-foreground/60 italic">No upcoming</span>
              )}
            </div>
          )}

          {/* Stats row */}
          {(noteCount > 0 || openTaskCount > 0 || interactionCount > 0) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {interactionCount > 0 && (
                <span className="text-xs text-muted-foreground">{interactionCount} interaction{interactionCount !== 1 ? 's' : ''}</span>
              )}
              {noteCount > 0 && (
                <>
                  <span className="text-muted-foreground/30 text-xs">·</span>
                  <span className="text-xs text-muted-foreground">{noteCount} note{noteCount !== 1 ? 's' : ''}</span>
                </>
              )}
              {openTaskCount > 0 && (
                <>
                  <span className="text-muted-foreground/30 text-xs">·</span>
                  <span className="text-xs text-amber-600 font-medium">{openTaskCount} task{openTaskCount !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  )
}

// ── View toggle ───────────────────────────────────────────────────────────────

function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="inline-flex rounded-lg border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => onChange('humans')}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
          mode === 'humans'
            ? 'bg-[hsl(213,70%,30%)] text-white'
            : 'text-muted-foreground hover:bg-muted/50'
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        By Name
      </button>
      <button
        onClick={() => onChange('organization')}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors border-l border-border ${
          mode === 'organization'
            ? 'bg-[hsl(213,70%,30%)] text-white'
            : 'text-muted-foreground hover:bg-muted/50'
        }`}
      >
        <Building2 className="h-3.5 w-3.5" />
        By Organization
      </button>
    </div>
  )
}

// ── Main grid ─────────────────────────────────────────────────────────────────

export default function HumansGrid({ users }: Props) {
  const [query, setQuery] = useState('')
  const [sortBy, setSortBy] = useState('recent')
  const [viewMode, setViewMode] = useState<ViewMode>('humans')

  // Restore view mode from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem('clientsViewMode')
    if (saved === 'humans' || saved === 'organization') setViewMode(saved)
  }, [])

  function handleViewModeChange(mode: ViewMode) {
    setViewMode(mode)
    localStorage.setItem('clientsViewMode', mode)
  }

  const filtered = useMemo(() => {
    let result = [...users]

    if (query.trim()) {
      const q = query.toLowerCase()
      result = result.filter(({ user }) =>
        getDisplayName(user).toLowerCase().includes(q) ||
        (user.organizationName ?? '').toLowerCase().includes(q) ||
        (user.workEmail ?? '').toLowerCase().includes(q)
      )
    }

    if (sortBy === 'name-asc') {
      result.sort((a, b) => getDisplayName(a.user).localeCompare(getDisplayName(b.user)))
    } else {
      result.sort((a, b) => b.interactionCount - a.interactionCount)
    }

    return result
  }, [users, query, sortBy])

  const groupedByOrganization = useMemo(() => {
    const map = new Map<string, EnrichedHuman[]>()
    for (const enriched of filtered) {
      const orgName = enriched.user.organizationName?.trim() || 'Individual'
      if (!map.has(orgName)) map.set(orgName, [])
      map.get(orgName)!.push(enriched)
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'Individual') return 1
      if (b === 'Individual') return -1
      return a.localeCompare(b)
    })
  }, [filtered])

  return (
    <div className="p-4 md:p-8 space-y-5">

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or organization..."
            className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 focus:border-[hsl(213,70%,30%)]"
          />
        </div>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 focus:border-[hsl(213,70%,30%)] pr-8 appearance-none cursor-pointer"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")", backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center' }}
        >
          <option value="recent">Recently Active</option>
          <option value="name-asc">Name A–Z</option>
        </select>

        {/* View toggle */}
        <ViewToggle mode={viewMode} onChange={handleViewModeChange} />

        {/* Add Human button */}
        <Link
          href="/humans/new"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-foreground shadow-sm hover:bg-muted/50 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Human
        </Link>
      </div>

      {/* ── Grid or empty state ─────────────────────────────────────────────── */}
      {users.length === 0 ? (
        <p className="text-sm text-muted-foreground">No humans yet.</p>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground mb-1">No humans match your search</p>
          <button
            onClick={() => setQuery('')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[hsl(213,70%,30%)] hover:underline mt-3"
          >
            <X className="h-3.5 w-3.5" />
            Clear search
          </button>
        </div>
      ) : viewMode === 'organization' ? (
        /* ── Organization grouped view ────────────────────────────────────── */
        <div className="space-y-8">
          {groupedByOrganization.map(([orgName, members]) => (
            <div key={orgName}>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <h3 className="text-sm font-semibold text-foreground">{orgName}</h3>
                {members.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                    {members.length}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {members.map((enriched) => (
                  <HumanCard key={enriched.user.id} enriched={enriched} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── Default flat grid ────────────────────────────────────────────── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((enriched) => (
            <HumanCard key={enriched.user.id} enriched={enriched} />
          ))}
        </div>
      )}
    </div>
  )
}
