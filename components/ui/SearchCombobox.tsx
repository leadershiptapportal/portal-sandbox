'use client'

import { useState, useRef } from 'react'
import { Search, X } from 'lucide-react'

interface Option {
  id: string
  name: string
}

interface Props {
  options: Option[]
  value: string
  onValueChange: (id: string) => void
  placeholder?: string
  disabled?: boolean
}

/**
 * Single-select search combobox. When a value is selected, shows it as
 * a dismissible chip. When empty, shows a filterable search input.
 * Results render inline (no floating overlay) — safe inside modals.
 */
export default function SearchCombobox({
  options,
  value,
  onValueChange,
  placeholder = 'Search…',
  disabled,
}: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = value ? options.find((o) => o.id === value) ?? null : null

  const filtered = options
    .filter((o) => o.id !== value)
    .filter((o) =>
      query.trim() ? o.name.toLowerCase().includes(query.toLowerCase().trim()) : true,
    )
    .slice(0, 8)

  function handleSelect(option: Option) {
    onValueChange(option.id)
    setQuery('')
    setOpen(false)
  }

  function handleClear() {
    onValueChange('')
    setQuery('')
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  if (selected) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/50 px-3 py-2 text-sm">
        <span className="flex-1 truncate text-foreground">{selected.name}</span>
        {!disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] disabled:opacity-50 disabled:cursor-not-allowed"
        />
      </div>
      {open && (query.trim() ? filtered.length > 0 : filtered.length > 0) && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-sm">
          {filtered.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); handleSelect(option) }}
                className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
              >
                {option.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && query.trim() && filtered.length === 0 && (
        <p className="mt-1 px-3 py-2 text-sm text-muted-foreground italic border border-border rounded-md bg-muted/30">
          No results for &ldquo;{query.trim()}&rdquo;
        </p>
      )}
    </div>
  )
}
