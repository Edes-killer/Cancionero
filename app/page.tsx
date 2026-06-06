"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { setIglesiaActivaId } from "@/lib/getIglesia"
import { useApp } from "@/context/AppContext"

const VERSICULOS = [
  { texto: "Cantad alegres a Dios, habitantes de toda la tierra.", cita: "Salmos 100:1" },
  { texto: "Todo lo que respira alabe a JAH. Aleluya.", cita: "Salmos 150:6" },
  { texto: "Servid a Jehová con alegría; venid ante su presencia con regocijo.", cita: "Salmos 100:2" },
  { texto: "Grande es Jehová, y digno de suprema alabanza.", cita: "Salmos 145:3" },
  { texto: "Jehová es mi fortaleza y mi cántico, y ha sido mi salvación.", cita: "Éxodo 15:2" },
]



export default function InicioPage() {
  const router = useRouter()
  const { session, iglesiaId, nombreIglesia, logoUrl, localidad, listo } = useApp()

  const [sinIglesia, setSinIglesia] = useState(false)
  const [iglesiaActivaId, setIglesiaActivaIdState] = useState("")
  const [iglesiasUsuario, setIglesiasUsuario] = useState<any[]>([])

  // Stats (se cargan en background)
  const [totalCanciones, setTotalCanciones] = useState(0)
  const [totalConAcordes, setTotalConAcordes] = useState(0)
  const [totalListas, setTotalListas] = useState(0)
  const [totalSinTono, setTotalSinTono] = useState(0)
  const [ultimoCulto, setUltimoCulto] = useState<any>(null)
  const [topCancionesMes, setTopCancionesMes] = useState<any[]>([])
  const [totalProyeccionesMes, setTotalProyeccionesMes] = useState(0)
  const versiculo = VERSICULOS[new Date().getDate() % VERSICULOS.length]

  // APK: redirigir si no hay IP configurada
  useEffect(() => {
    const ip = localStorage.getItem("servidor_ip")
    if (!ip && window.navigator.userAgent.includes("CapacitorWebView")) {
      router.push("/configurar-servidor")
    }
  }, [])

  // Cuando el contexto esté listo, verificar auth y cargar stats
  useEffect(() => {
    if (!listo) return

    if (!session) { router.replace("/login"); return }
    if (!iglesiaId) { setSinIglesia(true); return }

    setIglesiaActivaIdState(iglesiaId)

    // Cargar stats en background
    const cargarStats = async () => {
      try {
        const inicioMes = new Date()
        inicioMes.setDate(1)
        inicioMes.setHours(0, 0, 0, 0)

        const [
          relacionesRes,
          cancionesCountRes,
          sinTonoRes,
          acordesCountRes,
          listasRes,
          ultimoRes,
          historialRes,
        ] = await Promise.all([
          supabase.from("usuarios_iglesia").select("iglesia_id, iglesias(nombre)").eq("user_id", session.user.id),
          supabase.from("canciones").select("*", { count: "exact", head: true }).or(`iglesia_id.eq.${iglesiaId},iglesia_id.is.null`),
          supabase.from("canciones").select("*", { count: "exact", head: true }).or(`iglesia_id.eq.${iglesiaId},iglesia_id.is.null`).is("tono", null),
          supabase.from("partes_cancion").select("cancion_id").eq("tiene_acordes", true).limit(5000),
          supabase.from("listas_culto").select("*", { count: "exact", head: true }).eq("iglesia_id", iglesiaId),
          supabase.from("listas_culto").select("id, nombre, fecha").eq("iglesia_id", iglesiaId).order("fecha", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("historial_proyecciones").select("cancion_id, titulo, tono, categoria").eq("iglesia_id", iglesiaId).eq("tipo", "cancion").gte("proyectado_en", inicioMes.toISOString()).limit(200),
        ])

        const iglesiasSinDup = Array.from(
          new Map((relacionesRes.data || []).filter((r: any) => r.iglesia_id).map((r: any) => [r.iglesia_id, r])).values()
        )
        setIglesiasUsuario(iglesiasSinDup)
        setTotalCanciones(cancionesCountRes.count || 0)
        setTotalSinTono(sinTonoRes.count || 0)
        const idsUnicos = Array.from(new Set((acordesCountRes.data || []).map((p: any) => p.cancion_id).filter(Boolean)))
        setTotalConAcordes(idsUnicos.length)
        setTotalListas(listasRes.count || 0)
        setUltimoCulto(ultimoRes.data || null)
        setTotalProyeccionesMes(historialRes.data?.length || 0)
        const conteo = new Map<string, any>()
        ;(historialRes.data || []).forEach((item: any) => {
          const key = item.cancion_id || item.titulo
          if (!conteo.has(key)) conteo.set(key, { cancion_id: item.cancion_id, titulo: item.titulo || "Sin título", tono: item.tono || "", categoria: item.categoria || "", total: 0 })
          conteo.get(key).total += 1
        })
        setTopCancionesMes(Array.from(conteo.values()).sort((a, b) => b.total - a.total).slice(0, 5))
      } catch (e) {
        console.error("Error cargando stats:", e)
      }
    }
    cargarStats()
  }, [listo, session, iglesiaId, router])

  const totalSinAcordes = Math.max(totalCanciones - totalConAcordes, 0)
  const totalConTono = Math.max(totalCanciones - totalSinTono, 0)
  const pct = (v: number) => totalCanciones > 0 ? Math.round((v / totalCanciones) * 100) : 0

  // ── Sin iglesia ───────────────────────────────────────────────────────────
  if (listo && sinIglesia) {
    return (
      <div style={{ minHeight: "100dvh", background: "#060d1a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center", maxWidth: 400 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⛪</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 10 }}>No tienes una iglesia</div>
          <div style={{ opacity: 0.55, marginBottom: 24, lineHeight: 1.6 }}>Para usar el cancionero necesitas crear o unirte a una iglesia.</div>
          <button onClick={() => router.push("/crear-iglesia")} style={{ padding: "13px 28px", borderRadius: 14, border: "none", background: "linear-gradient(135deg,#2563eb,#6366f1)", color: "white", fontWeight: 800, fontSize: 16, cursor: "pointer" }}>
            Crear iglesia
          </button>
        </div>
      </div>
    )
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (!listo) {
    return (
      <div style={{ minHeight: "100dvh", background: "#060d1a", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 52, height: 52, borderRadius: "50%", border: "4px solid rgba(255,255,255,0.08)", borderTopColor: "#3b82f6", margin: "0 auto 16px", animation: "spin 0.8s linear infinite" }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <div style={{ opacity: 0.5, fontSize: 15 }}>Cargando dashboard...</div>
        </div>
      </div>
    )
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "100dvh",
      background: "linear-gradient(180deg,#060d1a 0%,#0a1628 100%)",
      color: "white",
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      boxSizing: "border-box"
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 14px 40px" }}>

        {/* ── HERO ──────────────────────────────────────────────────────── */}
        <div style={{
          background: "linear-gradient(135deg,rgba(37,99,235,0.18),rgba(99,102,241,0.12))",
          border: "1px solid rgba(59,130,246,0.2)",
          borderRadius: 20, padding: "20px 20px",
          marginBottom: 16,
          display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap"
        }}>
          {/* Logo */}
          <div style={{
            width: 64, height: 64, borderRadius: 16, flexShrink: 0,
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            overflow: "hidden"
          }}>
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <span style={{ fontSize: 30 }}>⛪</span>}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "clamp(20px,4vw,30px)", fontWeight: 900, lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {nombreIglesia}
            </div>
            {localidad && <div style={{ fontSize: 13, opacity: 0.5, marginTop: 4 }}>📍 {localidad}</div>}
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.6, fontStyle: "italic", lineHeight: 1.5 }}>
              "{versiculo.texto}" — <span style={{ opacity: 0.8 }}>{versiculo.cita}</span>
            </div>
          </div>

          {/* Selector de iglesia si tiene más de una */}
          {iglesiasUsuario.length > 1 && (
            <select
              value={iglesiaActivaId}
              onChange={async e => {
                setIglesiaActivaId(e.target.value)
                setIglesiaActivaIdState(e.target.value)
                window.location.reload()
              }}
              style={{
                padding: "9px 13px", borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.07)", color: "white",
                fontSize: 13, fontWeight: 700, outline: "none", flexShrink: 0
              }}
            >
              {iglesiasUsuario.map((rel: any) => (
                <option key={rel.iglesia_id} value={rel.iglesia_id}>
                  {rel.iglesias?.nombre || rel.iglesia_id}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* ── ACCESOS RÁPIDOS ───────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 16 }}>
          {[
            { icon: "🎛️", label: "Control", sub: "Operar culto", href: "/control", accent: "#2563eb" },
            { icon: "🎵", label: "Canciones", sub: "Gestionar repertorio", href: "/canciones", accent: "#7c3aed" },
            { icon: "🖥️", label: "Proyector", sub: "Nueva ventana", href: null, fn: () => window.open(`${window.location.origin}/proyectar`, "_blank"), accent: "#0e7490" },
            { icon: "🎸", label: "Músicos", sub: "Nueva ventana", href: null, fn: () => window.open(`${window.location.origin}/musicos`, "_blank"), accent: "#15803d" },
            { icon: "⚙️", label: "Config", sub: "Ajustes iglesia", href: "/configuracion", accent: "#374151" },
          ].map(({ icon, label, sub, href, fn, accent }) => (
            <button
              key={label}
              onClick={() => href ? router.push(href) : fn?.()}
              style={{
                padding: "16px 14px",
                borderRadius: 16,
                border: `1px solid ${accent}44`,
                background: `${accent}18`,
                color: "white",
                cursor: "pointer",
                textAlign: "left",
                display: "flex", flexDirection: "column", gap: 6,
                transition: "all 0.15s"
              }}
            >
              <span style={{ fontSize: 26 }}>{icon}</span>
              <span style={{ fontWeight: 800, fontSize: 15 }}>{label}</span>
              <span style={{ fontSize: 11, opacity: 0.5 }}>{sub}</span>
            </button>
          ))}
        </div>

        {/* ── STATS RÁPIDAS ─────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Canciones", valor: totalCanciones, icon: "🎵", color: "#3b82f6" },
            { label: "Con acordes", valor: totalConAcordes, icon: "🎸", color: "#22c55e" },
            { label: "Cultos", valor: totalListas, icon: "📋", color: "#a855f7" },
            { label: "Este mes", valor: totalProyeccionesMes, icon: "📊", color: "#f59e0b" },
          ].map(({ label, valor, icon, color }) => (
            <div key={label} style={{
              background: "rgba(17,27,46,0.95)",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 16, padding: "16px 14px",
              display: "flex", flexDirection: "column", gap: 6
            }}>
              <div style={{ fontSize: 22 }}>{icon}</div>
              <div style={{ fontSize: "clamp(24px,4vw,36px)", fontWeight: 900, color, lineHeight: 1 }}>{valor}</div>
              <div style={{ fontSize: 12, opacity: 0.5, fontWeight: 600 }}>{label}</div>
            </div>
          ))}
        </div>

        {/* ── GRID PRINCIPAL ────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 14 }}>

          {/* Último culto */}
          <div style={{ background: "rgba(17,27,46,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "18px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.4, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Último culto</div>
            {ultimoCulto ? (
              <>
                <div style={{ fontWeight: 800, fontSize: "clamp(17px,2.5vw,22px)", marginBottom: 6, lineHeight: 1.2 }}>{ultimoCulto.nombre || "Sin nombre"}</div>
                {ultimoCulto.fecha && (
                  <div style={{ fontSize: 13, opacity: 0.5, marginBottom: 14 }}>
                    📅 {new Date(ultimoCulto.fecha + "T12:00:00").toLocaleDateString("es-CL", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </div>
                )}
                <button onClick={() => router.push("/control")} style={{ width: "100%", padding: "11px", borderRadius: 12, border: "none", background: "#2563eb", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                  🎛️ Ir al Control
                </button>
              </>
            ) : (
              <>
                <div style={{ opacity: 0.45, fontSize: 14, marginBottom: 14, lineHeight: 1.5 }}>
                  No hay cultos guardados aún. Crea el primero desde el Control.
                </div>
                <button onClick={() => router.push("/control")} style={{ width: "100%", padding: "11px", borderRadius: 12, border: "none", background: "#2563eb", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                  🎛️ Preparar culto
                </button>
              </>
            )}
          </div>

          {/* Cobertura acordes */}
          <div style={{ background: "rgba(17,27,46,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "18px 18px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.4, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Repertorio</div>
            <div style={{ fontWeight: 800, fontSize: "clamp(17px,2.5vw,22px)", marginBottom: 14 }}>Cobertura de acordes</div>
            {[
              { label: "Con acordes", valor: totalConAcordes, color: "#22c55e" },
              { label: "Sin acordes", valor: totalSinAcordes, color: "#6b7280" },
              { label: "Con tono", valor: totalConTono, color: "#3b82f6" },
              { label: "Sin tono", valor: totalSinTono, color: "#f59e0b" },
            ].map(({ label, valor, color }) => (
              <div key={label} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 5 }}>
                  <span style={{ opacity: 0.8 }}>{label}</span>
                  <span style={{ opacity: 0.6 }}>{valor} · {pct(valor)}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{
                    height: "100%", borderRadius: 999,
                    background: color,
                    width: `${pct(valor)}%`,
                    transition: "width 0.6s ease"
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* Top canciones mes */}
          <div style={{ background: "rgba(17,27,46,0.95)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "18px 18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, opacity: 0.4, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 4 }}>Estadísticas</div>
                <div style={{ fontWeight: 800, fontSize: "clamp(17px,2.5vw,22px)" }}>Más proyectadas</div>
              </div>
              <span style={{ padding: "5px 12px", borderRadius: 999, background: "rgba(37,99,235,0.15)", border: "1px solid rgba(59,130,246,0.25)", color: "#93c5fd", fontWeight: 800, fontSize: 13 }}>
                {totalProyeccionesMes} usos
              </span>
            </div>

            {topCancionesMes.length === 0 ? (
              <div style={{ padding: "16px 14px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", opacity: 0.6, fontSize: 13, lineHeight: 1.6 }}>
                Sin proyecciones este mes. Proyecta canciones desde el Control para ver estadísticas.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {topCancionesMes.map((c, i) => (
                  <div key={`${c.cancion_id}-${i}`} style={{
                    display: "grid", gridTemplateColumns: "auto 1fr auto",
                    alignItems: "center", gap: 10,
                    padding: "10px 12px", borderRadius: 12,
                    background: i === 0 ? "rgba(234,179,8,0.08)" : "rgba(255,255,255,0.04)",
                    border: `1px solid ${i === 0 ? "rgba(234,179,8,0.2)" : "rgba(255,255,255,0.07)"}`
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                      background: i === 0 ? "rgba(234,179,8,0.18)" : "rgba(59,130,246,0.12)",
                      border: `1px solid ${i === 0 ? "rgba(234,179,8,0.3)" : "rgba(59,130,246,0.2)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 900, fontSize: 14
                    }}>{i + 1}</div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo}</div>
                      <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{[c.categoria, c.tono].filter(Boolean).join(" · ") || "Sin detalles"}</div>
                    </div>
                    <div style={{ padding: "4px 10px", borderRadius: 999, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.22)", color: "#86efac", fontWeight: 800, fontSize: 12, flexShrink: 0 }}>
                      {c.total}x
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
