'use client'

import { useState, useRef, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { updateInteractionNotes } from './actions'

interface Props {
  interactionId: string
  userId: string
  initialNotes: string | undefined
  autoEdit?: boolean
}

export default function InteractionNotesEditor({ interactionId, userId, initialNotes, autoEdit }: Props) {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Initialize from autoEdit for the first render (SSR → hydrate path).
  // The effect below handles the case where autoEdit becomes true after a
  // client-side navigation (user was already on the page when they clicked
  // the top "Add Notes" button, so useState doesn't re-initialize).
  const [editing, setEditing] = useState(autoEdit ?? false)
  const [draft, setDraft] = useState(initialNotes ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (autoEdit) {
      setEditing(true)
      const tid = setTimeout(() => {
        textareaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        textareaRef.current?.focus()
      }, 80)
      return () => clearTimeout(tid)
    }
  }, [autoEdit])

  function handleEdit() {
    setDraft(initialNotes ?? '')
    setStatus('idle')
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleCancel() {
    setEditing(false)
    setStatus('idle')
    if (autoEdit) {
      router.replace(window.location.pathname)
    }
  }

  function handleSave() {
    setStatus('saving')
    startTransition(async () => {
      const result = await updateInteractionNotes(interactionId, draft, userId)
      if ('error' in result) {
        setStatus('error')
        setErrorMsg(result.error)
        return
      }
      setStatus('saved')
      setEditing(false)
      if (autoEdit) {
        router.replace(window.location.pathname)
      } else {
        router.refresh()
      }
      setTimeout(() => setStatus('idle'), 2000)
    })
  }

  // ── Read mode ──────────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Interaction Notes
          </h2>
          <div className="flex items-center gap-2">
            {status === 'saved' && (
              <span className="text-xs font-medium text-emerald-600">Notes saved</span>
            )}
            <button
              onClick={handleEdit}
              className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
            >
              {initialNotes ? 'Edit Notes' : 'Add Notes'}
            </button>
          </div>
        </div>

        {initialNotes ? (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {initialNotes}
          </p>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No notes yet for this interaction.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Click Add Notes to get started.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Interaction Notes
        </h2>
        <div className="flex items-center gap-2">
          {status === 'error' && (
            <span className="text-xs font-medium text-rose-600">{errorMsg}</span>
          )}
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="text-xs font-medium px-2.5 py-1 rounded-md bg-[hsl(213,70%,30%)] text-white hover:bg-[hsl(213,70%,25%)] disabled:opacity-50 transition-colors"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={isPending}
        rows={12}
        placeholder="Add interaction notes…"
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,50%)] focus:border-transparent resize-y disabled:opacity-50"
      />
    </div>
  )
}
