'use client'

import { useMemo, useState } from 'react'
import { BookOpen, Search, X } from 'lucide-react'
import NoteItem from '../NoteItem'
import LogNoteDialog from '../LogNoteDialog'
import type { Note } from '@/lib/types'

interface Props {
  sessionNotes: Note[]
  userCanWrite: boolean
  userId: string
}

export default function CoachNotesSection({ sessionNotes, userCanWrite, userId }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return sessionNotes
    return sessionNotes.filter((note) => note.content.toLowerCase().includes(q))
  }, [sessionNotes, query])

  if (!userCanWrite) return null

  const hasAny = sessionNotes.length > 0

  return (
    <div className="bg-card rounded-xl shadow-sm p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-semibold text-foreground">General Notes</h2>
          {hasAny && query && (
            <span className="text-xs text-muted-foreground font-medium">
              {filtered.length} of {sessionNotes.length}
            </span>
          )}
        </div>
        <LogNoteDialog
          userId={userId}
          trigger={
            <button className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(213,70%,30%)] px-3 py-1.5 text-xs font-medium text-white hover:bg-[hsl(213,70%,25%)] transition-colors">
              + Add Notes
            </button>
          }
        />
      </div>

      {hasAny && (
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full pl-9 pr-9 py-2 text-sm rounded-md border border-border focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] placeholder:text-muted-foreground"
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
      )}

      {!hasAny ? (
        <p className="text-sm text-muted-foreground">No notes yet — use the Add Notes button above.</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">No notes match this search.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </div>
      )}
    </div>
  )
}
