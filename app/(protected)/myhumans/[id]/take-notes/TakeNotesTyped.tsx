'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Link2, WifiOff } from 'lucide-react'
import { saveTypedNoteAction } from '../actions'
import type { Interaction } from '@/lib/types'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface Props {
  personId: string
  meetings: Interaction[]
  initialInteraction: Interaction | null
  onSaveComplete: () => void
  onCancel: () => void
  onContentChange?: (hasContent: boolean) => void
}

function formatInteractionLabel(m: Interaction): string {
  const name = m.humanName ? `${m.humanName} · ` : ''
  const title = m.title || 'Untitled'
  const date = m.startTime
    ? new Date(m.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''
  return `${name}${title}${date ? ` — ${date}` : ''}`
}

export default function TakeNotesTyped({
  personId,
  meetings,
  initialInteraction,
  onSaveComplete,
  onCancel,
  onContentChange,
}: Props) {
  const draftKey = `typed-draft-${personId}`
  const isOnline = useOnlineStatus()

  const [content, setContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMeetingId, setSelectedMeetingId] = useState(initialInteraction?.id ?? '')
  const [showPicker, setShowPicker] = useState(false)
  const [draftReady, setDraftReady] = useState(false)

  const contentRef = useRef(content)
  useEffect(() => { contentRef.current = content }, [content])

  // Restore draft from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftKey)
      if (stored) {
        const draft = JSON.parse(stored) as { content?: string; meetingId?: string }
        if (draft.content) {
          setContent(draft.content)
          toast.info('Restored unsaved draft')
        }
        if (draft.meetingId) setSelectedMeetingId(draft.meetingId)
      }
    } catch {}
    setDraftReady(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save draft to localStorage every 30s
  useEffect(() => {
    if (!draftReady) return
    const interval = setInterval(() => {
      if (!contentRef.current.trim()) return
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          content: contentRef.current,
          savedAt: Date.now(),
        }))
      } catch {}
    }, 30_000)
    return () => clearInterval(interval)
  }, [draftReady, draftKey])

  // Notify parent when content presence changes
  useEffect(() => {
    onContentChange?.(content.trim().length > 0)
  }, [content, onContentChange])

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) ?? initialInteraction ?? null
  const canSave = content.trim().length > 0 && !saving && isOnline

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)

    const result = await saveTypedNoteAction(
      personId,
      content.trim(),
      selectedMeetingId || undefined,
    )

    if ('error' in result) {
      setError(result.error)
      setSaving(false)
      return
    }

    try { localStorage.removeItem(draftKey) } catch {}
    toast.success('Note saved')
    onSaveComplete()
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Offline banner ────────────────────────────────────────────────── */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs flex-shrink-0">
          <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
          You&apos;re offline — your work is saved locally and will sync when you reconnect.
        </div>
      )}

      {/* ── Text area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-card">
        {draftReady ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start typing your notes…"
            className="w-full h-full min-h-full resize-none bg-transparent px-5 py-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
            disabled={saving}
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
        ) : (
          <div className="w-full h-full animate-pulse bg-muted" />
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-card border-t border-border px-3 py-3 space-y-2">

        {/* Interaction link */}
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          {showPicker ? (
            <div className="flex-1 flex gap-2">
              <select
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={selectedMeetingId}
                onChange={(e) => { setSelectedMeetingId(e.target.value); setShowPicker(false) }}
                className="flex-1 text-xs border border-[hsl(213,70%,30%)] rounded-md px-2 py-1.5 bg-card focus:outline-none"
              >
                <option value="">— No linked interaction —</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>{formatInteractionLabel(m)}</option>
                ))}
              </select>
              <button
                onClick={() => setShowPicker(false)}
                className="text-xs text-muted-foreground px-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPicker(true)}
              className="flex-1 text-left text-xs text-muted-foreground hover:text-[hsl(213,70%,30%)] transition-colors truncate"
            >
              {selectedMeeting ? formatInteractionLabel(selectedMeeting) : 'Link to an interaction (optional)'}
            </button>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 h-10 rounded-md border border-[hsl(213,70%,30%)] bg-card text-[hsl(213,70%,30%)] text-sm font-medium hover:bg-[hsl(213,70%,97%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            title={!isOnline ? 'Reconnect to save' : undefined}
            className="px-5 h-10 rounded-md bg-[hsl(213,70%,30%)] text-white text-sm font-medium hover:bg-[hsl(213,70%,25%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : !isOnline ? 'Offline' : 'Save Note'}
          </button>
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      </div>
    </div>
  )
}
