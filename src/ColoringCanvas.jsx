import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { saveCurrent } from './storage.js'

// キャンバスの内部解像度(見た目のサイズとは独立)
const CANVAS_SIZE = 800
const MIN_ZOOM = 1
const MAX_ZOOM = 3.5

const COLORS = [
  '#2B2B2B', '#FFFFFF',
  '#FF6B6B', '#FF9F45', '#FFD166', '#F7E733',
  '#8BD450', '#4ECDC4', '#3D8BFF', '#7B6EF6',
  '#C77DFF', '#FF6FB5', '#B5651D', '#7A5230',
]

const BRUSH_SIZES = [
  { key: 'thin', label: '細い', size: 10 },
  { key: 'medium', label: '普通', size: 22 },
  { key: 'thick', label: '太い', size: 40 },
]

function drawStroke(ctx, stroke) {
  const { color, size, points } = stroke
  if (!points || points.length === 0) return
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = size

  if (points.length === 1) {
    ctx.beginPath()
    ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  ctx.beginPath()
  ctx.moveTo(points[0].x, points[0].y)
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2
    const midY = (points[i].y + points[i + 1].y) / 2
    ctx.quadraticCurveTo(points[i].x, points[i].y, midX, midY)
  }
  const last = points[points.length - 1]
  ctx.lineTo(last.x, last.y)
  ctx.stroke()
}

