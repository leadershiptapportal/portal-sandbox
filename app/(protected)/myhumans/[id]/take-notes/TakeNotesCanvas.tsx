'use client'

import { useRef, useState, useMemo, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Pencil, Undo2, Trash2, Eraser, Link2, WifiOff } from 'lucide-react'
import type { TldrawNoteCanvasHandle } from '@/components/ink/TldrawNoteCanvas'
import { saveInkNoteAction } from '../actions'
import type { Interaction } from '@/lib/types'
import type { Note } from '@/lib/airtable/notes'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'

const TldrawNoteCanvas = dynamic(
  () => import('@/components/ink/TldrawNoteCanvas'),
  { ssr: false, loading: () => <div className="w-full h-full bg-card animate-pulse rounded-xl" /> },
)

interface Props {
  personId: string
  personName: string
  meetings: Interaction[]
  initialInteraction: Interaction | null
  existingInkNote?: Note | null
  onSaveComplete: () => void
  onCancel: () => void
  onStrokeCountChange?: (count: number) => void
}

// ── Toolbar options ────────────────────────────────────────────────────────────

const COLORS = [
  { value: '#0f172a', label: 'Black',  swatch: 'bg-slate-900' },
  { value: '#1d4ed8', label: 'Blue',   swatch: 'bg-blue-700'  },
  { value: '#be123c', label: 'Red',    swatch: 'bg-rose-700'  },
  { value: '#15803d', label: 'Green',  swatch: 'bg-emerald-700' },
]

const WIDTHS = [
  { value: 1.8, label: 'Extra Fine', dot: 'w-0.5 h-0.5' },
  { value: 3,   label: 'Fine',       dot: 'w-1 h-1'     },
  { value: 5,   label: 'Medium',     dot: 'w-1.5 h-1.5' },
  { value: 8,   label: 'Bold',       dot: 'w-2.5 h-2.5' },
]

