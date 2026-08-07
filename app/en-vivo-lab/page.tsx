"use client"

// ── Banco de pruebas del editor de Transmisión ───────────────────────────────
// Página PÚBLICA (sin cámara ni sesión) para VER y PROBAR el editor de objetos
// y el ajuste de texto sin depender de una webcam. Lo que se valide acá se
// aplica igual al /en-vivo real, que usa el mismo componente ObjetoEditable.

import { useEffect, useRef, useState } from "react"
import ObjetoEditable from "@/components/ObjetoEditable"

const ANCHO = 1280, ALTO = 720

type Obj = { id: string; etiqueta: string; pos: { x: number; y: number }; w: number; aspecto: number; color: string; texto?: string }

export default function EnVivoLab() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [objs, setObjs] = useState<Obj[]>([
    { id: "logo", etiqueta: "Logo", pos: { x: 60, y: 50 }, w: 200, aspecto: 1, color: "#f59e0b" },
    { id: "nombre", etiqueta: "Nombre", pos: { x: 470, y: 40 }, w: 340, aspecto: 0.28, color: "#93c5fd", texto: "IGLESIA MORADORA DE SIÓN" },
    { id: "letra", etiqueta: "Letra", pos: { x: 170, y: 430 }, w: 940, aspecto: 0.32, color: "#ffffff", texto: "GOZO HAY EN EL CIELO, POR LA SALVACIÓN\nDE UN DESDICHADO PECADOR,\nALEGRÍA EN LA CELESTIAL MANSIÓN,\nHIMNOS DE TRIUNFO Y AMOR" },
  ])
  const objsRef = useRef(objs)
  useEffect(() => { objsRef.current = objs }, [objs])

  const cambiar = (id: string, p: { x: number; y: number }, w: number) =>
    setObjs(list => list.map(o => o.id === id ? { ...o, pos: p, w: Math.round(w) } : o))

  // Bucle de dibujo del lienzo (fondo "cámara" + objetos como cajas)
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    let raf = 0
    const dibujar = () => {
      // Fondo tipo cámara (gradiente + rejilla) para ver los objetos encima
      const g = ctx.createLinearGradient(0, 0, ANCHO, ALTO)
      g.addColorStop(0, "#1f2937"); g.addColorStop(1, "#0b1220")
      ctx.fillStyle = g; ctx.fillRect(0, 0, ANCHO, ALTO)
      ctx.strokeStyle = "rgba(255,255,255,0.05)"; ctx.lineWidth = 1
      for (let x = 0; x < ANCHO; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ALTO); ctx.stroke() }
      for (let y = 0; y < ALTO; y += 80) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ANCHO, y); ctx.stroke() }

      for (const o of objsRef.current) {
        const h = o.w * o.aspecto
        if (o.id === "letra") { dibujarCajaTexto(ctx, o.pos.x, o.pos.y, o.w, h, o.texto || "", o.color); continue }
        if (o.id === "nombre") {
          ctx.textAlign = "center"; ctx.textBaseline = "middle"
          let t = 40; ctx.font = `700 ${t}px system-ui`
          while (ctx.measureText(o.texto || "").width > o.w - 20 && t > 12) { t -= 2; ctx.font = `700 ${t}px system-ui` }
          ctx.fillStyle = o.color; ctx.fillText(o.texto || "", o.pos.x + o.w / 2, o.pos.y + h / 2)
          continue
        }
        // logo: caja
        ctx.fillStyle = "rgba(245,158,11,0.25)"; ctx.strokeStyle = o.color; ctx.lineWidth = 3
        ctx.fillRect(o.pos.x, o.pos.y, o.w, h); ctx.strokeRect(o.pos.x, o.pos.y, o.w, h)
        ctx.fillStyle = o.color; ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.font = "700 26px system-ui"; ctx.fillText("LOGO", o.pos.x + o.w / 2, o.pos.y + h / 2)
      }
      raf = requestAnimationFrame(dibujar)
    }
    raf = requestAnimationFrame(dibujar)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div style={{ minHeight: "100vh", background: "#060d1a", color: "#eaf0fb", fontFamily: "system-ui", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 800 }}>🧪 Banco de pruebas — Editor de Transmisión</h1>
      <p style={{ fontSize: 13, color: "rgba(234,240,251,0.6)", marginTop: 4 }}>Arrastra los objetos y redimensiónalos desde las 4 esquinas. Verifica que la letra se ajuste al tamaño de su caja.</p>
      <div style={{ maxWidth: 900, marginTop: 16 }}>
        <div style={{ position: "relative", aspectRatio: "16 / 9", borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)" }}>
          <canvas ref={canvasRef} width={ANCHO} height={ALTO} style={{ width: "100%", height: "100%", display: "block" }} />
          <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {objs.map(o => (
              <ObjetoEditable key={o.id} etiqueta={o.etiqueta} pos={o.pos} w={o.w} h={o.w * o.aspecto}
                minW={40} maxW={ANCHO} ancho={ANCHO} alto={ALTO}
                onChange={(p, w) => cambiar(o.id, p, w)} />
            ))}
          </div>
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: "rgba(234,240,251,0.6)", display: "flex", gap: 16, flexWrap: "wrap" }}>
          {objs.map(o => <span key={o.id}>{o.etiqueta}: {Math.round(o.w)}×{Math.round(o.w * o.aspecto)} @ ({Math.round(o.pos.x)},{Math.round(o.pos.y)})</span>)}
        </div>
      </div>
    </div>
  )
}

// Caja de letra con auto-ajuste (misma lógica que la transmisión) para validar
// que el texto SIEMPRE quepa completo dentro de la caja.
function dibujarCajaTexto(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, texto: string, color: string) {
  // Fondo
  ctx.fillStyle = "rgba(6,10,20,0.7)"
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fill()
  const padX = 30, padY = 22
  const areaW = w - padX * 2, areaH = h - padY * 2
  const envolver = (t: number): string[] => {
    ctx.font = `700 ${t}px system-ui`
    const out: string[] = []
    for (const bruto of texto.split("\n")) {
      const linea = bruto.trim(); if (!linea) continue
      const palabras = linea.split(" ")
      let actual = ""
      for (const p of palabras) {
        const prueba = actual ? actual + " " + p : p
        if (ctx.measureText(prueba).width > areaW && actual) { out.push(actual); actual = p }
        else actual = prueba
      }
      if (actual) out.push(actual)
    }
    return out
  }
  let tam = 44, lineas = envolver(tam)
  while (lineas.length * tam * 1.28 > areaH && tam > 12) { tam -= 2; lineas = envolver(tam) }
  const alturaLinea = tam * 1.28
  let ty = y + padY + (areaH - lineas.length * alturaLinea) / 2 + tam * 0.8
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic"; ctx.fillStyle = color
  ctx.font = `700 ${tam}px system-ui`
  for (const l of lineas) { ctx.fillText(l, x + w / 2, ty); ty += alturaLinea }
}
