"use client"
import OnboardingTour from "@/components/OnboardingTour"
import { getTourCanciones } from "@/lib/tours"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { io } from "socket.io-client"
import { supabase } from "../../lib/supabase"
import { supabaseProbablementeCaido, marcarSupabaseCaido, marcarSupabaseOk } from "../../lib/cache"
import { getIglesiaId, getRolEnIglesia } from "../../lib/getIglesia"
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
  fecha_creacion?: string
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
        actualizarCancion: actualizarCtx, eliminarCancionDelCache, sinConexion } = useApp()
  const [socket, setSocket] = useState<any>(null)
  const [socketConectado, setSocketConectado] = useState<boolean | null>(null)
  const [canciones, setCanciones] = useState<Cancion[]>([])
  const [idsConAcordes, setIdsConAcordes] = useState<string[]>([])
  const [iglesiaId, setIglesiaId] = useState<string | null>(null)
  const [cargando, setCargando] = useState(true)
  // ✅ Solo lider/admin pueden eliminar canciones (verificado también en la
  // BD vía funciones security-definer) — esto solo evita mostrar un botón
  // que igual sería rechazado.
  const [rol, setRol] = useState<string | null>(null)
  const puedeEliminar = rol === "lider" || rol === "admin"
  const [papeleraAbierta, setPapeleraAbierta] = useState(false)
  const [papeleraCanciones, setPapeleraCanciones] = useState<Cancion[]>([])
  const [cargandoPapelera, setCargandoPapelera] = useState(false)

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
  const [modoAcordes, setModoAcordes] = useState<number | null>(null)

  const NOTAS_ACORDES = ["Do","Do#","Reb","Re","Re#","Mib","Mi","Fa","Fa#","Solb","Sol","Sol#","Lab","La","La#","Sib","Si"]
  const SUFIJOS_ACORDES = ["m","7","m7","maj7","dim","sus2","sus4","add9"]

  const insertarAcorde = (parteIdx: number, acorde: string) => {
    const ta = document.getElementById(`ta-parte-${parteIdx}`) as HTMLTextAreaElement
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const texto = ta.value
    const nuevo = texto.slice(0, start) + `[${acorde}]` + texto.slice(end)
    actualizarParte(parteIdx, "texto", nuevo)
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + acorde.length + 2
      ta.focus()
    }, 0)
  }

  const agregarSufijo = (parteIdx: number, sufijo: string) => {
    const ta = document.getElementById(`ta-parte-${parteIdx}`) as HTMLTextAreaElement
    if (!ta) return
    const start = ta.selectionStart
    const before = ta.value.slice(0, start)
    const match = before.match(/\[([A-Za-zÁáÉéÍíÓóÚú#b]+)\]$/)
    if (match) {
      const newBefore = before.slice(0, before.length - match[0].length) + `[${match[1]}${sufijo}]`
      actualizarParte(parteIdx, "texto", newBefore + ta.value.slice(start))
    }
    setTimeout(() => ta.focus(), 0)
  }
  const [guardando, setGuardando] = useState(false)
  const [flashMsg, setFlashMsg] = useState("")
  // ✅ Modal de confirmación propio (antes se usaba window.confirm, que en
  // Electron sale con el estilo feo del sistema operativo).
  const [confirmDialog, setConfirmDialog] = useState<null | {
    mensaje: string; textoOk: string; peligro: boolean; onOk: () => void
  }>(null)

  // ✅ Detectar mobile para ocultar funciones de escritorio (importar PPT)
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  // Lista
  const [busqueda, setBusqueda] = useState("")
  const [busquedaDebounced, setBusquedaDebounced] = useState("")
  const busqTimerRef = useRef<any>(null)
  const handleBusqueda = (v: string) => {
    setBusqueda(v)
    clearTimeout(busqTimerRef.current)
    if (!v) {
      setBusquedaDebounced("")
    } else {
      busqTimerRef.current = setTimeout(() => setBusquedaDebounced(v), 200)
    }
  }
  const [filtroTono, setFiltroTono] = useState("")
  const [filtroCategoria, setFiltroCategoria] = useState("")
  const [filtroConAcordes, setFiltroConAcordes] = useState(false)
  const [ordenar, setOrdenar] = useState<"numero" | "az" | "za" | "reciente" | "antigua">(() =>
    (typeof window !== "undefined" ? localStorage.getItem("canciones-orden") || "numero" : "numero") as any
  )
  const cambiarOrden = (v: "numero" | "az" | "za" | "reciente" | "antigua") => {
    setOrdenar(v); localStorage.setItem("canciones-orden", v)
  }
  const [filtroSinTono,    setFiltroSinTono]    = useState(false)

  useEffect(() => {
    const f = new URLSearchParams(window.location.search).get("filtro") || ""
    if (f === "con-acordes") setFiltroConAcordes(true)
    if (f === "sin-tono")    setFiltroSinTono(true)
  }, [])
  const [activaId, setActivaId] = useState<string | null>(null)
  const [vistaLista, setVistaLista] = useState<"lista" | "grid">("lista")
  const [panelAbierto, setPanelAbierto] = useState<"editor" | "canciones" | "importar">("canciones")
  // ── Importador PPT ───────────────────────────────────────────────────────
  const [pptParsed, setPptParsed] = useState<any[]>([])
  const [convirtiendoPpt, setConvirtiendoPpt] = useState<string | null>(null)  // nombre del archivo que se está convirtiendo
  const [importando, setImportando] = useState(false)
  const [importProgreso, setImportProgreso] = useState(0)
  // ✅ Import masivo: categoría (texto libre, permite crear una nueva como
  // "coritos") y tono para aplicar a todas las canciones marcadas de una vez.
  const [catMasiva, setCatMasiva] = useState("")

  const editorRef = useRef<HTMLDivElement>(null)
  // ✅ Cache local de partes para no repetir queries al editor
  const partesCacheRef = useRef<Map<string, any[]>>(new Map())
  // ✅ Cache de sala para evitar múltiples getIglesiaId() en reconexiones
  const salaRef = useRef<string | null>(null)
  // ✅ El pin_sala en localStorage lo escribe AppContext en segundo plano
  // (fetch async sin esperar) — si el socket conecta antes de que termine,
  // se leía "sin pin" y el servidor podía rechazar la conexión si otro
  // dispositivo ya se había unido con el pin correcto. Se consulta directo
  // a Supabase para no depender de ese timing.
  const pinSalaRef = useRef<string | null | undefined>(undefined)
  const getPinSalaCached = async (igId: string | null): Promise<string | undefined> => {
    if (pinSalaRef.current !== undefined) return pinSalaRef.current || undefined
    if (!igId || igId === "global") return undefined
    try {
      const { data } = await supabase.from("iglesias").select("pin_sala").eq("id", igId).single()
      const pin = data?.pin_sala || null
      pinSalaRef.current = pin
      if (pin) localStorage.setItem("selah-sala-pin", pin)
      return pin || undefined
    } catch {
      return localStorage.getItem("selah-sala-pin") || undefined
    }
  }

  // ── Socket ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = io(getSocketUrl())
    s.on("connect", async () => {
      try {
        if (!salaRef.current) salaRef.current = iglesiaIdCtx || (await getIglesiaId()) || "global"
        const pin = await getPinSalaCached(salaRef.current)
        s.emit("unirse-sala", { sala: salaRef.current, pantalla: "canciones", pin })
        setSocketConectado(true)
      } catch (err) {
        if (process.env.NODE_ENV === "development") console.error("❌ canciones socket connect:", err)
      }
    })
    s.on("disconnect", () => setSocketConectado(false))
    s.on("connect_error", () => setSocketConectado(false))
    s.on("reconnect", () => setSocketConectado(true))
    s.on("cancion-activa", (data: any) => setActivaId(data.id))
    setSocket(s)
    return () => { s.disconnect() }
  }, [])

  // ── Carga inicial ────────────────────────────────────────────────────────────
  useEffect(() => {
    // ✅ activo flag: evita setState post-unmount en el await de getIglesiaId()
    let activo = true
    const init = async () => {
      const id = iglesiaIdCtx || await getIglesiaId()
      if (!activo) return
      setIglesiaId(id)
      if (id) getRolEnIglesia(id).then(r => { if (activo) setRol(r) })

      // ✅ Usar canciones del contexto si ya están cargadas (sin query)
      if (cancionesCtx.length > 0) {
        setCanciones(cancionesCtx as Cancion[])
        // Cargar acordes — si hay filtro "con-acordes" activo, esperar antes de mostrar
        // la lista (evita flash de "0 canciones" mientras acordes cargan)
        const acordesPromise = supabase.from("partes_cancion").select("cancion_id").eq("tiene_acordes", true)
          .then(({ data }) => {
            if (!activo) return
            const ids = Array.from(new Set((data || []).map((p: any) => p.cancion_id).filter(Boolean)))
            setIdsConAcordes(ids)
          })
        if (filtroConAcordes) await acordesPromise
        if (activo) setCargando(false)
        return
      }

      await cargarCanciones(id)
      if (activo) setCargando(false)
    }
    init()
    return () => { activo = false }
  }, [iglesiaIdCtx, cancionesCtx.length])

  const cargarCanciones = async (id?: string | null) => {
    const igId = id ?? iglesiaId
    // ✅ Siempre incluir himnario global (iglesia_id IS NULL) + propias de la iglesia
    const filtro = igId ? `iglesia_id.eq.${igId},iglesia_id.is.null` : null

    // ✅ Supabase corta cada request en 1000 filas del lado del servidor sin
    // importar el .limit() que pidas — hay que paginar con .range() como ya
    // hacen AppContext.cargarCanciones y control/page.tsx._fetchCanciones,
    // si no la lista queda incompleta (se ve como "Canciones (1000)" fijo).
    const PAGINA = 1000
    let todas: any[] = []
    let desde = 0
    let continuar = true
    while (continuar) {
      let query = supabase.from("canciones").select("id, titulo, tono, categoria, iglesia_id, numero, texto_busqueda, fecha_creacion")
      query = filtro ? query.or(filtro) : query.is("iglesia_id", null)
      const { data, error } = await query
        .is("eliminado_en", null)
        .order("numero", { ascending: true, nullsFirst: false })
        .range(desde, desde + PAGINA - 1)
      if (error) { console.error("❌ Error fetch canciones:", error.message); marcarSupabaseCaido(); break }
      if (!data || data.length === 0) break
      todas = todas.concat(data)
      continuar = data.length === PAGINA
      desde += PAGINA
    }
    marcarSupabaseOk()
    setCanciones(todas)
    console.log(`✅ Canciones cargadas: ${todas.length}`)

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

  // ── Conversión automática .ppt → .pptx (solo Electron) ──────────────────
  // Envía el archivo al servidor local embebido (main.js), que usa el
  // PowerPoint instalado del usuario vía PowerShell/COM Automation.
  // Devuelve un File .pptx listo para parsearPPTX, o null si falló.
  const convertirPptAutomatico = async (file: File): Promise<File | null> => {
    try {
      const formData = new FormData()
      formData.append("file", file, file.name)

      const res = await fetch("http://localhost:4000/api/ppt/convertir", {
        method: "POST",
        body: formData
      })

      if (!res.ok) return null

      const blob = await res.blob()
      const nombrePptx = file.name.replace(/\.ppt$/i, ".pptx")
      return new File([blob], nombrePptx, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" })
    } catch (e) {
      console.warn("Conversión automática ppt→pptx falló:", e)
      return null
    }
  }

  // ── Parsear PPTX ────────────────────────────────────────────────────────
  const parsearPPTX = async (file: File): Promise<any | null> => {
    try {
      // ✅ Detectar formato .ppt antiguo (binario, no ZIP)
      const header = await file.slice(0, 8).arrayBuffer()
      const bytes = new Uint8Array(header)
      const isPPT = bytes[0] === 0xD0 && bytes[1] === 0xCF  // Signature OLE
      if (isPPT) {
        const isElectron = typeof navigator !== "undefined" && navigator.userAgent.includes("Electron")

        // ✅ En Electron: intentar conversión automática usando el PowerPoint
        //    que el usuario ya tiene instalado, sin que tenga que hacer nada
        if (isElectron) {
          setConvirtiendoPpt(file.name)
          const convertido = await convertirPptAutomatico(file)
          setConvirtiendoPpt(null)
          if (convertido) {
            file = convertido  // continuar el flujo normal con el .pptx ya convertido
          } else {
            alert(`No se pudo convertir "${file.name}" automáticamente (¿PowerPoint no está instalado?).\n\nAbre el archivo en PowerPoint y usa "Guardar como" → PowerPoint Presentation (*.pptx), luego impórtalo de nuevo.`)
            return null
          }
        } else {
          // Web/APK: no hay forma de convertir desde el navegador
          alert(`El archivo "${file.name}" está en formato .ppt antiguo (PowerPoint 97-2003).\n\nAbre el archivo en PowerPoint y usa "Guardar como" → PowerPoint Presentation (*.pptx), luego impórtalo de nuevo.`)
          return null
        }
      }

      const JSZip = (await import("jszip")).default
      const zip = await JSZip.loadAsync(file)
      const slides: string[] = []

      const slideFiles = Object.keys(zip.files)
        .filter(f => f.match(/^ppt\/slides\/slide(\d+)\.xml$/))
        .sort((a, b) => {
          const na = parseInt(a.match(/slide(\d+)/)?.[1] || "0")
          const nb = parseInt(b.match(/slide(\d+)/)?.[1] || "0")
          return na - nb
        })

      for (const slidePath of slideFiles) {
        const xml = await zip.files[slidePath].async("text")
        const parser = new DOMParser()
        const doc = parser.parseFromString(xml, "text/xml")
        const textNodes = doc.querySelectorAll("t")
        const lines: string[] = []
        let lastP = ""
        textNodes.forEach(t => {
          const parentP = t.closest("a\\:p") || t.parentElement?.closest("[nodeName='a:p']")
          const pKey = parentP?.getAttribute("id") || parentP?.textContent?.slice(0, 20) || ""
          if (pKey !== lastP && lines.length > 0) lines.push("")
          lastP = pKey
          const txt = t.textContent?.trim()
          if (txt) lines.push(txt)
        })
        const texto = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim()
        if (texto) slides.push(texto)
      }

      if (!slides.length) return null

      // ── Detectar formato automáticamente ────────────────────────────────
      // Formato 1: filename = título, todas las slides son partes
      // Formato 2: primera slide = título, el resto son partes
      const norm = (s: string) => s.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[-_\s]+/g, " ").trim()

      const filenameSinExt = norm(file.name.replace(/\.pptx?$/i, ""))
      const primeraSlide   = slides[0]
      const lineasPrimera  = primeraSlide.split("\n").filter(Boolean).length

      // Calcular promedio de líneas de las demás slides
      const avgLineasResto = slides.length > 1
        ? slides.slice(1).reduce((sum, s) => sum + s.split("\n").filter(Boolean).length, 0) / (slides.length - 1)
        : 0

      // Primera slide es título si:
      // a) Su texto ≈ nombre del archivo (misma canción, slide decorativa)
      // b) Tiene pocas líneas (<= 2) y el resto tiene muchas más (>= 3)
      // c) Es muy corta (< 80 chars) y las demás son mucho más largas
      const textoNorm = norm(primeraSlide.replace(/\n/g, " "))
      const esTituloSlide =
        textoNorm === filenameSinExt ||
        filenameSinExt.includes(textoNorm) ||
        textoNorm.includes(filenameSinExt) ||
        (lineasPrimera <= 2 && avgLineasResto >= 3 && primeraSlide.length < 80)

      // ✅ Por defecto el título es el NOMBRE DEL ARCHIVO (así organiza el
      // usuario sus PPT). Antes la heurística de arriba "adivinaba" que la
      // primera diapositiva era el título y se equivocaba, metiendo la primera
      // estrofa como título. Ahora se ignora esa detección para el título por
      // defecto; si un archivo SÍ trae diapositiva de título, el usuario lo
      // cambia por canción con el botón de formato (cambiarFormato → con-titulo,
      // que usa _slides). void esTituloSlide para no dejar la variable sin uso.
      void esTituloSlide
      const titulo = file.name.replace(/\.pptx?$/i, "").replace(/[-_]/g, " ").trim()
      const slidesContenido = slides

      // ── Detectar tipo de cada parte ────────────────────────────────────
      const TIPOS: Record<string, string> = {
        coro: "Coro", estribillo: "Coro", chorus: "Coro", refran: "Coro",
        puente: "Puente", bridge: "Puente",
        "pre-coro": "Pre-coro", pre: "Pre-coro",
        intro: "Intro", final: "Final", tag: "Tag", outro: "Outro"
      }
      let versoN = 1
      const partes = slidesContenido.map(texto => {
        const primerLinea = texto.split("\n")[0].toLowerCase().trim()
        let tipo = "Verso"
        for (const [key, val] of Object.entries(TIPOS)) {
          if (primerLinea === key || primerLinea.startsWith(key + " ") || primerLinea.startsWith(key + ":")) {
            tipo = val; break
          }
        }
        if (tipo === "Verso") tipo = `Verso ${versoN++}`
        return {
          tipo,
          texto: texto.replace(/^(coro|estribillo|puente|bridge|chorus|intro|final|tag|outro|pre-coro|pre)[:\s]*/i, "").trim()
        }
      })

      return {
        titulo, partes, archivo: file.name,
        formatoDetectado: "sin-titulo",  // título = nombre de archivo por defecto
        _slides: slides  // ✅ guardar slides crudos para poder cambiar formato
      }
    } catch (e) {
      console.error("Error parseando PPTX:", e)
      return null
    }
  }

  const procesarArchivos = async (files: FileList, agregar = false) => {
    const resultados: any[] = []
    for (const file of Array.from(files)) {
      if (!file.name.match(/\.pptx?$/i)) continue
      const cancion = await parsearPPTX(file)
      if (!cancion) continue
      // ✅ Detectar duplicado en canciones existentes
      const duplicado = canciones.some(c =>
        c.titulo?.toLowerCase().trim() === cancion.titulo?.toLowerCase().trim()
      )
      resultados.push({
        ...cancion, tono: "", categoria: "himnario",
        seleccionado: true,
        duplicado, // marcar si ya existe
        expandido: false // para edición de partes
      })
    }
    if (resultados.length) {
      // ✅ Agregar a los existentes en vez de reemplazar
      setPptParsed(prev => agregar ? [...prev, ...resultados] : resultados)
      setPanelAbierto("importar")
    }
  }

  const cambiarFormato = (ci: number, nuevoFormato: "con-titulo" | "sin-titulo") => {
    setPptParsed(prev => prev.map((c, i) => {
      if (i !== ci) return c
      const slides: string[] = c._slides || []
      if (!slides.length) return c

      const TIPOS: Record<string, string> = {
        coro: "Coro", estribillo: "Coro", chorus: "Coro", refran: "Coro",
        puente: "Puente", bridge: "Puente", "pre-coro": "Pre-coro", pre: "Pre-coro",
        intro: "Intro", final: "Final", tag: "Tag", outro: "Outro"
      }
      let titulo: string, slidesContenido: string[]

      if (nuevoFormato === "con-titulo") {
        titulo = slides[0].replace(/\n/g, " ").trim()
        slidesContenido = slides.slice(1)
      } else {
        titulo = c.archivo.replace(/\.pptx?$/i, "").replace(/[-_]/g, " ").trim()
        slidesContenido = slides
      }

      let versoN = 1
      const partes = slidesContenido.map(texto => {
        const primerLinea = texto.split("\n")[0].toLowerCase().trim()
        let tipo = "Verso"
        for (const [key, val] of Object.entries(TIPOS)) {
          if (primerLinea === key || primerLinea.startsWith(key + " ") || primerLinea.startsWith(key + ":")) {
            tipo = val; break
          }
        }
        if (tipo === "Verso") tipo = `Verso ${versoN++}`
        return {
          tipo,
          texto: texto.replace(/^(coro|estribillo|puente|bridge|chorus|intro|final|tag|outro|pre-coro|pre)[:\s]*/i, "").trim()
        }
      })

      return { ...c, titulo, partes, formatoDetectado: nuevoFormato }
    }))
  }

  const importarTodo = async () => {
    if (!iglesiaId) return
    if (sinConexion) { flash("⚠️ Sin conexión con el servidor — no se puede importar ahora"); return }
    setImportando(true)
    const seleccionadas = pptParsed.filter(c => c.seleccionado)
    let ok = 0
    let primerError = ""

    // ✅ Número correlativo automático: continúa desde el último número usado
    // considerando TANTO el himnario global (iglesia_id null) COMO las
    // canciones propias de la iglesia. Antes solo miraba las de la iglesia
    // (que estaba vacía → arrancaba en 1) y chocaba con los números del
    // himnario. Ahora las nuevas quedan después del último número del himnario.
    let siguienteNumero = 1
    try {
      const { data: maxRow } = await supabase
        .from("canciones")
        .select("numero")
        .or(`iglesia_id.eq.${iglesiaId},iglesia_id.is.null`)
        .not("numero", "is", null)
        .order("numero", { ascending: false })
        .limit(1)
        .maybeSingle()
      siguienteNumero = ((maxRow?.numero as number) || 0) + 1
    } catch { /* si falla, arranca en 1 */ }

    for (let i = 0; i < seleccionadas.length; i++) {
      const c = seleccionadas[i]
      setImportProgreso(Math.round((i / seleccionadas.length) * 100))
      try {
        const { data, error } = await supabase.from("canciones").insert({
          titulo: (c.titulo || "").trim().toUpperCase(), tono: c.tono || null, categoria: c.categoria || "himnario",
          numero: siguienteNumero, iglesia_id: iglesiaId
        }).select().single()
        // ✅ Antes esto hacía "continue" en silencio: si el insert fallaba (RLS,
        // columna faltante, etc.) saltaba la canción sin avisar y al final decía
        // "importadas" igual. Ahora se guarda el primer error para mostrarlo.
        if (error || !data) { if (!primerError) primerError = error?.message || "no se pudo crear la canción"; continue }
        // ✅ texto_letra faltaba acá (sí está en el guardado manual); si la
        // columna es NOT NULL, el insert de partes fallaba y la canción quedaba
        // sin letra.
        const partesInsert = c.partes.map((p: any, idx: number) => ({
          cancion_id: data.id, tipo: p.tipo, texto: p.texto, texto_letra: p.texto,
          texto_acordes: null, tiene_acordes: false, orden: idx
        }))
        const { error: errorPartes } = await supabase.from("partes_cancion").insert(partesInsert)
        if (errorPartes) { if (!primerError) primerError = errorPartes.message; continue }
        ok++
        siguienteNumero++  // ✅ siguiente canción toma el número siguiente
      } catch (e: any) {
        if (!primerError) primerError = e?.message || "error inesperado"
      }
    }
    setImportProgreso(100)
    setImportando(false)
    setPptParsed([])
    setPanelAbierto("canciones")
    await cargarCanciones(iglesiaId) // ✅ pasar iglesiaId explícito
    if (ok > 0 && !primerError) flash(`✅ ${ok} canciones importadas exitosamente`)
    else if (ok > 0) flash(`⚠️ Se importaron ${ok}, pero otras fallaron: ${primerError}`)
    else flash(`❌ No se pudo importar: ${primerError || "revisa la conexión"}`)
  }

  const flash = (msg: string) => {
    setFlashMsg(msg)
    // ✅ Los errores (❌/⚠️) quedan más tiempo para poder leerlos; los éxitos se van rápido.
    const esError = msg.startsWith("❌") || msg.startsWith("⚠️")
    setTimeout(() => setFlashMsg(""), esError ? 7000 : 2800)
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
    if (sinConexion) { flash("⚠️ Sin conexión con el servidor — no se puede guardar ahora"); return }
    if (!titulo.trim()) { flash("⚠️ El título es obligatorio"); return }
    setGuardando(true)

    const textoCompleto = partes.map(p => p.texto).join(" ")
    const tonoFinal = normalizarAcorde(tono || detectarTono(textoCompleto) || "")

    const datosCancion = {
      titulo: titulo.trim().toUpperCase(),  // ✅ todos los títulos en mayúscula
      autor: autor.trim() || null,
      tono: tonoFinal || null,
      categoria: categoriaFinal || null,
      numero: numero ? parseInt(numero) : null,
      iglesia_id: iglesiaId
    }

    let cancionId = editandoId

    if (editandoId) {
      const { error } = await supabase.from("canciones").update(datosCancion).eq("id", editandoId)
      if (error) { flash("❌ Error actualizando: " + (error.message || "intenta de nuevo")); setGuardando(false); return }
      await supabase.from("partes_cancion").delete().eq("cancion_id", editandoId)
    } else {
      const { data, error } = await supabase.from("canciones").insert(datosCancion).select().single()
      // 🔍 Mostrar el error REAL (antes solo decía "Error creando canción" sin
      // detalle). Con esto se ve si es RLS, columna faltante, numero duplicado, etc.
      if (error || !data) { flash("❌ Error creando canción: " + (error?.message || "intenta de nuevo")); setGuardando(false); return }
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
    if (errorPartes) { flash("❌ Error guardando la letra: " + (errorPartes.message || "intenta de nuevo")); setGuardando(false); return }

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

  const eliminarCancion = (id: string, titulo: string) => {
    if (sinConexion) { flash("⚠️ Sin conexión con el servidor — no se puede eliminar ahora"); return }
    setConfirmDialog({
      mensaje: `¿Enviar "${titulo}" a la papelera? Podrás restaurarla luego desde ahí.`,
      textoOk: "Enviar a papelera", peligro: false,
      onOk: async () => {
        // ✅ Ya no se borra directo — pasa por una función que verifica en la BD
        // que el usuario sea lider/admin y solo la marca como eliminada (soft-delete).
        const { error } = await supabase.rpc("eliminar_cancion_soft", { p_id: id })
        if (error) { flash(`❌ ${error.message || "No se pudo eliminar"}`); return }
        if (editandoId === id) resetEditor()
        flash("🗑️ Enviada a la papelera")
        await cargarCanciones()
        partesCacheRef.current.delete(id) // ✅ Invalidar cache de partes
        eliminarCancionDelCache(id)
      }
    })
  }

  const cargarPapelera = async () => {
    setCargandoPapelera(true)
    try {
      const filtro = iglesiaId ? `iglesia_id.eq.${iglesiaId},iglesia_id.is.null` : null
      let query = supabase.from("canciones").select("id, titulo, tono, categoria, iglesia_id, numero, texto_busqueda, fecha_creacion")
      query = filtro ? query.or(filtro) : query.is("iglesia_id", null)
      const { data, error } = await query.not("eliminado_en", "is", null).order("titulo")
      if (error) { flash(`❌ ${error.message}`); return }
      setPapeleraCanciones((data || []) as Cancion[])
    } finally {
      setCargandoPapelera(false)
    }
  }

  const restaurarCancion = async (id: string, titulo: string) => {
    const { error } = await supabase.rpc("restaurar_cancion", { p_id: id })
    if (error) { flash(`❌ ${error.message || "No se pudo restaurar"}`); return }
    flash(`✅ "${titulo}" restaurada`)
    setPapeleraCanciones(prev => prev.filter(c => c.id !== id))
    await cargarCanciones()
  }

  const purgarCancion = (id: string, titulo: string) => {
    setConfirmDialog({
      mensaje: `¿Eliminar "${titulo}" definitivamente? Esta acción NO se puede deshacer.`,
      textoOk: "Eliminar definitivamente", peligro: true,
      onOk: async () => {
        const { error } = await supabase.rpc("purgar_cancion", { p_id: id })
        if (error) { flash(`❌ ${error.message || "No se pudo eliminar"}`); return }
        flash("🗑️ Eliminada definitivamente")
        setPapeleraCanciones(prev => prev.filter(c => c.id !== id))
      }
    })
  }

  // ✅ La proyección se maneja solo desde Control (flujo real del culto). Antes
  // había un botón "▶" acá que emitía por socket aunque no hubiera conexión y
  // mostraba "Proyectando" sin proyectar nada -- se quitó.

  // ── Filtrado ─────────────────────────────────────────────────────────────────

  const categoriasDisponibles = useMemo(() =>
    Array.from(new Set(canciones.map(c => c.categoria).filter(Boolean))).sort() as string[],
    [canciones]
  )

  const cancionesFiltradas = useMemo(() => {
    const norm = (s: string) => (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    const q = norm(busquedaDebounced.trim())
    const esNumero      = /^\d+$/.test(q)
    const matchNumTexto = q.match(/^(\d+)\s+(.+)$/)
    const numParte      = matchNumTexto?.[1] || ""
    const textoParte    = matchNumTexto?.[2] || ""

    const scored = canciones.map(c => {
      if (!q) return { c, score: 0, pass: true }
      const titulo   = norm(c.titulo)
      const numero   = String(c.numero || "")
      const categoria = norm(c.categoria || "")

      if (matchNumTexto) {
        const numOk    = numero === numParte || numero.startsWith(numParte)
        const tituloOk = titulo.includes(textoParte)
        if (numOk && tituloOk) return { c, score: 100, pass: true }
        if (numOk)             return { c, score: 80,  pass: true }
        if (tituloOk)          return { c, score: 60,  pass: true }
        return { c, score: 0, pass: false }
      }
      if (esNumero) {
        if (numero === q)         return { c, score: 100, pass: true }
        if (numero.startsWith(q)) return { c, score: 80,  pass: true }
        return { c, score: 0, pass: false }
      }
      if (titulo === q)           return { c, score: 100, pass: true }
      if (titulo.startsWith(q))   return { c, score: 90,  pass: true }
      if (titulo.includes(q))     return { c, score: 70,  pass: true }
      if (categoria.includes(q))  return { c, score: 30,  pass: true }
      return { c, score: 0, pass: false }
    })
    .filter(x => x.pass)
    .filter(x => !filtroTono      || x.c.tono === filtroTono)
    .filter(x => !filtroCategoria || x.c.categoria === filtroCategoria)
    .filter(x => !filtroConAcordes || idsConAcordes.includes(x.c.id))
    .filter(x => !filtroSinTono   || !x.c.tono)

    if (q) {
      return scored
        .sort((a, b) => b.score - a.score || (a.c.numero ?? 999999) - (b.c.numero ?? 999999))
        .map(x => x.c)
    }

    return scored.map(x => x.c).sort((a, b) => {
      if (ordenar === "az")       return (a.titulo || "").localeCompare(b.titulo || "")
      if (ordenar === "za")       return (b.titulo || "").localeCompare(a.titulo || "")
      if (ordenar === "reciente") return new Date(b.fecha_creacion || 0).getTime() - new Date(a.fecha_creacion || 0).getTime()
      if (ordenar === "antigua")  return new Date(a.fecha_creacion || 0).getTime() - new Date(b.fecha_creacion || 0).getTime()
      const na = a.numero ?? 999999, nb = b.numero ?? 999999
      if (na !== nb) return na - nb
      return (a.titulo || "").localeCompare(b.titulo || "")
    })
  }, [canciones, busquedaDebounced, filtroTono, filtroCategoria, filtroConAcordes, filtroSinTono, idsConAcordes, ordenar])

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
    <>
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
              <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.2, display: "flex", alignItems: "center", gap: 6 }}>
                Cancionero
                {(socketConectado === false || (socketConectado === null && !!(window as any).Capacitor)) && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 5,
                    background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.25)"
                  }}>● SIN CONEXIÓN</span>
                )}
                {socketConectado === true && (
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 5px", borderRadius: 5,
                    background: "rgba(34,197,94,0.12)", color: "#4ade80", border: "1px solid rgba(34,197,94,0.2)"
                  }}>● EN LÍNEA</span>
                )}
              </div>
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
            {(["canciones", "editor", "importar"] as const)
              // ✅ "Importar PPT" solo en escritorio — requiere sistema de archivos
              .filter(tab => !(tab === "importar" && isMobile))
              .map(tab => (
              <button
                key={tab}
                {...(tab === "editor" ? { "data-tour": "btn-nueva-cancion" } : tab === "importar" ? { "data-tour": "btn-importar-ppt" } : {})}
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
                {tab === "canciones" ? `📋 Canciones (${canciones.length})` : tab === "importar" ? "📤 Importar PPT" : editandoId ? "✏️ Editando" : "➕ Nueva"}
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

          {/* Papelera — solo lider/admin */}
          {puedeEliminar && (
            <button
              onClick={() => { setPapeleraAbierta(true); cargarPapelera() }}
              title="Canciones eliminadas"
              style={{ ...btnBase, padding: "7px 12px", fontSize: 13, background: "rgba(255,255,255,0.05)", color: colors.textMuted, flexShrink: 0 }}
            >🗑 Papelera</button>
          )}
        </div>
      </div>

      {/* ── PAPELERA (modal) ── */}
      {papeleraAbierta && (
        <div onClick={() => setPapeleraAbierta(false)} style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width: "min(560px, 92vw)", maxHeight: "80vh", display: "flex", flexDirection: "column",
            background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 16, overflow: "hidden"
          }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${colors.border}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>🗑 Papelera</div>
              <button onClick={() => setPapeleraAbierta(false)} style={btnSecondary}>✕ Cerrar</button>
            </div>
            <div style={{ overflowY: "auto", padding: 16 }}>
              {cargandoPapelera ? (
                <div style={{ textAlign: "center", padding: 30, color: colors.textMuted }}>Cargando...</div>
              ) : papeleraCanciones.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: colors.textMuted }}>La papelera está vacía.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {papeleraCanciones.map(c => (
                    <div key={c.id} style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                      background: colors.bg, border: `1px solid ${colors.border}`, borderRadius: 10
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.titulo}</div>
                        {c.categoria && <div style={{ fontSize: 11, color: colors.textMuted }}>{c.categoria}</div>}
                      </div>
                      <button onClick={() => restaurarCancion(c.id, c.titulo)} style={{ ...btnSecondary, fontSize: 12, padding: "6px 10px", flexShrink: 0 }}>↩ Restaurar</button>
                      <button onClick={() => purgarCancion(c.id, c.titulo)} style={{ ...btnDanger, fontSize: 12, padding: "6px 10px", flexShrink: 0 }}>Eliminar definitivo</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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

      {/* ── Modal de confirmación (reemplaza window.confirm) ── */}
      {confirmDialog && (
        <div onClick={() => setConfirmDialog(null)} style={{
          position: "fixed", inset: 0, zIndex: 2000,
          background: "rgba(0,0,0,0.6)", display: "flex",
          alignItems: "center", justifyContent: "center", padding: 20
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: colors.surface, border: `1px solid ${colors.border}`,
            borderRadius: 16, padding: 24, maxWidth: 420, width: "100%",
            boxShadow: "0 24px 60px rgba(0,0,0,0.5)"
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: colors.text, lineHeight: 1.6, marginBottom: 20 }}>
              {confirmDialog.mensaje}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmDialog(null)} style={{
                padding: "9px 18px", borderRadius: 10, border: `1px solid ${colors.border}`,
                background: "transparent", color: colors.text, fontSize: 14, fontWeight: 600, cursor: "pointer"
              }}>Cancelar</button>
              <button onClick={() => { const cb = confirmDialog.onOk; setConfirmDialog(null); cb() }} style={{
                padding: "9px 18px", borderRadius: 10, border: "none",
                background: confirmDialog.peligro ? "#dc2626" : "#2563eb",
                color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer"
              }}>{confirmDialog.textoOk}</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 20px" }}>

        {/* ═══════════════ PANEL IMPORTAR PPT ═══════════════ */}
        {/* ✅ Solo se renderiza en escritorio — en mobile no existe el tab */}
        {panelAbierto === "importar" && !isMobile && (
          <div>
            <div style={{ marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700 }}>📤 Importar desde PowerPoint</div>
                <div style={{ fontSize: 13, color: colors.textMuted, marginTop: 4 }}>
                  {pptParsed.length > 0 ? `${pptParsed.length} canción(es) detectadas — revisa y confirma` : "Selecciona uno o varios archivos .pptx"}
                </div>
              </div>
              <button onClick={() => { setPptParsed([]); setPanelAbierto("canciones") }} style={btnSecondary}>
                ✕ Cancelar
              </button>
            </div>

            {/* Banner de conversión automática .ppt → .pptx en progreso */}
            {convirtiendoPpt && (
              <div style={{
                display:"flex", alignItems:"center", gap:10, marginBottom:14,
                padding:"12px 16px", borderRadius:12,
                background:"rgba(251,191,36,0.08)", border:"1px solid rgba(251,191,36,0.25)"
              }}>
                <span style={{ fontSize:18 }}>⏳</span>
                <div style={{ fontSize:13, fontWeight:600 }}>
                  Convirtiendo "{convirtiendoPpt}" con PowerPoint... esto puede tardar unos segundos
                </div>
              </div>
            )}

            {/* Dropzone */}
            {pptParsed.length === 0 && (
              <label
                onDragOver={e => { e.preventDefault(); e.stopPropagation(); (e.currentTarget as HTMLElement).style.borderColor = "#3b82f6"; (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.1)" }}
                onDragLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(59,130,246,0.4)"; (e.currentTarget as HTMLElement).style.background = "rgba(59,130,246,0.04)" }}
                onDrop={e => {
                  e.preventDefault(); e.stopPropagation()
                  const el = e.currentTarget as HTMLElement
                  el.style.borderColor = "rgba(59,130,246,0.4)"; el.style.background = "rgba(59,130,246,0.04)"
                  if (e.dataTransfer.files.length) procesarArchivos(e.dataTransfer.files)
                }}
                style={{
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  border: "2px dashed rgba(59,130,246,0.4)", borderRadius: 16,
                  padding: "60px 20px", cursor: "pointer", gap: 12,
                  background: "rgba(59,130,246,0.04)", transition: "all 0.2s"
                }}>
                <div style={{ fontSize: 48 }}>📊</div>
                <div style={{ fontSize: 18, fontWeight: 700 }}>Arrastra tus archivos .pptx aquí</div>
                <div style={{ fontSize: 13, color: colors.textMuted }}>O haz clic para seleccionar — puedes subir varios a la vez</div>
                <div style={{ fontSize: 12, color: colors.textMuted, opacity: 0.6 }}>Cada archivo = una canción · Cada diapositiva = una parte</div>
                <input type="file" accept=".pptx,.ppt" multiple style={{ display: "none" }}
                  onChange={e => e.target.files && procesarArchivos(e.target.files)} />
              </label>
            )}

            {/* Preview de canciones parseadas */}
            {pptParsed.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {/* ── Acciones masivas (aplican a todas las marcadas) ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.2)", borderRadius: 10, padding: "10px 12px" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#93c5fd" }}>Aplicar a todas las marcadas:</span>
                  {/* Tono masivo */}
                  <select defaultValue="" onChange={e => {
                    const v = e.target.value
                    if (v === "__nada__") return
                    setPptParsed(prev => prev.map(x => x.seleccionado ? { ...x, tono: v === "__sintono__" ? "" : v } : x))
                    e.target.value = "__nada__"
                  }} style={{ ...selectStyle, width: 120 }}>
                    <option value="__nada__">Tono…</option>
                    <option value="__sintono__">Sin tono</option>
                    {TONOS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {/* Categoría masiva (texto libre → permite crear una nueva) */}
                  <input value={catMasiva} onChange={e => setCatMasiva(e.target.value)}
                    placeholder="Categoría (ej: coritos)"
                    style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px", color: "white", fontSize: 13, width: 170 }} />
                  <button onClick={() => {
                    const cat = catMasiva.trim().toLowerCase()
                    if (!cat) return
                    setPptParsed(prev => prev.map(x => x.seleccionado ? { ...x, categoria: cat } : x))
                    flash(`✅ Categoría "${cat}" aplicada a las marcadas`)
                  }} style={{ ...btnSecondary, fontSize: 12, padding: "6px 12px" }}>
                    Aplicar categoría
                  </button>
                </div>

                {pptParsed.map((c, ci) => (
                  <div key={ci} style={{
                    background: colors.surface, borderRadius: 12,
                    border: `1px solid ${c.seleccionado ? "rgba(59,130,246,0.4)" : "rgba(255,255,255,0.06)"}`,
                    overflow: "hidden", opacity: c.seleccionado ? 1 : 0.5
                  }}>
                    {/* Header canción */}
                    <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                      <input type="checkbox" checked={c.seleccionado}
                        onChange={() => setPptParsed(prev => prev.map((x,i) => i===ci ? {...x, seleccionado: !x.seleccionado} : x))}
                        style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 4 }}>
                        <input value={c.titulo}
                          onChange={e => setPptParsed(prev => prev.map((x,i) => i===ci ? {...x, titulo: e.target.value} : x))}
                          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", color: "white", fontSize: 15, fontWeight: 700, width: "100%" }} />
                        {c.duplicado && (
                          <div style={{ fontSize: 11, color: "#fbbf24", background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 6, padding: "3px 8px", display: "inline-flex", gap: 4, alignItems: "center" }}>
                            ⚠️ Ya existe una canción con este nombre — se importará de todas formas si está marcada
                          </div>
                        )}
                        {/* ✅ Toggle de formato */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 11, opacity: 0.4 }}>Formato detectado:</span>
                          <button
                            onClick={() => cambiarFormato(ci, c.formatoDetectado === "con-titulo" ? "sin-titulo" : "con-titulo")}
                            style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, border: "1px solid rgba(99,102,241,0.4)", background: "rgba(99,102,241,0.1)", color: "#a5b4fc", cursor: "pointer" }}
                            title="Cambiar formato de importación">
                            {c.formatoDetectado === "con-titulo"
                              ? "📋 1ª diapositiva = título"
                              : "📄 Nombre de archivo = título"}
                            {" "}↺
                          </button>
                        </div>
                      </div>
                      <select value={c.tono}
                        onChange={e => setPptParsed(prev => prev.map((x,i) => i===ci ? {...x, tono: e.target.value} : x))}
                        style={{ ...selectStyle, width: 100 }}>
                        <option value="">Sin tono</option>
                        {TONOS.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                      <select value={c.categoria}
                        onChange={e => setPptParsed(prev => prev.map((x,i) => i===ci ? {...x, categoria: e.target.value} : x))}
                        style={{ ...selectStyle, width: 130 }}>
                        <option value="himnario">Himnario</option>
                        {["Alabanza","Adoración","Avivamiento","Comunión","Evangelismo","Gratitud","Ofrenda"].map(cat => <option key={cat} value={cat.toLowerCase()}>{cat}</option>)}
                        {/* ✅ categoría personalizada (ej: la aplicada masivamente) que no está en la lista fija */}
                        {c.categoria && !["himnario","alabanza","adoración","avivamiento","comunión","evangelismo","gratitud","ofrenda"].includes(c.categoria) && (
                          <option value={c.categoria}>{c.categoria}</option>
                        )}
                      </select>
                      <button onClick={() => setPptParsed(prev => prev.map((x,i) => i===ci ? {...x, expandido: !x.expandido} : x))}
                        style={{ ...btnSecondary, fontSize: 12, padding: "5px 10px" }}>
                        {c.expandido ? "▲ Ocultar" : "✏️ Editar partes"}
                      </button>
                      <button onClick={() => setPptParsed(prev => prev.filter((_,i) => i !== ci))}
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>
                        🗑
                      </button>
                    </div>

                    {/* Partes — modo chips o edición expandida */}
                    {!c.expandido ? (
                      <div style={{ padding: "10px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
                        {c.partes.map((p: any, pi: number) => (
                          <div key={pi} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                            <div style={{ fontWeight: 700, color: "#93c5fd", marginBottom: 2 }}>{p.tipo}</div>
                            <div style={{ color: colors.textMuted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.texto.split("\n")[0]}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                        {c.partes.map((p: any, pi: number) => (
                          <div key={pi} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.07)", padding: "10px 12px" }}>
                            <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
                              <select value={p.tipo}
                                onChange={e => setPptParsed(prev => prev.map((x,i) => i===ci ? {...x, partes: x.partes.map((pp: any, pj: number) => pj===pi ? {...pp, tipo: e.target.value} : pp)} : x))}
                                style={{ ...selectStyle, width: 130, fontSize: 12 }}>
                                {["Verso 1","Verso 2","Verso 3","Verso 4","Coro","Puente","Estribillo","Intro","Final","Observación"].map(t => <option key={t} value={t}>{t}</option>)}
                              </select>
                              <button onClick={() => setPptParsed(prev => prev.map((x,i) => i===ci ? {...x, partes: x.partes.filter((_: any, pj: number) => pj !== pi)} : x))}
                                style={{ marginLeft: "auto", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#fca5a5", borderRadius: 6, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>
                                Eliminar
                              </button>
                            </div>
                            <textarea value={p.texto} rows={4}
                              onChange={e => setPptParsed(prev => prev.map((x,i) => i===ci ? {...x, partes: x.partes.map((pp: any, pj: number) => pj===pi ? {...pp, texto: e.target.value} : pp)} : x))}
                              style={{ width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "8px 10px", color: "white", fontSize: 13, fontFamily: "monospace", resize: "vertical", boxSizing: "border-box" }} />
                          </div>
                        ))}
                        <button onClick={() => setPptParsed(prev => prev.map((x,i) => i===ci ? {...x, partes: [...x.partes, { tipo: "Verso", texto: "" }]} : x))}
                          style={{ ...btnSecondary, fontSize: 12, alignSelf: "flex-start" }}>
                          + Agregar parte
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Botones acción */}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  <button onClick={importarTodo} disabled={importando || !pptParsed.some(c => c.seleccionado)}
                    style={{ ...btnPrimary, flex: 1, justifyContent: "center", opacity: importando ? 0.7 : 1 }}>
                    {importando ? `⏳ Importando... ${importProgreso}%` : `✅ Importar ${pptParsed.filter(c=>c.seleccionado).length} canciones`}
                  </button>
                  <label style={{ ...btnSecondary, cursor: "pointer" }}>
                    + Agregar más archivos
                    <input type="file" accept=".pptx,.ppt" multiple style={{ display: "none" }}
                      onChange={e => {
                        if (!e.target.files) return
                        procesarArchivos(e.target.files, true) // ✅ agregar=true
                      }} />
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

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
                        onClick={() => setModoAcordes(modoAcordes === i ? null : i)}
                        title="Editor de acordes"
                        style={{
                          ...btnBase, padding: "5px 10px", fontSize: 12,
                          background: modoAcordes === i ? "rgba(251,191,36,0.15)" : "rgba(255,255,255,0.05)",
                          color: modoAcordes === i ? "#fbbf24" : colors.textMuted,
                          border: `1px solid ${modoAcordes === i ? "rgba(251,191,36,0.3)" : "transparent"}`
                        }}
                      >
                        🎸 Acordes
                      </button>
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

                  {/* Teclado de acordes */}
                  {modoAcordes === i && (
                    <div style={{ padding: "10px 16px", borderBottom: `1px solid ${colors.border}`, background: "rgba(251,191,36,0.03)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", marginBottom: 8, letterSpacing: "0.05em" }}>NOTAS</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                        {NOTAS_ACORDES.map(nota => (
                          <button key={nota} type="button"
                            onMouseDown={e => { e.preventDefault(); insertarAcorde(i, nota) }}
                            style={{
                              padding: "5px 10px", borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: "pointer",
                              background: "rgba(251,191,36,0.1)", border: "1px solid rgba(251,191,36,0.25)",
                              color: "#fbbf24"
                            }}>{nota}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#a5b4fc", marginBottom: 6, letterSpacing: "0.05em" }}>MODIFICADORES (aplica al último acorde antes del cursor)</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {SUFIJOS_ACORDES.map(suf => (
                          <button key={suf} type="button"
                            onMouseDown={e => { e.preventDefault(); agregarSufijo(i, suf) }}
                            style={{
                              padding: "5px 10px", borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: "pointer",
                              background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)",
                              color: "#a5b4fc"
                            }}>{suf}</button>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 8, opacity: 0.7 }}>
                        💡 Haz clic en el texto para posicionar el cursor, luego selecciona una nota
                      </div>
                    </div>
                  )}

                  {/* Body parte */}
                  <div style={{ padding: 16, display: vistaPrevia === i ? "grid" : "block", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <textarea
                      id={`ta-parte-${i}`}
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
                {/* Filtros rápidos */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {[
                    { id: "con-acordes", label: "🎸 Con acordes", color: "#a855f7", bg: "rgba(168,85,247,0.12)", border: "rgba(168,85,247,0.35)", activo: filtroConAcordes, toggle: () => setFiltroConAcordes(v => !v) },
                    { id: "sin-tono",    label: "⚠️ Sin tono",    color: "#f59e0b", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.35)", activo: filtroSinTono,    toggle: () => setFiltroSinTono(v => !v) },
                  ].map(({ id, label, color, bg, border, activo, toggle }) => (
                    <button key={id} onClick={toggle} style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                      cursor: "pointer", border: `1px solid ${activo ? border : colors.border}`,
                      background: activo ? bg : "transparent",
                      color: activo ? color : colors.textMuted, transition: "all .15s"
                    }}>
                      {label}
                      {activo && <span style={{ marginLeft: 5, opacity: .7 }}>×</span>}
                    </button>
                  ))}
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    data-tour="buscador-canciones"
                    placeholder="🔍  Buscar por título, categoría, tono o número..."
                    value={busqueda}
                    onChange={e => handleBusqueda(e.target.value)}
                    style={{ ...inputStyle, fontSize: 16, paddingRight: busqueda ? 34 : 14 }}
                  />
                  {busqueda && (
                    <button
                      onClick={() => handleBusqueda("")}
                      aria-label="Limpiar búsqueda"
                      style={{
                        position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
                        width: 24, height: 24, borderRadius: "50%", border: "none",
                        background: "rgba(255,255,255,0.1)", color: colors.textMuted,
                        fontSize: 14, lineHeight: 1, cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}
                    >✕</button>
                  )}
                </div>
                <div data-tour="filtros-rapidos" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div style={{ position: "relative" }}>
                    <select value={filtroTono} onChange={e => setFiltroTono(e.target.value)} style={{ ...selectStyle, paddingRight: filtroTono ? 40 : 14 }}>
                      <option value="">Todos los tonos</option>
                      {TONOS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {filtroTono && (
                      <button
                        onClick={() => setFiltroTono("")}
                        aria-label="Limpiar filtro de tono"
                        style={{
                          position: "absolute", right: 22, top: "50%", transform: "translateY(-50%)",
                          width: 18, height: 18, borderRadius: "50%", border: "none",
                          background: "rgba(255,255,255,0.12)", color: colors.textMuted,
                          fontSize: 11, lineHeight: 1, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                      >✕</button>
                    )}
                  </div>
                  <div style={{ position: "relative" }}>
                    <select value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} style={{ ...selectStyle, paddingRight: filtroCategoria ? 40 : 14 }}>
                      <option value="">Todas categorías</option>
                      {categoriasDisponibles.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    {filtroCategoria && (
                      <button
                        onClick={() => setFiltroCategoria("")}
                        aria-label="Limpiar filtro de categoría"
                        style={{
                          position: "absolute", right: 22, top: "50%", transform: "translateY(-50%)",
                          width: 18, height: 18, borderRadius: "50%", border: "none",
                          background: "rgba(255,255,255,0.12)", color: colors.textMuted,
                          fontSize: 11, lineHeight: 1, cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center"
                        }}
                      >✕</button>
                    )}
                  </div>
                </div>

                {/* ── Ordenar ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, opacity: 0.4, flexShrink: 0 }}>Ordenar:</span>
                  {([
                    { v: "numero",   l: "# Número" },
                    { v: "az",       l: "A → Z" },
                    { v: "za",       l: "Z → A" },
                    { v: "reciente", l: "Más reciente" },
                    { v: "antigua",  l: "Más antigua" },
                  ] as const).map(({ v, l }) => (
                    <button key={v} onClick={() => cambiarOrden(v)} style={{
                      padding: "4px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      cursor: "pointer", border: `1px solid ${ordenar === v ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"}`,
                      background: ordenar === v ? "rgba(59,130,246,0.15)" : "transparent",
                      color: ordenar === v ? "#93c5fd" : colors.textMuted, transition: "all .15s"
                    }}>{l}</button>
                  ))}
                </div>
                {(busqueda || filtroTono || filtroCategoria || filtroConAcordes || filtroSinTono) && (
                  <button onClick={() => { setBusqueda(""); setBusquedaDebounced(""); setFiltroTono(""); setFiltroCategoria(""); setFiltroConAcordes(false); setFiltroSinTono(false) }} style={btnSecondary}>
                    ✕ Limpiar todos los filtros
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
                      <button onClick={() => editarCancion(c)} style={{ ...btnSecondary, flex: 1, justifyContent: "center" }}>✏️</button>
                      {puedeEliminar && (
                        <button onClick={() => eliminarCancion(c.id, c.titulo)} style={{ ...btnDanger, padding: "9px 10px" }}>🗑</button>
                      )}
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
                      <button onClick={() => editarCancion(c)} style={{ ...btnSecondary, padding: "8px 10px", fontSize: 13 }}>✏️</button>
                      {puedeEliminar && (
                        <button onClick={() => eliminarCancion(c.id, c.titulo)} style={{ ...btnDanger, padding: "8px 10px", fontSize: 13 }}>🗑</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
    <OnboardingTour id="tour-canciones" pasos={getTourCanciones(isMobile)} nombrePagina="Canciones" />
  </>
  )
}
