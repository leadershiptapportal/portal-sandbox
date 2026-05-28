'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { PenLine } from 'lucide-react'
import { saveNoteAction, updateInteractionNotesAction } from '@/app/(protected)/myhumans/[id]/actions'

const MIN_CHARS = 5

interface Props {
  /** Airtable record ID of the person this note is about. */
  subjectPersonId: string
  /**
   * Optional Airtable record ID of the Interaction this note is attached to.
   * When provided the note is saved with note_type='interaction_note' AND linked
   * to the interaction; otherwise it's a general_note on the profile.
   */
  interactionId?: string
  /** Initial textarea text (used when editing an existing draft). */
  initialContent?: string
  /** Called after a successful save. The dialog wrapper closes itself on this. */
  onSaved?: () => void
  /** Called when the user clicks Cancel. */
  onCancel?: () => void
  /**
   * When true, hides the "Open ink composer" link (used inside the ink
   * composer itself or in surfaces where the link would be confusing).
   */
  hideInkLink?: boolean
  /** Layout variant: 'inline' renders flat, 'card' adds padding + border. */
  variant?: 'inline' | 'card'
}

/**
 * Single source of truth for creating a typed note (or an interaction note).
 * Used by:
 *   - LogNoteDialog (profile "Log a Note" modal)
 *   - InteractionNoteForm (note panel on an interaction page — interactionId is set)
 *
 * For handwritten ink notes, the user is sent to the full-screen ink page
 * because the canvas needs real estate. The link is rendered as a sibling
 * here so the entry point is consistent.
 */
export default function NoteComposer({
  subjectPersonId,
  interactionId,
  initialContent = '',
  onSaved,
  onCancel,
  hideInkLink = false,
  variant = 'card',
}: Props) {
  const router = useRouter()
  const [content, setContent] = useState(initialContent)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmed = content.trim()
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_CHARS
  const canSubmit = trimmed.length >= MIN_CHARS && !saving

  async function handleSave() {
    if (!canSubmit) return
    setSaving(true)
    setError(null)
    try {
      if (interactionId) {
        const result = await updateInteractionNotesAction(interactionId, content, subjectPersonId)
        if (!result.success) {
          setError(result.error ?? 'Failed to save interaction note.')
          setSaving(false)
          return
        }
      } else {
        await saveNoteAction(subjectPersonId, content)
      }
      toast.success(interactionId ? 'Interaction note saved' : 'Note saved')
      setContent('')
      router.refresh()
      onSaved?.()
    } catch (err) {
      const code = err instanceof Error ? err.message : ''
      if (code === 'NOTES_TABLE_MISSING') {
        setError('Notes table not configured. Contact your administrator.')
      } else if (code === 'NO_RELATIONSHIP') {
        setError('No active coaching or reporting relationship reaches this person.')
      } else {
        setError('Failed to save note. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const placeholder = interactionId
    ? 'Interaction observations, follow-up items, coaching themes…'
    : 'Coaching context, observations, themes…'

  const inkHref = `/myhumans/${subjectPersonId}/notes/new/ink`

  const wrapperCls =
    variant === 'card'
      ? 'space-y-3'
      : 'space-y-3'

  return (
    <div className={wrapperCls}>
      <div className="space-y-1.5">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value)
            if (error) setError(null)
          }}
          placeholder={placeholder}
          rows={6}
          aria-invalid={tooShort}
          className="w-full rounded-md border border-border px-3 py-2.5 text-sm bg-card resize-y focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] focus:border-[hsl(213,70%,30%)] placeholder:text-muted-foreground leading-relaxed"
        />
        <div className="flex items-center justify-between text-xs">
          {tooShort ? (
            <span className="text-rose-600">Note must be at least {MIN_CHARS} characters.</span>
          ) : (
            <span className="text-muted-foreground">{trimmed.length} chars</span>
          )}
          {!hideInkLink && (
            <Link
              href={inkHref}
              className="inline-flex items-center gap-1 text-[hsl(213,70%,30%)] hover:underline font-medium"
            >
              <PenLine className="h-3.5 w-3.5" />
              Write with Pencil
            </Link>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 h-9 text-sm border border-border rounded-md hover:bg-muted/50 transition-colors text-muted-foreground disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSubmit}
          className="px-4 h-9 text-sm font-medium bg-[hsl(213,70%,30%)] text-white rounded-md hover:bg-[hsl(213,70%,25%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving…' : error ? 'Try again' : interactionId ? 'Save Interaction Note' : 'Save Note'}
        </button>
      </div>
    </div>
  )
}
