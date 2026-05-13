'use client'

import { useEffect, useRef, useState } from 'react'

interface InkPoint {
  x: number          // CSS pixels relative to canvas
  y: number
  pressure: number   // 0..1
}

interface Stroke {
  points: InkPoint[]
  color: string
  baseWidth: number  // CSS pixels
}

interface Props {
  /** Initial drawing color. Defaults to slate-900-ish ink. */
  color?: string
  /** Initial pen width (CSS pixels at pressure=1). */
  width?: number
  /**
   * If true, only Pointer Events with pointerType==='pen' draw — fingers and
   * mouse are ignored. Useful for iPad palm rejection.
   */
  penOnly?: boolean
  /**
   * Called whenever the canvas content changes (added stroke, undo, clear).
   * Lets the parent decide whether the Save button should be enabled.
   */
  onStrokesChange?: (strokeCount: number) => void
  /** Forwarded ref to the underlying canvas for image export. */
  canvasRef?: React.RefObject<HTMLCanvasElement | null>
  /** Imperative handle so the parent can clear / undo from a toolbar. */
  controlsRef?: React.MutableRefObject<{
    undo: () => void
    clear: () => void
    isEmpty: () => boolean
  } | null>
  className?: string
}

/**
 * Canvas-based ink surface. Captures stylus input via the Pointer Events API
 * (Apple Pencil reports pointerType='pen' with real pressure on iPadOS Safari)
 * and renders pressure-aware strokes.
 *
 * Notes for reviewers:
 * - We scale the canvas backing store by devicePixelRatio so retina ink stays
 *   crisp.
 * - touch-action: none on the canvas prevents the browser from scrolling /
 *   zooming while the user draws.
 * - Each stroke is a sequence of quadratic curves between recorded points so
 *   the line looks smooth even at low sampling rates. Pressure modulates line
 *   width for that pencil-like taper.
 * - Strokes live in component state (an array of point arrays) so undo/clear
 *   are cheap and we can re-render the whole drawing on resize.
 */
