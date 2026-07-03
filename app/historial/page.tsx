"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getIglesiaId } from "@/lib/getIglesia"

const f: React.CSSProperties = { fontFamily: "'Segoe UI', system-ui, sans-serif" }

export default function HistorialPage() {
  const router = useRouter()
  const [cargando,    setCargando]    = useState(true)
  const [cultos,      setCultos]      = useState<any[]>([])
  const [seleccionado, setSeleccionado] = useState<any>(null)
  const [canciones,   setCanciones]   = useState<any[]>([])
  const [stats,       setStats]       = useState({ totalCultos:0, totalProyecciones:0, topCancion:"" })
  const [topList,     setTopList]     = useState<{titulo:string,total:number}[]>([])
  const [mes,         setMes]         = useState("")
  const [pag,         setPag]         = useState(0)
  const POR_PAG = 12

  useEffect(() => { cargar() }, [])

  const cargar = async () => {
    const igId = await getIglesiaId()
    if (!igId) { router.replace("/login"); return }

    const [cultosRes, histRes] = await Promise.all([
      supabase.from("listas_culto")
        .select("id, nombre, fecha")
        .eq("iglesia_id", igId)
        .order("fecha", { ascending: false }),
      supabase.from("historial_proyecciones")
        .select("cancion_id, titulo, proyectado_en, lista_id")
        .eq("iglesia_id", igId)
        .eq("tipo", "cancion")
        .order("proyectado_en", { ascending: false })
        .limit(2000)
    ])

    const listasCulto = cultosRes.data || []
    const hist        = histRes.data   || []

    // ── Enriquecer cultos con cantidad de proyecciones ──────────────────────
    const conteoXLista = new Map<string, number>()
    hist.forEach((h: any) => {
      if (h.lista_id) conteoXLista.set(h.lista_id, (conteoXLista.get(h.lista_id) || 0) + 1)
    })
    const cultosEnriquecidos = listasCulto.map((c: any) => ({
      ...c, proyecciones: conteoXLista.get(c.id) || 0
    }))
    setCultos(cultosEnriquecidos)

    // ── Top canciones ────────────────────────────────────────────────────────
    const conteoCancion = new Map<string, any>()
    hist.forEach((h: any) => {
      const k = h.cancion_id || h.titulo
      if (!k) return
      if (!conteoCancion.has(k)) conteoCancion.set(k, { titulo: h.titulo || "Sin título", total: 0 })
      conteoCancion.get(k).total++
    })
    const top = Array.from(conteoCancion.values()).sort((a, b) => b.total - a.total).slice(0, 10)
    setTopList(top)

    setStats({
      totalCultos: listasCulto.length,
      totalProyecciones: hist.length,
      topCancion: top[0]?.titulo || "—"
    })
    setCargando(false)
  }

  const abrirCulto = async (culto: any) => {
    setSeleccionado(culto)
    const { data } = await supabase
      .from("historial_proyecciones")
      .select("titulo, tono, categoria, proyectado_en")
      .eq("lista_id", culto.id)
      .eq("tipo", "cancion")
      .order("proyectado_en")
    setCanciones(data || [])
  }

  // ── Filtrar por mes ────────────────────────────────────────────────────────
  const cultosFiltrados = cultos.filter(c => {
    if (!mes) return true
    return c.fecha?.startsWith(mes)
  })
  const mesesDisponibles = Array.from(new Set(
    cultos.map(c => c.fecha?.slice(0, 7)).filter(Boolean)
  )).sort().reverse()

  const pagActual = cultosFiltrados.slice(pag * POR_PAG, (pag + 1) * POR_PAG)
  const totalPags = Math.ceil(cultosFiltrados.length / POR_PAG)

  const Card = ({ children, style = {} }: any) => (
    <div style={{ borderRadius: 14, padding: "14px 16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", ...style }}>{children}</div>
  )

  if (cargando) return (
    <div style={{ ...f, minHeight:"100dvh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center", color:"white" }}>
      <div style={{ width:44,height:44,borderRadius:"50%",border:"3px solid rgba(255,255,255,0.08)",borderTopColor:"#3b82f6",animation:"spin .8s linear infinite" }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  // ── Vista detalle culto ───────────────────────────────────────────────────
  if (seleccionado) return (
    <div style={{ ...f, minHeight:"100dvh", background:"#060d1a", color:"white" }}>
      <div style={{ maxWidth:700, margin:"0 auto", padding:"0 0 60px" }}>
        <div style={{ padding:"20px 16px 14px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => { setSeleccionado(null); setCanciones([]) }}
            style={{ padding:"8px 14px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)", color:"white", fontSize:14, cursor:"pointer" }}>
            ← Volver
          </button>
          <div>
            <div style={{ fontWeight:900, fontSize:20 }}>{seleccionado.nombre || "Sin nombre"}</div>
            {seleccionado.fecha && <div style={{ fontSize:13, opacity:.4, marginTop:2 }}>
              {new Date(seleccionado.fecha+"T00:00:00").toLocaleDateString("es-ES",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
            </div>}
          </div>
        </div>
        <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:8 }}>
          {canciones.length === 0 ? (
            <div style={{ textAlign:"center", opacity:.3, padding:40 }}>Sin proyecciones registradas</div>
          ) : canciones.map((c, i) => (
            <Card key={i}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:28,height:28,borderRadius:8,background:"rgba(37,99,235,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:"#93c5fd",flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600,fontSize:14,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{c.titulo}</div>
                  <div style={{ fontSize:11,opacity:.4,marginTop:2 }}>{[c.tono && `Tono ${c.tono}`,c.categoria].filter(Boolean).join(" · ")}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )

  // ── Vista principal ────────────────────────────────────────────────────────
  return (
    <div style={{ ...f, minHeight:"100dvh", background:"#060d1a", color:"white" }}>
      <div style={{ maxWidth:900, margin:"0 auto", padding:"0 0 60px" }}>

        {/* Header */}
        <div style={{ padding:"24px 16px 16px", display:"flex", alignItems:"center", gap:12 }}>
          <button onClick={() => router.push("/")} style={{ padding:"8px 14px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)", color:"white", fontSize:14, cursor:"pointer" }}>← Dashboard</button>
          <div style={{ fontSize:22, fontWeight:900 }}>📅 Historial de Cultos</div>
        </div>

        <div style={{ padding:"0 16px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
            {[
              { n: stats.totalCultos,       label:"cultos registrados", color:"#3b82f6", icon:"📋" },
              { n: stats.totalProyecciones,  label:"proyecciones",       color:"#a855f7", icon:"🎵" },
              { n: topList.length > 0 ? topList[0].total : 0, label:`veces: ${stats.topCancion.slice(0,18)}`, color:"#f59e0b", icon:"🔥" },
            ].map(({ n, label, color, icon }) => (
              <div key={label} style={{ borderRadius:12, padding:"12px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)" }}>
                <div style={{ fontSize:11 }}>{icon}</div>
                <div style={{ fontSize:22, fontWeight:900, color, marginTop:4 }}>{n}</div>
                <div style={{ fontSize:11, opacity:.5, marginTop:2, lineHeight:1.4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Top canciones */}
          {topList.length > 0 && (
            <div style={{ borderRadius:14, overflow:"hidden", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)", fontWeight:800, fontSize:14 }}>🏆 Las más cantadas</div>
              {topList.map((c, i) => (
                <div key={i} style={{ padding:"10px 16px", display:"flex", alignItems:"center", gap:12, borderBottom: i<topList.length-1?"1px solid rgba(255,255,255,0.04)":"none" }}>
                  <div style={{ width:24,height:24,borderRadius:7,flexShrink:0,background:i===0?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:i===0?"#fbbf24":"rgba(255,255,255,0.4)" }}>{i+1}</div>
                  <div style={{ flex:1, fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.titulo}</div>
                  <div style={{ fontSize:12,fontWeight:700,padding:"2px 8px",borderRadius:6,background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.4)" }}>{c.total}×</div>
                </div>
              ))}
            </div>
          )}

          {/* Filtro por mes */}
          <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
            <span style={{ fontSize:13, opacity:.5 }}>Filtrar:</span>
            <button onClick={() => { setMes(""); setPag(0) }} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${!mes?"rgba(37,99,235,0.5)":"rgba(255,255,255,0.1)"}`, background:!mes?"rgba(37,99,235,0.15)":"transparent", color:!mes?"#93c5fd":"rgba(255,255,255,0.5)", fontSize:12, fontWeight:600, cursor:"pointer" }}>Todos</button>
            {mesesDisponibles.slice(0,6).map(m => (
              <button key={m} onClick={() => { setMes(m); setPag(0) }} style={{ padding:"5px 12px", borderRadius:20, border:`1px solid ${mes===m?"rgba(37,99,235,0.5)":"rgba(255,255,255,0.1)"}`, background:mes===m?"rgba(37,99,235,0.15)":"transparent", color:mes===m?"#93c5fd":"rgba(255,255,255,0.5)", fontSize:12, fontWeight:600, cursor:"pointer" }}>
                {new Date(m+"-01").toLocaleDateString("es-ES",{month:"short",year:"2-digit"})}
              </button>
            ))}
          </div>

          {/* Lista de cultos */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:10 }}>
            {pagActual.map(c => (
              <button key={c.id} onClick={() => abrirCulto(c)}
                style={{ padding:"14px 16px", borderRadius:14, border:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)", color:"white", cursor:"pointer", textAlign:"left", display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ fontWeight:700, fontSize:15, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nombre || "Sin nombre"}</div>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ fontSize:12, opacity:.4 }}>
                    {c.fecha ? new Date(c.fecha+"T00:00:00").toLocaleDateString("es-ES",{weekday:"short",day:"numeric",month:"short"}) : "Sin fecha"}
                  </div>
                  {c.proyecciones > 0 && <div style={{ fontSize:11,padding:"2px 8px",borderRadius:6,background:"rgba(37,99,235,0.15)",color:"#93c5fd",fontWeight:700 }}>{c.proyecciones} canciones</div>}
                </div>
              </button>
            ))}
          </div>

          {/* Paginación */}
          {totalPags > 1 && (
            <div style={{ display:"flex", gap:8, justifyContent:"center" }}>
              <button onClick={() => setPag(p => Math.max(0, p-1))} disabled={pag===0}
                style={{ padding:"7px 16px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)", color:"white", cursor:"pointer", opacity:pag===0?.4:1 }}>← Anterior</button>
              <span style={{ padding:"7px 16px", fontSize:13, opacity:.5 }}>{pag+1} / {totalPags}</span>
              <button onClick={() => setPag(p => Math.min(totalPags-1, p+1))} disabled={pag===totalPags-1}
                style={{ padding:"7px 16px", borderRadius:10, border:"1px solid rgba(255,255,255,0.1)", background:"rgba(255,255,255,0.05)", color:"white", cursor:"pointer", opacity:pag===totalPags-1?.4:1 }}>Siguiente →</button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
