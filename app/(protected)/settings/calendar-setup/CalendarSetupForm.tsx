'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarCheck } from 'lucide-react'
import { toast } from 'sonner'
import { saveCalendarSetup } from './actions'
import type { GraphCalendar } from '@/lib/microsoft/graph'

interface Props {
  calendars: GraphCalendar[]
  defaultSelectedIds: string[]
  defaultPastDays: number
  defaultFutureDays: number
}

export default function CalendarSetupForm({
  calendars,
  defaultSelectedIds,
  defaultPastDays,
  defaultFutureDays,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set(defaultSelectedIds))
  const [pastDays, setPastDays] = useState(defaultPastDays)
  const [futureDays, setFutureDays] = useState(defaultFutureDays)
  const [saving, setSaving] = useState(false)

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (selected.size === 0) {
      toast.error('Select at least one calendar')
      return
    }
    setSaving(true)
    try {
      const result = await saveCalendarSetup([...selected], pastDays, futureDays)
      if ('error' in result) {
        toast.error(result.error)
        return
      }
      // Trigger the first sync
      const syncRes = await fetch('/api/calendar/sync', { method: 'POST' })
      const syncData = await syncRes.json()
      if (!syncRes.ok) {
        toast.warning(`Setup saved, but sync failed: ${syncData.error ?? 'Unknown error'}`)
      } else {
        toast.success(`Calendar connected — synced ${syncData.synced} interaction${syncData.synced === 1 ? '' : 's'}`)
      }
      router.push('/settings')
    } catch {
      toast.error('Something went wrong — please try again')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Calendar list */}
      <div className="space-y-2">
        {calendars.map(cal => (
          <label
            key={cal.id}
            className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors"
          >
            <input
              type="checkbox"
              checked={selected.has(cal.id)}
              onChange={() => toggle(cal.id)}
              className="h-4 w-4 rounded border-slate-300 text-[hsl(213,70%,30%)] accent-[hsl(213,70%,30%)]"
            />
            <span className="text-sm text-slate-800 font-medium">{cal.name}</span>
            {cal.isDefaultCalendar && (
              <span className="ml-auto text-xs text-slate-400">Primary</span>
            )}
          </label>
        ))}
      </div>

      {/* Sync window */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Sync past (days)
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={pastDays}
            onChange={e => setPastDays(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]"
          />
          <p className="text-xs text-slate-400 mt-1">How far back to pull past events</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Sync ahead (days)
          </label>
          <input
            type="number"
            min={1}
            max={365}
            value={futureDays}
            onChange={e => setFutureDays(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]"
          />
          <p className="text-xs text-slate-400 mt-1">How far ahead to pull upcoming events</p>
        </div>
      </div>

      <button
        type="submit"
        disabled={saving || selected.size === 0}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[hsl(213,70%,30%)] text-white hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
      >
        <CalendarCheck className="h-4 w-4" />
        {saving ? 'Saving & syncing…' : 'Save & Start Sync'}
      </button>
    </form>
  )
}