export default function InkCanvas({
  color = '#0f172a',
  width = 2.4,
  penOnly = false,
  onStrokesChange,
  canvasRef,
  controlsRef,
  className,
}: Props) {
  const localCanvasRef = useRef<HTMLCanvasElement>(null)
  const ref = canvasRef ?? localCanvasRef
  const containerRef = useRef<HTMLDivElement>(null)

  const strokesRef = useRef<Stroke[]>([])
  const currentRef = useRef<Stroke | null>(null)
  const activePointerRef = useRef<number | null>(null)
  const [, forceUpdate] = useState(0)
  const rerender = () => forceUpdate((n) => n + 1)

  // ── Re-resolve canvas bitmap to match its CSS box × DPR ─────────────────────
  function resizeCanvas() {
    const canvas = ref.current
    const container = containerRef.current
    if (!canvas || !container) return
    const dpr = window.devicePixelRatio || 1
    const rect = container.getBoundingClientRect()
    canvas.width = Math.max(1, Math.round(rect.width * dpr))
    canvas.height = Math.max(1, Math.round(rect.height * dpr))
    canvas.style.width = `${rect.width}px`
    canvas.style.height = `${rect.height}px`
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
    }
    redraw()
  }

  function redraw() {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    // Use the CSS-pixel coordinate space for path drawing
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    for (const stroke of strokesRef.current) drawStroke(ctx, stroke)
    const cur = currentRef.current
    if (cur) drawStroke(ctx, cur)
  }

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    const pts = stroke.points
    if (pts.length === 0) return
    ctx.strokeStyle = stroke.color
    if (pts.length === 1) {
      const p = pts[0]
      ctx.beginPath()
      ctx.fillStyle = stroke.color
      ctx.arc(p.x, p.y, stroke.baseWidth * Math.max(0.6, p.pressure), 0, Math.PI * 2)
      ctx.fill()
      return
    }
    // Draw each segment with its own line width so pressure modulates taper.
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1]
      const curr = pts[i]
      const mid = { x: (prev.x + curr.x) / 2, y: (prev.y + curr.y) / 2 }
      const w =
        stroke.baseWidth *
        (0.55 + 0.9 * ((prev.pressure + curr.pressure) / 2))
      ctx.lineWidth = w
      ctx.beginPath()
      if (i === 1) {
        ctx.moveTo(prev.x, prev.y)
      } else {
        const prev2 = pts[i - 2]
        const m0 = { x: (prev2.x + prev.x) / 2, y: (prev2.y + prev.y) / 2 }
        ctx.moveTo(m0.x, m0.y)
      }
      ctx.quadraticCurveTo(prev.x, prev.y, mid.x, mid.y)
      ctx.stroke()
    }
  }

  // ── Pointer event plumbing ─────────────────────────────────────────────────

  function pointerToCanvas(e: PointerEvent | React.PointerEvent): InkPoint {
    const canvas = ref.current!
    const rect = canvas.getBoundingClientRect()
    // Apple Pencil reports real pressure 0..1. Mouse reports 0.5 for an
    // active button (and 0 when no button is down on hover events). Touch
    // sometimes reports 0; coerce non-pen sources to a sensible default so
    // the stroke isn't invisible.
    const native: PointerEvent =
      'nativeEvent' in e ? (e.nativeEvent as PointerEvent) : (e as PointerEvent)
    const isPen = native.pointerType === 'pen'
    const rawPressure = native.pressure
    const pressure = isPen
      ? rawPressure > 0
        ? rawPressure
        : 0.5
      : 0.55
    return {
      x: native.clientX - rect.left,
      y: native.clientY - rect.top,
      pressure,
    }
  }

  function shouldAccept(e: React.PointerEvent): boolean {
    if (!penOnly) return true
    return e.pointerType === 'pen'
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!shouldAccept(e)) return
    if (activePointerRef.current !== null) return
    activePointerRef.current = e.pointerId
    ref.current?.setPointerCapture(e.pointerId)
    currentRef.current = {
      points: [pointerToCanvas(e)],
      color,
      baseWidth: width,
    }
    rerender()
    redraw()
  }

  function onPointerMove(e: React.PointerEvent) {
    if (activePointerRef.current !== e.pointerId) return
    const cur = currentRef.current
    if (!cur) return
    // Some browsers/coalescing libraries emit getCoalescedEvents() — use
    // them so high-frequency pen samples don't get dropped.
    const native = e.nativeEvent as PointerEvent
    const coalesced = native.getCoalescedEvents?.() ?? []
    if (coalesced.length > 0) {
      for (const ev of coalesced) {
        cur.points.push(pointerToCanvas(ev))
      }
    } else {
      cur.points.push(pointerToCanvas(e))
    }
    redraw()
  }

  function endStroke() {
    const cur = currentRef.current
    if (cur && cur.points.length > 0) {
      strokesRef.current.push(cur)
    }
    currentRef.current = null
    activePointerRef.current = null
    onStrokesChange?.(strokesRef.current.length)
    redraw()
    rerender()
  }

  function onPointerUp(e: React.PointerEvent) {
    if (activePointerRef.current !== e.pointerId) return
    ref.current?.releasePointerCapture(e.pointerId)
    endStroke()
  }

  function onPointerCancel(e: React.PointerEvent) {
    if (activePointerRef.current !== e.pointerId) return
    endStroke()
  }

  // ── Lifecycle: size + parent controls ───────────────────────────────────────

  useEffect(() => {
    resizeCanvas()
    const obs = new ResizeObserver(() => resizeCanvas())
    if (containerRef.current) obs.observe(containerRef.current)
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!controlsRef) return
    controlsRef.current = {
      undo: () => {
        if (strokesRef.current.length === 0) return
        strokesRef.current.pop()
        onStrokesChange?.(strokesRef.current.length)
        redraw()
        rerender()
      },
      clear: () => {
        if (strokesRef.current.length === 0) return
        strokesRef.current = []
        onStrokesChange?.(strokesRef.current.length)
        redraw()
        rerender()
      },
      isEmpty: () => strokesRef.current.length === 0 && currentRef.current === null,
    }
  }, [controlsRef, onStrokesChange])

  return (
    <div ref={containerRef} className={`relative bg-white ${className ?? ''}`}>
      <canvas
        ref={ref}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onPointerLeave={onPointerCancel}
        // touch-action: none keeps the browser from stealing the gesture for
        // scroll/zoom while the user is drawing.
        className="block w-full h-full touch-none select-none cursor-crosshair"
      />
    </div>
  )
}