function formatInteractionLabel(m: Interaction): string {
  const name = m.humanName ? `${m.humanName} · ` : ''
  const title = m.title || 'Untitled'
  const date = m.startTime
    ? new Date(m.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''
  return `${name}${title}${date ? ` — ${date}` : ''}`
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function TakeNotesCanvas({
  personId,
  personName,
  meetings,
  initialInteraction,
  existingInkNote,
  onSaveComplete,
  onCancel,
  onStrokeCountChange,
}: Props) {
  const canvasRef = useRef<TldrawNoteCanvasHandle | null>(null)
  const draftKey  = `ink-draft-${personId}`

  const [color,    setColor]    = useState(COLORS[0].value)
  const [width,    setWidth]    = useState(WIDTHS[2].value)   // default: Medium
  const [tool,     setTool]     = useState<'pen' | 'eraser'>('pen')
  const [hasShapes, setHasShapes] = useState(false)
  const [caption,  setCaption]  = useState(existingInkNote?.content ?? '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  // Tracks the Airtable record ID of the note being edited so re-saves upsert
  const [currentNoteId, setCurrentNoteId] = useState<string | undefined>(existingInkNote?.id)

  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(
    initialInteraction?.id ?? '',
  )
  const [showPicker, setShowPicker] = useState(false)

  // Draft restoration state — gate canvas render until localStorage is checked
  const [snapshotReady,    setSnapshotReady]    = useState(false)
  const [resolvedSnapshot, setResolvedSnapshot] = useState<string | undefined>(undefined)

  // Stable ref so the 30s interval always reads the latest caption without stale closure
  const captionRef = useRef(caption)
  useEffect(() => { captionRef.current = caption }, [caption])

  const isOnline = useOnlineStatus()

  // Restore draft from localStorage on mount (runs client-side only)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(draftKey)
      if (stored) {
        const draft = JSON.parse(stored) as { snapshot?: string; caption?: string }
        setResolvedSnapshot(draft.snapshot ?? existingInkNote?.inkNoteData)
        if (draft.caption !== undefined) setCaption(draft.caption)
        toast.info('Restored unsaved draft')
      } else {
        setResolvedSnapshot(existingInkNote?.inkNoteData)
      }
    } catch {
      setResolvedSnapshot(existingInkNote?.inkNoteData)
    }
    setSnapshotReady(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Save snapshot + caption to localStorage every 30s (only when canvas has content)
  useEffect(() => {
    if (!snapshotReady) return
    const interval = setInterval(() => {
      if (!canvasRef.current || canvasRef.current.isEmpty()) return
      const snapshot = canvasRef.current.getSnapshot()
      if (!snapshot) return
      try {
        localStorage.setItem(draftKey, JSON.stringify({
          snapshot,
          caption: captionRef.current,
          savedAt: Date.now(),
        }))
      } catch {}
    }, 30_000)
    return () => clearInterval(interval)
  }, [snapshotReady, draftKey])

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId) ?? initialInteraction ?? null,
    [meetings, selectedMeetingId, initialInteraction],
  )

  const canSave = hasShapes && !saving && isOnline

  const handleShapeCountChange = useCallback(
    (count: number) => {
      setHasShapes(count > 0)
      onStrokeCountChange?.(count)
    },
    [onStrokeCountChange],
  )

  // ── Save ─────────────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!canvasRef.current) return
    setSaving(true)
    setError(null)

    try {
      const blob = await canvasRef.current.exportBlob()
      if (!blob) {
        setError('Could not export the canvas. Try again.')
        setSaving(false)
        return
      }

      const inkNoteData = canvasRef.current.getSnapshot() ?? ''

      const fd = new FormData()
      fd.append('file', new File([blob], `ink-note-${Date.now()}.png`, { type: 'image/png' }))
      fd.append('folder', 'leadershiptap/ink-notes')

      const uploadRes  = await fetch('/api/upload-image', { method: 'POST', body: fd })
      const uploadJson = await uploadRes.json()
      if (!uploadJson.success) {
        setError(`Upload failed: ${uploadJson.error ?? 'unknown error'}`)
        setSaving(false)
        return
      }

      const result = await saveInkNoteAction(
        personId,
        uploadJson.url,
        inkNoteData,
        caption.trim() || undefined,
        selectedMeetingId || undefined,
        currentNoteId,
      )

      if ('error' in result) {
        setError(result.error)
        setSaving(false)
        return
      }

      try { localStorage.removeItem(draftKey) } catch {}
      setCurrentNoteId(result.noteId)
      toast.success('Note saved')
      onSaveComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">

      {/* ── Offline banner ────────────────────────────────────────────────── */}
      {!isOnline && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs flex-shrink-0">
          <WifiOff className="h-3.5 w-3.5 flex-shrink-0" />
          You&apos;re offline — your work is saved locally and will sync when you reconnect.
        </div>
      )}

      {/* ── Tool strip ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border flex-shrink-0 overflow-x-auto">

        {/* Pen / Eraser */}
        <div className="inline-flex rounded-md border border-border overflow-hidden flex-shrink-0">
          <button
            onClick={() => setTool('pen')}
            aria-pressed={tool === 'pen'}
            className={`flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium transition-colors ${
              tool === 'pen' ? 'bg-[hsl(213,70%,30%)] text-white' : 'bg-card text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Pen
          </button>
          <button
            onClick={() => setTool('eraser')}
            aria-pressed={tool === 'eraser'}
            className={`flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium border-l border-border transition-colors ${
              tool === 'eraser' ? 'bg-rose-600 text-white border-rose-600' : 'bg-card text-muted-foreground hover:bg-muted/50'
            }`}
          >
            <Eraser className="h-3.5 w-3.5" />
            Eraser
          </button>
        </div>

        {tool === 'pen' && (
          <>
            <div className="h-5 w-px bg-muted flex-shrink-0" />

            {/* Color */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  aria-label={c.label}
                  title={c.label}
                  className={`w-6 h-6 rounded-full ${c.swatch} ring-offset-1 transition-shadow ${
                    color === c.value ? 'ring-2 ring-slate-900' : 'ring-1 ring-slate-200'
                  }`}
                />
              ))}
            </div>

            <div className="h-5 w-px bg-muted flex-shrink-0" />

            {/* Size */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {WIDTHS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWidth(w.value)}
                  aria-label={w.label}
                  title={w.label}
                  className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors ${
                    width === w.value ? 'border-slate-900 bg-muted' : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <span className={`rounded-full bg-slate-900 ${w.dot}`} />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Undo / Clear — pushed right */}
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => canvasRef.current?.undo()}
            disabled={!hasShapes}
            aria-label="Undo"
            title="Undo"
            className="p-2 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              canvasRef.current?.clear()
              try { localStorage.removeItem(draftKey) } catch {}
            }}
            disabled={!hasShapes}
            aria-label="Clear"
            title="Clear"
            className="p-2 rounded-md text-muted-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0">
        {snapshotReady ? (
          <TldrawNoteCanvas
            ref={canvasRef}
            color={color}
            width={width}
            tool={tool}
            penOnly={true}
            onShapeCountChange={handleShapeCountChange}
            className="w-full h-full"
            initialSnapshot={resolvedSnapshot}
          />
        ) : (
          <div className="w-full h-full bg-card animate-pulse rounded-xl" />
        )}
      </div>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-card border-t border-border px-3 py-3 space-y-2">

        {/* Interaction link */}
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
          {showPicker ? (
            <div className="flex-1 flex gap-2">
              <select
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={selectedMeetingId}
                onChange={(e) => { setSelectedMeetingId(e.target.value); setShowPicker(false) }}
                className="flex-1 text-xs border border-[hsl(213,70%,30%)] rounded-md px-2 py-1.5 bg-card focus:outline-none"
              >
                <option value="">— No linked interaction —</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>{formatInteractionLabel(m)}</option>
                ))}
              </select>
              <button
                onClick={() => setShowPicker(false)}
                className="text-xs text-muted-foreground hover:text-muted-foreground px-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPicker(true)}
              className="flex-1 text-left text-xs text-muted-foreground hover:text-[hsl(213,70%,30%)] transition-colors truncate"
            >
              {selectedMeeting ? formatInteractionLabel(selectedMeeting) : 'Link to an interaction (optional)'}
            </button>
          )}
        </div>

        {/* Caption + actions */}
        <div className="flex gap-2">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Optional caption…"
            className="flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
            disabled={saving}
          />
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 h-10 rounded-md border border-[hsl(213,70%,30%)] bg-card text-[hsl(213,70%,30%)] text-sm font-medium hover:bg-[hsl(213,70%,97%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            title={!isOnline ? 'Reconnect to save' : undefined}
            className="px-5 h-10 rounded-md bg-[hsl(213,70%,30%)] text-white text-sm font-medium hover:bg-[hsl(213,70%,25%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {saving ? 'Saving…' : !isOnline ? 'Offline' : 'Save Note'}
          </button>
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      </div>
    </div>
  )
}
