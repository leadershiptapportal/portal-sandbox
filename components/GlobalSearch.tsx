'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

type SearchResult = { id: string; name: string; jobTitle?: string }

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

// Shared result list used by both the inline dropdown and the dialog
function ResultList({
  results,
  loading,
  query,
  activeIndex,
  onHover,
  onSelect,
  useMouseDown,
}: {
  results: SearchResult[]
  loading: boolean
  query: string
  activeIndex: number
  onHover: (i: number) => void
  onSelect: (id: string) => void
  useMouseDown?: boolean
}) {
  if (results.length > 0) {
    return (
      <ul className="py-1 max-h-72 overflow-y-auto">
        {results.map((r, i) => (
          <li key={r.id}>
            <button
              {...(useMouseDown
                ? { onMouseDown: (e: React.MouseEvent) => { e.preventDefault(); onSelect(r.id) } }
                : { onClick: () => onSelect(r.id) })}
              onMouseEnter={() => onHover(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === activeIndex ? 'bg-muted' : 'hover:bg-muted/50'
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-[hsl(213,60%,90%)] text-[hsl(213,70%,30%)] flex items-center justify-center text-xs font-semibold flex-shrink-0">
                {initials(r.name)}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground truncate">{r.name}</div>
                {r.jobTitle && (
                  <div className="text-xs text-muted-foreground truncate">{r.jobTitle}</div>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    )
  }
  if (query.length >= 2 && !loading) {
    return (
      <div className="px-4 py-5 text-center text-sm text-muted-foreground">
        No people found for &ldquo;{query}&rdquo;
      </div>
    )
  }
  return (
    <div className="px-4 py-5 text-center text-xs text-muted-foreground">
      Type a name to search
    </div>
  )
}

export default function GlobalSearch({ collapsed }: { collapsed: boolean }) {
  // Inline dropdown state (expanded sidebar)
  const [inlineQuery, setInlineQuery] = useState('')
  const [inlineResults, setInlineResults] = useState<SearchResult[]>([])
  const [inlineLoading, setInlineLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

  // Dialog state (Cmd+K or collapsed icon)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogQuery, setDialogQuery] = useState('')
  const [dialogResults, setDialogResults] = useState<SearchResult[]>([])
  const [dialogLoading, setDialogLoading] = useState(false)

  const [activeIndex, setActiveIndex] = useState(0)
  const [isMac, setIsMac] = useState(false)

  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const inlineDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const dialogDebounce = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    setIsMac(navigator.platform.toUpperCase().includes('MAC'))
  }, [])

  // Cmd+K opens the center dialog
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setDropdownOpen(false)
        setDialogOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Close inline dropdown on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Node
      if (containerRef.current?.contains(target) || dropdownRef.current?.contains(target)) return
      setDropdownOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const fetchResults = useCallback(
    async (q: string, setResults: (r: SearchResult[]) => void, setLoading: (v: boolean) => void) => {
      if (q.trim().length < 2) { setResults([]); setLoading(false); return }
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
    },
    [],
  )

  useEffect(() => {
    clearTimeout(inlineDebounce.current)
    inlineDebounce.current = setTimeout(
      () => fetchResults(inlineQuery, setInlineResults, setInlineLoading),
      200,
    )
    return () => clearTimeout(inlineDebounce.current)
  }, [inlineQuery, fetchResults])

  useEffect(() => {
    clearTimeout(dialogDebounce.current)
    dialogDebounce.current = setTimeout(
      () => fetchResults(dialogQuery, setDialogResults, setDialogLoading),
      200,
    )
    return () => clearTimeout(dialogDebounce.current)
  }, [dialogQuery, fetchResults])

  function openDropdown() {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    setDropdownStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
      zIndex: 9999,
    })
    setDropdownOpen(true)
  }

  function handleSelect(id: string) {
    setDropdownOpen(false)
    setDialogOpen(false)
    setInlineQuery('')
    setInlineResults([])
    setDialogQuery('')
    setDialogResults([])
    router.push(`/myhumans/${id}`)
  }

  function handleInlineKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, inlineResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && inlineResults[activeIndex]) {
      handleSelect(inlineResults[activeIndex].id)
    } else if (e.key === 'Escape') {
      setDropdownOpen(false)
      ;(e.target as HTMLInputElement).blur()
    }
  }

  function handleDialogKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(i => Math.min(i + 1, dialogResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && dialogResults[activeIndex]) {
      handleSelect(dialogResults[activeIndex].id)
    }
  }

  function handleDialogOpenChange(next: boolean) {
    setDialogOpen(next)
    if (!next) { setDialogQuery(''); setDialogResults([]) }
  }

  return (
    <>
      {collapsed ? (
        // Collapsed: icon only → opens center dialog
        <button
          onClick={() => setDialogOpen(true)}
          className="group relative flex items-center justify-center w-10 mx-auto px-0 min-h-[44px] rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Search my humans"
        >
          <Search className="h-4 w-4 flex-shrink-0" />
          <span
            className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 px-2 py-1 rounded-md bg-foreground text-background text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity shadow-md z-50"
            role="tooltip"
          >
            Search my humans
          </span>
        </button>
      ) : (
        // Expanded: real input with inline dropdown
        <div ref={containerRef}>
          <div className="flex items-center gap-2 px-3 py-2 bg-card border border-border hover:border-border rounded-lg focus-within:border-border transition-colors">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              value={inlineQuery}
              onChange={e => { setInlineQuery(e.target.value); setDropdownOpen(true) }}
              onFocus={openDropdown}
              onKeyDown={handleInlineKeyDown}
              placeholder="Search my humans..."
              className="flex-1 text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground min-w-0"
            />
            {inlineLoading ? (
              <div className="h-3.5 w-3.5 border-2 border-border border-t-muted-foreground rounded-full animate-spin flex-shrink-0" />
            ) : (
              <kbd className="text-[11px] text-muted-foreground/60 font-sans leading-none flex-shrink-0">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            )}
          </div>

          {dropdownOpen &&
            typeof window !== 'undefined' &&
            createPortal(
              <div
                ref={dropdownRef}
                style={dropdownStyle}
                className="bg-card border border-border rounded-lg shadow-lg overflow-hidden"
              >
                <ResultList
                  results={inlineResults}
                  loading={inlineLoading}
                  query={inlineQuery}
                  activeIndex={activeIndex}
                  onHover={setActiveIndex}
                  onSelect={handleSelect}
                  useMouseDown
                />
              </div>,
              document.body,
            )}
        </div>
      )}

      {/* Center dialog — Cmd+K or collapsed icon click */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent showCloseButton={false} className="p-0 gap-0 max-w-md overflow-hidden">
          <DialogTitle className="sr-only">Search my humans</DialogTitle>
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              value={dialogQuery}
              onChange={e => setDialogQuery(e.target.value)}
              onKeyDown={handleDialogKeyDown}
              placeholder="Search my humans..."
              className="flex-1 text-sm outline-none bg-transparent text-foreground placeholder:text-muted-foreground"
            />
            {dialogLoading && (
              <div className="h-4 w-4 border-2 border-border border-t-muted-foreground rounded-full animate-spin flex-shrink-0" />
            )}
          </div>
          <ResultList
            results={dialogResults}
            loading={dialogLoading}
            query={dialogQuery}
            activeIndex={activeIndex}
            onHover={setActiveIndex}
            onSelect={handleSelect}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
