'use client'

import { useState } from 'react'

const NOTES_PREVIEW_CHARS = 300

interface Props {
  notes: string
}

export default function RecentInteractionCard({ notes }: Props) {
  const [expanded, setExpanded] = useState(false)

  const needsTruncation = notes.length > NOTES_PREVIEW_CHARS
  const visibleNotes =
    needsTruncation && !expanded ? notes.slice(0, NOTES_PREVIEW_CHARS) + '…' : notes

  return (
    <div className="mt-3 space-y-3">
      {/* Notes */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          Interaction Notes
        </p>
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {visibleNotes}
        </p>
        {needsTruncation && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 text-xs font-medium text-[hsl(213,70%,30%)] hover:underline"
          >
            {expanded ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

    </div>
  )
}
