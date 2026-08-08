"use client"

// ── Banco de pruebas del editor de Transmisión ───────────────────────────────
// Página PÚBLICA (sin cámara ni sesión) para VER y PROBAR el editor de objetos
// y el AJUSTE de la letra sin depender de una webcam.

import { useEffect, useRef, useState } from "react"
import ObjetoEditable from "@/components/ObjetoEditable"

const ANCHO = 1280, ALTO = 720
const PADX = 38, PADBOT = 22, TITULO_H = 46

const fontLetra = (w: number) => Math.round(Math.max(20, Math.min(54, w / 20)))

function ajustar(ctx: CanvasRenderingContext2D, texto: string, maxW: number): string[] {
  const out: string[] = []
  let actual = ""
  for (const p of texto.split(" ")) {
    const t = actual ? actual + " " + p : p
    if (ctx.measureText(t).width > maxW && actual) { out.push(actual); actual = p } else actual = t
  }
  if (actual) out.push(actual)
  return out
}
function envolver(ctx: CanvasRenderingContext2D, texto: string, maxW: number, font: number): string[] {
  ctx.font = `700 ${font}px system-ui`
  const out: string[] = []
  for (const b of (texto || "").split("\n")) { const l = b.trim(); if (l) out.push(...ajustar(ctx, l, maxW)) }
  return out
}
let _med: HTMLCanvasElement | null = null
function medCtx(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null
  if (!_med) _med = document.createElement("canvas")
  return _med.getContext("2d")
}
// La fuente escala con el ancho, pero se topa para que la caja QUEPA bajo su
// posición (no se sale de pantalla). Mismo cálculo que /en-vivo.
function medirLetra(ctx: CanvasRenderingContext2D | null, texto: string, w: number, yTop: number): { font: number; lineas: string[]; h: number } {
  const dispo = Math.max(150, ALTO - yTop - 22)
  const t = texto || ""
  const wrap = (f: number) => ctx ? envolver(ctx, t, w - PADX * 2, f) : t.split("\n").filter(l => l.trim())
  const altoDe = (f: number, n: number) => TITULO_H + Math.max(n, t.trim() ? 1 : 0) * f * 1.34 + PADBOT
  let font = fontLetra(w)
  let lineas = wrap(font)
  let h = altoDe(font, lineas.length)
  while (h > dispo && font > 16) { font -= 2; lineas = wrap(font); h = altoDe(font, lineas.length) }
  return { font, lineas, h: Math.round(h) }
}
function altoLetra(texto: string, w: number, yTop: number): number {
  return medirLetra(medCtx(), texto, w, yTop).h
}

type Obj = { id: string; etiqueta: string; pos: { x: number; y: number }; w: number; aspecto?: number; soloAncho?: boolean; color: string; texto?: string }

