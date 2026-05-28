'use client'

import { useEffect, useRef } from 'react'

const DEBOUNCE_MS = 2_000

export function useDraftSave(key: string, value: string, enabled = true): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify({ value, savedAt: Date.now() }))
      } catch {}
    }, DEBOUNCE_MS)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [key, value, enabled])
}

export function clearDraft(key: string): void {
  try { localStorage.removeItem(key) } catch {}
}

export function loadDraft(key: string): string | null {
  try {
    const item = localStorage.getItem(key)
    if (!item) return null
    const parsed = JSON.parse(item) as { value: string }
    return parsed.value ?? null
  } catch {
    return null
  }
}
