'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Search, X } from 'lucide-react'
import { FileText } from 'lucide-react'
import NoteComposer from '@/components/notes/NoteComposer'

interface Human {
  id: string
  name: string
}

interface Props {
  /** Pre-set person — hides the person search (use from profile page) */
  userId?: string
  /** Shown in the person search (use from dashboard) */
  humans?: Human[]
  /** Custom trigger element; if omitted a default button is rendered */
  trigger?: React.ReactNode
}

export default function LogNoteDialog({ userId, humans, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const [personId, setPersonId] = useState('')
  const [personName, setPersonName] = useState('')
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const effectivePersonId = userId ?? personId

  // Minimum characters before showing results
  const MIN_CHARS = 2

  const results =
    query.trim().length >= MIN_CHARS && humans
      ? humans.filter((c) =>
          c.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : []

  function handleOpen() {
    setPersonId('')
    setPersonName('')
    setQuery('')
    setShowResults(false)
    setOpen(true)
  }

  function selectPerson(human: Human) {
    setPersonId(human.id)
    setPersonName(human.name)
    setQuery(human.name)
    setShowResults(false)
  }

  function clearPerson() {
    setPersonId('')
    setPersonName('')
    setQuery('')
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const triggerEl = trigger ? (
    <div onClick={handleOpen}>{trigger}</div>
  ) : (
    <Button variant="outline" size="sm" onClick={handleOpen}>
      <FileText />
      Add Note
    </Button>
  )

  return (
    <>
      {triggerEl}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Person search — only when no userId pre-set */}
            {!userId && humans && (
              <div className="space-y-1.5" ref={searchRef}>
                <Label>Person</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value)
                      // If the user edits after a selection, clear the selection
                      if (personId && e.target.value !== personName) {
                        setPersonId('')
                        setPersonName('')
                      }
                      setShowResults(true)
                    }}
                    onFocus={() => setShowResults(true)}
                    placeholder="Search by name…"
                    className="w-full pl-9 pr-9 py-2 text-sm rounded-md border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] placeholder:text-slate-400"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={clearPerson}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Results dropdown */}
                  {showResults && query.trim().length >= MIN_CHARS && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
                      {results.length > 0 ? (
                        results.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={(e) => {
                              // mousedown fires before blur so we can select before hiding
                              e.preventDefault()
                              selectPerson(c)
                            }}
                            className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                          >
                            {c.name}
                          </button>
                        ))
                      ) : (
                        <p className="px-3 py-3 text-sm text-slate-400 italic">
                          No matching people found.
                        </p>
                      )}
                    </div>
                  )}
                </div>
                {query.trim().length > 0 && query.trim().length < MIN_CHARS && (
                  <p className="text-xs text-slate-400">
                    Keep typing to search…
                  </p>
                )}
              </div>
            )}

            {effectivePersonId ? (
              <NoteComposer
                subjectPersonId={effectivePersonId}
                onSaved={() => setOpen(false)}
                onCancel={() => setOpen(false)}
                hideInkLink
              />
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">
                {userId ? '' : 'Search for a person above to write your note.'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
