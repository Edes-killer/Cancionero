"use client"

import { useEffect, useRef } from "react"

// ── Objeto editable sobre un lienzo (mover + redimensionar) ──────────────────
// Componente compartido por la Transmisión (/en-vivo) y el banco de pruebas
// (/en-vivo-lab). Trabaja en el espacio del lienzo (ancho×alto, por defecto
// 1280×720) y se posiciona en % de su contenedor, así escala solo.
//
// Robusto: mientras arrastras, el seguimiento va por el DOCUMENTO (no por la
// manijita), así el puntero no se "pierde" al salirse de ella. Redimensiona
// desde las 4 esquinas. Por defecto mantiene la proporción (logo, cámara e
// imágenes); con `redimensionLibre` cada eje responde al movimiento real del
// puntero (cajas de texto). La esquina OPUESTA siempre queda fija.

type Corner = "tl" | "tr" | "bl" | "br"
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export interface ObjetoEditableProps {
  pos: { x: number; y: number }
  w: number
  h: number
  onChange: (p: { x: number; y: number }, w: number, h?: number) => void
  etiqueta: string
  minW?: number
  maxW?: number
  ancho?: number
  alto?: number
  minH?: number
  maxH?: number
  // "solo ancho": al redimensionar cambia solo el ancho; el alto lo maneja el
  // contenido (ej. el rótulo de letra, que crece según el texto). La parte de
  // arriba (y) queda fija.
  soloAncho?: boolean
  // Permite modificar ancho y alto de manera independiente desde cualquiera
  // de las cuatro esquinas. Útil para texto largo y overlays editoriales.
  redimensionLibre?: boolean
}

