'use client'

import { useRef, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { toast } from 'sonner'
import { Pencil, Undo2, Trash2, Eraser, Link2 } from 'lucide-react'
import type { TldrawNoteCanvasHandle } from '@/components/ink/TldrawNoteCanvas'
import { saveInkNoteAction } from '../actions'
import type { Interaction } from '@/lib/types'

// Dynamic import prevents tldraw's browser-only code from running during SSR.
const TldrawNoteCanvas = dynamic(
  () => import('@/components/ink/TldrawNoteCanvas'),
  { ssr: false, loading: () => <div className="w-full h-full bg-white animate-pulse rounded-xl" /> },
)

interface Props {
  personId: string
  personName: string
  meetings: Interaction[]
  initialInteraction: Interaction | null
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
  { value: 1.8, label: 'Fine',   dot: 'w-1 h-1'     },
  { value: 3,   label: 'Medium', dot: 'w-1.5 h-1.5' },
  { value: 5,   label: 'Bold',   dot: 'w-2.5 h-2.5' },
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
  onSaveComplete,
  onCancel,
  onStrokeCountChange,
}: Props) {
  const canvasRef = useRef<TldrawNoteCanvasHandle | null>(null)

  const [color,    setColor]    = useState(COLORS[0].value)
  const [width,    setWidth]    = useState(WIDTHS[1].value)
  const [tool,     setTool]     = useState<'pen' | 'eraser'>('pen')
  const [hasShapes, setHasShapes] = useState(false)
  const [caption,  setCaption]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  // Interaction linking
  const [selectedMeetingId, setSelectedMeetingId] = useState<string>(
    initialInteraction?.id ?? '',
  )
  const [showPicker, setShowPicker] = useState(false)

  const selectedMeeting = useMemo(
    () => meetings.find((m) => m.id === selectedMeetingId) ?? initialInteraction ?? null,
    [meetings, selectedMeetingId, initialInteraction],
  )

  const canSave = hasShapes && !saving

  // Stable reference — avoids triggering tldraw's onMount re-run on every render.
  const handleShapeCountChange = useCallback(
    (count: number) => {
      setHasShapes(count > 0)
      onStrokeCountChange?.(count)
    },
    [onStrokeCountChange],
  )

  // ── Save flow ────────────────────────────────────────────────────────────────

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
        caption.trim() || undefined,
        selectedMeetingId || undefined,
      )

      if ('error' in result) {
        setError(result.error)
        setSaving(false)
        return
      }

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

      {/* ── Tool strip ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-3 py-2 bg-white border-b border-slate-200 flex-shrink-0 overflow-x-auto">

        {/* Pen / Eraser toggle */}
        <div className="inline-flex rounded-md border border-slate-200 overflow-hidden flex-shrink-0">
          <button
            onClick={() => setTool('pen')}
            aria-pressed={tool === 'pen'}
            className={`flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium transition-colors ${
              tool === 'pen'
                ? 'bg-[hsl(213,70%,30%)] text-white'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Pen
          </button>
          <button
            onClick={() => setTool('eraser')}
            aria-pressed={tool === 'eraser'}
            className={`flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium border-l border-slate-200 transition-colors ${
              tool === 'eraser'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Eraser className="h-3.5 w-3.5" />
            Eraser
          </button>
        </div>

        <div className="h-5 w-px bg-slate-200 mx-0.5" />

        {/* Color + size (pen mode only) */}
        {tool === 'pen' && (
          <>
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Color</span>
            <div className="flex items-center gap-1">
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
            <div className="h-5 w-px bg-slate-200 mx-0.5" />
            <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Size</span>
            <div className="flex items-center gap-1">
              {WIDTHS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWidth(w.value)}
                  aria-label={w.label}
                  title={w.label}
                  className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors ${
                    width === w.value
                      ? 'border-slate-900 bg-slate-100'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`rounded-full bg-slate-900 ${w.dot}`} />
                </button>
              ))}
            </div>
          </>
        )}

        {/* Undo / Clear — pushed to the right */}
        <div className="ml-auto flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => canvasRef.current?.undo()}
            disabled={!hasShapes}
            aria-label="Undo"
            title="Undo"
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => canvasRef.current?.clear()}
            disabled={!hasShapes}
            aria-label="Clear"
            title="Clear"
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── Infinite canvas — fills all remaining vertical space ────────────── */}
      <div className="flex-1 min-h-0">
        <TldrawNoteCanvas
          ref={canvasRef}
          color={color}
          width={width}
          tool={tool}
          penOnly={true}
          onShapeCountChange={handleShapeCountChange}
          className="w-full h-full"
        />
      </div>

      {/* ── Footer: interaction picker + caption + save ──────────────────────── */}
      <div className="flex-shrink-0 bg-white border-t border-slate-200 px-3 py-3 space-y-2">

        {/* Interaction row */}
        <div className="flex items-center gap-2">
          <Link2 className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
          {showPicker ? (
            <div className="flex-1 flex gap-2">
              <select
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={selectedMeetingId}
                onChange={(e) => {
                  setSelectedMeetingId(e.target.value)
                  setShowPicker(false)
                }}
                className="flex-1 text-xs border border-[hsl(213,70%,30%)] rounded-md px-2 py-1.5 bg-white focus:outline-none"
              >
                <option value="">— No linked interaction —</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>
                    {formatInteractionLabel(m)}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowPicker(false)}
                className="text-xs text-slate-400 hover:text-slate-600 px-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowPicker(true)}
              className="flex-1 text-left text-xs text-slate-500 hover:text-[hsl(213,70%,30%)] transition-colors truncate"
            >
              {selectedMeeting
                ? formatInteractionLabel(selectedMeeting)
                : 'Link to an interaction (optional)'}
            </button>
          )}
        </div>

        {/* Caption + save / cancel */}
        <div className="flex gap-2">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Optional caption…"
            className="flex-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
            disabled={saving}
          />
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-4 h-10 rounded-md border border-[hsl(213,70%,30%)] bg-white text-[hsl(213,70%,30%)] text-sm font-medium hover:bg-[hsl(213,70%,97%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="px-5 h-10 rounded-md bg-[hsl(213,70%,30%)] text-white text-sm font-medium hover:bg-[hsl(213,70%,25%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>

        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      </div>
    </div>
  )
}
