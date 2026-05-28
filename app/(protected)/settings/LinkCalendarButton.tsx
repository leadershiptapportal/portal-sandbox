'use client'

import { useState } from 'react'
import { CalendarCheck, CalendarX2 } from 'lucide-react'

interface Props {
  linked?: boolean
}

export default function LinkCalendarButton({ linked = false }: Props) {
  const [loading, setLoading] = useState(false)

  function handleLink() {
    setLoading(true)
    window.location.href = '/api/auth/microsoft'
  }

  async function handleUnlink() {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/microsoft/unlink', { method: 'POST' })
      if (res.ok) window.location.reload()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-foreground font-medium">Microsoft 365 Calendar</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {linked
            ? 'Your calendar is connected — interactions sync automatically'
            : 'Link your work calendar to enable interaction syncing'}
        </p>
      </div>

      {linked ? (
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CalendarCheck className="h-3.5 w-3.5" />
            Linked
          </span>
          <button
            onClick={handleUnlink}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:bg-muted/50 disabled:opacity-50 transition-colors"
          >
            <CalendarX2 className="h-3.5 w-3.5" />
            Unlink
          </button>
        </div>
      ) : (
        <button
          onClick={handleLink}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[hsl(213,70%,30%)] text-white hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
        >
          <CalendarCheck className="h-3.5 w-3.5" />
          {loading ? 'Redirecting…' : 'Link My Calendar'}
        </button>
      )}
    </div>
  )
}
