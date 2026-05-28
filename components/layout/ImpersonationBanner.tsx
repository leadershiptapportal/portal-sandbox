'use client'

import { useTransition } from 'react'
import { stopImpersonationAction } from '@/app/(protected)/settings/actions'

export function ImpersonationBanner({ name }: { name: string }) {
  const [pending, startTransition] = useTransition()

  function handleExit() {
    startTransition(() => stopImpersonationAction())
  }

  return (
    <div className="fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-3 bg-amber-500 text-white text-sm font-medium py-2 px-4 shadow-md">
      <span>
        Viewing as <strong>{name}</strong>
      </span>
      <button
        onClick={handleExit}
        disabled={pending}
        className="ml-2 px-3 py-0.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors text-xs font-semibold disabled:opacity-50"
      >
        {pending ? 'Exiting…' : 'Exit'}
      </button>
    </div>
  )
}