export default function ObjetoEditable({
  pos, w, h, onChange, etiqueta, minW = 60, maxW, ancho = 1280, alto = 720,
  minH = 48, maxH, soloAncho = false, redimensionLibre = false,
}: ObjetoEditableProps) {
  const maxAncho = maxW ?? ancho
  const maxAlto = maxH ?? alto
  const ref = useRef<HTMLDivElement>(null)

  // Props frescas para que los listeners del documento usen siempre lo último.
  const propsRef = useRef({ onChange, minW, maxAncho, minH, maxAlto, ancho, alto, soloAncho, redimensionLibre })
  useEffect(() => {
    propsRef.current = { onChange, minW, maxAncho, minH, maxAlto, ancho, alto, soloAncho, redimensionLibre }
  }, [alto, ancho, maxAlto, maxAncho, minH, minW, onChange, redimensionLibre, soloAncho])

  // Estado del arrastre en curso (null = sin arrastre).
  const est = useRef<{
    modo: "mover" | "esc"; px: number; py: number; x: number; y: number; w: number; h: number
    ax: number; ay: number; ratio: number; left: boolean; top: boolean
    rect: DOMRect
  } | null>(null)
  const limpiarListenersRef = useRef<(() => void) | null>(null)

  useEffect(() => () => limpiarListenersRef.current?.(), [])

  const arrancar = (comun: Omit<NonNullable<typeof est.current>, "rect">) => {
    const rect = ref.current?.parentElement?.getBoundingClientRect()
    if (!rect) return
    est.current = { ...comun, rect }
    const mover = (e: PointerEvent) => {
      const s = est.current; if (!s) return
      const r = s.rect; if (!r.width) return
      const { onChange, minW, maxAncho, minH, maxAlto, ancho, alto, soloAncho, redimensionLibre } = propsRef.current
      if (s.modo === "mover") {
        const dx = (e.clientX - s.px) * (ancho / r.width)
        const dy = (e.clientY - s.py) * (alto / r.height)
        onChange({ x: clamp(s.x + dx, 0, ancho - s.w), y: clamp(s.y + dy, 0, alto - s.h) }, s.w)
        return
      }
      const px = (e.clientX - r.left) * (ancho / r.width)
      const nw = clamp(Math.abs(px - s.ax), minW, maxAncho)
      const nx = clamp(s.left ? s.ax - nw : s.ax, 0, ancho - nw)
      if (soloAncho) {
        onChange({ x: nx, y: s.y }, nw)
        return
      }
      if (redimensionLibre) {
        const py = (e.clientY - r.top) * (alto / r.height)
        const limiteW = Math.min(maxAncho, s.left ? s.ax : ancho - s.ax)
        const limiteH = Math.min(maxAlto, s.top ? s.ay : alto - s.ay)
        const anchoLibre = clamp(Math.abs(px - s.ax), Math.min(minW, limiteW), limiteW)
        const altoLibre = clamp(Math.abs(py - s.ay), Math.min(minH, limiteH), limiteH)
        const xLibre = s.left ? s.ax - anchoLibre : s.ax
        const yLibre = s.top ? s.ay - altoLibre : s.ay
        onChange({ x: xLibre, y: yLibre }, anchoLibre, altoLibre)
        return
      }
      const nh = nw * s.ratio
      const ny = clamp(s.top ? s.ay - nh : s.ay, 0, alto - nh)
      onChange({ x: nx, y: ny }, nw)
    }
    const terminar = () => {
      est.current = null
      document.removeEventListener("pointermove", mover)
      document.removeEventListener("pointerup", terminar)
      document.removeEventListener("pointercancel", terminar)
      limpiarListenersRef.current = null
    }
    limpiarListenersRef.current?.()
    limpiarListenersRef.current = terminar
    document.addEventListener("pointermove", mover)
    document.addEventListener("pointerup", terminar)
    document.addEventListener("pointercancel", terminar)
  }

  const iniciarMover = (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    arrancar({ modo: "mover", px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, w, h, ax: 0, ay: 0, ratio: h / w, left: false, top: false })
  }
  const iniciarEscalar = (corner: Corner) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    const left = corner === "tl" || corner === "bl"
    const top = corner === "tl" || corner === "tr"
    arrancar({
      modo: "esc", px: e.clientX, py: e.clientY, x: pos.x, y: pos.y, w, h,
      ax: left ? pos.x + w : pos.x, ay: top ? pos.y + h : pos.y, ratio: h / w, left, top,
    })
  }

  const manija = (extra: React.CSSProperties): React.CSSProperties => ({
    position: "absolute", width: 20, height: 20, borderRadius: 5,
    background: "#2563eb", border: "2px solid #fff", boxShadow: "0 1px 5px rgba(0,0,0,.45)",
    touchAction: "none", pointerEvents: "auto", ...extra,
  })

  return (
    <div
      ref={ref}
      onPointerDown={iniciarMover}
      style={{
        position: "absolute",
        left: `${(pos.x / ancho) * 100}%`, top: `${(pos.y / alto) * 100}%`,
        width: `${(w / ancho) * 100}%`, height: `${(h / alto) * 100}%`,
        border: "1.5px dashed rgba(147,197,253,0.95)", borderRadius: 6,
        cursor: "move", boxSizing: "border-box", pointerEvents: "auto", touchAction: "none",
      }}
    >
      <span style={{
        position: "absolute", top: -20, left: 0, fontSize: 10, fontWeight: 700, color: "#fff",
        background: "#2563eb", padding: "1px 7px", borderRadius: 4, whiteSpace: "nowrap", pointerEvents: "none",
      }}>{etiqueta}</span>
      <div title="Ajustar desde arriba a la izquierda" onPointerDown={iniciarEscalar("tl")} style={manija({ left: -10, top: -10, cursor: "nwse-resize" })} />
      <div title="Ajustar desde arriba a la derecha" onPointerDown={iniciarEscalar("tr")} style={manija({ right: -10, top: -10, cursor: "nesw-resize" })} />
      <div title="Ajustar desde abajo a la izquierda" onPointerDown={iniciarEscalar("bl")} style={manija({ left: -10, bottom: -10, cursor: "nesw-resize" })} />
      <div title="Ajustar desde abajo a la derecha" onPointerDown={iniciarEscalar("br")} style={manija({ right: -10, bottom: -10, cursor: "nwse-resize" })} />
    </div>
  )
}
