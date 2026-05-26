'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Search, X } from 'lucide-react'

interface Client {
  id: string
  name: string
}

interface Props {
  clients: Client[]
  trigger: React.ReactNode
}

const MIN_CHARS = 2

export default function TakeNotesDialog({ clients, trigger }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [personId, setPersonId] = useState('')
  const [personName, setPersonName] = useState('')
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)

  const results =
    query.trim().length >= MIN_CHARS
      ? clients.filter((c) =>
          c.name.toLowerCase().includes(query.trim().toLowerCase()),
        )
      : []

  function handleOpen() {
    setQuery('')
    setPersonId('')
    setPersonName('')
    setShowResults(false)
    setOpen(true)
  }

  function selectPerson(client: Client) {
    setPersonId(client.id)
    setPersonName(client.name)
    setQuery(client.name)
    setShowResults(false)
  }

  function clearPerson() {
    setPersonId('')
    setPersonName('')
    setQuery('')
  }

  function handleProceed() {
    if (!personId) return
    setOpen(false)
    router.push(`/myhumans/${personId}/take-notes`)
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <>
      <div onClick={handleOpen}>{trigger}</div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Take Notes</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Person search */}
            <div className="space-y-1.5" ref={searchRef}>
              <Label>Who is this session for?</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
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

                {showResults && query.trim().length >= MIN_CHARS && (
                  <div className="absolute z-50 top-full mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-52 overflow-y-auto">
                    {results.length > 0 ? (
                      results.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectPerson(c) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors"
                        >
                          {c.name}
                        </button>
                      ))
                    ) : (
                      <p className="px-3 py-2 text-sm text-slate-400">No matches</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={handleProceed}
              disabled={!personId}
              className="w-full py-2 rounded-md bg-[hsl(213,70%,30%)] text-white text-sm font-medium hover:bg-[hsl(213,70%,25%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Take Notes{personName ? ` for ${personName}` : ''}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
