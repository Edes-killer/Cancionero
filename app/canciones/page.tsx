"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { io } from "socket.io-client"
import { supabase } from "../../lib/supabase"
import { getIglesiaId } from "../../lib/getIglesia"
import { getSocketUrl } from "@/lib/servidor"
import { useApp } from "@/context/AppContext"

// ─── TIPOS ───────────────────────────────────────────────────────────────────

interface Parte {
  id?: string
  tipo: "Verso" | "Coro" | "Puente" | "Intro" | "Outro" | "Observación"
  texto: string
  formato: "solo" | "linea" | "corchetes"
  texto_letra?: string
  texto_acordes?: string
  tiene_acordes?: boolean
  orden?: number
}

interface Cancion {
  id: string
  titulo: string
  autor?: string
  tono?: string
  categoria?: string
  numero?: number
  iglesia_id?: string
}

// ─── CONSTANTES ──────────────────────────────────────────────────────────────

const TONOS = [
  "Do", "Dom", "Do#",
  "Re", "Rem", "Re#",
  "Mi", "Mim",
  "Fa", "Fam", "Fa#",
  "Sol", "Solm", "Sol#",
  "La", "Lam", "La#",
  "Si", "Sim"
]

const CATEGORIAS_PRESET = [
  "Alabanza", "Adoración", "Avivamiento", "Comunión",
  "Evangelismo", "Gratitud", "Ofrenda", "Bienvenida", "Cierre"
]

const TIPOS_PARTE: Parte["tipo"][] = [
  "Verso", "Coro", "Puente", "Intro", "Outro", "Observación"
]

// ─── HELPERS ─────────────────────────────────────────────────────────────────

