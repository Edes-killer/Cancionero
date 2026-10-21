"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { navegarSPA } from "@/lib/navegar"
import { permiteCamaraMovil, permiteTransmision } from "@/lib/planes"

type Capacidad = "transmision" | "premium"

export default function RequierePlan({
  children,
  funcion,
  capacidad = "transmision",
}: {
  children: ReactNode
  funcion: string
  capacidad?: Capacidad
}) {
  const router = useRouter()
  const { listo, plan } = useApp()
  const permitido = capacidad === "transmision" ? permiteTransmision(plan) : permiteCamaraMovil(plan)
  const planNecesario = capacidad === "transmision" ? "Pro" : "Premium"

  if (!listo) {
    return (
      <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", background:"#060d1a", color:"#cbd5e1", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:28, marginBottom:10 }}>◌</div>
          <div style={{ fontWeight:750 }}>Comprobando tu plan…</div>
        </div>
      </main>
    )
  }

  if (!permitido) {
    return (
      <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", padding:24, background:"radial-gradient(circle at 50% 0%,#16213b 0,#060d1a 58%)", color:"#eef2ff", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
        <section style={{ width:"min(100%,560px)", padding:"34px 30px", borderRadius:22, background:"rgba(15,25,45,.94)", border:"1px solid rgba(245,158,11,.28)", boxShadow:"0 24px 70px rgba(0,0,0,.4)", textAlign:"center" }}>
          <div style={{ width:64, height:64, margin:"0 auto 18px", borderRadius:18, display:"grid", placeItems:"center", fontSize:30, background:"rgba(245,158,11,.14)", border:"1px solid rgba(245,158,11,.25)" }}>★</div>
          <div style={{ color:"#fbbf24", fontSize:11, fontWeight:900, letterSpacing:1.5 }}>PLAN {planNecesario.toUpperCase()}</div>
          <h1 style={{ margin:"9px 0 10px", fontSize:26, lineHeight:1.15 }}>{funcion}</h1>
          <p style={{ margin:"0 auto 24px", maxWidth:450, color:"rgba(238,242,255,.62)", lineHeight:1.55, fontSize:14 }}>
            {capacidad === "transmision"
              ? "La transmisión nativa está disponible desde el plan Pro. Gratis mantiene Control, canciones, Biblia y preparación de cultos."
              : "Esta función avanzada pertenece al plan Premium. Pro mantiene disponible la transmisión nativa con una cámara y un destino."}
          </p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <button type="button" onClick={() => navegarSPA(router, "/")} style={{ padding:"11px 18px", borderRadius:11, border:"1px solid rgba(255,255,255,.13)", background:"rgba(255,255,255,.05)", color:"white", fontWeight:750, cursor:"pointer" }}>← Volver al inicio</button>
            <button type="button" onClick={() => { window.location.href = "/bienvenido/#planes" }} style={{ padding:"11px 18px", borderRadius:11, border:"none", background:"linear-gradient(135deg,#f59e0b,#d97706)", color:"#140b00", fontWeight:900, cursor:"pointer" }}>Ver plan {planNecesario}</button>
          </div>
        </section>
      </main>
    )
  }

  return children
}
