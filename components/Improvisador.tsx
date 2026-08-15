"use client"

// ── Modo improvisación (UI) ──────────────────────────────────────────────────
// Muestra las escalas sugeridas para el tono de la canción + un piano que marca
// las notas. Reutilizable en /musicos (y donde haga falta).

import { useMemo, useState } from "react"
import { improvisar, type Escala } from "@/lib/improvisacion"

// Un piano de 2 octavas (SVG, escala al ancho) que resalta las notas de la
// escala; la tónica va marcada más fuerte.
function Piano({ escala, nombrePc }: { escala: Escala; nombrePc: Record<number, string> }) {
  const ancho = 28, alto = 108, bw = 18, bh = 66
  const blancasPc = [0, 2, 4, 5, 7, 9, 11]          // Do Re Mi Fa Sol La Si
  const negras = [{ i: 0, pc: 1 }, { i: 1, pc: 3 }, { i: 3, pc: 6 }, { i: 4, pc: 8 }, { i: 5, pc: 10 }]
  const W = ancho * 14

  const enEscala = (pc: number) => escala.clases.includes(pc)
  const esRaiz = (pc: number) => pc === escala.raiz

  const blancas: any[] = [], negrasEls: any[] = []
  for (let o = 0; o < 2; o++) {
    for (let k = 0; k < 7; k++) {
      const i = o * 7 + k, pc = blancasPc[k], x = i * ancho
      const on = enEscala(pc), raiz = esRaiz(pc)
      blancas.push(
        <g key={`w${i}`}>
          <rect x={x + 0.5} y={0.5} width={ancho - 1} height={alto - 1} rx={3}
            fill={raiz ? "#f59e0b" : on ? "#bfdbfe" : "#f4f4f5"} stroke="#3f3f46" strokeWidth={0.6} />
          {on && <text x={x + ancho / 2} y={alto - 12} textAnchor="middle" fontSize={11} fontWeight={800} fill={raiz ? "#7a3d02" : "#1e3a8a"}>{nombrePc[pc]}</text>}
        </g>
      )
    }
    for (const n of negras) {
      const i = o * 7 + n.i, x = (i + 1) * ancho - bw / 2
      const on = enEscala(n.pc), raiz = esRaiz(n.pc)
      negrasEls.push(
        <g key={`b${i}`}>
          <rect x={x} y={0} width={bw} height={bh} rx={2.5}
            fill={raiz ? "#d97706" : on ? "#2563eb" : "#18181b"} stroke="#000" strokeWidth={0.6} />
          {on && <text x={x + bw / 2} y={bh - 7} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">{nombrePc[n.pc]}</text>}
        </g>
      )
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${alto}`} width="100%" style={{ display: "block", borderRadius: 8, background: "#27272a" }} role="img" aria-label={`Piano con la escala ${escala.nombre}`}>
      {blancas}{negrasEls}
    </svg>
  )
}

export default function Improvisador({ tono, pasos = 0, americano = false }: { tono: string; pasos?: number; americano?: boolean }) {
  const data = useMemo(() => improvisar(tono, pasos, americano), [tono, pasos, americano])
  const [sel, setSel] = useState(0)

  if (!data) {
    return (
      <div style={{ padding: "14px 16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 13.5, color: "rgba(255,255,255,0.6)" }}>
        🎼 No pude detectar el tono de esta canción. Asigna un tono (ej. <strong style={{ color: "#fff" }}>Sol</strong> o <strong style={{ color: "#fff" }}>La menor</strong>) para ver las escalas.
      </div>
    )
  }

  const esc = data.escalas[Math.min(sel, data.escalas.length - 1)]
  const nombrePc: Record<number, string> = {}
  esc.clases.forEach((c, k) => { nombrePc[c] = esc.notas[k] })

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 14.5, fontWeight: 800, color: "#fff" }}>
        🎼 Improvisar en <span style={{ color: "#f59e0b" }}>{data.tonoNombre}</span>
      </div>

      {/* Pestañas de escalas */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {data.escalas.map((e, i) => (
          <button key={e.nombre} onClick={() => setSel(i)}
            style={{
              padding: "7px 12px", borderRadius: 99, cursor: "pointer", fontSize: 12.5, fontWeight: 700,
              background: i === sel ? "rgba(37,99,235,0.25)" : "rgba(255,255,255,0.05)",
              border: `1px solid ${i === sel ? "#2563eb" : "rgba(255,255,255,0.12)"}`,
              color: i === sel ? "#bfdbfe" : "rgba(255,255,255,0.7)", whiteSpace: "nowrap",
            }}>{e.nombre}</button>
        ))}
      </div>

      <Piano escala={esc} nombrePc={nombrePc} />

      {/* Notas de la escala */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {esc.notas.map((n, k) => (
          <span key={k} style={{
            padding: "4px 10px", borderRadius: 8, fontSize: 13, fontWeight: 800,
            background: esc.clases[k] === esc.raiz ? "rgba(245,158,11,0.22)" : "rgba(255,255,255,0.06)",
            border: `1px solid ${esc.clases[k] === esc.raiz ? "rgba(245,158,11,0.5)" : "rgba(255,255,255,0.12)"}`,
            color: esc.clases[k] === esc.raiz ? "#fbbf24" : "#e5e7eb",
          }}>{n}{esc.clases[k] === esc.raiz ? " •" : ""}</span>
        ))}
      </div>

      <div style={{ fontSize: 12.5, color: "rgba(255,255,255,0.6)", lineHeight: 1.5 }}>
        💡 {esc.cuando} La nota con <span style={{ color: "#fbbf24" }}>•</span> es la tónica (la de “casa”).
      </div>
    </div>
  )
}
