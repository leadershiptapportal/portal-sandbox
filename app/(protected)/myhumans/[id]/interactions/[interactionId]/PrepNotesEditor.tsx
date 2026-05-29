'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updatePrepNotes } from './actions'

interface Props {
  interactionId: string
  userId: string
  initialNotes: string | undefined
}

export default function PrepNotesEditor({ interactionId, userId, initialNotes }: Props) {
  const router = useRouter()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialNotes ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleEdit() {
    setDraft(initialNotes ?? '')
    setStatus('idle')
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleCancel() {
    setEditing(false)
    setStatus('idle')
  }

  function handleSave() {
    setStatus('saving')
    startTransition(async () => {
      const result = await updatePrepNotes(interactionId, draft, userId)
      if ('error' in result) {
        setStatus('error')
        setErrorMsg(result.error)
        return
      }
      setStatus('saved')
      setEditing(false)
      router.refresh()
      setTimeout(() => setStatus('idle'), 2000)
    })
  }

  // ── Read mode ──────────────────────────────────────────────────────────────

  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-end mb-3 gap-2">
          {status === 'saved' && (
            <span className="text-xs font-medium text-emerald-600">Notes saved</span>
          )}
          <button
            onClick={handleEdit}
            className="text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
          >
            {initialNotes ? 'Edit' : 'Add'}
          </button>
        </div>

        {initialNotes ? (
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {initialNotes}
          </p>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-muted/50 px-4 py-6 text-center">
            <p className="text-sm text-muted-foreground">No prep notes yet.</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Click Add to get started.</p>
          </div>
        )}
      </div>
    )
  }

  // ── Edit mode ──────────────────────────────────────────────────────────────

  return (
    <div>
      <div className="flex items-center justify-end mb-3 gap-2">
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

      <textarea
        ref={textareaRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        disabled={isPending}
        rows={10}
        placeholder="Add pre-notes…"
        className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,50%)] focus:border-transparent resize-y disabled:opacity-50"
      />
    </div>
  )
}
