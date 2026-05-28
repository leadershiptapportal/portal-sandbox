'use client'

import { Clock } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

export interface LastNoteData {
  content: string
  inkImageUrl?: string
  date: string
}

interface Props {
  note: LastNoteData | null
  /** Visual weight: 'subtle' (outline) or 'prominent' (filled block, full-width) */
  variant?: 'subtle' | 'prominent'
  label?: string
}

export default function LastInteractionNotesDialog({
  note,
  variant = 'subtle',
  label = 'View last interaction notes',
}: Props) {
  if (!note) return null

  const formattedDate = note.date
    ? new Date(note.date).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : ''

  const triggerClass =
    variant === 'prominent'
      ? 'w-full flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[hsl(213,60%,94%)] text-[hsl(213,70%,30%)] text-sm font-medium hover:bg-[hsl(213,60%,88%)] transition-colors'
      : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card text-xs font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors'

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className={triggerClass}>
          <Clock className={variant === 'prominent' ? 'h-4 w-4 flex-shrink-0' : 'h-3.5 w-3.5 flex-shrink-0'} />
          {label}
        </button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border flex-shrink-0">
          <DialogTitle className="text-base font-semibold text-foreground">
            Previous Interaction Notes
          </DialogTitle>
          {formattedDate && (
            <p className="text-xs text-muted-foreground mt-0.5">{formattedDate}</p>
          )}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {note.content && (
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {note.content}
            </p>
          )}

          {note.inkImageUrl && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Handwritten Notes
              </p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={note.inkImageUrl}
                alt="Handwritten notes from previous interaction"
                className="w-full rounded-lg border border-border"
              />
            </div>
          )}

          {!note.content && !note.inkImageUrl && (
            <p className="text-sm text-muted-foreground">No note content available.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
