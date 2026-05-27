'use client'

import { useRef, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Pencil, Undo2, Trash2, X, Eraser } from 'lucide-react'
import type { TldrawNoteCanvasHandle } from '@/components/ink/TldrawNoteCanvas'
import { saveInkNoteAction } from '../../../actions'

const TldrawNoteCanvas = dynamic(
  () => import('@/components/ink/TldrawNoteCanvas'),
  { ssr: false, loading: () => <div className="w-full h-full bg-white animate-pulse" /> },
)

interface Props {
  subjectPersonId: string
  subjectName: string
}

const COLORS = [
  { value: '#0f172a', label: 'Black',  swatch: 'bg-slate-900'   },
  { value: '#1d4ed8', label: 'Blue',   swatch: 'bg-blue-700'    },
  { value: '#be123c', label: 'Red',    swatch: 'bg-rose-700'    },
  { value: '#15803d', label: 'Green',  swatch: 'bg-emerald-700' },
]

const WIDTHS = [
  { value: 1.8, label: 'Extra Fine', dot: 'w-0.5 h-0.5' },
  { value: 3,   label: 'Fine',       dot: 'w-1 h-1'     },
  { value: 5,   label: 'Medium',     dot: 'w-1.5 h-1.5' },
  { value: 8,   label: 'Bold',       dot: 'w-2.5 h-2.5' },
]

export default function InkNoteComposer({ subjectPersonId, subjectName }: Props) {
  const router    = useRouter()
  const canvasRef = useRef<TldrawNoteCanvasHandle | null>(null)

  const [color,    setColor]    = useState(COLORS[0].value)
  const [width,    setWidth]    = useState(WIDTHS[2].value)   // default: Medium
  const [tool,     setTool]     = useState<'pen' | 'eraser'>('pen')
  const [hasShapes, setHasShapes] = useState(false)
  const [caption,  setCaption]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const canSave = hasShapes && !saving

  const handleShapeCountChange = useCallback(
    (count: number) => setHasShapes(count > 0),
    [],
  )

  async function handleSave() {
    if (!canvasRef.current) return
    setSaving(true)
    setError(null)

    try {
      const blob = await canvasRef.current.exportBlob()
      if (!blob) { setError('Could not export the canvas. Try again.'); setSaving(false); return }

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

      const result = await saveInkNoteAction(subjectPersonId, uploadJson.url, caption)
      if ('error' in result) { setError(result.error); setSaving(false); return }

      toast.success('Ink note saved')
      router.push(`/myhumans/${subjectPersonId}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setSaving(false)
    }
  }

  function handleCancel() {
    if (hasShapes && !confirm('Discard this ink note?')) return
    router.push(`/myhumans/${subjectPersonId}`)
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-white">

      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-200 flex-shrink-0">
        <button
          onClick={handleCancel}
          aria-label="Close"
          className="p-2 rounded-md text-slate-500 hover:bg-slate-100"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-slate-400 leading-none">Ink note for</p>
          <p className="text-sm font-semibold text-slate-900 truncate leading-tight">{subjectName}</p>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={() => canvasRef.current?.undo()}
            disabled={!hasShapes}
            aria-label="Undo"
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Undo2 className="h-5 w-5" />
          </button>
          <button
            onClick={() => canvasRef.current?.clear()}
            disabled={!hasShapes}
            aria-label="Clear"
            className="p-2 rounded-md text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className="ml-1 px-4 h-9 rounded-md bg-[hsl(213,70%,30%)] text-white text-sm font-medium hover:bg-[hsl(213,70%,25%)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {/* ── Tool strip ────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-100 flex-shrink-0 overflow-x-auto">

        {/* Pen / Eraser */}
        <div className="inline-flex rounded-md border border-slate-200 overflow-hidden flex-shrink-0">
          <button
            onClick={() => setTool('pen')}
            aria-pressed={tool === 'pen'}
            className={`flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium transition-colors ${
              tool === 'pen' ? 'bg-[hsl(213,70%,30%)] text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Pen
          </button>
          <button
            onClick={() => setTool('eraser')}
            aria-pressed={tool === 'eraser'}
            className={`flex items-center gap-1.5 px-2.5 h-8 text-xs font-medium border-l border-slate-200 transition-colors ${
              tool === 'eraser' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Eraser className="h-3.5 w-3.5" />
            Eraser
          </button>
        </div>

        {tool === 'pen' && (
          <>
            <div className="h-5 w-px bg-slate-200 flex-shrink-0" />

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

            <div className="h-5 w-px bg-slate-200 flex-shrink-0" />

            {/* Size */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {WIDTHS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWidth(w.value)}
                  aria-label={w.label}
                  title={w.label}
                  className={`w-8 h-8 rounded-md flex items-center justify-center border transition-colors ${
                    width === w.value ? 'border-slate-900 bg-slate-100' : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span className={`rounded-full bg-slate-900 ${w.dot}`} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── Canvas ────────────────────────────────────────────────────────── */}
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

      {/* ── Caption + status ─────────────────────────────────────────────── */}
      <footer className="px-3 pb-3 pt-2 flex-shrink-0 space-y-2 bg-white border-t border-slate-200">
        <input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Optional caption…"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-[hsl(213,70%,30%)]"
          disabled={saving}
        />
        {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}
      </footer>
    </div>
  )
}
