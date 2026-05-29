'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FileText, Loader2 } from 'lucide-react'
import NoteBody from '@/components/notes/NoteBody'
import { getNotesByInteractionIdAction, updateInteractionNotesAction } from './actions'
import type { Note } from '@/lib/types'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  interactionId: string
  meetingTitle: string
  meetingDate: string
  personId: string
}

export default function InteractionNotesPopout({
  open,
  onOpenChange,
  interactionId,
  meetingTitle,
  meetingDate,
  personId,
}: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  // Edit state
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Fetch notes when the dialog opens (lazy — only on first open)
  useEffect(() => {
    if (!open || loaded) return
    setLoading(true)
    getNotesByInteractionIdAction(interactionId).then((fetched) => {
      setNotes(fetched)
      setLoading(false)
      setLoaded(true)
    })
  }, [open, loaded, interactionId])

  // Reset when interactionId changes (different row clicked)
  useEffect(() => {
    setLoaded(false)
    setNotes([])
    setEditing(false)
    setDraft('')
    setSaveError('')
  }, [interactionId])

  const existingNote = notes.find((n) => n.noteType !== 'ink_note') ?? notes[0] ?? null
  const hasNotes = notes.length > 0

  function startEdit() {
    setDraft(existingNote?.content ?? '')
    setSaveError('')
    setEditing(true)
  }

  async function handleSave() {
    if (!draft.trim()) return
    setSaving(true)
    setSaveError('')
    const result = await updateInteractionNotesAction(interactionId, draft.trim(), personId)
    setSaving(false)
    if (result.success) {
      // Update local note state so the view reflects the save immediately
      setNotes((prev) => {
        if (existingNote) {
          return prev.map((n) => n.id === existingNote.id ? { ...n, content: draft.trim() } : n)
        }
        return [{ id: 'optimistic', content: draft.trim(), date: new Date().toISOString().split('T')[0], visibility: 'private_to_author' as const }]
      })
      setEditing(false)
    } else {
      setSaveError(result.error ?? 'Failed to save — please try again.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-foreground leading-snug">
            {meetingTitle || 'Interaction Notes'}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Add or edit notes for this interaction.
          </DialogDescription>
          <p className="text-xs text-muted-foreground mt-0.5">{meetingDate}</p>
        </DialogHeader>

        <div className="mt-1 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && !editing && (
            <>
              {hasNotes ? (
                <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
                  {notes.map((n) => (
                    <div key={n.id} className="text-sm">
                      <NoteBody content={n.content} inkImageUrl={n.inkImageUrl} />
                      {n.date && (
                        <p className="text-xs text-muted-foreground mt-1.5">
                          {new Date(n.date).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric',
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-8 text-center">
                  <FileText className="h-8 w-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground font-medium">No notes for this interaction yet</p>
                  <p className="text-xs text-muted-foreground">Add a note below or use Take Notes for handwriting.</p>
                </div>
              )}

              <button
                onClick={startEdit}
                className="w-full py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted/50 hover:border-border transition-colors font-medium"
              >
                {hasNotes ? 'Edit Note' : 'Add Note'}
              </button>
            </>
          )}

          {!loading && editing && (
            <div className="space-y-3">
              <textarea
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                placeholder="Interaction notes…"
                className="w-full rounded-md border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] placeholder:text-muted-foreground resize-y"
                disabled={saving}
              />
              {saveError && <p className="text-xs text-rose-600">{saveError}</p>}
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !draft.trim()}
                  className="px-4 py-2 rounded-md bg-[hsl(213,70%,30%)] text-white text-sm font-medium hover:bg-[hsl(213,70%,25%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={() => { setEditing(false); setSaveError('') }}
                  disabled={saving}
                  className="px-4 py-2 rounded-md border border-border text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
