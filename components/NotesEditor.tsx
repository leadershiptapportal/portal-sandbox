'use client'

import { useState } from 'react'

interface NotesEditorProps {
  interactionId: string
  userId: string
  initialNotes?: string
  saveAction: (userId: string, interactionId: string, notes: string) => Promise<{ ok: true } | { ok: false; error: string }>
}

export default function NotesEditor({ interactionId, userId, initialNotes, saveAction }: NotesEditorProps) {
  const [editing, setEditing] = useState(!initialNotes)
  const [value, setValue] = useState(initialNotes ?? '')
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSave() {
    setStatus('saving')
    const result = await saveAction(userId, interactionId, value)
    if (result.ok) {
      setStatus('saved')
      setEditing(false)
    } else {
      setStatus('error')
      setErrorMsg(result.error)
    }
  }

  if (!editing && value) {
    return (
      <div className="space-y-3">
        <div className="relative">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-foreground whitespace-pre-wrap leading-relaxed">
            {value}
          </div>
          <button
            onClick={() => { setEditing(true); setStatus('idle') }}
            className="absolute top-2 right-2 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <textarea
        className="w-full rounded-lg border border-border bg-muted/50 p-4 text-sm resize-y min-h-[160px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        placeholder="Paste transcript or notes here..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={status === 'saving'}
          className="bg-foreground text-background hover:bg-foreground/90 h-9 px-4 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {status === 'saving' ? 'Saving…' : 'Save Notes'}
        </button>
        {initialNotes && (
          <button
            onClick={() => { setEditing(false); setValue(initialNotes); setStatus('idle') }}
            className="text-muted-foreground hover:text-foreground h-9 px-3 rounded-lg text-sm transition-colors"
          >
            Cancel
          </button>
        )}
        {status === 'saved' && (
          <span className="text-sm text-emerald-600 font-medium">Saved ✓</span>
        )}
        {status === 'error' && (
          <span className="text-sm text-red-500">{errorMsg}</span>
        )}
      </div>
    </div>
  )
}
