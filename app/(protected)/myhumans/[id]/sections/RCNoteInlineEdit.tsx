'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, X, StickyNote } from 'lucide-react'
import { upsertRCNoteAction } from '../actions'

interface Props {
  rcId: string
  subjectPersonId: string
  initialNote: string
  currentCoachId: string
}

export default function RCNoteInlineEdit({ rcId, subjectPersonId, initialNote }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(initialNote)
  const [saved, setSaved] = useState(initialNote)
  const [saving, setSaving] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.selectionStart = textareaRef.current.value.length
    }
  }, [editing])

  async function handleSave() {
    if (draft === saved) { setEditing(false); return }
    setSaving(true)
    const result = await upsertRCNoteAction({ rcId, subjectPersonId, content: draft })
    setSaving(false)
    if ('error' in result && result.error) {
      // Keep editing open on error
      return
    }
    setSaved(draft)
    setEditing(false)
  }

  function handleCancel() {
    setDraft(saved)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="mt-1.5">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') handleCancel()
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
          }}
          disabled={saving}
          rows={3}
          placeholder="Add a quick note about this relationship…"
          className="w-full text-xs text-slate-700 border border-[hsl(213,70%,30%)] rounded-md px-2 py-1.5 resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)] disabled:opacity-50"
        />
        <div className="flex items-center gap-1 mt-1">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-0.5 text-xs text-emerald-700 hover:text-emerald-800 font-medium disabled:opacity-50"
          >
            <Check className="h-3 w-3" />
            {saving ? 'Saving…' : 'Save'}
          </button>
          <span className="text-slate-300 text-xs">·</span>
          <button
            onClick={handleCancel}
            disabled={saving}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            <X className="h-3 w-3 inline" /> Cancel
          </button>
          <span className="ml-auto text-[10px] text-slate-300">⌘↵ to save</span>
        </div>
      </div>
    )
  }

  if (saved) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="mt-1 w-full text-left group"
        title="Click to edit note"
      >
        <p className="text-xs text-slate-500 line-clamp-2 group-hover:text-slate-700 transition-colors">
          {saved}
        </p>
      </button>
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="mt-1 flex items-center gap-1 text-xs text-slate-300 hover:text-slate-500 transition-colors"
    >
      <StickyNote className="h-3 w-3" />
      Add note
    </button>
  )
}