const normalizarAcorde = (acorde: string) => {
  const mapaBase: Record<string, string> = {
    do: "Do", re: "Re", mi: "Mi", fa: "Fa",
    sol: "Sol", la: "La", si: "Si",
    c: "Do", d: "Re", e: "Mi", f: "Fa",
    g: "Sol", a: "La", b: "Si"
  }
  const match = acorde.trim().match(/^(do|re|mi|fa|sol|la|si|c|d|e|f|g|a|b)(#|b)?(.*)$/i)
  if (!match) return acorde.trim()
  const base = mapaBase[match[1].toLowerCase()] || match[1]
  return `${base}${match[2] || ""}${match[3] || ""}`
}

const esLineaAcordes = (linea: string) => {
  const tokens = linea.trim().split(/\s+/)
  return tokens.length > 0 && tokens.every(t =>
    t.match(/^([A-G]|Do|Re|Mi|Fa|Sol|La|Si)(#|b)?(m|maj|min|sus|dim|aug)?\d*(\/[A-G])?(\(.*?\))?$/i)
  )
}

const inferirFormato = (texto: string): Parte["formato"] => {
  if (texto.includes("[")) return "corchetes"
  const lineas = texto.split("\n")
  for (let i = 0; i < lineas.length - 1; i++) {
    if (esLineaAcordes(lineas[i]) && lineas[i + 1]?.trim()) return "linea"
  }
  return "solo"
}

const detectarTono = (texto: string) => {
  const palabras = texto.split(/\s+/)
  for (const palabra of palabras) {
    const limpia = palabra.replace(/[^a-zA-Z#b]/g, "")
    const norm = normalizarAcorde(limpia)
    if (norm.match(/^(Do|Re|Mi|Fa|Sol|La|Si)(#|b)?m?$/i)) return norm
  }
  return ""
}

const tieneAcordes = (texto: string) =>
  texto.includes("[") || inferirFormato(texto) !== "solo"

// ─── RENDERIZADOR DE ACORDES (vista previa para músicos) ─────────────────────

const VistaPrevia = ({ texto, formato }: { texto: string; formato: string }) => {
  if (!texto.trim()) return (
    <div style={{ opacity: 0.35, fontSize: "13px", fontStyle: "italic", padding: "12px 0" }}>
      El texto aparecerá aquí...
    </div>
  )

  if (formato === "corchetes") {
    const lineas = texto.split("\n")
    return (
      <div style={{ fontFamily: "'Courier New', monospace", fontSize: "14px", lineHeight: 1.9 }}>
        {lineas.map((linea, li) => {
          const partes: React.ReactNode[] = []
          const regex = /\[([^\]]+)\]([^\[]*)/g
          let match
          let lastIndex = 0
          let hayAcordes = false

          const textoSinAcordes = linea.replace(/\[([^\]]+)\]/g, "")
          const soloAcordes: string[] = []
          let m2
          const r2 = /\[([^\]]+)\]/g
          while ((m2 = r2.exec(linea)) !== null) soloAcordes.push(m2[1])

          if (soloAcordes.length > 0) {
            return (
              <div key={li}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "2px" }}>
                  {soloAcordes.map((ac, ai) => (
                    <span key={ai} style={{
                      background: "rgba(250,204,21,0.15)",
                      border: "1px solid rgba(250,204,21,0.35)",
                      color: "#fcd34d",
                      borderRadius: "5px",
                      padding: "1px 7px",
                      fontSize: "12px",
                      fontWeight: 700
                    }}>{ac}</span>
                  ))}
                </div>
                {textoSinAcordes.trim() && (
                  <div style={{ color: "rgba(255,255,255,0.9)" }}>{textoSinAcordes}</div>
                )}
              </div>
            )
          }

          return <div key={li} style={{ color: "rgba(255,255,255,0.9)" }}>{linea || "\u00a0"}</div>
        })}
      </div>
    )
  }

  if (formato === "linea") {
    const lineas = texto.split("\n")
    const resultado: React.ReactNode[] = []
    for (let i = 0; i < lineas.length; i++) {
      if (esLineaAcordes(lineas[i]) && lineas[i + 1]) {
        resultado.push(
          <div key={`a${i}`} style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "2px" }}>
            {lineas[i].trim().split(/\s+/).map((ac, ai) => (
              <span key={ai} style={{
                background: "rgba(250,204,21,0.15)",
                border: "1px solid rgba(250,204,21,0.35)",
                color: "#fcd34d",
                borderRadius: "5px",
                padding: "1px 7px",
                fontSize: "12px",
                fontWeight: 700
              }}>{ac}</span>
            ))}
          </div>
        )
        resultado.push(
          <div key={`l${i}`} style={{ color: "rgba(255,255,255,0.9)", marginBottom: "8px", fontFamily: "'Courier New', monospace", fontSize: "14px" }}>
            {lineas[i + 1]}
          </div>
        )
        i++
      } else {
        resultado.push(
          <div key={i} style={{ color: "rgba(255,255,255,0.9)", fontFamily: "'Courier New', monospace", fontSize: "14px" }}>
            {lineas[i] || "\u00a0"}
          </div>
        )
      }
    }
    return <div style={{ lineHeight: 1.7 }}>{resultado}</div>
  }

  return (
    <div style={{
      fontFamily: "'Courier New', monospace",
      fontSize: "14px",
      lineHeight: 1.8,
      color: "rgba(255,255,255,0.88)",
      whiteSpace: "pre-line"
    }}>
      {texto}
    </div>
  )
}

// ─── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────

export default function CancionesPage() {
  const { iglesiaId: iglesiaIdCtx, canciones: cancionesCtx,
        actualizarCancion: actualizarCtx, eliminarCancionDelCache } = useApp()
  const [socket, setSocket] = useState<any>(null)
  const [canciones, setCanciones] = useState<Cancion[]>([])
  const [idsConAcordes, setIdsConAcordes] = useState<string[]>([])
  const [iglesiaId, setIglesiaId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)

  // Editor
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [titulo, setTitulo] = useState("")
  const [autor, setAutor] = useState("")
  const [tono, setTono] = useState("")
  const [categoria, setCategoria] = useState("")
  const [categoriaCustom, setCategoriaCustom] = useState("")
  const [numero, setNumero] = useState("")
  const [partes, setPartes] = useState<Parte[]>([
    { tipo: "Verso", texto: "", formato: "solo" }
  ])
  const [vistaPrevia, setVistaPrevia] = useState<number | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [flashMsg, setFlashMsg] = useState("")

  // Lista
  const [busqueda, setBusqueda] = useState("")
  const [filtroTono, setFiltroTono] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [activaId, setActivaId] = useState<string | null>(null)
  const [vistaLista, setVistaLista] = useState<"lista" | "grid">("lista")
  const [panelAbierto, setPanelAbierto] = useState<"editor" | "canciones">("canciones")

  const editorRef = useRef<HTMLDivElement>(null)
  // ✅ Cache local de partes para no repetir queries al editor
  const partesCacheRef = useRef<Map<string, any[]>>(new Map())

  // ── Socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = io(getSocketUrl())
    s.on("connect", async () => {
      const sala = iglesiaIdCtx || (await getIglesiaId()) || "global"
      s.emit("unirse-sala", { sala, pantalla: "canciones" })
    })
    s.on("cancion-activa", (data: any) => setActivaId(data.id))
    setSocket(s)
    return () => { s.disconnect() }
  }, [])

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      const id = iglesiaIdCtx || await getIglesiaId()
      setIglesiaId(id)

      // ✅ Usar canciones del contexto si ya están cargadas (sin query)
      if (cancionesCtx.length > 0) {
        setCanciones(cancionesCtx as Cancion[])
        // Solo cargar acordes en background
        supabase.from("partes_cancion").select("cancion_id").eq("tiene_acordes", true)
          .then(({ data }) => {
            const ids = Array.from(new Set((data || []).map((p: any) => p.cancion_id).filter(Boolean)))
            setIdsConAcordes(ids)
          })
        setCargando(false)
        return
      }

      await cargarCanciones(id)
      setCargando(false)
    }
    init()
  }, [iglesiaIdCtx, cancionesCtx.length])

  const cargarCanciones = async (id?: string | null) => {
    const igId = id ?? iglesiaId
    // ✅ Siempre incluir himnario global (iglesia_id IS NULL) + propias de la iglesia
    let query = supabase.from("canciones").select("id, titulo, tono, categoria, iglesia_id, numero, texto_busqueda")
    if (igId) {
      query = query.or(`iglesia_id.eq.${igId},iglesia_id.is.null`)
    } else {
      query = query.is("iglesia_id", null)
    }

    const { data } = await query
    setCanciones(data || [])

    const { data: conAcordes } = await supabase
      .from("partes_cancion")
      .select("cancion_id")
      .eq("tiene_acordes", true)

    const ids = Array.from(
      new Set((conAcordes || []).map((p: any) => p.cancion_id).filter(Boolean))
    )
    setIdsConAcordes(ids)
  }

  // ── Editor helpers ───────────────────────────────────────────────────────────

  const flash = (msg: string) => {
    setFlashMsg(msg)
    setTimeout(() => setFlashMsg(""), 2800)
  }


  // ── Color por categoría (igual que en control) ──────────────────────────────
  const colorCategoria = (cat?: string): { bg: string; border: string; text: string } => {
    switch ((cat || "").toLowerCase()) {
      case "alabanza":    return { bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.30)",  text: "#fcd34d" }
      case "adoración":   return { bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.30)", text: "#c4b5fd" }
      case "avivamiento": return { bg: "rgba(239,68,68,0.10)",   border: "rgba(239,68,68,0.30)",   text: "#fca5a5" }
      case "comunión":    return { bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.30)",  text: "#6ee7b7" }
      case "evangelismo": return { bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.30)",  text: "#fdba74" }
      case "gratitud":    return { bg: "rgba(34,197,94,0.10)",   border: "rgba(34,197,94,0.30)",   text: "#86efac" }
      case "ofrenda":     return { bg: "rgba(14,165,233,0.10)",  border: "rgba(14,165,233,0.30)",  text: "#7dd3fc" }
      case "bienvenida":  return { bg: "rgba(99,179,237,0.10)",  border: "rgba(99,179,237,0.30)",  text: "#93c5fd" }
      case "cierre":      return { bg: "rgba(156,163,175,0.10)", border: "rgba(156,163,175,0.30)", text: "#d1d5db" }
      default:            return { bg: "rgba(99,179,237,0.10)",  border: "rgba(99,179,237,0.25)",  text: "#93c5fd" }
    }
  }

  const resetEditor = () => {
    setEditandoId(null)
    setTitulo("")
    setAutor("")
    setTono("")
    setCategoria("")
    setCategoriaCustom("")
    setNumero("")
    setPartes([{ tipo: "Verso", texto: "", formato: "solo" }])
    setVistaPrevia(null)
  }

  const agregarParte = () =>
    setPartes(prev => [...prev, { tipo: "Verso", texto: "", formato: "solo" }])

  const actualizarParte = (i: number, campo: keyof Parte, valor: string) => {
    setPartes(prev => {
      const nuevas = [...prev]
      ;(nuevas[i] as any)[campo] = valor
      return nuevas
    })
  }

  const moverParte = (i: number, dir: -1 | 1) => {
    setPartes(prev => {
      const n = [...prev]
      const dest = i + dir
      if (dest < 0 || dest >= n.length) return prev
      ;[n[i], n[dest]] = [n[dest], n[i]]
      return n
    })
  }

  const eliminarParte = (i: number) =>
    setPartes(prev => prev.filter((_, idx) => idx !== i))

  const duplicarParte = (i: number) =>
    setPartes(prev => {
      const n = [...prev]
      n.splice(i + 1, 0, { ...n[i] })
      return n
    })

    
  const detectarTonoDesdePartes = () => {
    const texto = partes.map(p => p.texto).join(" ")
    const t = detectarTono(texto)
    if (t) { setTono(t); flash(`✅ Tono detectado: ${t}`) }
    else flash("⚠️ No se detectó tono en los acordes")
  }

  const categoriaFinal = categoria === "__custom__" ? categoriaCustom.trim() : categoria

  // ── Guardar ──────────────────────────────────────────────────────────────────

  const guardarCancion = async () => {
    if (!titulo.trim()) { flash("⚠️ El título es obligatorio"); return }
    setGuardando(true)

    const textoCompleto = partes.map(p => p.texto).join(" ")
    const tonoFinal = normalizarAcorde(tono || detectarTono(textoCompleto) || "")

    const datosCancion = {
      titulo: titulo.trim(),
      autor: autor.trim() || null,
      tono: tonoFinal || null,
      categoria: categoriaFinal || null,
      numero: numero ? parseInt(numero) : null,
      iglesia_id: iglesiaId
    }

    let cancionId = editandoId

    if (editandoId) {
      const { error } = await supabase.from("canciones").update(datosCancion).eq("id", editandoId)
      if (error) { flash("❌ Error actualizando canción"); setGuardando(false); return }
      await supabase.from("partes_cancion").delete().eq("cancion_id", editandoId)
    } else {
      const { data, error } = await supabase.from("canciones").insert(datosCancion).select().single()
      if (error || !data) { flash("❌ Error creando canción"); setGuardando(false); return }
      cancionId = data.id
    }

    const partesInsert = partes.map((p, i) => ({
      cancion_id: cancionId,
      tipo: p.tipo,
      texto: p.texto,
      texto_letra: p.texto,
      texto_acordes: tieneAcordes(p.texto) ? p.texto : null,
      tiene_acordes: tieneAcordes(p.texto),
      orden: i
    }))

    

    const { error: errorPartes } = await supabase.from("partes_cancion").insert(partesInsert)
    if (errorPartes) { flash("❌ Error guardando partes"); setGuardando(false); return }

    flash(editandoId ? "✅ Canción actualizada" : "✅ Canción guardada")
    resetEditor()
    await cargarCanciones()
    if (cancionId) {
      partesCacheRef.current.delete(cancionId) // ✅ Invalidar cache de partes
      await actualizarCtx(cancionId)
    }
    setGuardando(false)
    setPanelAbierto("canciones")
  }

  // ── Editar / Eliminar ────────────────────────────────────────────────────────

  const editarCancion = async (c: Cancion) => {
    // ✅ Usar cache si existe
    let data: any[]
    if (partesCacheRef.current.has(c.id)) {
      data = partesCacheRef.current.get(c.id)!
    } else {
      const { data: fetched } = await supabase
        .from("partes_cancion").select("*").eq("cancion_id", c.id).order("orden")
      data = fetched || []
      partesCacheRef.current.set(c.id, data)
    }

    setEditandoId(c.id)
    setTitulo(c.titulo || "")
    setAutor((c as any).autor || "")
    setTono(c.tono || "")
    setNumero(c.numero ? String(c.numero) : "")

    const cat = c.categoria || ""
    if (CATEGORIAS_PRESET.includes(cat) || cat === "") {
      setCategoria(cat)
      setCategoriaCustom("")
    } else {
      setCategoria("__custom__")
      setCategoriaCustom(cat)
    }

    setPartes(
      (data || []).map((p: any) => ({
        ...p,
        formato: inferirFormato(p.texto || "")
      }))
    )
    setVistaPrevia(null)
    setPanelAbierto("editor")
    editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const eliminarCancion = async (id: string, titulo: string) => {
    if (!confirm(`¿Eliminar "${titulo}"? Esta acción no se puede deshacer.`)) return
    await supabase.from("partes_cancion").delete().eq("cancion_id", id)
    await supabase.from("canciones").delete().eq("id", id)
    if (editandoId === id) resetEditor()
    flash("🗑️ Canción eliminada")
    await cargarCanciones()
    partesCacheRef.current.delete(id) // ✅ Invalidar cache de partes
    eliminarCancionDelCache(id)
  }

  const proyectar = async (c: Cancion) => {
    if (!socket) return
    const { data: partes } = await supabase.from("partes_cancion").select("*").eq("cancion_id", c.id).order("orden")
    const partesConAcordes = (partes || []).map((p: any) => ({
      ...p,
      texto: p.texto_acordes ?? p.texto ?? ""
    }))
    socket.emit("cargar-cancion", { partes: partesConAcordes, index: 0, titulo: c.titulo, tono: c.tono || "" })
    socket.emit("cancion-activa", { id: c.id })
    flash(`▶ Proyectando: ${c.titulo}`)
  }

  // ── Filtrado ─────────────────────────────────────────────────────────────────

  const categoriasDisponibles = useMemo(() =>
    Array.from(new Set(canciones.map(c => c.categoria).filter(Boolean))).sort() as string[],
    [canciones]
  )

  const cancionesFiltradas = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return canciones
      .filter(c => {
        if (!q) return true
        return (
          (c.titulo || "").toLowerCase().includes(q) ||
          (c.categoria || "").toLowerCase().includes(q) ||
          (c.tono || "").toLowerCase().includes(q) ||
          String(c.numero || "").includes(q)
        )
      })
      .filter(c => !filtroTono || c.tono === filtroTono)
      .filter(c => !filtroCategoria || c.categoria === filtroCategoria)
      .sort((a, b) => {
        const na = a.numero ?? 999999, nb = b.numero ?? 999999
        if (na !== nb) return na - nb
        return (a.titulo || "").localeCompare(b.titulo || "")
      })
  }, [canciones, busqueda, filtroTono, filtroCategoria])

  // ── ESTILOS BASE ─────────────────────────────────────────────────────────────

  const colors = {
    bg: "#0a0f1a",
    surface: "#111827",
    card: "#1a2235",
    cardHover: "#1e2a40",
    border: "rgba(255,255,255,0.07)",
    borderActive: "rgba(99,179,237,0.4)",
    text: "#f0f4ff",
    textMuted: "rgba(240,244,255,0.5)",
    accent: "#3b82f6",
    accentGlow: "rgba(59,130,246,0.2)",
    green: "#22c55e",
    greenGlow: "rgba(34,197,94,0.15)",
    gold: "#fbbf24",
    red: "#ef4444",
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 14px",
    background: "#0d1526",
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: "10px",
    fontSize: "14px",
    outline: "none",
    boxSizing: "border-box",
    transition: "border-color 0.2s"
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle,
    cursor: "pointer"
  }

  const btnBase: React.CSSProperties = {
    padding: "9px 16px",
    borderRadius: "9px",
    border: "none",
    cursor: "pointer",
    fontSize: "13px",
    fontWeight: 600,
    transition: "all 0.15s",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px"
  }

  const btnPrimary: React.CSSProperties = {
    ...btnBase,
    background: colors.accent,
    color: "white",
  }

  const btnSecondary: React.CSSProperties = {
    ...btnBase,
    background: "rgba(255,255,255,0.07)",
    color: colors.text,
    border: `1px solid ${colors.border}`
  }

  const btnDanger: React.CSSProperties = {
    ...btnBase,
    background: "rgba(239,68,68,0.12)",
    color: "#fca5a5",
    border: "1px solid rgba(239,68,68,0.25)"
  }

  const btnSuccess: React.CSSProperties = {
    ...btnBase,
    background: "rgba(34,197,94,0.15)",
    color: "#86efac",
    border: "1px solid rgba(34,197,94,0.3)"
  }

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: colors.textMuted,
    marginBottom: "6px",
    display: "block"
  }

  const tipoBadgeColor: Record<string, string> = {
    Verso: "rgba(99,179,237,0.18)",
    Coro: "rgba(167,139,250,0.18)",
    Puente: "rgba(52,211,153,0.18)",
    Intro: "rgba(251,191,36,0.18)",
    Outro: "rgba(251,191,36,0.18)",
    Observación: "rgba(156,163,175,0.18)"
  }

  const tipoBadgeText: Record<string, string> = {
    Verso: "#93c5fd",
    Coro: "#c4b5fd",
    Puente: "#6ee7b7",
    Intro: "#fde68a",
    Outro: "#fde68a",
    Observación: "#d1d5db"
  }

  if (cargando) {
    return (
      <div style={{
        minHeight: "100vh", background: colors.bg, display: "flex",
        alignItems: "center", justifyContent: "center", color: colors.text
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{
            width: 48, height: 48, borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.1)",
            borderTopColor: colors.accent,
            margin: "0 auto 16px",
            animation: "spin 0.8s linear infinite"
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
          <div style={{ opacity: 0.6 }}>Cargando cancionero...</div>
        </div>
      </div>
    )
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: "100dvh",
      background: colors.bg,
      color: colors.text,
      fontFamily: "'Segoe UI', system-ui, sans-serif",
      overflowX: "hidden",
      boxSizing: "border-box"
    }}>

      {/* ── HEADER ── */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,15,26,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${colors.border}`,
        padding: "0 20px"
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "flex", alignItems: "center",
          justifyContent: "space-between",
          height: 60, gap: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: `linear-gradient(135deg, ${colors.accent}, #6366f1)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0
            }}>🎵</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2 }}>Cancionero</div>
              <div style={{ fontSize: 11, color: colors.textMuted }}>
                {canciones.length} canciones
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{
            display: "flex", gap: 4,
            background: "rgba(255,255,255,0.05)",
            borderRadius: 10, padding: 4
          }}>
            {(["canciones", "editor"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setPanelAbierto(tab)
                  if (tab === "editor" && !editandoId) resetEditor()
                }}
                style={{
                  ...btnBase,
                  padding: "7px 16px",
                  background: panelAbierto === tab ? colors.accent : "transparent",
                  color: panelAbierto === tab ? "white" : colors.textMuted,
                  fontSize: "13px"
                }}
              >
                {tab === "canciones" ? `📋 Canciones (${canciones.length})` : editandoId ? "✏️ Editando" : "➕ Nueva"}
              </button>
            ))}
          </div>

          {/* vista toggle */}
          {panelAbierto === "canciones" && (
            <div style={{ display: "flex", gap: 4, background: "rgba(255,255,255,0.05)", borderRadius: 8, padding: 3 }}>
              {(["lista", "grid"] as const).map(v => (
                <button key={v} onClick={() => setVistaLista(v)} style={{
                  ...btnBase, padding: "5px 10px", fontSize: 14,
                  background: vistaLista === v ? "rgba(255,255,255,0.12)" : "transparent",
                  color: vistaLista === v ? colors.text : colors.textMuted
                }}>
                  {v === "lista" ? "☰" : "⊞"}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── FLASH ── */}
      {flashMsg && (
        <div style={{
          position: "fixed", top: 70, left: "50%", transform: "translateX(-50%)",
          background: flashMsg.startsWith("✅") || flashMsg.startsWith("▶")
            ? "rgba(34,197,94,0.15)" : flashMsg.startsWith("❌") || flashMsg.startsWith("⚠️")
            ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
          border: `1px solid ${flashMsg.startsWith("✅") || flashMsg.startsWith("▶") ? "rgba(34,197,94,0.35)" : "rgba(239,68,68,0.35)"}`,
          color: colors.text, padding: "10px 22px", borderRadius: 10,
          fontSize: 14, fontWeight: 600, zIndex: 999,
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          whiteSpace: "nowrap"
        }}>
          {flashMsg}
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>

        {/* ═══════════════ PANEL EDITOR ═══════════════ */}
        {panelAbierto === "editor" && (
          <div ref={editorRef}>

            {/* ── Encabezado editor ── */}
            <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>
                  {editandoId ? "✏️ Editar canción" : "➕ Nueva canción"}
                </div>
                {editandoId && (
                  <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                    Modifica los datos y guarda los cambios
                  </div>
                )}
              </div>
              {editandoId && (
                <button onClick={resetEditor} style={btnSecondary}>
                  ✕ Cancelar edición
                </button>
              )}
            </div>

            {/* ── Metadatos ── */}
            <div style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 14, padding: 20, marginBottom: 20
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted, marginBottom: 16 }}>
                Información de la canción
              </div>

              {/* Título + Número */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={labelStyle}>Título *</label>
                  <input
                    placeholder="Ej: Grande es el Señor"
                    value={titulo}
                    onChange={e => setTitulo(e.target.value)}
                    style={inputStyle}
                  />
                </div>
                <div style={{ minWidth: 90 }}>
                  <label style={labelStyle}>N°</label>
                  <input
                    placeholder="123"
                    value={numero}
                    onChange={e => setNumero(e.target.value)}
                    type="number"
                    style={{ ...inputStyle, width: 90 }}
                  />
                </div>
              </div>

              {/* Autor */}
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Autor / Intérprete</label>
                <input
                  placeholder="Ej: Marcos Witt"
                  value={autor}
                  onChange={e => setAutor(e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Tono + Categoría */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Tono</label>
                  <div style={{ display: "flex", gap: 8 }}>
                    <select value={tono} onChange={e => setTono(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
                      <option value="">Sin tono</option>
                      {TONOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button
                      onClick={detectarTonoDesdePartes}
                      title="Detectar tono automáticamente"
                      style={{ ...btnSecondary, padding: "9px 12px", flexShrink: 0 }}
                    >
                      🎯
                    </button>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Categoría</label>
                  <select
                    value={categoria}
                    onChange={e => setCategoria(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="">Sin categoría</option>
                    {CATEGORIAS_PRESET.map(c => <option key={c} value={c}>{c}</option>)}
                    <option value="__custom__">✏️ Otra categoría...</option>
                  </select>
                  {categoria === "__custom__" && (
                    <input
                      placeholder="Escribe la categoría"
                      value={categoriaCustom}
                      onChange={e => setCategoriaCustom(e.target.value)}
                      style={{ ...inputStyle, marginTop: 8 }}
                    />
                  )}
                </div>
              </div>
            </div>

            {/* ── Partes ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: colors.textMuted }}>
                  Partes de la canción — {partes.length}
                </div>
                <button onClick={agregarParte} style={btnSecondary}>
                  + Agregar parte
                </button>
              </div>

              {partes.map((p, i) => (
                <div key={i} style={{
                  background: colors.surface,
                  border: `1px solid ${vistaPrevia === i ? colors.borderActive : colors.border}`,
                  borderRadius: 14,
                  marginBottom: 12,
                  overflow: "hidden",
                  transition: "border-color 0.2s"
                }}>
                  {/* Cabecera parte */}
                  <div style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 16px",
                    background: "rgba(255,255,255,0.025)",
                    borderBottom: `1px solid ${colors.border}`,
                    flexWrap: "wrap"
                  }}>
                    {/* Orden */}
                    <div style={{
                      width: 26, height: 26, borderRadius: 6,
                      background: "rgba(255,255,255,0.06)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 12, fontWeight: 700, color: colors.textMuted, flexShrink: 0
                    }}>
                      {i + 1}
                    </div>

                    {/* Tipo */}
                    <select
                      value={p.tipo}
                      onChange={e => actualizarParte(i, "tipo", e.target.value)}
                      style={{
                        ...selectStyle,
                        width: "auto",
                        padding: "6px 10px",
                        fontSize: 13,
                        background: tipoBadgeColor[p.tipo] || "rgba(255,255,255,0.06)",
                        color: tipoBadgeText[p.tipo] || colors.text,
                        fontWeight: 700,
                        border: "none"
                      }}
                    >
                      {TIPOS_PARTE.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    {/* Formato */}
                    <select
                      value={p.formato}
                      onChange={e => actualizarParte(i, "formato", e.target.value)}
                      style={{ ...selectStyle, width: "auto", padding: "6px 10px", fontSize: 12 }}
                    >
                      <option value="solo">Solo letra</option>
                      <option value="linea">Acordes arriba</option>
                      <option value="corchetes">Corchetes [Do]</option>
                    </select>

                    {/* Indicador acordes */}
                    {tieneAcordes(p.texto) && (
                      <span style={{
                        background: "rgba(251,191,36,0.12)",
                        border: "1px solid rgba(251,191,36,0.3)",
                        color: colors.gold,
                        borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 700
                      }}>
                        🎸 Con acordes
                      </span>
                    )}

                    {/* Acciones */}
                    <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                      <button
                        onClick={() => setVistaPrevia(vistaPrevia === i ? null : i)}
                        title="Vista previa para músicos"
                        style={{
                          ...btnBase, padding: "5px 10px", fontSize: 12,
                          background: vistaPrevia === i ? colors.accentGlow : "rgba(255,255,255,0.05)",
                          color: vistaPrevia === i ? "#93c5fd" : colors.textMuted,
                          border: `1px solid ${vistaPrevia === i ? colors.borderActive : "transparent"}`
                        }}
                      >
                        👁 Vista
                      </button>
                      <button onClick={() => moverParte(i, -1)} disabled={i === 0} style={{ ...btnBase, padding: "5px 8px", background: "rgba(255,255,255,0.05)", color: colors.textMuted, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                      <button onClick={() => moverParte(i, 1)} disabled={i === partes.length - 1} style={{ ...btnBase, padding: "5px 8px", background: "rgba(255,255,255,0.05)", color: colors.textMuted, opacity: i === partes.length - 1 ? 0.3 : 1 }}>↓</button>
                      <button onClick={() => duplicarParte(i)} title="Duplicar" style={{ ...btnBase, padding: "5px 8px", background: "rgba(255,255,255,0.05)", color: colors.textMuted }}>⧉</button>
                      <button onClick={() => eliminarParte(i)} disabled={partes.length === 1} style={{ ...btnBase, padding: "5px 8px", background: "rgba(239,68,68,0.08)", color: "#fca5a5", opacity: partes.length === 1 ? 0.3 : 1 }}>✕</button>
                    </div>
                  </div>

                  {/* Body parte */}
                  <div style={{ padding: 16, display: vistaPrevia === i ? "grid" : "block", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <textarea
                      value={p.texto}
                      onChange={e => actualizarParte(i, "texto", e.target.value)}
                      placeholder={
                        p.formato === "corchetes"
                          ? "[Do]Canta al Señor [Fa]con alegría\n[Sol]Grande es [Do]su amor"
                          : p.formato === "linea"
                          ? "Do              Fa\nCanta al Señor con alegría"
                          : "Canta al Señor con alegría\nGrande es su amor"
                      }
                      style={{
                        ...inputStyle,
                        minHeight: 160,
                        resize: "vertical",
                        lineHeight: 1.65,
                        fontFamily: "'Courier New', monospace",
                        fontSize: "14px"
                      }}
                    />

                    {/* Vista previa inline */}
                    {vistaPrevia === i && (
                      <div style={{
                        background: "#060d1a",
                        border: `1px solid ${colors.border}`,
                        borderRadius: 10,
                        padding: "14px 16px",
                        minHeight: 160,
                        overflowY: "auto"
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: colors.textMuted, marginBottom: 10 }}>
                          Vista músicos
                        </div>
                        <VistaPrevia texto={p.texto} formato={p.formato} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Acciones guardar ── */}
            <div style={{
              display: "flex", gap: 10, flexWrap: "wrap",
              padding: "16px 20px",
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 14
            }}>
              <button
                onClick={guardarCancion}
                disabled={guardando}
                style={{
                  ...btnPrimary,
                  opacity: guardando ? 0.7 : 1,
                  padding: "11px 24px",
                  fontSize: 14
                }}
              >
                {guardando ? "⏳ Guardando..." : editandoId ? "💾 Actualizar canción" : "💾 Guardar canción"}
              </button>

              {editandoId && (
                <button onClick={resetEditor} style={{ ...btnSecondary, padding: "11px 20px" }}>
                  ✕ Cancelar
                </button>
              )}

              <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button onClick={agregarParte} style={btnSecondary}>+ Parte</button>
                <button onClick={detectarTonoDesdePartes} style={btnSecondary}>🎯 Detectar tono</button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════ PANEL CANCIONES ═══════════════ */}
        {panelAbierto === "canciones" && (
          <div>
            {/* Búsqueda y filtros */}
            <div style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 14, padding: 16, marginBottom: 20
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <input
                  placeholder="🔍  Buscar por título, categoría, tono o número..."
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  style={{ ...inputStyle, fontSize: 16 }}
                />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <select value={filtroTono} onChange={e => setFiltroTono(e.target.value)} style={selectStyle}>
                    <option value="">Todos los tonos</option>
                    {TONOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={selectStyle}>
                    <option value="">Todas categorías</option>
                    {categoriasDisponibles.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
                {(busqueda || filtroTono || filtroCategoria) && (
                  <button onClick={() => { setBusqueda(""); setFiltroTono(""); setFiltroCategoria("") }} style={btnSecondary}>
                    ✕ Limpiar filtros
                  </button>
                )}
              </div>

              {cancionesFiltradas.length !== canciones.length && (
                <div style={{ marginTop: 10, fontSize: 12, color: colors.textMuted }}>
                  Mostrando {cancionesFiltradas.length} de {canciones.length} canciones
                </div>
              )}
            </div>

            {/* Lista */}
            {cancionesFiltradas.length === 0 ? (
              <div style={{
                textAlign: "center", padding: "60px 20px",
                color: colors.textMuted, fontSize: 15
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>🎵</div>
                {canciones.length === 0
                  ? "No hay canciones aún. ¡Crea la primera!"
                  : "No se encontraron canciones con esos filtros."}
              </div>
            ) : vistaLista === "grid" ? (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 12
              }}>
                {cancionesFiltradas.map(c => (
                  <div key={c.id} style={{
                    background: c.id === activaId ? "rgba(34,197,94,0.12)" : colors.card,
                    border: `1px solid ${c.id === activaId ? "rgba(34,197,94,0.4)" : colors.border}`,
                    borderRadius: 12, padding: "14px 16px",
                    display: "flex", flexDirection: "column", gap: 10
                  }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6, lineHeight: 1.3 }}>
                        {c.numero ? <span style={{ color: colors.textMuted, marginRight: 6, fontWeight: 600 }}>{c.numero}.</span> : null}
                        {c.titulo}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {c.categoria && (() => { const col = colorCategoria(c.categoria); return (
                          <span style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}`, borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                            {c.categoria}
                          </span>
                        )})()}
                        {c.tono && (
                          <span style={{ background: "rgba(167,139,250,0.1)", color: "#c4b5fd", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                            {c.tono}
                          </span>
                        )}
                        {idsConAcordes.includes(c.id) && (
                          <span style={{ background: "rgba(251,191,36,0.1)", color: "#fcd34d", borderRadius: 5, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
                            🎸
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => proyectar(c)} style={{ ...btnSuccess, flex: 1, justifyContent: "center" }}>▶</button>
                      <button onClick={() => editarCancion(c)} style={{ ...btnSecondary, flex: 1, justifyContent: "center" }}>✏️</button>
                      <button onClick={() => eliminarCancion(c.id, c.titulo)} style={{ ...btnDanger, padding: "9px 10px" }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {cancionesFiltradas.map(c => (
                  <div key={c.id} style={{
                    background: c.id === activaId ? "rgba(34,197,94,0.1)" : colors.card,
                    border: `1px solid ${c.id === activaId ? "rgba(34,197,94,0.35)" : colors.border}`,
                    borderLeft: c.id === activaId ? "3px solid #22c55e" : `3px solid ${colorCategoria(c.categoria).border}`,
                    borderRadius: 10, padding: "13px 16px",
                    display: "flex", alignItems: "center", gap: 12,
                    transition: "background 0.15s"
                  }}>
                    {/* Número */}
                    {c.numero && (
                      <div style={{
                        minWidth: 34, textAlign: "center",
                        fontSize: 13, fontWeight: 700, color: colors.textMuted,
                        flexShrink: 0
                      }}>
                        {c.numero}
                      </div>
                    )}

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.titulo}
                        {c.id === activaId && (
                          <span style={{
                            marginLeft: 8, fontSize: 10, fontWeight: 700,
                            background: "rgba(34,197,94,0.2)", color: "#86efac",
                            border: "1px solid rgba(34,197,94,0.3)",
                            borderRadius: 4, padding: "1px 6px"
                          }}>EN VIVO</span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {c.categoria && (() => { const col = colorCategoria(c.categoria); return (
                          <span style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}`, borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>
                            {c.categoria}
                          </span>
                        )})()}
                        {c.tono && (
                          <span style={{ background: "rgba(167,139,250,0.1)", color: "#c4b5fd", border: "1px solid rgba(167,139,250,0.25)", borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>
                            {c.tono}
                          </span>
                        )}
                        {idsConAcordes.includes(c.id) && (
                          <span style={{ background: "rgba(251,191,36,0.1)", color: "#fcd34d", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>
                            🎸 Acordes
                          </span>
                        )}
                        {(c as any).autor && (
                          <span style={{ color: colors.textMuted, fontSize: 11 }}>
                            {(c as any).autor}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Acciones — compactas en mobile */}
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      <button onClick={() => proyectar(c)} style={{ ...btnSuccess, padding: "8px 10px", fontSize: 13 }}>▶</button>
                      <button onClick={() => editarCancion(c)} style={{ ...btnSecondary, padding: "8px 10px", fontSize: 13 }}>✏️</button>
                      <button onClick={() => eliminarCancion(c.id, c.titulo)} style={{ ...btnDanger, padding: "8px 10px", fontSize: 13 }}>🗑</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
