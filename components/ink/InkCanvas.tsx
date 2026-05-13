'use client'

import { useEffect, useRef, useState } from 'react'
import { getStroke } from 'perfect-freehand'

interface InkPoint {
  x: number          // CSS pixels relative to canvas
  y: number
  pressure: number   // 0..1
}

interface Stroke {
  points: InkPoint[]
  color: string
  size: number       // perfect-freehand "size" — visual stroke width baseline
}

interface Props {
  /** Drawing color. Defaults to slate-900-ish ink. */
  color?: string
  /** Stroke size baseline (perfect-freehand `size`). */
  width?: number
  /**
   * When true, only Pointer Events with pointerType==='pen' or 'mouse' draw —
   * touches are ignored so the palm doesn't smear ink on iPad. Default true.
   */
  penOnly?: boolean
  onStrokesChange?: (strokeCount: number) => void
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  controlsRef?: React.MutableRefObject<{
    undo: () => void
    clear: () => void
    isEmpty: () => boolean
  } | null>
  className?: string
}

// ── perfect-freehand options ──────────────────────────────────────────────────
//
// These knobs tune how the raw pointer samples are turned into a smooth ink
// outline. The values below were tuned for Apple Pencil sampling rates on
// iPadOS Safari. If ink ever feels syrupy or laggy, lower `smoothing` and
// `streamline`. If it feels jittery, raise them.

const STROKE_OPTS = {
  thinning: 0.55,    // how much pressure thins the stroke (0 = none, 1 = max)
  smoothing: 0.62,   // post-process smoothing (Catmull-Rom)
  streamline: 0.45,  // input streamlining (Lerp)
  easing: (t: number) => t,
  start: {
    taper: 0,
    cap: true,
  },
  end: {
    taper: 0,
    cap: true,
  },
  // size is set per-stroke from the toolbar
}

/**
 * Converts a perfect-freehand outline polygon to a Path2D for fast canvas fill.
 * The polygon is a closed loop around the centerline, so we just lineTo each
 * vertex and close.
 */
function polygonToPath(points: number[][]): Path2D {
  const path = new Path2D()
  if (points.length < 2) return path
  const [first, ...rest] = points
  path.moveTo(first[0], first[1])
  for (const [x, y] of rest) path.lineTo(x, y)
  path.closePath()
  return path
}

/**
 * Canvas-based ink surface. Captures stylus input via Pointer Events (Apple
 * Pencil reports pointerType='pen' with real pressure on iPadOS Safari) and
 * renders pressure-aware strokes via perfect-freehand.
 *
 * Rendering strategy: two-layer caching.
 *   - committed strokes are baked to an offscreen canvas once when they're
 *     finished. On every frame we blit that cache to the visible canvas in
 *     one drawImage call (O(1) regardless of stroke count).
 *   - the in-progress stroke is re-rendered each frame on top.
 *   - rAF batches updates to the display's refresh rate, so a high-frequency
 *     pen (the iPad Pro hits 240Hz) doesn't trigger 240 redraws/sec.
 *
 * Palm rejection: when penOnly is true (default), touch pointers are dropped
 * entirely. If a pen event arrives while a touch stroke is mid-flight, the
 * touch stroke is abandoned and the pen takes over.
 */
