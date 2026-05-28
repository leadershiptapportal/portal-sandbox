'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { Note } from '@/lib/airtable/notes'

interface Props {
  interactionId: string        // Airtable record ID of the Interaction
  subjectPersonId?: string
  relationshipContextId?: string
  existingNote?: Note          // present when editing
}

export default function InteractionNoteForm({
  interactionId,
  subjectPersonId,
  relationshipContextId,
  existingNote,
}: Props) {
  const router = useRouter()
  const isEdit = !!existingNote

  const [body, setBody] = useState(existingNote?.content ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!body.trim()) { setError('Note cannot be empty.'); return }

    setSaving(true)
    try {
      let res: Response
      if (isEdit) {
        res = await fetch(`/api/notes/${existingNote.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: body.trim() }),
        })
      } else {
        res = await fetch('/api/notes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: body.trim(),
            interactionId,
            subjectPersonId,
            humanId: subjectPersonId,
            noteType: 'interaction_note',
          }),
        })
      }

      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Failed to save — please try again.')
        return
      }

      setSaved(true)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      <div className="space-y-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Notes
        </label>
        <Textarea
          placeholder="Interaction notes, themes, action items…"
          value={body}
          onChange={(e) => { setBody(e.target.value); setSaved(false) }}
          rows={8}
          disabled={saving}
          className="resize-y"
        />
      </div>

      {error && <p className="text-sm text-rose-500">{error}</p>}

      {saved && (
        <p className="text-sm text-emerald-600 font-medium">
          {isEdit ? 'Note updated ✓' : 'Note saved ✓'}
        </p>
      )}

      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : isEdit ? 'Update Note' : 'Save Note'}
      </Button>
    </form>
  )
}
