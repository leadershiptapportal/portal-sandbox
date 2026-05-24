'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

type SearchResult = { id: string; name: string; jobTitle?: string }

interface GlobalSearchProps {
  collapsed: boolean
}

export default function GlobalSearch({ collapsed }: GlobalSearchProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMac, setIsMac] = useState(false)
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes('MAC'))
  }, [])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/search/users?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(Array.isArray(data) ? data : [])
      setActiveIndex(0)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(query), 200)
    return () => clearTimeout(debounceRef.current)
  }, [query, search])

  function handleSelect(id: string) {
    setOpen(false)
    setQuery('')
    setResults([])
    router.push(`/users/${id}`)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[activeIndex]) {
      handleSelect(results[activeIndex].id)
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setQuery('')
      setResults([])
    }
  }

  const initials = (name: string) =>
    name
      .split(' ')
      .map(w => w[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`group relative flex items-center rounded-lg transition-colors ${
          collapsed
            ? 'justify-center w-10 mx-auto px-0 min-h-[44px] text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            : 'gap-2 px-3 py-2 w-full bg-white border border-slate-200 hover:border-slate-300 text-slate-400 hover:text-slate-500'
        }`}
        aria-label="Search people"
        title={collapsed ? 'Search people' : undefined}
      >
        <Search className="h-4 w-4 flex-shrink-0" />
        {!collapsed && (
          <>
            <span className="flex-1 text-left text-sm text-slate-400">Search people...</span>
            <kbd className="text-[11px] text-slate-300 font-sans leading-none">
              {isMac ? '⌘K' : 'Ctrl K'}
            </kbd>
          </>
        )}
        {collapsed && (
          <span
            className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 rounded-md bg-slate-900 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-50"
            role="tooltip"
          >
            Search people
          </span>
        )}
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton={false} className="p-0 gap-0 max-w-md overflow-hidden">
          <DialogTitle className="sr-only">Search people</DialogTitle>

          <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100">
            <Search className="h-4 w-4 text-slate-400 flex-shrink-0" />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search people..."
              className="flex-1 text-sm outline-none bg-transparent text-slate-900 placeholder:text-slate-400"
            />
            {loading && (
              <div className="h-4 w-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin flex-shrink-0" />
            )}
          </div>

          {results.length > 0 && (
            <ul className="py-1 max-h-72 overflow-y-auto">
              {results.map((result, i) => (
                <li key={result.id}>
                  <button
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => handleSelect(result.id)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      i === activeIndex ? 'bg-slate-100' : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[hsl(213,60%,90%)] text-[hsl(213,70%,30%)] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                      {initials(result.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-slate-900 truncate">
                        {result.name}
                      </div>
                      {result.jobTitle && (
                        <div className="text-xs text-slate-500 truncate">{result.jobTitle}</div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-slate-400">
              No people found for &ldquo;{query}&rdquo;
            </div>
          )}

          {query.length < 2 && (
            <div className="px-4 py-5 text-center text-xs text-slate-400">
              Type a name to search
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
