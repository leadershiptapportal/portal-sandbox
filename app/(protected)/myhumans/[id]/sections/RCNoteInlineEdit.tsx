'use client'

import { useState } from 'react'
import { StickyNote } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { upsertRCNoteAction } from '../actions'

interface Props {
  rcId: string
  subjectPersonId: string
  initialNote: string
  currentCoachId: string
  /** Number of lines to show in the preview before truncating. Default 5. */
  previewLines?: number
}

const LINE_CLAMP: Record<number, string> = {
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
}

export default function RCNoteInlineEdit({
  rcId,
  subjectPersonId,
  initialNote,
  previewLines = 5,
}: Props) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(initialNote)
  const [saved, setSaved] = useState(initialNote)
  const [saving, setSaving] = useState(false)

  const clampClass = LINE_CLAMP[previewLines] ?? 'line-clamp-5'

  async function handleSave() {
    if (draft === saved) { setOpen(false); return }
    setSaving(true)
    const result = await upsertRCNoteAction({ rcId, subjectPersonId, content: draft })
    setSaving(false)
    if (!('error' in result) || !result.error) {
      setSaved(draft)
      setOpen(false)
    }
  }

  function handleCancel() {
    setDraft(saved)
    setOpen(false)
  }

  return (
    <>
      <div className="mt-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-0.5">
          Quick Notes
        </p>
        {saved ? (
          <button
            onClick={() => { setDraft(saved); setOpen(true) }}
            className="w-full text-left group"
            title="Click to view or edit"
          >
            <p className={`text-xs text-muted-foreground ${clampClass} group-hover:text-foreground transition-colors leading-relaxed`}>
              {saved}
            </p>
          </button>
        ) : (
          <button
            onClick={() => { setDraft(''); setOpen(true) }}
            className="flex items-center gap-1 text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            <StickyNote className="h-3 w-3" />
            Add note
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) handleCancel() }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Quick Notes</DialogTitle>
          </DialogHeader>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave()
              if (e.key === 'Escape') handleCancel()
            }}
            disabled={saving}
            rows={8}
            placeholder="Add a quick note about this relationship…"
            className="w-full text-sm text-foreground border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-[hsl(213,70%,30%)] focus:border-transparent disabled:opacity-50"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
          />
          <p className="text-xs text-muted-foreground">⌘↵ to save</p>
          <DialogFooter>
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
