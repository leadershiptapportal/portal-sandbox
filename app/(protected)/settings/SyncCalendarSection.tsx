'use client'

import { useState } from 'react'
import { RefreshCw, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import LinkCalendarButton from './LinkCalendarButton'

interface Props {
  calendarLinked: boolean
  calendarSetupComplete: boolean
  lastSyncedAt?: string
}

export default function SyncCalendarSection({ calendarLinked, calendarSetupComplete, lastSyncedAt }: Props) {
  const [syncing, setSyncing] = useState(false)

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Sync failed')
        return
      }
      toast.success(`Synced ${data.synced} interaction${data.synced === 1 ? '' : 's'}`)
      window.location.reload()
    } catch {
      toast.error('Sync failed — check your connection')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      <LinkCalendarButton linked={calendarLinked} />

      {calendarLinked && (
        <>
          <div className="border-t border-border" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground font-medium">Sync Now</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {lastSyncedAt
                  ? `Last synced ${new Date(lastSyncedAt).toLocaleString()}`
                  : calendarSetupComplete
                  ? 'Never synced'
                  : 'Complete calendar setup to enable sync'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/settings/calendar-setup"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground border border-border hover:bg-muted/50 transition-colors"
                title="Edit calendar settings"
              >
                <Settings2 className="h-3.5 w-3.5" />
                Edit
              </a>
              <button
                onClick={handleSync}
                disabled={syncing || !calendarSetupComplete}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[hsl(213,70%,30%)] text-white hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync Now'}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