export default function ColoringCanvas({ template, initialStrokes, onBack }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const stageRef = useRef(null)
  const lineArtImgRef = useRef(null)

  const [strokes, setStrokes] = useState(initialStrokes || [])
  const strokesRef = useRef(strokes)
  strokesRef.current = strokes

  const [redoStack, setRedoStack] = useState([])
  const redoRef = useRef(redoStack)
  redoRef.current = redoStack

  const [color, setColor] = useState(COLORS[2])
  const [brush, setBrush] = useState(BRUSH_SIZES[1])
  const [justSaved, setJustSaved] = useState(false)

  const drawingRef = useRef(false)
  const liveStrokeRef = useRef(null)
  const pointersRef = useRef(new Map())
  const pinchRef = useRef(null)

  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const zoomRef = useRef(zoom)
  const panRef = useRef(pan)
  zoomRef.current = zoom
  panRef.current = pan

  const renderAll = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const s of strokesRef.current) drawStroke(ctx, s)
    if (liveStrokeRef.current) drawStroke(ctx, liveStrokeRef.current)
  }, [])

  useEffect(() => {
    canvasRef.current.width = CANVAS_SIZE
    canvasRef.current.height = CANVAS_SIZE
    renderAll()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const buildThumbnail = useCallback(() => {
    try {
      const off = document.createElement('canvas')
      off.width = CANVAS_SIZE
      off.height = CANVAS_SIZE
      const octx = off.getContext('2d')
      octx.fillStyle = '#ffffff'
      octx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      octx.drawImage(canvasRef.current, 0, 0)
      if (lineArtImgRef.current && lineArtImgRef.current.complete) {
        octx.globalCompositeOperation = 'multiply'
        octx.drawImage(lineArtImgRef.current, 0, 0, CANVAS_SIZE, CANVAS_SIZE)
        octx.globalCompositeOperation = 'source-over'
      }
      return off.toDataURL('image/png')
    } catch (e) {
      return null
    }
  }, [])

  const persist = useCallback(() => {
    const thumbnail = buildThumbnail()
    saveCurrent({
      templateId: template.id,
      strokes: strokesRef.current,
      thumbnail,
      updatedAt: Date.now(),
    })
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 500)
  }, [buildThumbnail, template.id])

  // 画面座標 -> キャンバス座標(内部解像度基準)に変換
  const toCanvasPoint = useCallback((clientX, clientY) => {
    const rect = wrapRef.current.getBoundingClientRect()
    const x = ((clientX - rect.left) / rect.width) * CANVAS_SIZE
    const y = ((clientY - rect.top) / rect.height) * CANVAS_SIZE
    return { x, y }
  }, [])

  const getStageRelative = useCallback((clientX, clientY) => {
    const rect = stageRef.current.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  const onPointerDown = (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2) {
      // ピンチ開始。描画中のストロークがあれば、消さずに確定してからズームに切り替える。
      if (drawingRef.current && liveStrokeRef.current && liveStrokeRef.current.points.length > 0) {
        const finished = liveStrokeRef.current
        setStrokes((prev) => {
          const next = [...prev, finished]
          strokesRef.current = next
          return next
        })
        setRedoStack([])
      }
      drawingRef.current = false
      liveStrokeRef.current = null
      const pts = [...pointersRef.current.values()]
      const p1 = getStageRelative(pts[0].x, pts[0].y)
      const p2 = getStageRelative(pts[1].x, pts[1].y)
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      pinchRef.current = {
        startDist: dist,
        startZoom: zoomRef.current,
        startPan: { ...panRef.current },
        startCenter: center,
      }
      renderAll()
      return
    }

    if (pointersRef.current.size === 1) {
      drawingRef.current = true
      const p = toCanvasPoint(e.clientX, e.clientY)
      liveStrokeRef.current = { color, size: brush.size, points: [p] }
      renderAll()
    }
  }

  const onPointerMove = (e) => {
    if (!pointersRef.current.has(e.pointerId)) return
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (pointersRef.current.size === 2 && pinchRef.current) {
      const pts = [...pointersRef.current.values()]
      const p1 = getStageRelative(pts[0].x, pts[0].y)
      const p2 = getStageRelative(pts[1].x, pts[1].y)
      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y)
      const center = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }
      const { startDist, startZoom, startPan, startCenter } = pinchRef.current
      const scaleFactor = dist / Math.max(startDist, 1)
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, startZoom * scaleFactor))
      const contentX = (startCenter.x - startPan.x) / startZoom
      const contentY = (startCenter.y - startPan.y) / startZoom
      const newPan = {
        x: center.x - contentX * newZoom,
        y: center.y - contentY * newZoom,
      }
      setZoom(newZoom)
      setPan(newPan)
      return
    }

    if (pointersRef.current.size === 1 && drawingRef.current && liveStrokeRef.current) {
      const p = toCanvasPoint(e.clientX, e.clientY)
      liveStrokeRef.current.points.push(p)
      renderAll()
    }
  }

  const finishPointer = (e) => {
    pointersRef.current.delete(e.pointerId)

    if (pointersRef.current.size < 2) {
      pinchRef.current = null
    }

    if (pointersRef.current.size === 0 && drawingRef.current) {
      drawingRef.current = false
      if (liveStrokeRef.current && liveStrokeRef.current.points.length > 0) {
        const finished = liveStrokeRef.current
        liveStrokeRef.current = null
        setStrokes((prev) => {
          const next = [...prev, finished]
          strokesRef.current = next
          return next
        })
        setRedoStack([])
        renderAll()
        persist()
      }
    }
  }

  // 大きめのwheel操作でも拡大縮小できるように(PCでの動作確認用)
  const onWheel = (e) => {
    e.preventDefault()
    const stageRect = stageRef.current.getBoundingClientRect()
    const center = { x: e.clientX - stageRect.left, y: e.clientY - stageRect.top }
    const delta = -e.deltaY * 0.0015
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoomRef.current * (1 + delta)))
    const contentX = (center.x - panRef.current.x) / zoomRef.current
    const contentY = (center.y - panRef.current.y) / zoomRef.current
    setZoom(newZoom)
    setPan({ x: center.x - contentX * newZoom, y: center.y - contentY * newZoom })
  }

  const undo = () => {
    setStrokes((prev) => {
      if (prev.length === 0) return prev
      const next = prev.slice(0, -1)
      const removed = prev[prev.length - 1]
      setRedoStack((r) => [...r, removed])
      strokesRef.current = next
      return next
    })
    setTimeout(() => { renderAll(); persist() }, 0)
  }

  const redo = () => {
    setRedoStack((r) => {
      if (r.length === 0) return r
      const restored = r[r.length - 1]
      const nextRedo = r.slice(0, -1)
      setStrokes((prev) => {
        const next = [...prev, restored]
        strokesRef.current = next
        return next
      })
      return nextRedo
    })
    setTimeout(() => { renderAll(); persist() }, 0)
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  const wrapStyle = useMemo(() => ({
    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
  }), [pan, zoom])

  return (
    <div className="screen coloring-screen">
      <div className="coloring-topbar">
        <div className="topbar-group">
          <button className="icon-button back-button" onClick={onBack} aria-label="もどる">←</button>
        </div>
        <div className="topbar-group">
          <button className="icon-button" onClick={undo} disabled={strokes.length === 0} aria-label="ひとつもどす">↩︎</button>
          <button className="icon-button" onClick={redo} disabled={redoStack.length === 0} aria-label="ひとつすすめる">↪︎</button>
          <button className="icon-button" onClick={resetView} aria-label="ひょうじをもどす">🔍</button>
          <button className={`icon-button${justSaved ? ' save-flash' : ''}`} aria-label="ほぞんじょうたい" tabIndex={-1}>
            {justSaved ? '✓' : '💾'}
          </button>
        </div>
      </div>

      <div
        className="canvas-stage"
        ref={stageRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishPointer}
        onPointerCancel={finishPointer}
        onPointerLeave={finishPointer}
        onWheel={onWheel}
      >
        <div
          className="canvas-transform-wrap"
          ref={wrapRef}
          style={{ width: 'min(92vw, 70vh)', height: 'min(92vw, 70vh)', ...wrapStyle }}
        >
          <canvas ref={canvasRef} />
          <img
            className="lineart"
            src={template.src}
            alt={template.name}
            ref={lineArtImgRef}
            draggable={false}
          />
        </div>
      </div>

      <div className="palette-bar">
        <div className="brush-row">
          {BRUSH_SIZES.map((b) => (
            <button
              key={b.key}
              className={`brush-size-btn${brush.key === b.key ? ' active' : ''}`}
              onClick={() => setBrush(b)}
              aria-label={b.label}
            >
              <span className="dot" style={{ width: b.size * 0.45, height: b.size * 0.45 }} />
            </button>
          ))}
        </div>
        <div className="color-scroll">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`color-swatch${color === c ? ' selected' : ''}`}
              style={{ background: c, borderColor: c === '#FFFFFF' ? '#e6e6e6' : 'rgba(255,255,255,0.9)' }}
              onClick={() => setColor(c)}
              aria-label={c}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
