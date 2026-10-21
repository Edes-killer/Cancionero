"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { useApp } from "@/context/AppContext"
import { navegarSPA } from "@/lib/navegar"
import { permiteTransmision } from "@/lib/planes"

export default function RequierePremium({ children, funcion }: { children: ReactNode; funcion: string }) {
  const router = useRouter()
  const { listo, plan } = useApp()

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

  if (!permiteTransmision(plan)) {
    return (
      <main style={{ minHeight:"100vh", display:"grid", placeItems:"center", padding:24, background:"radial-gradient(circle at 50% 0%,#16213b 0,#060d1a 58%)", color:"#eef2ff", fontFamily:"'Segoe UI',system-ui,sans-serif" }}>
        <section style={{ width:"min(100%,560px)", padding:"34px 30px", borderRadius:22, background:"rgba(15,25,45,.94)", border:"1px solid rgba(245,158,11,.28)", boxShadow:"0 24px 70px rgba(0,0,0,.4)", textAlign:"center" }}>
          <div style={{ width:64, height:64, margin:"0 auto 18px", borderRadius:18, display:"grid", placeItems:"center", fontSize:30, background:"rgba(245,158,11,.14)", border:"1px solid rgba(245,158,11,.25)" }}>★</div>
          <div style={{ color:"#fbbf24", fontSize:11, fontWeight:900, letterSpacing:1.5 }}>PLAN PREMIUM</div>
          <h1 style={{ margin:"9px 0 10px", fontSize:26, lineHeight:1.15 }}>{funcion}</h1>
          <p style={{ margin:"0 auto 24px", maxWidth:450, color:"rgba(238,242,255,.62)", lineHeight:1.55, fontSize:14 }}>
            La transmisión profesional y la cámara móvil pertenecen al plan Premium. Tu iglesia mantiene disponibles Control, canciones, Biblia y preparación de cultos.
          </p>
          <div style={{ display:"flex", gap:10, justifyContent:"center", flexWrap:"wrap" }}>
            <button type="button" onClick={() => navegarSPA(router, "/")} style={{ padding:"11px 18px", borderRadius:11, border:"1px solid rgba(255,255,255,.13)", background:"rgba(255,255,255,.05)", color:"white", fontWeight:750, cursor:"pointer" }}>← Volver al inicio</button>
            <button type="button" onClick={() => { window.location.href = "/bienvenido/#planes" }} style={{ padding:"11px 18px", borderRadius:11, border:"none", background:"linear-gradient(135deg,#f59e0b,#d97706)", color:"#140b00", fontWeight:900, cursor:"pointer" }}>Ver plan Premium</button>
          </div>
        </section>
      </main>
    )
  }

  return children
}
