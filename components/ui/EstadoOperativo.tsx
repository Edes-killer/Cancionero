"use client"

import type { CSSProperties, ReactNode } from "react"

export type NivelEstado = "ok" | "warning" | "error" | "idle" | "live"

const PALETA: Record<NivelEstado, { fondo: string; borde: string; texto: string; punto: string }> = {
  ok:      { fondo:"rgba(34,197,94,.10)",  borde:"rgba(34,197,94,.25)",  texto:"#86efac", punto:"#22c55e" },
  warning: { fondo:"rgba(245,158,11,.10)", borde:"rgba(245,158,11,.28)", texto:"#fcd34d", punto:"#f59e0b" },
  error:   { fondo:"rgba(239,68,68,.11)",  borde:"rgba(239,68,68,.28)",  texto:"#fca5a5", punto:"#ef4444" },
  idle:    { fondo:"rgba(148,163,184,.08)",borde:"rgba(148,163,184,.18)",texto:"#cbd5e1", punto:"#64748b" },
  live:    { fondo:"rgba(220,38,38,.16)",  borde:"rgba(248,113,113,.38)",texto:"#fecaca", punto:"#ef4444" },
}

export default function EstadoOperativo({ nivel, icono, etiqueta, detalle, compacto=false, onClick }: {
  nivel: NivelEstado
  icono?: ReactNode
  etiqueta: string
  detalle?: string
  compacto?: boolean
  onClick?: () => void
}) {
  const p = PALETA[nivel]
  const estilo: CSSProperties = {
    display:"inline-flex", alignItems:"center", gap:compacto ? 5 : 7,
    minHeight:compacto ? 24 : 30, padding:compacto ? "3px 7px" : "5px 10px",
    borderRadius:999, border:`1px solid ${p.borde}`, background:p.fondo, color:p.texto,
    fontSize:compacto ? 9.5 : 11.5, fontWeight:800, whiteSpace:"nowrap",
    cursor:onClick ? "pointer" : "default",
  }
  const contenido = <>
    {icono || <span aria-hidden style={{ width:7, height:7, borderRadius:99, background:p.punto, boxShadow:nivel === "live" ? `0 0 7px ${p.punto}` : "none" }} />}
    <span>{etiqueta}</span>
    {detalle && !compacto && <span style={{ opacity:.65, fontWeight:650 }}>{detalle}</span>}
  </>
  return onClick
    ? <button type="button" onClick={onClick} title={detalle} style={estilo}>{contenido}</button>
    : <span title={detalle} style={estilo}>{contenido}</span>
}
