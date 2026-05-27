'use client'

/**
 * TldrawNoteCanvas — tldraw v5-backed ink canvas for coaching notes.
 *
 * Design goals:
 *   • Infinite scrollable canvas — finger pans, Apple Pencil draws (isPenMode)
 *   • No iOS selection / Scribble interference — all tldraw UI hidden, context
 *     menu suppressed, tldraw owns all pointer event handling
 *   • Clean white background with subtle grid-free look
 *   • Exports to PNG blob for upload to Cloudinary (same save flow as before)
 *
 * Usage: dynamically imported with { ssr: false } from the parent component to
 * avoid Next.js SSR issues with tldraw's browser-only APIs.
 */

import { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import {
  Tldraw,
  Editor,
  DefaultColorStyle,
  DefaultSizeStyle,
  type TLComponents,
  type TLUiComponents,
} from 'tldraw'
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
const SIZE_MAP: Record<number, 's' | 'm' | 'l'> = {
  1.8: 's',
  3:   'm',
  5:   'l',
}

// ── Component overrides ────────────────────────────────────────────────────────

/**
 * Suppress all tldraw built-in UI. We render our own minimal toolbar outside
 * the tldraw tree. Removing the context menu prevents iOS long-press from
 * triggering the system selection / copy-paste popover.
 * Defined outside the component so the reference is stable (tldraw requires
 * this to be memoised or top-level).
 */
const HIDDEN_COMPONENTS: TLComponents = {
  Toolbar:           null,
  MainMenu:          null,
  StylePanel:        null,
  PageMenu:          null,
  NavigationPanel:   null,
  HelpMenu:          null,
  DebugMenu:         null,
  // HelperButtons renders the "Exit pen mode" button. Hiding it prevents
  // anything from calling the exit-pen-mode action and resetting isPenMode
  // back to false after we set it on mount.
  HelperButtons:     null,
  // Remove the loading screen — the canvas becomes interactive immediately
  // (combined with maxFontsToLoadBeforeRender: 0 below).
  LoadingScreen:     null,
  // Plain white background — no tldraw dot pattern.
  Background: () => (
    <div style={{ position: 'absolute', inset: 0, background: '#ffffff' }} />
  ),
}

/**
 * Skip tldraw's font-loading wait entirely. By default tldraw sets
 * maxFontsToLoadBeforeRender to Infinity, which means it shows a non-interactive
 * placeholder div for ~2 seconds while fonts load. Setting it to 0 makes the
 * real canvas render immediately on mount. Defined at module scope so the
 * reference is stable across renders (tldraw requires this to be memoised or
 * top-level to avoid re-mounting the editor).
 */
const TLDRAW_OPTIONS = { maxFontsToLoadBeforeRender: 0 } as const

// ── Public handle type ─────────────────────────────────────────────────────────

export interface TldrawNoteCanvasHandle {
  /** Export the current canvas content as a PNG Blob, or null if empty. */
  exportBlob: () => Promise<Blob | null>
  undo:  () => void
  clear: () => void
  isEmpty: () => boolean
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface Props {
  /** Hex colour from the parent toolbar. */
  color:   string
  /** Numeric width from the parent toolbar (maps to tldraw size token). */
  width:   number
  /** 'pen' activates tldraw's draw tool; 'eraser' activates the eraser. */
  tool:    'pen' | 'eraser'
  /**
   * When true (default), touches pan the canvas and only the stylus draws.
   * Maps to tldraw's built-in isPenMode. Removes the need for a manual
   * "pen only" toggle — this is just how Apple Notes / OneNote behave.
   */
  penOnly: boolean
  /** Fired whenever the number of shapes on the canvas changes. */
  onShapeCountChange: (count: number) => void
  className?: string
}

// ── Component ──────────────────────────────────────────────────────────────────

function TldrawNoteCanvasInner(
  { color, width, tool, penOnly, onShapeCountChange, className }: Props,
  ref: React.ForwardedRef<TldrawNoteCanvasHandle>,
) {
  const editorRef = useRef<Editor | null>(null)

  // Mirror latest prop values into refs so the stable onMount callback always
  // reads fresh data without needing to re-run.
  const colorRef   = useRef(color)
  const widthRef   = useRef(width)
  const penOnlyRef = useRef(penOnly)
  useEffect(() => { colorRef.current   = color   }, [color])
  useEffect(() => { widthRef.current   = width   }, [width])
  useEffect(() => { penOnlyRef.current = penOnly }, [penOnly])

  // ── Sync prop changes → editor ───────────────────────────────────────────────

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

  // ── Imperative handle for parent toolbar ─────────────────────────────────────

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
    undo: () => editorRef.current?.undo(),
    clear: () => {
      const editor = editorRef.current
      if (!editor) return
      const ids = [...editor.getCurrentPageShapeIds()]
      if (ids.length > 0) editor.deleteShapes(ids)
    },
    isEmpty: () => (editorRef.current?.getCurrentPageShapeIds().size ?? 0) === 0,
  }), [])

  // ── onMount ──────────────────────────────────────────────────────────────────

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor

      // Set initial tool and styles from current prop values.
      editor.setCurrentTool('draw')
      editor.setStyleForNextShapes(
        DefaultColorStyle,
        (COLOR_MAP[colorRef.current] ?? 'black') as never,
      )
      editor.setStyleForNextShapes(
        DefaultSizeStyle,
        (SIZE_MAP[widthRef.current] ?? 'm') as never,
      )

      // isPenMode: finger pans the infinite canvas; stylus draws. This is the
      // core behaviour that makes it feel like Apple Notes / OneNote.
      editor.updateInstanceState({ isPenMode: penOnlyRef.current })

      // Keep parent informed of shape count for save-button enabled state.
      // We return the unsubscribe function so tldraw cleans up on unmount.
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
      // Prevent the iOS system context menu / callout on long press. tldraw
      // handles pointer events internally but this belt-and-suspenders CSS
      // stops Safari from stealing events before tldraw sees them.
      style={{ WebkitTouchCallout: 'none', userSelect: 'none', touchAction: 'none' }}
    >
      <Tldraw
        onMount={handleMount}
        components={HIDDEN_COMPONENTS}
        options={TLDRAW_OPTIONS}
        // Lock to light mode — prevents the dark-mode CSS class swap that
        // causes the slight colour change symptom after font loading.
        colorScheme={'light' as const}
        forceMobile={false}
      />
    </div>
  )
}

const TldrawNoteCanvas = forwardRef(TldrawNoteCanvasInner)
export default TldrawNoteCanvas
