'use client'

import { useTheme } from 'next-themes'
import { useTransition, useEffect, useState } from 'react'
import { saveThemeAction } from './actions'

const OPTIONS = [
  { value: 'light', label: 'Light' },
  { value: 'dark',  label: 'Dark' },
  { value: 'system', label: 'System' },
] as const

export function ThemeToggle({ initialTheme }: { initialTheme?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    setMounted(true)
    // If Airtable has a saved preference and localStorage has nothing yet, honour it
    if (initialTheme && !localStorage.getItem('mh-theme')) {
      setTheme(initialTheme)
    }
  }, [])

  function handleChange(value: 'light' | 'dark' | 'system') {
    setTheme(value)
    startTransition(() => saveThemeAction(value))
  }

  const active = mounted ? (theme ?? 'system') : (initialTheme ?? 'system')

  return (
    <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => handleChange(value)}
          disabled={pending}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            active === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
