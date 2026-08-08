"use client"

import { useEffect, useRef } from "react"

// ── Objeto editable sobre un lienzo (mover + redimensionar) ──────────────────
// Componente compartido por la Transmisión (/en-vivo) y el banco de pruebas
// (/en-vivo-lab). Trabaja en el espacio del lienzo (ancho×alto, por defecto
// 1280×720) y se posiciona en % de su contenedor, así escala solo.
//
// Robusto: mientras arrastras, el seguimiento va por el DOCUMENTO (no por la
// manijita), así el puntero no se "pierde" al salirse de ella. Redimensiona
// desde las 4 esquinas manteniendo la proporción; la esquina OPUESTA queda fija
// y el ancho lo da la distancia horizontal (predecible, sin saltos).

type Corner = "tl" | "tr" | "bl" | "br"
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))

export interface ObjetoEditableProps {
  pos: { x: number; y: number }
  w: number
  h: number
  onChange: (p: { x: number; y: number }, w: number) => void
  etiqueta: string
  minW?: number
  maxW?: number
  ancho?: number
  alto?: number
  // "solo ancho": al redimensionar cambia solo el ancho; el alto lo maneja el
  // contenido (ej. el rótulo de letra, que crece según el texto). La parte de
  // arriba (y) queda fija.
  soloAncho?: boolean
}

export default function ObjetoEditable({
  pos, w, h, onChange, etiqueta, minW = 60, maxW, ancho = 1280, alto = 720, soloAncho = false,
}: ObjetoEditableProps) {
  const maxAncho = maxW ?? ancho
  const ref = useRef<HTMLDivElement>(null)

  // Props frescas para que los listeners del documento usen siempre lo último.
  const propsRef = useRef({ onChange, minW, maxAncho, ancho, alto, soloAncho })
  propsRef.current = { onChange, minW, maxAncho, ancho, alto, soloAncho }

  // Estado del arrastre en curso (null = sin arrastre).
  const est = useRef<{
    modo: "mover" | "esc"; px: number; py: number; x: number; y: number; w: number; h: number
    ax: number; ay: number; ratio: number; left: boolean; top: boolean
    rect: DOMRect
  } | null>(null)

  // Handlers estables (para add/removeEventListener).
  const onMove = useRef((e: PointerEvent) => {
    const s = est.current; if (!s) return
    const r = s.rect; if (!r.width) return
    const { onChange, minW, maxAncho, ancho, alto, soloAncho } = propsRef.current

    if (s.modo === "mover") {
      const dx = (e.clientX - s.px) * (ancho / r.width)
      const dy = (e.clientY - s.py) * (alto / r.height)
      onChange({ x: clamp(s.x + dx, 0, ancho - s.w), y: clamp(s.y + dy, 0, alto - s.h) }, s.w)
      return
    }
    // Redimensionar: ancho = distancia horizontal del puntero al ancla.
    const px = (e.clientX - r.left) * (ancho / r.width)
    const nw = clamp(Math.abs(px - s.ax), minW, maxAncho)
    const nx = clamp(s.left ? s.ax - nw : s.ax, 0, ancho - nw)
    if (soloAncho) {
      // El alto lo maneja el contenido; la parte de arriba (y) queda fija.
      onChange({ x: nx, y: s.y }, nw)
      return
    }
    const nh = nw * s.ratio
    const ny = clamp(s.top ? s.ay - nh : s.ay, 0, alto - nh)
    onChange({ x: nx, y: ny }, nw)
  }).current

  const onUp = useRef(() => {
    est.current = null
    document.removeEventListener("pointermove", onMove)
    document.removeEventListener("pointerup", onUp)
    document.removeEventListener("pointercancel", onUp)
  }).current

  useEffect(() => () => onUp(), []) // limpiar si se desmonta a mitad de arrastre

  const arrancar = (comun: Omit<NonNullable<typeof est.current>, "rect">) => {
    const rect = ref.current?.parentElement?.getBoundingClientRect()
    if (!rect) return
    est.current = { ...comun, rect }
    document.addEventListener("pointermove", onMove)
    document.addEventListener("pointerup", onUp)
    document.addEventListener("pointercancel", onUp)
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
      <div onPointerDown={iniciarEscalar("tl")} style={manija({ left: -10, top: -10, cursor: "nwse-resize" })} />
      <div onPointerDown={iniciarEscalar("tr")} style={manija({ right: -10, top: -10, cursor: "nesw-resize" })} />
      <div onPointerDown={iniciarEscalar("bl")} style={manija({ left: -10, bottom: -10, cursor: "nesw-resize" })} />
      <div onPointerDown={iniciarEscalar("br")} style={manija({ right: -10, bottom: -10, cursor: "nwse-resize" })} />
    </div>
  )
}
