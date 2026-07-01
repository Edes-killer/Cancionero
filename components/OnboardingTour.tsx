"use client"
import { useEffect, useState, useRef } from "react"

export interface PasoTour {
  titulo: string
  desc: string
  tip?: string
  atajo?: string
  selector?: string
  posicion?: "top" | "bottom" | "left" | "right"
  icono?: string
  antes?: () => void  // ✅ abre paneles/dropdowns antes de mostrar el paso
}

interface Props {
  id: string
  pasos: PasoTour[]
  nombrePagina?: string
  onFin?: () => void
}

export default function OnboardingTour({ id, pasos, nombrePagina, onFin }: Props) {
  const [activo,     setActivo]     = useState(false)
  const [paso,       setPaso]       = useState(0)
  const [rect,       setRect]       = useState<DOMRect | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const [entrando,   setEntrando]   = useState(false)
  const [inicio,     setInicio]     = useState(true) // pantalla de bienvenida

  useEffect(() => {
    const visto   = localStorage.getItem(id)
    const forzar  = sessionStorage.getItem(`${id}-forzar`)
    if (!visto || forzar) {
      sessionStorage.removeItem(`${id}-forzar`)
      setTimeout(() => { setActivo(true); setEntrando(true); setTimeout(() => setEntrando(false), 400) }, 900)
    }
  }, [id])

  useEffect(() => {
    if (!activo || inicio) return
    const p = pasos[paso]
    const run = async () => {
    if (p?.selector) {
      // ✅ Ejecutar callback antes (abrir panel/dropdown)
      if (p.antes) {
        p.antes()
        // Dar tiempo a que el DOM se actualice antes de buscar el elemento
        await new Promise(r => setTimeout(r, 320))
      }
      const el = document.querySelector(p.selector) as HTMLElement | null
      if (el) {
        // ✅ Scroll inteligente: busca el contenedor scrollable más cercano
        const scrollearHacia = (elemento: HTMLElement) => {
          // Buscar padre con overflow scroll/auto
          let padre = elemento.parentElement
          while (padre && padre !== document.body) {
            const overflow = window.getComputedStyle(padre).overflowY
            if (overflow === "scroll" || overflow === "auto") {
              const pr = padre.getBoundingClientRect()
              const er = elemento.getBoundingClientRect()
              padre.scrollTop += er.top - pr.top - pr.height / 2 + er.height / 2
              return
            }
            padre = padre.parentElement
          }
          // Fallback: scroll de ventana
          const er = elemento.getBoundingClientRect()
          const scrollY = window.scrollY + er.top - window.innerHeight / 2 + er.height / 2
          window.scrollTo({ top: Math.max(0, scrollY), behavior: "smooth" })
        }

        scrollearHacia(el)
        setTimeout(() => {
          const r = el.getBoundingClientRect()
          setRect(r)
          calcularPos(r, p.posicion || "bottom")
        }, 450)
        return
      }
    }
    setRect(null)
    setTooltipPos({ top: window.innerHeight / 2 - 120, left: window.innerWidth / 2 - 190 })
    }
    run()
  }, [paso, activo, inicio, pasos])

  const calcularPos = (r: DOMRect, pos: string) => {
    const W = 380, H = 270, pad = 16
    const vh = window.innerHeight, vw = window.innerWidth
    let top = 0, left = 0

    if (pos === "bottom")     { top = r.bottom + pad; left = r.left + r.width / 2 - W / 2 }
    else if (pos === "top")   { top = r.top - H - pad; left = r.left + r.width / 2 - W / 2 }
    else if (pos === "right") { top = r.top + r.height / 2 - H / 2; left = r.right + pad }
    else                      { top = r.top + r.height / 2 - H / 2; left = r.left - W - pad }

    // Si no cabe abajo → arriba, si no cabe arriba → centro
    if (top + H > vh - 12) top = r.top - H - pad
    if (top < 12)          top = Math.max(12, vh / 2 - H / 2)

    // ✅ Anti-solape: si el tooltip tapa el elemento, moverlo al lado opuesto
    const tapa = top < r.bottom + 8 && top + H > r.top - 8
    if (tapa) top = r.bottom + pad < vh - H - 12 ? r.bottom + pad : r.top - H - pad

    left = Math.max(12, Math.min(left, vw - W - 12))
    top  = Math.max(12, Math.min(top, vh - H - 12))
    setTooltipPos({ top, left })
  }

  const siguiente = () => {
    if (paso < pasos.length - 1) { setEntrando(true); setTimeout(() => setEntrando(false), 300); setPaso(p => p + 1) }
    else terminar()
  }

  const terminar = () => {
    localStorage.setItem(id, "1")
    setActivo(false)
    onFin?.()
  }

  if (!activo) return null

  const p = pasos[paso]
  const tiene = !!(rect && p?.selector && !inicio)

  // ── Pantalla de bienvenida ────────────────────────────────────────────────
  if (inicio) return (
    <div style={{ position:"fixed", inset:0, zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center",
      background:"rgba(2,6,23,0.92)", backdropFilter:"blur(8px)", fontFamily:"'Segoe UI',system-ui,sans-serif",
      animation:"fadeIn .4s ease" }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:scale(.96) } to { opacity:1; transform:scale(1) } }
        @keyframes float { 0%,100% { transform:translateY(0) } 50% { transform:translateY(-6px) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:.6 } }
      `}</style>
      <div style={{ maxWidth:460, width:"90%", textAlign:"center" }}>
        <div style={{ fontSize:72, marginBottom:12, animation:"float 2.5s ease-in-out infinite" }}>
          {pasos[0]?.icono || "🎛️"}
        </div>
        <div style={{ fontSize:28, fontWeight:900, color:"white", marginBottom:8, letterSpacing:"-0.03em" }}>
          {nombrePagina || "Bienvenido"}
        </div>
        <div style={{ fontSize:15, color:"rgba(255,255,255,0.55)", lineHeight:1.7, marginBottom:8 }}>
          Parece que es tu primera vez aquí.<br/>
          Te mostramos todo lo que necesitas saber en <strong style={{ color:"#93c5fd" }}>{pasos.length} pasos rápidos</strong>.
        </div>
        <div style={{ display:"flex", gap:6, justifyContent:"center", flexWrap:"wrap", marginBottom:32, marginTop:16 }}>
          {pasos.map((s, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:4, padding:"4px 10px", borderRadius:20,
              background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)",
              fontSize:11, color:"rgba(255,255,255,0.5)" }}>
              {s.icono || "·"} {s.titulo.replace(/^[^\w]+/, "").substring(0, 22)}
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
          <button onClick={terminar} style={{ padding:"10px 20px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)",
            background:"transparent", color:"rgba(255,255,255,0.4)", fontSize:13, cursor:"pointer" }}>
            Saltar
          </button>
          <button onClick={() => setInicio(false)} style={{ padding:"12px 28px", borderRadius:12, border:"none",
            background:"linear-gradient(135deg,#2563eb,#6366f1)", color:"white",
            fontSize:15, fontWeight:800, cursor:"pointer", boxShadow:"0 8px 24px rgba(37,99,235,0.4)" }}>
            Empezar el tour →
          </button>
        </div>
      </div>
    </div>
  )

  // ── Tour paso a paso ──────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
        @keyframes glow { 0%,100% { box-shadow:0 0 0 4px rgba(59,130,246,0.2),0 0 20px rgba(59,130,246,0.2) }
                          50% { box-shadow:0 0 0 6px rgba(59,130,246,0.35),0 0 35px rgba(59,130,246,0.35) } }
      `}</style>

      {/* Overlay */}
      <div style={{ position:"fixed", inset:0, zIndex:9998, pointerEvents: tiene ? "none" : "auto",
        background: tiene
          ? `radial-gradient(ellipse at ${(rect!.left+rect!.width/2)}px ${(rect!.top+rect!.height/2)}px,
             transparent ${Math.max(rect!.width,rect!.height)*0.9}px,
             rgba(2,6,23,0.6) ${Math.max(rect!.width,rect!.height)*1.25}px)`
          : "rgba(2,6,23,0.6)",
        backdropFilter:"blur(0.5px)", transition:"background .4s" }}
        onClick={!tiene ? terminar : undefined}
      />

      {/* Resaltado del elemento */}
      {tiene && rect && (
        <div style={{ position:"fixed", zIndex:9999, pointerEvents:"none",
          left:rect.left-6, top:rect.top-6, width:rect.width+12, height:rect.height+12,
          borderRadius:10, outline:"2.5px solid #3b82f6",
          boxShadow:"0 0 0 3px rgba(59,130,246,0.2), 0 0 20px rgba(59,130,246,0.25)",
          transition:"all .35s ease" }}
        />
      )}

      {/* Tooltip */}
      <div style={{
        position:"fixed", zIndex:10000, width:380,
        top:tooltipPos.top, left:tooltipPos.left,
        background:"rgba(10,18,38,0.98)", border:"1px solid rgba(59,130,246,0.3)",
        borderRadius:18, padding:"22px 24px",
        boxShadow:"0 24px 70px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)",
        fontFamily:"'Segoe UI',system-ui,sans-serif", color:"white",
        animation: entrando ? "fadeIn .3s ease" : "none",
        transition:"top .35s ease, left .35s ease"
      }}>
        {/* Barra de progreso */}
        <div style={{ display:"flex", gap:3, marginBottom:18 }}>
          {pasos.map((_, i) => (
            <div key={i} style={{ flex:1, height:3, borderRadius:2, overflow:"hidden",
              background:"rgba(255,255,255,0.08)" }}>
              <div style={{ height:"100%", borderRadius:2,
                background: i < paso ? "#3b82f6" : i === paso ? "linear-gradient(90deg,#3b82f6,#6366f1)" : "transparent",
                width: i === paso ? "100%" : i < paso ? "100%" : "0%",
                transition:"width .4s ease" }}
              />
            </div>
          ))}
        </div>

        {/* Encabezado */}
        <div style={{ display:"flex", alignItems:"flex-start", gap:12, marginBottom:12 }}>
          {p.icono && (
            <div style={{ width:40, height:40, borderRadius:10, background:"rgba(37,99,235,0.15)",
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
              {p.icono}
            </div>
          )}
          <div>
            <div style={{ fontSize:16, fontWeight:800, lineHeight:1.3 }}>{p.titulo}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>
              Paso {paso + 1} de {pasos.length}
            </div>
          </div>
        </div>

        {/* Descripción */}
        <div style={{ fontSize:13, color:"rgba(255,255,255,0.7)", lineHeight:1.7, marginBottom: p.tip || p.atajo ? 12 : 18 }}>
          {p.desc}
        </div>

        {/* Tip */}
        {p.tip && (
          <div style={{ padding:"8px 12px", borderRadius:8, marginBottom:10,
            background:"rgba(34,197,94,0.08)", border:"1px solid rgba(34,197,94,0.2)",
            fontSize:12, color:"#86efac", lineHeight:1.5 }}>
            💡 {p.tip}
          </div>
        )}

        {/* Atajo de teclado */}
        {p.atajo && (
          <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12, fontSize:12, color:"rgba(255,255,255,0.4)" }}>
            ⌨️ Atajo:
            {p.atajo.split("+").map((k, i) => (
              <span key={i}><kbd style={{ padding:"2px 6px", borderRadius:5,
                background:"rgba(255,255,255,0.07)", border:"1px solid rgba(255,255,255,0.12)",
                fontSize:11, fontFamily:"monospace" }}>{k}</kbd>
                {i < p.atajo!.split("+").length - 1 && " + "}
              </span>
            ))}
          </div>
        )}

        {/* Botones */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <button onClick={terminar} style={{ padding:"6px 10px", borderRadius:8, border:"none",
            background:"transparent", color:"rgba(255,255,255,0.3)", fontSize:12, cursor:"pointer" }}>
            Saltar tour
          </button>
          <div style={{ display:"flex", gap:8 }}>
            {paso > 0 && (
              <button onClick={() => setPaso(p => p - 1)} style={{ padding:"8px 14px", borderRadius:10,
                border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)",
                color:"white", fontSize:13, fontWeight:600, cursor:"pointer" }}>
                ← Atrás
              </button>
            )}
            <button onClick={siguiente} style={{ padding:"9px 20px", borderRadius:10, border:"none",
              background: paso === pasos.length - 1
                ? "linear-gradient(135deg,#22c55e,#16a34a)"
                : "linear-gradient(135deg,#2563eb,#6366f1)",
              color:"white", fontSize:13, fontWeight:700, cursor:"pointer",
              boxShadow: paso === pasos.length - 1
                ? "0 4px 16px rgba(34,197,94,0.35)"
                : "0 4px 16px rgba(37,99,235,0.35)" }}>
              {paso === pasos.length - 1 ? "¡Listo! ✓" : "Siguiente →"}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

export const resetTour = (id: string) => localStorage.removeItem(id)
