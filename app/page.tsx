"use client"

import { useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { getIglesiaId, setIglesiaActivaId } from "@/lib/getIglesia"

const VERSICULOS = [
  { texto: "Cantad alegres a Dios, habitantes de toda la tierra.", cita: "Salmos 100:1" },
  { texto: "Todo lo que respira alabe a JAH. Aleluya.", cita: "Salmos 150:6" },
  { texto: "Servid a Jehová con alegría; venid ante su presencia con regocijo.", cita: "Salmos 100:2" },
  { texto: "Grande es Jehová, y digno de suprema alabanza.", cita: "Salmos 145:3" },
  { texto: "Jehová es mi fortaleza y mi cántico, y ha sido mi salvación.", cita: "Éxodo 15:2" },
  { texto: "Alabad a Jehová, porque él es bueno; porque para siempre es su misericordia.", cita: "Salmos 136:1" },
  { texto: "Cantad al Señor un cántico nuevo, porque ha hecho maravillas.", cita: "Salmos 98:1" },
]

const f: React.CSSProperties = { fontFamily: "'Segoe UI', system-ui, sans-serif" }

const Divider = () => <div style={{ height:1, background:"rgba(255,255,255,0.04)", margin:"0 -16px" }} />

export default function InicioPage() {
  const router = useRouter()

  const [cargando,        setCargando]        = useState(true)
  const [sinIglesia,      setSinIglesia]      = useState(false)
  const [nombreIglesia,   setNombreIglesia]   = useState("")
  const [localidad,       setLocalidad]       = useState("")
  const [logoUrl,         setLogoUrl]         = useState("")
  const [iglesiaActivaId, setIglesiaActivaIdState] = useState("")
  const [iglesiasUsuario, setIglesiasUsuario] = useState<any[]>([])

  const [totalCanciones,       setTotalCanciones]       = useState(0)
  const [totalConAcordes,      setTotalConAcordes]      = useState(0)
  const [totalListas,          setTotalListas]          = useState(0)
  const [totalSinTono,         setTotalSinTono]         = useState(0)

  const [cultosRecientes,      setCultosRecientes]      = useState<any[]>([])
  const [topCancionesMes,      setTopCancionesMes]      = useState<any[]>([])
  const [totalProyeccionesMes, setTotalProyeccionesMes] = useState(0)

  const [cancionesRecientes,   setCancionesRecientes]   = useState<any[]>([])
  const [categorias,           setCategorias]           = useState<{nombre:string,total:number}[]>([])

  const [servidorActivo, setServidorActivo] = useState<boolean | null>(null)
  const [servidorIp,     setServidorIp]     = useState("")

  const versiculo = VERSICULOS[new Date().getDate() % VERSICULOS.length]
  const mesActual = new Date().toLocaleDateString("es-ES", { month:"long" })
  const esDomingo = new Date().getDay() === 0

  // Si APK sin IP configurada → mostrar banner, NO redirigir automáticamente
  // El usuario puede navegar libremente y configurar cuando quiera
  useEffect(() => {
    const ip = localStorage.getItem("servidor_ip") || ""
    setServidorIp(ip)
  }, [])

  // Ping al servidor — y si falla en el APK, intentar encontrarlo solo
  useEffect(() => {
    const ping = async () => {
      const ip = localStorage.getItem("servidor_ip") || window.location.hostname
      try {
        const r = await fetch(`http://${ip}:4000/ping`, { signal: AbortSignal.timeout(2500) })
        const d = await r.json()
        if (d?.ok === true) { setServidorActivo(true); return }
        throw new Error("ping sin ok")
      } catch {
        setServidorActivo(false)
        // ✅ En el APK, si el ping al servidor guardado (o a localhost) falla,
        // intentar encontrarlo solo en la red antes de obligar al usuario a
        // ir a Configuración y tocar "Buscar automáticamente" a mano —
        // pensado para el primer uso o cuando el PC cambió de IP.
        const esCapacitor = typeof window !== "undefined" && !!(window as any).Capacitor
        if (!esCapacitor) return
        try {
          const { buscarServidorEnRed } = await import("@/lib/servidor")
          const encontrada = await buscarServidorEnRed()
          if (encontrada) {
            localStorage.setItem("servidor_ip", encontrada)
            setServidorIp(encontrada)
            setServidorActivo(true)
          }
        } catch { /* ignorar — se queda el banner de "servidor no detectado" */ }
      }
    }
    ping()
  }, [])

  // Carga principal
  useEffect(() => {
    const cargar = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession()
        if (!sessionData.session?.user) { router.replace("/login"); return }
        const userId    = sessionData.session.user.id
        const iglesiaId = await getIglesiaId()

        if (!iglesiaId) {
          const onbDone = typeof window !== "undefined" && localStorage.getItem("selah-onboarding-ok")
          if (!onbDone) { router.replace("/onboarding"); return }
          setSinIglesia(true); setCargando(false); return
        }

        setIglesiaActivaIdState(iglesiaId)

        // Datos de iglesia en background (sin bloquear spinner)
        // ✅ .limit(1) evita PGRST116
        supabase.from("iglesias").select("nombre, logo_url, localidad").eq("id", iglesiaId).limit(1)
          .then(({ data: rows }) => {
            const d = (rows as any[])?.[0]
            if (d) { setNombreIglesia(d.nombre || "Mi Iglesia"); setLogoUrl(d.logo_url || ""); setLocalidad(d.localidad || "") }
          })

        setCargando(false) // mostrar UI antes de que terminen los stats

        const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0)

        const [
          relacionesRes,
          cancionesCountRes,
          sinTonoRes,
          acordesRes,
          listasRes,
          cultosRes,
          historialRes,
          cancionesRecientesRes,
          categoriasRes,
          iglesiasnombresRes,
        ] = await Promise.all([
          supabase.from("usuarios_iglesia").select("iglesia_id").eq("user_id", userId),
          supabase.from("canciones").select("*", { count:"exact", head:true }).or(`iglesia_id.eq.${iglesiaId},iglesia_id.is.null`).is("eliminado_en", null),
          supabase.from("canciones").select("*", { count:"exact", head:true }).or(`iglesia_id.eq.${iglesiaId},iglesia_id.is.null`).is("eliminado_en", null).is("tono", null),
          supabase.from("partes_cancion").select("cancion_id", { count:"exact", head:false }).eq("tiene_acordes", true).limit(5000),
          supabase.from("listas_culto").select("*", { count:"exact", head:true }).eq("iglesia_id", iglesiaId),
          // ✅ 6 últimos cultos (antes solo 1)
          supabase.from("listas_culto").select("id, nombre, fecha").eq("iglesia_id", iglesiaId).order("fecha", { ascending:false }).limit(6),
          supabase.from("historial_proyecciones").select("cancion_id, titulo, tono, categoria").eq("iglesia_id", iglesiaId).eq("tipo","cancion").gte("proyectado_en", inicioMes.toISOString()).limit(200),
          // ✅ Canciones recientes — query que antes faltaba
          supabase.from("canciones").select("id, titulo, tono, categoria, fecha_creacion").eq("iglesia_id", iglesiaId).is("eliminado_en", null).order("fecha_creacion", { ascending:false }).limit(5),
          // ✅ Categorías — query que antes faltaba
          supabase.from("canciones").select("categoria").or(`iglesia_id.eq.${iglesiaId},iglesia_id.is.null`).is("eliminado_en", null).not("categoria","is",null),
          supabase.from("iglesias").select("id, nombre").in("id",
            (await supabase.from("usuarios_iglesia").select("iglesia_id").eq("user_id", userId)).data?.map((r:any) => r.iglesia_id).filter(Boolean) || []
          ),
        ])

        const idsRel     = (relacionesRes.data || []).filter((r:any) => r.iglesia_id).map((r:any) => r.iglesia_id)
        const nombresMap = new Map((iglesiasnombresRes.data || []).map((ig:any) => [ig.id, ig.nombre]))
        setIglesiasUsuario(Array.from(new Set(idsRel)).map(id => ({ iglesia_id:id, nombre: nombresMap.get(id) || id })))

        setTotalCanciones(cancionesCountRes.count || 0)
        setTotalSinTono(sinTonoRes.count || 0)
        setTotalListas(listasRes.count || 0)
        setTotalConAcordes(Array.from(new Set((acordesRes.data || []).map((p:any) => p.cancion_id).filter(Boolean))).length)
        setCultosRecientes(cultosRes.data || [])
        setTotalProyeccionesMes(historialRes.data?.length || 0)

        const conteo = new Map<string,any>()
        ;(historialRes.data || []).forEach((item:any) => {
          const key = item.cancion_id || item.titulo
          if (!conteo.has(key)) conteo.set(key, { titulo: item.titulo || "Sin título", tono: item.tono || "", total:0 })
          conteo.get(key).total += 1
        })
        setTopCancionesMes(Array.from(conteo.values()).sort((a,b) => b.total - a.total).slice(0,5))

        setCancionesRecientes(cancionesRecientesRes.data || [])

        const catConteo = new Map<string,number>()
        ;(categoriasRes.data || []).forEach((r:any) => {
          if (!r.categoria) return
          catConteo.set(r.categoria, (catConteo.get(r.categoria) || 0) + 1)
        })
        setCategorias(Array.from(catConteo.entries()).sort((a,b) => b[1]-a[1]).slice(0,6).map(([nombre,total]) => ({nombre,total})))

      } catch (e) { console.error(e); setCargando(false) }
    }
    cargar()
  }, [router])

  const pct = (v:number) => totalCanciones > 0 ? Math.round((v/totalCanciones)*100) : 0

  if (cargando) return (
    <div style={{ ...f, minHeight:"100dvh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center", color:"white" }}>
      <div style={{ textAlign:"center" }}>
        <div style={{ width:48, height:48, borderRadius:"50%", border:"3px solid rgba(255,255,255,0.08)", borderTopColor:"#3b82f6", margin:"0 auto 14px", animation:"spin .8s linear infinite" }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        <div style={{ opacity:0.4, fontSize:14 }}>Cargando...</div>
      </div>
    </div>
  )

  if (sinIglesia) return (
    <div style={{ ...f, minHeight:"100dvh", background:"#060d1a", display:"flex", alignItems:"center", justifyContent:"center", color:"white", padding:24 }}>
      <div style={{ textAlign:"center", maxWidth:340 }}>
        <div style={{ fontSize:52, marginBottom:16 }}>⛪</div>
        <div style={{ fontSize:22, fontWeight:800, marginBottom:10 }}>No tienes una iglesia</div>
        <div style={{ opacity:.5, marginBottom:24, lineHeight:1.6, fontSize:14 }}>Crea una iglesia nueva o únete a una existente con un código de invitación.</div>
        <button onClick={() => router.push("/crear-iglesia")} style={{ padding:"13px 28px", borderRadius:12, border:"none", background:"linear-gradient(135deg,#2563eb,#6366f1)", color:"white", fontWeight:800, fontSize:16, cursor:"pointer", width:"100%" }}>
          Crear iglesia
        </button>
        <button onClick={() => router.push("/unirse")} style={{ marginTop:12, padding:"13px 28px", borderRadius:12, border:"1px solid rgba(255,255,255,0.15)", background:"transparent", color:"white", fontWeight:700, fontSize:15, cursor:"pointer", width:"100%" }}>
          🔑 Tengo un código de invitación
        </button>
      </div>
    </div>
  )

  return (
    <div style={{ ...f, minHeight:"100dvh", background:"#060d1a", color:"white" }}>
      <div style={{ maxWidth:900, margin:"0 auto", padding:"0 0 60px" }}>

        {/* ══ HERO ══════════════════════════════════════════════════════════ */}
        <div style={{ background:"linear-gradient(160deg,#0f1f3d 0%,#111827 60%,#060d1a 100%)", borderBottom:"1px solid rgba(255,255,255,0.05)", padding:"32px 20px 28px", position:"relative", overflow:"hidden" }}>
          <div style={{ position:"absolute", top:-60, right:-40, width:280, height:280, borderRadius:"50%", background:"radial-gradient(circle,rgba(37,99,235,0.12) 0%,transparent 70%)", pointerEvents:"none" }} />
          <div style={{ position:"absolute", bottom:-40, left:-20, width:200, height:200, borderRadius:"50%", background:"radial-gradient(circle,rgba(99,102,241,0.08) 0%,transparent 70%)", pointerEvents:"none" }} />

          <div style={{ display:"flex", alignItems:"center", gap:16, position:"relative" }}>
            <div style={{ width:72, height:72, borderRadius:20, flexShrink:0, background: logoUrl?"transparent":"linear-gradient(135deg,rgba(37,99,235,0.3),rgba(99,102,241,0.2))", border:"1px solid rgba(255,255,255,0.1)", display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", boxShadow:"0 8px 32px rgba(0,0,0,0.3)" }}>
              {logoUrl ? <img src={logoUrl} alt="Logo iglesia" style={{ width:"100%", height:"100%", objectFit:"cover" }} /> : <span style={{ fontSize:32 }}>⛪</span>}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              {esDomingo && <div style={{ fontSize:11, color:"#fbbf24", fontWeight:700, letterSpacing:"0.06em", marginBottom:4 }}>☀️ HOY ES DOMINGO</div>}
              <div style={{ fontSize:"clamp(18px,5vw,28px)", fontWeight:900, letterSpacing:"-0.02em", lineHeight:1.1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {nombreIglesia || "Cargando..."}
              </div>
              {localidad && <div style={{ fontSize:13, color:"rgba(255,255,255,0.4)", marginTop:4 }}>📍 {localidad}</div>}
              {iglesiasUsuario.length > 1 && (
                <select value={iglesiaActivaId} onChange={e => { setIglesiaActivaId(e.target.value); setIglesiaActivaIdState(e.target.value); window.location.reload() }}
                  style={{ marginTop:8, padding:"5px 10px", borderRadius:8, border:"1px solid rgba(255,255,255,0.15)", background:"#1e293b", color:"white", fontSize:12, outline:"none", cursor:"pointer" }}>
                  {iglesiasUsuario.map((rel:any) => (
                    <option key={rel.iglesia_id} value={rel.iglesia_id} style={{ background:"#1e293b", color:"white" }}>{rel.nombre}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div style={{ marginTop:20, padding:"14px 16px", background:"rgba(255,255,255,0.03)", borderRadius:12, borderLeft:"3px solid rgba(99,102,241,0.5)" }}>
            <div style={{ fontSize:13, lineHeight:1.6, color:"rgba(255,255,255,0.65)", fontStyle:"italic" }}>"{versiculo.texto}"</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:6, fontWeight:600 }}>{versiculo.cita}</div>
          </div>
        </div>

        <div style={{ padding:"20px 16px", display:"flex", flexDirection:"column", gap:14 }}>

          {/* ══ ACCESOS RÁPIDOS ════════════════════════════════════════════ */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
            <button onClick={() => router.push("/control")} style={{ gridColumn:"1 / -1", padding:"20px", borderRadius:16, border:"1px solid rgba(37,99,235,0.35)", background:"linear-gradient(135deg,rgba(37,99,235,0.2) 0%,rgba(99,102,241,0.12) 100%)", color:"white", cursor:"pointer", display:"flex", alignItems:"center", gap:16 }}>
              <div style={{ width:52, height:52, borderRadius:14, background:"rgba(37,99,235,0.3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, flexShrink:0 }}>🎛️</div>
              <div style={{ textAlign:"left" }}>
                <div style={{ fontWeight:900, fontSize:18 }}>Control de Culto</div>
                <div style={{ fontSize:13, color:"rgba(255,255,255,0.5)", marginTop:2 }}>Proyectar canciones y coordinar el servicio</div>
              </div>
              <div style={{ marginLeft:"auto", fontSize:22, opacity:0.4 }}>→</div>
            </button>

            {[
              { icon:"🎵", label:"Canciones",       sub:"Gestionar repertorio",           border:"rgba(124,58,237,0.3)",  bg:"rgba(124,58,237,0.1)",  ibg:"rgba(124,58,237,0.25)",  action:() => router.push("/canciones") },
              { icon:"🖥️", label:"Proyector",       sub:"Abrir pantalla de proyección",   border:"rgba(14,116,144,0.3)", bg:"rgba(14,116,144,0.1)",  ibg:"rgba(14,116,144,0.25)",  action:() => window.open(`${window.location.origin}/proyectar`, "_blank") },
              { icon:"🎸", label:"Vista Músicos",   sub:"Letras y acordes en tiempo real", border:"rgba(21,128,61,0.3)",  bg:"rgba(21,128,61,0.1)",   ibg:"rgba(21,128,61,0.25)",   action:() => {
                const esCapacitor = !!(window as any).Capacitor
                if (esCapacitor) router.push("/musicos")
                else window.open(`${window.location.origin}/musicos`, "_blank")
              }},
              { icon:"📅", label:"Historial",        sub:"Cultos y estadísticas",        border:"rgba(245,158,11,0.3)", bg:"rgba(245,158,11,0.1)", ibg:"rgba(245,158,11,0.25)",  action:() => router.push("/historial") },
              { icon:"⚙️", label:"Configuración",  sub:"Iglesia, servidor y ajustes",    border:"rgba(255,255,255,0.08)", bg:"rgba(255,255,255,0.04)", ibg:"rgba(255,255,255,0.07)", action:() => router.push("/configuracion") },
            ].map(({ icon, label, sub, border, bg, ibg, action }) => (
              <button key={label} onClick={action} style={{ padding:"16px 14px", borderRadius:14, border:`1px solid ${border}`, background:bg, color:"white", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"flex-start", gap:8 }}>
                <div style={{ width:40, height:40, borderRadius:11, background:ibg, display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{icon}</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:15 }}>{label}</div>
                  <div style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginTop:2 }}>{sub}</div>
                </div>
              </button>
            ))}
          </div>

          {/* ══ ESTADO DEL SERVIDOR ════════════════════════════════════════ */}
          {servidorActivo !== null && (
            <div style={{ padding:"12px 16px", borderRadius:12, display:"flex", alignItems:"center", gap:10, background: servidorActivo?"rgba(34,197,94,0.06)":"rgba(239,68,68,0.06)", border:`1px solid ${servidorActivo?"rgba(34,197,94,0.15)":"rgba(239,68,68,0.15)"}` }}>
              <div style={{ width:8, height:8, borderRadius:"50%", background: servidorActivo?"#22c55e":"#ef4444", flexShrink:0, boxShadow: servidorActivo?"0 0 6px rgba(34,197,94,0.6)":"0 0 6px rgba(239,68,68,0.4)" }} />
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color: servidorActivo?"#4ade80":"#fca5a5" }}>
                  {servidorActivo ? "Conectado con el computador" : "Sin conexión con el computador"}
                </div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:1 }}>
                  {servidorActivo ? "Ya puedes proyectar" : "Abre Selah Live en el computador para poder proyectar"}
                </div>
              </div>
              <button onClick={() => router.push("/configuracion")} style={{ padding:"5px 12px", borderRadius:7, border:"none", background: servidorActivo?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.15)", color: servidorActivo?"#4ade80":"#fca5a5", fontSize:12, fontWeight:700, cursor:"pointer", flexShrink:0 }}>
                {servidorActivo ? "Detalles" : "Configurar"}
              </button>
            </div>
          )}

          {/* ══ STATS ══════════════════════════════════════════════════════ */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:8 }}>
            {[
              { valor:totalCanciones.toLocaleString(), label:"canciones",      sub:"en el repertorio",            color:"#3b82f6", icon:"🎵",
                action:() => router.push("/canciones") },
              { valor:totalConAcordes, label:"con acordes", sub:`${pct(totalConAcordes)}% del repertorio`, color:"#a855f7", icon:"🎸",
                action:() => router.push("/canciones?filtro=con-acordes") },
              { valor:totalListas, label:"cultos guardados", sub:"listas de canciones", color:"#22c55e", icon:"📋",
                action:() => router.push("/control") },
              { valor:totalSinTono, label:"sin tono",
                sub:   totalSinTono > 0 ? "requieren atención" : "todo completo ✓",
                color: totalSinTono > 0 ? "#f59e0b" : "#22c55e",
                icon:  totalSinTono > 0 ? "⚠️" : "✅",
                action:() => router.push(totalSinTono > 0 ? "/canciones?filtro=sin-tono" : "/canciones") },
            ].map(({ valor, label, sub, color, icon, action }) => (
              <button key={label} onClick={action} style={{ padding:"14px 12px", borderRadius:12, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", textAlign:"left", cursor:"pointer", color:"white" }}>
                <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                  <span style={{ fontSize:14 }}>{icon}</span>
                  <span style={{ fontSize:22, fontWeight:900, color }}>{valor}</span>
                </div>
                <div style={{ fontSize:12, fontWeight:700, color:"rgba(255,255,255,0.7)" }}>{label}</div>
                <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{sub}</div>
              </button>
            ))}
          </div>

          {/* ══ CULTOS RECIENTES ═══════════════════════════════════════════ */}
          {cultosRecientes.length > 0 && (
            <div style={{ borderRadius:14, overflow:"hidden", border:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontWeight:800, fontSize:14 }}>📋 Cultos recientes</div>
                <button onClick={() => router.push("/control")} style={{ fontSize:12, color:"rgba(255,255,255,0.35)", background:"none", border:"none", cursor:"pointer", padding:0 }}>Ver todos →</button>
              </div>
              {cultosRecientes.map((c, i) => (
                <div key={c.id}>
                  <div style={{ padding:"11px 16px", display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.nombre || "Sin nombre"}</div>
                      {c.fecha && <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:2 }}>{new Date(c.fecha + "T00:00:00").toLocaleDateString("es-ES", { weekday:"short", day:"numeric", month:"short", year:"numeric" })}</div>}
                    </div>
                    <button onClick={() => { localStorage.setItem("selah_autoload_lista", c.id); router.push("/control") }} style={{ padding:"6px 12px", borderRadius:8, border:"none", background:"rgba(37,99,235,0.18)", color:"#93c5fd", fontWeight:700, fontSize:12, cursor:"pointer", flexShrink:0 }}>
                      Abrir →
                    </button>
                  </div>
                  {i < cultosRecientes.length - 1 && <Divider />}
                </div>
              ))}
            </div>
          )}

          {/* ══ TOP CANCIONES DEL MES ══════════════════════════════════════ */}
          {topCancionesMes.length > 0 && (
            <div style={{ borderRadius:14, overflow:"hidden", border:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontWeight:800, fontSize:14 }}>🔥 Más cantadas en {mesActual}</div>
                <div style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>{totalProyeccionesMes} proyecciones</div>
              </div>
              {topCancionesMes.map((c, i) => (
                <div key={i}>
                  <div style={{ padding:"11px 16px", display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:26, height:26, borderRadius:8, flexShrink:0, background: i===0?"rgba(251,191,36,0.15)":"rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color: i===0?"#fbbf24":"rgba(255,255,255,0.4)" }}>{i+1}</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.titulo}</div>
                      {c.tono && <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:1 }}>Tono {c.tono}</div>}
                    </div>
                    <div style={{ fontSize:12, fontWeight:700, padding:"3px 8px", borderRadius:6, background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.4)" }}>{c.total}×</div>
                  </div>
                  {i < topCancionesMes.length - 1 && <Divider />}
                </div>
              ))}
            </div>
          )}

          {/* ══ ESTADO DEL CANCIONERO ══════════════════════════════════════ */}
          {totalCanciones > 0 && (
            <div style={{ borderRadius:14, padding:"14px 16px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontWeight:800, fontSize:14, marginBottom:12 }}>📊 Estado del cancionero</div>
              {[
                { label:"Con tono asignado", valor: Math.max(totalCanciones - totalSinTono, 0), color:"#3b82f6" },
                { label:"Con acordes",       valor: totalConAcordes,                             color:"#a855f7" },
              ].map(({ label, valor, color }) => (
                <div key={label} style={{ marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:5 }}>
                    <span>{label}</span>
                    <span style={{ fontWeight:700, color }}>{valor} / {totalCanciones} ({pct(valor)}%)</span>
                  </div>
                  <div style={{ height:5, borderRadius:3, background:"rgba(255,255,255,0.06)", overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${pct(valor)}%`, background:color, borderRadius:3, transition:"width 0.8s ease" }} />
                  </div>
                </div>
              ))}
              {totalSinTono > 0 && (
                <button onClick={() => router.push("/canciones?filtro=sin-tono")} style={{ marginTop:8, width:"100%", padding:"8px 12px", borderRadius:8, border:"1px solid rgba(245,158,11,0.25)", background:"rgba(245,158,11,0.06)", color:"#fbbf24", fontSize:12, fontWeight:600, cursor:"pointer", textAlign:"left" }}>
                  ⚠️ Tienes {totalSinTono} canciones sin tono — ir a completarlas →
                </button>
              )}
            </div>
          )}

          {/* ══ CANCIONES RECIENTES ════════════════════════════════════════ */}
          {cancionesRecientes.length > 0 && (
            <div style={{ borderRadius:14, overflow:"hidden", border:"1px solid rgba(255,255,255,0.06)", background:"rgba(255,255,255,0.02)" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,0.05)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontWeight:800, fontSize:14 }}>🆕 Últimas canciones agregadas</div>
                <button onClick={() => router.push("/canciones")} style={{ fontSize:12, color:"rgba(255,255,255,0.35)", background:"none", border:"none", cursor:"pointer", padding:0 }}>Ver todas →</button>
              </div>
              {cancionesRecientes.map((c, i) => (
                <div key={c.id}>
                  <div style={{ padding:"10px 16px", display:"flex", alignItems:"center", gap:10 }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{c.titulo}</div>
                      <div style={{ fontSize:11, color:"rgba(255,255,255,0.35)", marginTop:1 }}>{[c.tono && `Tono ${c.tono}`, c.categoria].filter(Boolean).join(" · ")}</div>
                    </div>
                    {c.fecha_creacion && <div style={{ fontSize:11, color:"rgba(255,255,255,0.25)", flexShrink:0 }}>{new Date(c.fecha_creacion).toLocaleDateString("es-ES", { day:"numeric", month:"short" })}</div>}
                  </div>
                  {i < cancionesRecientes.length - 1 && <Divider />}
                </div>
              ))}
            </div>
          )}

          {/* ══ CATEGORÍAS ════════════════════════════════════════════════ */}
          {categorias.length > 0 && totalCanciones > 0 && (
            <div style={{ borderRadius:14, padding:"14px 16px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)" }}>
              <div style={{ fontWeight:800, fontSize:14, marginBottom:12 }}>🏷️ Por categoría</div>
              {categorias.map(({ nombre, total }, i) => {
                const colores = ["#3b82f6","#a855f7","#22c55e","#f59e0b","#ec4899","#14b8a6"]
                const color   = colores[i % colores.length]
                return (
                  <div key={nombre} style={{ marginBottom:9 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:12, color:"rgba(255,255,255,0.5)", marginBottom:4 }}>
                      <span style={{ textTransform:"capitalize" }}>{nombre}</span>
                      <span style={{ fontWeight:700, color }}>{total}</span>
                    </div>
                    <div style={{ height:4, borderRadius:2, background:"rgba(255,255,255,0.05)", overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${Math.round(total/totalCanciones*100)}%`, background:color, borderRadius:2, transition:"width .8s ease" }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ textAlign:"center", fontSize:11, color:"rgba(255,255,255,0.15)", paddingTop:4 }}>
            Selah Live v0.2.0
          </div>
        </div>
      </div>
    </div>
  )
}
