'use client'

import { useState, useTransition } from 'react'
import { startImpersonationAction } from './actions'

interface PortalUser {
  id: string
  name: string
  email: string
}

export function ImpersonateSection({ users }: { users: PortalUser[] }) {
  const [selected, setSelected] = useState('')
  const [pending, startTransition] = useTransition()

  function handleStart() {
    if (!selected) return
    startTransition(() => startImpersonationAction(selected))
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Select a portal user to view the app exactly as they would see it. A banner will appear while active.
      </p>
      <div className="flex gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)]/30 focus:border-[hsl(213,70%,30%)]"
        >
          <option value="">Choose a user…</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} — {u.email}
            </option>
          ))}
        </select>
        <button
          onClick={handleStart}
          disabled={!selected || pending}
          className="px-4 py-2 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 transition-colors disabled:opacity-40"
        >
          {pending ? 'Starting…' : 'View as'}
        </button>
      </div>
    </div>
  )
}
