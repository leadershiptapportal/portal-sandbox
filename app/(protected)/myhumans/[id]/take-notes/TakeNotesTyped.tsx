'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { toast } from 'sonner'
import { Link2, WifiOff } from 'lucide-react'
import { saveTypedNoteAction, checkInteractionTypedNoteAction } from '../actions'
import type { NoteCategory } from '../actions'
import type { Interaction } from '@/lib/types'
import type { Note } from '@/lib/airtable/notes'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

interface Props {
  personId: string
  meetings: Interaction[]
  initialInteraction: Interaction | null
  existingNote?: Note | null
  noteCategory: NoteCategory
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
  existingNote,
  noteCategory,
  onSaveComplete,
  onCancel,
  onContentChange,
}: Props) {
  const draftKey = `typed-draft-${personId}-${noteCategory}`
  const isOnline = useOnlineStatus()

  const [content, setContent] = useState(existingNote?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedMeetingId, setSelectedMeetingId] = useState(initialInteraction?.id ?? '')
  const [showPicker, setShowPicker] = useState(false)
  const [draftReady, setDraftReady] = useState(false)

  // Append-on-link conflict state (only relevant for general notes)
  const [appendConflict, setAppendConflict] = useState<{ existingContent: string; noteId: string } | null>(null)
  const [, startCheckTransition] = useTransition()

  const contentRef = useRef(content)
  useEffect(() => { contentRef.current = content }, [content])

  // Restore localStorage draft on mount (only when no existing note to edit)
  useEffect(() => {
    if (!existingNote) {
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
    }
    setDraftReady(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-save draft every 30s (skip when editing an existing note — it's already persisted)
  useEffect(() => {
    if (!draftReady || existingNote) return
    const interval = setInterval(() => {
      if (!contentRef.current.trim()) return
      try {
        localStorage.setItem(draftKey, JSON.stringify({ content: contentRef.current, savedAt: Date.now() }))
      } catch {}
    }, 30_000)
    return () => clearInterval(interval)
  }, [draftReady, draftKey, existingNote])

  // Notify parent when content presence changes
  useEffect(() => {
    onContentChange?.(content.trim().length > 0)
  }, [content, onContentChange])

  // When user links an interaction from general-note mode, check for existing typed note
  function handleInteractionSelect(meetingId: string) {
    setSelectedMeetingId(meetingId)
    setShowPicker(false)
    setAppendConflict(null)

    if (!meetingId || noteCategory !== 'general' || !content.trim()) return

    startCheckTransition(async () => {
      const result = await checkInteractionTypedNoteAction(meetingId)
      if (result.note) {
        setAppendConflict({ existingContent: result.note.content, noteId: result.note.id })
      }
    })
  }

  function handleAppendConfirm() {
    if (!appendConflict) return
    const merged = appendConflict.existingContent + '\n\n' + content.trim()
    setContent(merged)
    setAppendConflict(null)
  }

  function handleKeepAsGeneral() {
    setSelectedMeetingId('')
    setAppendConflict(null)
  }

  const selectedMeeting = meetings.find((m) => m.id === selectedMeetingId) ?? initialInteraction ?? null
  const canSave = content.trim().length > 0 && !saving && isOnline

  async function handleSave() {
    if (!canSave) return
    setSaving(true)
    setError(null)

    const result = await saveTypedNoteAction(
      personId,
      content.trim(),
      noteCategory,
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

      {/* ── Append conflict banner ────────────────────────────────────────── */}
      {appendConflict && (
        <div className="flex-shrink-0 bg-amber-50 border-b border-amber-200 px-4 py-3 space-y-2">
          <p className="text-xs font-medium text-amber-800">
            This interaction already has typed notes. What would you like to do?
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleAppendConfirm}
              className="px-3 py-1.5 rounded-md bg-[hsl(213,70%,30%)] text-white text-xs font-medium hover:bg-[hsl(213,70%,25%)] transition-colors"
            >
              Append my notes to existing
            </button>
            <button
              onClick={handleKeepAsGeneral}
              className="px-3 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
            >
              Keep as general note
            </button>
          </div>
        </div>
      )}

      {/* ── Text area ─────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto bg-card">
        {draftReady ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              noteCategory === 'prep'
                ? 'Add preparation notes — questions to ask, topics to cover, context to keep in mind…'
                : noteCategory === 'interaction'
                ? 'Add interaction notes…'
                : 'Start typing your notes…'
            }
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

        {/* Interaction link — only shown for general notes (interaction/prep already have context) */}
        {noteCategory === 'general' && (
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
            {showPicker ? (
              <div className="flex-1 flex gap-2">
                <select
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={selectedMeetingId}
                  onChange={(e) => handleInteractionSelect(e.target.value)}
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
        )}

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