export default function InkCanvas({
  color = '#0f172a',
  width = 4,
  penOnly = true,
  onStrokesChange,
  canvasRef,
  controlsRef,
  className,
}: Props) {
  const localCanvasRef = useRef<HTMLCanvasElement>(null)
  const ref = canvasRef ?? localCanvasRef
  const containerRef = useRef<HTMLDivElement>(null)

  // Cache canvas — holds the rasterized result of every committed stroke.
  // Same size as the visible canvas (including DPR).
  const cacheRef = useRef<HTMLCanvasElement | null>(null)

  const strokesRef = useRef<Stroke[]>([])
  const currentRef = useRef<Stroke | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const activeKindRef = useRef<'pen' | 'mouse' | 'touch' | null>(null)
  const rafRef = useRef<number | null>(null)
  const dirtyRef = useRef(false)

  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate((n) => n + 1)

  // Latest props captured in refs so the native event listeners attached in
  // the mount effect always see fresh values without needing to re-attach.
  const colorRef = useRef(color)
  const widthRef = useRef(width)
  const penOnlyRef = useRef(penOnly)
  useEffect(() => { colorRef.current = color }, [color])
  useEffect(() => { widthRef.current = width }, [width])
  useEffect(() => { penOnlyRef.current = penOnly }, [penOnly])

  // ── Geometry helpers ───────────────────────────────────────────────────────

  function getDpr() {
    return Math.max(1, window.devicePixelRatio || 1)
  }

  function resize() {
    const canvas = ref.current
    const container = containerRef.current
    if (!canvas || !container) return
    const dpr = getDpr()
    const rect = container.getBoundingClientRect()
    const w = Math.max(1, Math.round(rect.width * dpr))
    const h = Math.max(1, Math.round(rect.height * dpr))

    canvas.width = w
    canvas.height = h
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`

    if (!cacheRef.current) cacheRef.current = document.createElement('canvas')
    cacheRef.current.width = w
    cacheRef.current.height = h

    repaintCache()
    requestRender()
  }

  /** Re-rasterize every committed stroke onto the cache canvas. */
  function repaintCache() {
    const cache = cacheRef.current
    if (!cache) return
    const ctx = cache.getContext('2d')
    if (!ctx) return
    const dpr = getDpr()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, cache.width, cache.height)
    ctx.scale(dpr, dpr)
    for (const stroke of strokesRef.current) renderStroke(ctx, stroke)
  }

  /** Append a single stroke to the cache canvas without clearing. */
  function bakeStroke(stroke: Stroke) {
    const cache = cacheRef.current
    if (!cache) return
    const ctx = cache.getContext('2d')
    if (!ctx) return
    const dpr = getDpr()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)
    renderStroke(ctx, stroke)
  }

  function renderStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    const raw = stroke.points.map((p) => [p.x, p.y, p.pressure] as [number, number, number])
    const outline = getStroke(raw, { ...STROKE_OPTS, size: stroke.size })
    if (outline.length < 2) return
    ctx.fillStyle = stroke.color
    ctx.fill(polygonToPath(outline))
  }

  /** Render the on-screen canvas from cache + the in-progress stroke. */
  function paint() {
    const canvas = ref.current
    const cache = cacheRef.current
    if (!canvas || !cache) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(cache, 0, 0)
    if (currentRef.current) {
      ctx.scale(getDpr(), getDpr())
      renderStroke(ctx, currentRef.current)
    }
  }

  function requestRender() {
    if (dirtyRef.current) return
    dirtyRef.current = true
    rafRef.current = requestAnimationFrame(() => {
      dirtyRef.current = false
      paint()
    })
  }

  // ── Pointer event plumbing ─────────────────────────────────────────────────

  function eventToPoint(e: PointerEvent): InkPoint {
    const canvas = ref.current!
    const rect = canvas.getBoundingClientRect()
    const isPen = e.pointerType === 'pen'
    const raw = e.pressure
    // Mouse reports pressure 0.5 when the button is down. Touch may report 0.
    // Coerce non-pen sources to a stable mid-pressure so the ink isn't
    // invisible or weirdly tapered when typed-in.
    const pressure = isPen ? (raw > 0 ? raw : 0.5) : 0.55
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, pressure }
  }

  function shouldAccept(kind: string): boolean {
    if (!penOnlyRef.current) return true
    return kind !== 'touch'
  }

  function handleDown(e: PointerEvent) {
    if (!shouldAccept(e.pointerType)) return

    // Pen always beats an in-progress touch stroke (Apple Pencil priority).
    if (
      activePointerRef.current !== null &&
      activeKindRef.current !== 'pen' &&
      e.pointerType === 'pen'
    ) {
      currentRef.current = null
      activePointerRef.current = null
      activeKindRef.current = null
    }

    if (activePointerRef.current !== null) return

    activePointerRef.current = e.pointerId
    activeKindRef.current = e.pointerType as 'pen' | 'mouse' | 'touch'
    ref.current?.setPointerCapture(e.pointerId)
    currentRef.current = {
      points: [eventToPoint(e)],
      color: colorRef.current,
      size: widthRef.current,
    }
    requestRender()
    rerender()
  }

  function handleMove(e: PointerEvent) {
    if (activePointerRef.current !== e.pointerId) return
    const cur = currentRef.current
    if (!cur) return
    // High-frequency Pencil samples arrive in batches via getCoalescedEvents.
    const coalesced = e.getCoalescedEvents?.() ?? []
    if (coalesced.length > 0) {
      for (const sub of coalesced) cur.points.push(eventToPoint(sub))
    } else {
      cur.points.push(eventToPoint(e))
    }
    requestRender()
  }

  function commitStroke() {
    const cur = currentRef.current
    if (cur && cur.points.length > 0) {
      strokesRef.current.push(cur)
      bakeStroke(cur)
    }
    currentRef.current = null
    activePointerRef.current = null
    activeKindRef.current = null
    onStrokesChange?.(strokesRef.current.length)
    requestRender()
    rerender()
  }

  function handleUp(e: PointerEvent) {
    if (activePointerRef.current !== e.pointerId) return
    ref.current?.releasePointerCapture(e.pointerId)
    commitStroke()
  }

  function handleCancel(e: PointerEvent) {
    if (activePointerRef.current !== e.pointerId) return
    commitStroke()
  }

  // ── Mount: attach NATIVE listeners (avoids React synthetic event overhead) ─

  useEffect(() => {
    resize()
    const obs = new ResizeObserver(() => resize())
    if (containerRef.current) obs.observe(containerRef.current)

    const canvas = ref.current
    if (!canvas) return () => obs.disconnect()

    const down = (e: PointerEvent) => handleDown(e)
    const move = (e: PointerEvent) => handleMove(e)
    const up = (e: PointerEvent) => handleUp(e)
    const cancel = (e: PointerEvent) => handleCancel(e)

    // passive:false because we may want to preventDefault on touch in some
    // browsers; touch-action: none on the element already covers iOS though.
    canvas.addEventListener('pointerdown', down, { passive: false })
    canvas.addEventListener('pointermove', move, { passive: true })
    canvas.addEventListener('pointerup', up, { passive: true })
    canvas.addEventListener('pointercancel', cancel, { passive: true })
    canvas.addEventListener('pointerleave', cancel, { passive: true })

    return () => {
      obs.disconnect()
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', cancel)
      canvas.removeEventListener('pointerleave', cancel)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Imperative handle for parent toolbar (undo / clear).
  useEffect(() => {
    if (!controlsRef) return
    controlsRef.current = {
      undo: () => {
        if (strokesRef.current.length === 0) return
        strokesRef.current.pop()
        onStrokesChange?.(strokesRef.current.length)
        repaintCache()
        requestRender()
        rerender()
      },
      clear: () => {
        if (strokesRef.current.length === 0 && currentRef.current === null) return
        strokesRef.current = []
        currentRef.current = null
        activePointerRef.current = null
        activeKindRef.current = null
        onStrokesChange?.(strokesRef.current.length)
        repaintCache()
        requestRender()
        rerender()
      },
      isEmpty: () => strokesRef.current.length === 0 && currentRef.current === null,
    }
  }, [controlsRef, onStrokesChange])

  return (
    <div ref={containerRef} className={`relative bg-white ${className ?? ''}`}>
      <canvas
        ref={ref}
        // touch-action: none keeps the browser from stealing the gesture for
        // scroll/zoom while the user is drawing.
        className="block w-full h-full touch-none select-none cursor-crosshair"
      />
    </div>
  )
}
