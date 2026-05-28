'use client'

/**
 * TldrawNoteCanvas — tldraw v5-backed ink canvas for coaching notes.
 *
 * Design goals:
 *   • Notebook-mode camera — full-width page, finger scrolls vertically only,
 *     no horizontal drift, no accidental zoom-out
 *   • Finger pans / Apple Pencil draws (isPenMode)
 *   • No iOS selection / Scribble interference — all tldraw UI hidden
 *   • Clean white background
 *   • Exports to PNG blob for upload to Cloudinary
 *
 * Usage: dynamically imported with { ssr: false } from the parent component.
 */

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle, useState, useMemo } from 'react'
import {
  Tldraw,
  Editor,
  DefaultColorStyle,
  DefaultSizeStyle,
  defaultShapeUtils,
  defaultBindingUtils,
  getSnapshot,
  loadSnapshot,
  type TLComponents,
} from 'tldraw'
import { createTLStore } from '@tldraw/editor'
import 'tldraw/tldraw.css'

// ── Type mapping ───────────────────────────────────────────────────────────────

/** Maps our CSS colour values → tldraw's named colour tokens. */
const COLOR_MAP: Record<string, string> = {
  '#0f172a': 'black',
  '#1d4ed8': 'blue',
  '#be123c': 'red',
  '#15803d': 'green',
}

/** Maps our numeric width values → tldraw size tokens. */
const SIZE_MAP: Record<number, 's' | 'm' | 'l' | 'xl'> = {
  1.8: 's',
  3:   'm',
  5:   'l',
  8:   'xl',
}

// ── Component overrides ────────────────────────────────────────────────────────

const HIDDEN_COMPONENTS_BASE: TLComponents = {
  Toolbar:           null,
  MainMenu:          null,
  StylePanel:        null,
  PageMenu:          null,
  NavigationPanel:   null,
  HelpMenu:          null,
  DebugMenu:         null,
  HelperButtons:     null,
  LoadingScreen:     null,
}

// ── tldraw options ─────────────────────────────────────────────────────────────

/**
 * Static options passed to Tldraw.
 *
 * camera.constraints gives us "notebook" behaviour:
 *   • bounds 800 × 100 000 — full-width, effectively infinite height
 *   • fit-x initialZoom — zoom is set so the page width exactly fills the
 *     screen; no need to zoom in to see content at a natural writing scale
 *   • behavior.x = 'fixed' — the page never drifts left/right; finger
 *     panning is constrained to the Y axis only
 *   • behavior.y = 'contain' — finger can scroll the full page height but
 *     can't scroll past the top or bottom edge
 */
const TLDRAW_OPTIONS = {
  maxFontsToLoadBeforeRender: 0,
}

// ── Public handle type ─────────────────────────────────────────────────────────

export interface TldrawNoteCanvasHandle {
  exportBlob:  () => Promise<Blob | null>
  getSnapshot: () => string | null
  undo:        () => void
  clear:       () => void
  isEmpty:     () => boolean
}

// ── Props ──────────────────────────────────────────────────────────────────────

export interface TldrawNoteCanvasProps {
  color:    string
  width:    number
  tool:     'pen' | 'eraser'
  penOnly:  boolean
  onShapeCountChange: (count: number) => void
  className?: string
  initialSnapshot?: string
  isDarkMode?: boolean
}

// ── Component ──────────────────────────────────────────────────────────────────