export default function EnVivoLab() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [objs, setObjs] = useState<Obj[]>([
    { id: "logo", etiqueta: "Logo", pos: { x: 60, y: 50 }, w: 200, aspecto: 1, color: "#f59e0b" },
    { id: "letra", etiqueta: "Letra", pos: { x: 300, y: 348 }, w: 680, soloAncho: true, color: "#ffffff", texto: "VEN, ¡OH, TODOPODEROSO,\nADORABLE CREADOR!\nPADRE SANTO, CARIÑOSO,\nMANIFIESTA TU AMOR.\nA TU TRONO DE CLEMENCIA\nLEVANTAMOS NUESTRA VOZ." },
  ])
  const objsRef = useRef(objs); useEffect(() => { objsRef.current = objs }, [objs])
  const cambiar = (id: string, p: { x: number; y: number }, w: number) => setObjs(l => l.map(o => o.id === id ? { ...o, pos: p, w: Math.round(w) } : o))
  const hDe = (o: Obj) => o.soloAncho ? altoLetra(o.texto || "", o.w, o.pos.y) : o.w * (o.aspecto || 1)

  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    let raf = 0
    const dibujar = () => {
      const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO); g.addColorStop(0, "#1f2937"); g.addColorStop(1, "#0b1220")
      ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO)
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1
      for (let x = 0; x < ANCHO; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ALTO); ctx.stroke() }
      for (let y = 0; y < ALTO; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ANCHO, y); ctx.stroke() }
      for (const o of objsRef.current) {
        if (o.soloAncho) { dibujarLetra(ctx, o.pos.x, o.pos.y, o.w, o.texto || "", o.color); continue }
        const h = o.w * (o.aspecto || 1)
        ctx.fillStyle = "rgba(245,158,11,0.25)"; ctx.strokeStyle = o.color; ctx.lineWidth = 3
        ctx.fillRect(o.pos.x, o.pos.y, o.w, h); ctx.strokeRect(o.pos.x, o.pos.y, o.w, h)
        ctx.fillStyle = o.color; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.font = "700 26px system-ui"
        ctx.fillText("LOGO", o.pos.x + o.w / 2, o.pos.y + h / 2)
      }
      raf = requestAnimationFrame(dibujar)
    }
    raf = requestAnimationFrame(dibujar)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", color: "#eaf0fb", fontFamily: "system-ui", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>🧪 Banco de pruebas — Editor</h1>
      <p style={{ fontSize: 13, color: "rgba(234,240,251,0.6)", marginTop: 4 }}>La caja de "Letra" ajusta su alto al texto y su fuente al ancho. Redimensiona desde las esquinas.</p>
      <div style={{ maxWidth: 900, marginTop: 16 }}>
        <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          <canvas ref={canvasRef} width={ANCHO} height={ALTO} style={{ width: "100%", height: "100%", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {objs.map(o => (
              <ObjetoEditable key={o.id} etiqueta={o.etiqueta} pos={o.pos} w={o.w} h={hDe(o)}
                soloAncho={o.soloAncho} minW={o.soloAncho ? 280 : 40} maxW={ANCHO} ancho={ANCHO} alto={ALTO}
                onChange={(p, w) => cambiar(o.id, p, w)} />
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(234,240,251,0.6)", display: "flex", gap: 16, flexWrap: "wrap" }}>
          {objs.map(o => <span key={o.id}>{o.etiqueta}: {Math.round(o.w)}×{Math.round(hDe(o))} font {o.soloAncho ? medirLetra(medCtx(), o.texto || "", o.w, o.pos.y).font : "-"} @ ({Math.round(o.pos.x)},{Math.round(o.pos.y)}) fondo≤{ALTO}</span>)}
        </div>
      </div>
    </div>
  )
}

// Réplica de dibujarLetraCaja para validar el comportamiento.
function dibujarLetra(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, texto: string, color: string) {
  const { font, lineas, h } = medirLetra(ctx, texto, w, y)
  const lineH = font * 1.34
  ctx.fillStyle = "rgba(6,10,20,0.82)"; ctx.beginPath(); ctx.roundRect(x, y, w, h, 18); ctx.fill()
  ctx.fillStyle = "#f59e0b"; ctx.beginPath(); ctx.roundRect(x + 15, y + 14, 5, h - 28, 3); ctx.fill()
  // título
  ctx.textAlign = "left"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = "rgba(255,255,255,0.82)"; ctx.font = "700 19px system-ui"
  ctx.fillText("VEN, ¡OH, TODOPODEROSO · Sol", x + PADX, y + 30)
  ctx.fillStyle = "rgba(255,255,255,0.12)"; ctx.fillRect(x + PADX, y + 40, w - PADX * 2, 1.5)
  // letra
  ctx.textAlign = "center"; ctx.fillStyle = color; ctx.font = `700 ${font}px system-ui`
  let ty = y + TITULO_H + font * 0.82
  for (const l of lineas) { ctx.fillText(l, x + w / 2, ty); ty += lineH }
}