function TldrawNoteCanvasInner(
  { color, width, tool, penOnly, onShapeCountChange, className, initialSnapshot, isDarkMode = false }: TldrawNoteCanvasProps,
  ref: React.ForwardedRef<TldrawNoteCanvasHandle>,
) {
  /**
   * Pre-create the store synchronously. Without this, tldraw's internal
   * useLocalStore starts with { status:'loading' }, fires a useEffect to
   * transition to { status:'not-synced' }, and disposes + recreates the editor
   * during that async flip — causing the "works for 2 seconds then dies" bug.
   * Passing a TLStore instance routes straight to TldrawEditorWithReadyStore,
   * no loading cycle.
   *
   * If an initialSnapshot is provided, load it into the store before mounting
   * so the existing strokes are visible immediately.
   */
  const [store] = useState(() => {
    const s = createTLStore({
      shapeUtils:   defaultShapeUtils,
      bindingUtils: defaultBindingUtils,
    })
    if (initialSnapshot) {
      try { loadSnapshot(s, JSON.parse(initialSnapshot)) } catch { /* ignore corrupt data */ }
    }
    return s
  })

  const editorRef = useRef<Editor | null>(null)

  // Prop → ref mirrors so the stable onMount callback reads current values.
  const colorRef   = useRef(color)
  const widthRef   = useRef(width)
  const penOnlyRef = useRef(penOnly)
  useEffect(() => { colorRef.current  = color   }, [color])
  useEffect(() => { widthRef.current  = width   }, [width])
  useEffect(() => { penOnlyRef.current = penOnly }, [penOnly])

  // ── Sync prop changes → live editor ─────────────────────────────────────────

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.setStyleForNextShapes(DefaultColorStyle, (COLOR_MAP[color] ?? 'black') as never)
  }, [color])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.setStyleForNextShapes(DefaultSizeStyle, (SIZE_MAP[width] ?? 'm') as never)
  }, [width])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.setCurrentTool(tool === 'pen' ? 'draw' : 'eraser')
  }, [tool])

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    editor.updateInstanceState({ isPenMode: penOnly })
  }, [penOnly])

  // ── Imperative handle ────────────────────────────────────────────────────────

  useImperativeHandle(ref, () => ({
    exportBlob: async () => {
      const editor = editorRef.current
      if (!editor) return null
      const ids = [...editor.getCurrentPageShapeIds()]
      if (ids.length === 0) return null
      const { blob } = await editor.toImage(ids, {
        format:     'png',
        background: true,
        padding:    'auto',
        pixelRatio: 2,
      })
      return blob
    },
    getSnapshot: () => {
      const editor = editorRef.current
      if (!editor) return null
      return JSON.stringify(getSnapshot(editor.store))
    },
    undo: () => editorRef.current?.undo(),
    clear: () => {
      const editor = editorRef.current
      if (!editor) return
      const ids = [...editor.getCurrentPageShapeIds()]
      if (ids.length > 0) editor.deleteShapes(ids)
    },
    isEmpty: () => (editorRef.current?.getCurrentPageShapeIds().size ?? 0) === 0,
  }), [])

  // ── Components (background adapts to dark mode) ──────────────────────────────

  const components = useMemo((): TLComponents => ({
    ...HIDDEN_COMPONENTS_BASE,
    Background: () => (
      <div style={{ position: 'absolute', inset: 0, background: isDarkMode ? '#111827' : '#ffffff' }} />
    ),
  }), [isDarkMode])

  // ── onMount ──────────────────────────────────────────────────────────────────

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor

      // ── Camera: locked at exactly 0.5× (fit-x of a canvas 2× the viewport width) ──
      // Computing bounds at mount time lets us use the actual device width rather
      // than a hard-coded 800-unit assumption. fit-x with w = 2 × screenWidth
      // lands the zoom at exactly 0.5 on every screen size.
      const vp = editor.getViewportScreenBounds()
      editor.setCameraOptions({
        isLocked:      false,
        panSpeed:      1,
        zoomSpeed:     1,
        zoomSteps:     [0.5],          // single step = no zooming in or out
        wheelBehavior: 'none',
        constraints: {
          bounds:      { x: 0, y: 0, w: vp.width * 2, h: 100_000 },
          padding:     { x: 0, y: 0 },
          origin:      { x: 0, y: 0 },
          initialZoom: 'fit-x',
          baseZoom:    'fit-x',
          behavior: {
            x: 'fixed',    // no horizontal pan
            y: 'contain',  // vertical scroll within bounds
          },
        },
      })
      // Apply the new constraints immediately (reset to fit-x = 0.5×).
      editor.resetZoom()

      editor.setCurrentTool('draw')
      editor.setStyleForNextShapes(
        DefaultColorStyle,
        (COLOR_MAP[colorRef.current] ?? 'black') as never,
      )
      editor.setStyleForNextShapes(
        DefaultSizeStyle,
        (SIZE_MAP[widthRef.current] ?? 'm') as never,
      )

      // isPenMode: finger pans the canvas vertically; stylus draws.
      editor.updateInstanceState({ isPenMode: penOnlyRef.current })

      return editor.store.listen(() => {
        onShapeCountChange(editor.getCurrentPageShapeIds().size)
      })
    },
    [onShapeCountChange],
  )

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className={`relative ${className ?? ''}`}
      style={{ WebkitTouchCallout: 'none', userSelect: 'none', touchAction: 'none' }}
    >
      <Tldraw
        store={store}
        onMount={handleMount}
        components={components}
        options={TLDRAW_OPTIONS}
        colorScheme={isDarkMode ? 'dark' : 'light'}
        licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
      />
    </div>
  )
}

const TldrawNoteCanvas = forwardRef(TldrawNoteCanvasInner)
export default TldrawNoteCanvas
